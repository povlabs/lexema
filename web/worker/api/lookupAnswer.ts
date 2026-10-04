// What `GET /v1/lookup` on api.lexema.fyi answers (#150): every candidate the
// lookup returns, as JSON in the shape #148's brief draws.
//
// A candidate is a record and how the query reached it:
//
// - `headword`: the record is about the query (`sale` the salt noun).
// - `form`: the record lists the query in its own table and is nobody's lemma
//   here (`bellissimo` for `bella`).
// - `form_of`: the record the query's form-of record names as its lemma
//   (`andare` for `andavano`). This is the one-call form-to-lemma answer: the
//   lemma's own definitions and forms, with the query's place in its table.
// - `phrase`: nothing spells the query, and it is a multi-word headword its
//   words spell as their lemmas (`andare via` for `vado via`, #214). Its
//   surface is the query as typed, and it has no place in any table.
//
// Nothing here ranks or places anew. Definitions are the page's list
// (lib/dictionary/definitions.ts), a verb's forms are the page's conjugation
// (lib/dictionary/conjugation.ts) and a noun's or adjective's are the page's grid
// (lib/dictionary/genderGrid.ts). The grammar of a match is the cell those put it in,
// with the page's Italian labels (ADR 0015).
//
// The filters (#151, ./lookupFilters.ts) choose among these candidates and
// narrow what each carries; they never reorder them.

import { normalizeItalianExact } from "@lexema/italian/normalize.ts";
import { expressionMeaning } from "@lexema/lookup/expressions.ts";
import { bareKey, type Nearby } from "@lexema/lookup/nearby.ts";
import type { PhraseOffer } from "@lexema/lookup/phrase.ts";
import { entryKey, isFormOfReading, isVerbReading, lemmasOfPartOfSpeech, publicEntryId, searchedSpellings, sourcePointerOf } from "@lexema/lookup/types.ts";
import type {
  FoundResult,
  LemmaTarget,
  NotFoundResult,
  Reading,
  RecoveredDefinition,
  SearchedSpellings,
  SourceForm,
} from "@lexema/lookup/types.ts";
import { conjugationOf, slotOf, type Conjugation } from "@/lib/dictionary/conjugation.ts";
import { definitionsOf, senseLabels, type DefinitionItem } from "@/lib/dictionary/definitions.ts";
import {
  agreementOf,
  type Agreement,
  gendersOf,
  GENDER_LABEL,
  NUMBERS,
  NUMBER_LABEL,
  numbersOf,
  type Grid,
} from "@/lib/dictionary/genderGrid.ts";
import { sourcePageUrl } from "@/lib/dictionary/sourcePage.ts";
import {
  admits,
  fits,
  narrows,
  type AgreementNarrowing,
  type LookupFilters,
  type Section,
  type VerbNarrowing,
} from "./lookupFilters.ts";

/** How the query reached a candidate's record. */
export type Via = "headword" | "form" | "form_of" | "phrase";

/**
 * One candidate: the record answered with, and how the query reached it. A
 * `form_of` candidate carries where its lemma's table spells the query, when
 * it does, and the form-of record it was reached through otherwise. Nothing
 * of a `phrase` candidate's table was searched, so it carries no hit.
 */
export type Candidate =
  | { via: "headword" | "form"; reading: Reading; surface: string; hit: SearchedSpellings }
  | { via: "form_of"; reading: Reading; surface: string; hit: SearchedSpellings | undefined; formOf: Reading }
  | { via: "phrase"; reading: Reading; surface: string; hit?: never };

/** Finds the lemma a form-of record names, as a reading of its own. */
export type LemmaReader = (lemma: LemmaTarget) => Promise<Reading | undefined>;

/** The first spelling of the query the reading carries, as the source spells it. */
function surfaceOn(reading: Reading): string {
  return reading.evidence[0]?.surface ?? reading.word;
}

/** Every candidate of a found lookup, in the lookup's order, each record once. */
export async function candidatesOf(result: FoundResult, readLemma: LemmaReader): Promise<Candidate[]> {
  if (result.route.kind === "phrase") return phraseCandidates(result);
  const candidates: Candidate[] = [];
  for (const reading of result.readings) {
    const lemmas = isFormOfReading(reading) ? lemmasOfPartOfSpeech(reading.pos, reading.lemmaLinks) : [];
    if (lemmas.length === 0) {
      candidates.push({
        via: reading.isAboutQuery ? "headword" : "form",
        reading,
        surface: surfaceOn(reading),
        hit: searchedSpellings(reading),
      });
      continue;
    }
    for (const lemma of lemmas) {
      const lemmaReading = await readLemma(lemma);
      if (lemmaReading === undefined) throw new Error(`lemma record ${lemma.recordId} (${lemma.word}) could not be read`);
      candidates.push({
        via: "form_of",
        reading: lemmaReading,
        surface: lemma.listing?.evidence[0].surface ?? surfaceOn(reading),
        hit: lemma.listing === undefined ? undefined : searchedSpellings(lemma.listing),
        formOf: reading,
      });
    }
  }
  const seen = new Set<string>();
  return candidates.filter((candidate) => !seen.has(entryKey(candidate.reading)) && seen.add(entryKey(candidate.reading)));
}

/** Each record of the multi-word headwords the query's words spell, the query as typed its surface. */
function phraseCandidates(result: FoundResult): Candidate[] {
  return result.readings.map((reading) => ({ via: "phrase", reading, surface: result.query.raw.trim() }));
}

/** One place a matched form fills, in Italian labels: a cell of a conjugation or of a grid. */
export type GrammarPlace = Partial<Record<"mood" | "tense" | "person" | "gender" | "number" | "degree", string>>;

const NON_FINITE_PLACE: Record<string, GrammarPlace> = {
  infinito: { mood: "infinito" },
  gerundio: { mood: "gerundio" },
  "participio presente": { mood: "participio", tense: "presente" },
  "participio passato": { mood: "participio", tense: "passato" },
  participio: { mood: "participio" },
};

/** Where each searched form of a verb sits in its conjugation, in source order. */
function conjugationPlaces(reading: Reading, hit: SearchedSpellings, conjugation: Conjugation): GrammarPlace[] {
  return reading.forms
    .filter((form) => hit.formPointers.has(sourcePointerOf(form.ref) ?? ""))
    .flatMap((form): GrammarPlace[] => {
      const slot = slotOf(form);
      if (slot.kind === "non-finite") return [NON_FINITE_PLACE[slot.role]];
      for (const table of conjugation.moods) {
        for (const tense of [...table.simple, ...table.compound]) {
          const at = tense.cells.findIndex((cell) => cell.forms.includes(form));
          if (at !== -1) return [{ mood: table.mood.toLowerCase(), tense: tense.name, person: table.persons[at] }];
        }
      }
      return [];
    });
}

/** Every cell of a grid the query's spellings sit in. */
function gridPlaces(grid: Grid | undefined, hit: SearchedSpellings, degree: GrammarPlace): GrammarPlace[] {
  return (grid?.rows ?? []).flatMap((row) =>
    row.cells.flatMap((cell, n) =>
      cell.spellings.some(
        (spelling) =>
          (hit.headword && spelling.headword) || spelling.forms.some((form) => hit.formPointers.has(sourcePointerOf(form.ref) ?? "")),
      )
        ? [{ gender: GENDER_LABEL[row.gender], number: NUMBER_LABEL[NUMBERS[n]], ...degree }]
        : [],
    ),
  );
}

/** A form-of record's own gender and number, for a lemma whose table does not spell the query. */
function statedPlaces(formOf: Reading): GrammarPlace[] {
  const claims = formOf.grammar.record;
  return gendersOf(claims).flatMap((gender) =>
    numbersOf(claims).map((number) => ({ gender: GENDER_LABEL[gender], number: NUMBER_LABEL[number] })),
  );
}

/** A grid's rows and columns; a narrowed grid carries only the ones its narrowing keeps. */
type GridJson = Partial<Record<"maschile" | "femminile", Partial<Record<"singolare" | "plurale", string[]>>>>;

/** A verb's conjugation, or a noun's or adjective's grid, or null when the reading places no form. */
export type FormsJson =
  | ({ type: "conjugation"; moods: Record<string, Record<string, Record<string, string[]>>> } & Partial<
      Record<Conjugation["nonFinite"][number]["label"], string[]>
    >)
  | { type: "gender_number"; grid: GridJson; superlativo: GridJson | null }
  | null;

function gridJson(grid: Grid, narrowing: AgreementNarrowing): GridJson {
  return Object.fromEntries(
    grid.rows.flatMap((row) => {
      const gender = GENDER_LABEL[row.gender];
      const cells = row.cells.flatMap((cell, n) => {
        const number = NUMBER_LABEL[NUMBERS[n]];
        return fits({ gender, number }, narrowing) ? [[number, cell.spellings.map((spelling) => spelling.surface)]] : [];
      });
      return cells.length === 0 ? [] : [[gender, Object.fromEntries(cells)]];
    }),
  );
}

/** Where a non-finite form sits; the ausiliare sits nowhere, so any narrowing drops it. */
function nonFinitePlace(form: SourceForm): GrammarPlace {
  const slot = slotOf(form);
  return slot.kind === "non-finite" ? NON_FINITE_PLACE[slot.role] : {};
}

/**
 * A conjugation as JSON, narrowed to the cells whose place fits. A tense or a
 * mood the narrowing empties is left out, and a conjugation it empties is
 * still a conjugation, with no moods.
 */
function conjugationJson(conjugation: Conjugation, narrowing: VerbNarrowing): FormsJson {
  if (conjugation.moods.length === 0 && conjugation.nonFinite.length === 0) return null;
  const narrowed = narrows(narrowing);
  const surfaces = (forms: readonly { surface: string }[]) => forms.map((form) => form.surface);
  const nonFinite = conjugation.nonFinite.flatMap((entry) => {
    const kept = narrowed ? entry.forms.filter((form) => fits(nonFinitePlace(form), narrowing)) : entry.forms;
    return kept.length === 0 ? [] : [[entry.label, surfaces(kept)]];
  });
  const moods = conjugation.moods.flatMap((table) => {
    const mood = table.mood.toLowerCase();
    const tenses = [...table.simple, ...table.compound].flatMap((tense) => {
      const cells = tense.cells.flatMap((cell, i) => {
        const person = table.persons[i];
        return cell.forms.length > 0 && fits({ mood, tense: tense.name, person }, narrowing)
          ? [[person, surfaces(cell.forms)]]
          : [];
      });
      return cells.length === 0 && narrowed ? [] : [[tense.name, Object.fromEntries(cells)]];
    });
    return tenses.length === 0 && narrowed ? [] : [[mood, Object.fromEntries(tenses)]];
  });
  return { type: "conjugation", ...Object.fromEntries(nonFinite), moods: Object.fromEntries(moods) };
}

/** One definition as the API returns it; nested items are the recovered list it opens. */
export interface DefinitionJson {
  definition: string;
  labels: string[];
  examples: string[];
  items: DefinitionJson[];
}

function recoveredJson(definition: RecoveredDefinition): DefinitionJson {
  return {
    definition: definition.text,
    labels: definition.labels,
    examples: definition.examples.map((example) => example.text),
    items: definition.items.map(recoveredJson),
  };
}

function definitionJson(item: DefinitionItem): DefinitionJson {
  if (item.from === "page") return { ...recoveredJson(item.definition), examples: item.examples };
  return {
    definition: item.sense.glosses.map((gloss) => gloss.text).join("\n"),
    labels: senseLabels(item.sense.labels.map((label) => label.label)),
    examples: item.examples,
    items: item.sense.recoveredItems.map(recoveredJson),
  };
}

/** The credit every result carries, so a client can pass it on (ADR 0009). */
export interface AttributionJson {
  licence: "CC BY-SA 4.0";
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/";
  source: "Wikizionario";
  source_url: string;
}

export const attributionOf = (word: string): AttributionJson => ({
  licence: "CC BY-SA 4.0",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/",
  source: "Wikizionario",
  source_url: sourcePageUrl(word),
});

/** What every result carries, whatever `fields` asks for. */
export interface ResultCoreJson {
  /** Archive release/line, or release/page revision for a page-only entry. */
  id: string;
  word: string;
  pos: string;
  pos_title: string;
  match: { surface: string; via: Via; grammar: GrammarPlace[] };
  attribution: AttributionJson;
}

/** The sections `fields` chooses among, by the name each has in a result. */
export interface SectionsJson {
  pronunciations: { ipa: string; note: string | null }[];
  definitions: DefinitionJson[];
  /** Examples of senses that are not definitions, as the page shows them after the list. */
  examples: string[];
  forms: FormsJson;
  etymology: string | null;
  synonyms: string[];
  antonyms: string[];
  derived: string[];
  expressions: ExpressionJson[];
}

/**
 * One row of the record's *Expressions*, as the page lists it (#213): the
 * phrase under the four rules of ADR 0019, its meanings joined by "; " or
 * null, and whether the phrase is an Italian headword of its own.
 */
export interface ExpressionJson {
  phrase: string;
  meaning: string | null;
  has_entry: boolean;
}

/** One result: every section, or the ones `fields` named. */
export type ResultJson = ResultCoreJson & Partial<SectionsJson>;

/** The key each `fields` name selects in a result. */
export const SECTION_KEY: Record<Section, keyof SectionsJson> = {
  definitions: "definitions",
  examples: "examples",
  forms: "forms",
  etymology: "etymology",
  synonyms: "synonyms",
  antonyms: "antonyms",
  derived: "derived",
  pronunciation: "pronunciations",
  expressions: "expressions",
};

/** A result with only the sections `fields` names, and its definitions capped at `limit_definitions`. */
function shaped(result: ResultCoreJson & SectionsJson, filters: LookupFilters): ResultJson {
  const definitions =
    filters.limitDefinitions === undefined ? result.definitions : result.definitions.slice(0, filters.limitDefinitions);
  const full: ResultJson = { ...result, definitions };
  if (filters.fields === undefined) return full;
  const dropped = new Set<string>(Object.values(SECTION_KEY));
  for (const field of filters.fields) dropped.delete(SECTION_KEY[field]);
  return Object.fromEntries(Object.entries(full).filter(([key]) => !dropped.has(key))) as ResultJson;
}

const NO_HIT: SearchedSpellings = { headword: false, formPointers: new Set<string>() };

/** A reading's forms as the page lays them out: a verb's conjugation, or anything else's grids. */
type Layout = { conjugation: Conjugation; agreement?: never } | { conjugation?: never; agreement: Agreement };

function layoutOf(reading: Reading, hit: SearchedSpellings): Layout {
  return isVerbReading(reading) ? { conjugation: conjugationOf(reading.forms, hit) } : { agreement: agreementOf(reading) };
}

/** Where the query sits in the candidate's forms. */
function grammarOf(candidate: Candidate, hit: SearchedSpellings, layout: Layout): GrammarPlace[] {
  if (candidate.via === "phrase") return [];
  if (candidate.via === "form_of" && candidate.hit === undefined) return statedPlaces(candidate.formOf);
  if (layout.conjugation !== undefined) return conjugationPlaces(candidate.reading, hit, layout.conjugation);
  return [
    ...gridPlaces(layout.agreement.grid, hit, {}),
    ...gridPlaces(layout.agreement.superlative, hit, { degree: "superlativo" }),
  ];
}

/** How the query reached a candidate: the spelling matched, the route, and its places in the forms. */
export function matchOf(candidate: Candidate): ResultCoreJson["match"] {
  const hit = candidate.hit ?? NO_HIT;
  return { surface: candidate.surface, via: candidate.via, grammar: grammarOf(candidate, hit, layoutOf(candidate.reading, hit)) };
}

/** One candidate as JSON, shaped by the filters that kept it. */
export function resultJson(candidate: Candidate, filters: LookupFilters): ResultJson {
  const { reading } = candidate;
  const hit = candidate.hit ?? NO_HIT;
  const layout = layoutOf(reading, hit);
  const { conjugation, agreement } = layout;
  const grammar = grammarOf(candidate, hit, layout);

  const forms: FormsJson =
    conjugation !== undefined
      ? conjugationJson(conjugation, filters.verb)
      : agreement?.grid !== undefined || agreement?.superlative !== undefined
        ? {
            type: "gender_number",
            grid: agreement.grid === undefined ? {} : gridJson(agreement.grid, filters.agreement),
            superlativo: agreement.superlative === undefined ? null : gridJson(agreement.superlative, filters.agreement),
          }
        : null;

  const { items, looseExamples } = definitionsOf(reading);
  const facts = reading.wordFacts;
  const result: ResultCoreJson & SectionsJson = {
    id: idOf(reading),
    word: reading.word,
    pos: reading.pos,
    pos_title: reading.posTitle,
    match: { surface: candidate.surface, via: candidate.via, grammar },
    pronunciations: facts.pronunciations.map((sound) => ({ ipa: sound.ipa, note: sound.note })),
    definitions: items.map(definitionJson),
    examples: looseExamples,
    forms,
    etymology: facts.etymologies.length === 0 ? null : facts.etymologies.map((text) => text.text).join("\n"),
    synonyms: facts.synonyms.map((word) => word.word),
    antonyms: facts.antonyms.map((word) => word.word),
    derived: facts.derived.map((word) => word.word),
    expressions: facts.expressions.map((expression) => ({
      phrase: expression.phrase,
      meaning: expressionMeaning(expression),
      has_entry: expression.hasEntry,
    })),
    attribution: attributionOf(reading.word),
  };
  return shaped(result, filters);
}

/**
 * What the not-found answer offers: `findNearby`'s spellings in its order, its
 * `typo` called `edit`, and the query corrected so that it reads as a
 * multi-word headword called `phrase`.
 */
export type SuggestionKind = "accent" | "edit" | "phrase" | "prefix";

/**
 * One offer, and the Wikizionario page its word comes from: its own for a
 * spelling, and the first headword it reaches for a `phrase`, whose words
 * (`vado via`) have no page of their own.
 */
export interface Suggestion {
  word: string;
  kind: SuggestionKind;
  page: string;
}

const spelling = (word: string, kind: Exclude<SuggestionKind, "phrase">): Suggestion => ({ word, kind, page: word });

const phraseSuggestions = (offers: readonly PhraseOffer[]): Suggestion[] =>
  offers.map((offer) => ({ word: offer.phrase, kind: "phrase", page: offer.headwords[0] }));

/**
 * `findNearby`'s offer as a list. After an accent match it also lists the
 * words that begin with the query (`others`), so each of those is told apart
 * by whether it is the query's letters with other accents or a final
 * apostrophe, which is the test the accent step itself makes (`bareKey`). The
 * phrases follow an accent or a typo offer.
 */
export function suggestionsOf(nearby: Nearby, query: string): Suggestion[] {
  switch (nearby.kind) {
    case "accent": {
      const bare = bareKey(normalizeItalianExact(query));
      return [
        ...[nearby.best, ...nearby.others].map((word) =>
          spelling(word, bareKey(normalizeItalianExact(word)) === bare ? "accent" : "prefix"),
        ),
        ...phraseSuggestions(nearby.phrases),
      ];
    }
    case "typo":
      return [...[nearby.best, ...nearby.others].map((word) => spelling(word, "edit")), ...phraseSuggestions(nearby.phrases)];
    case "phrase":
      return phraseSuggestions([nearby.best, ...nearby.others]);
    case "prefix":
      return nearby.words.map((word) => spelling(word, "prefix"));
    case "none":
      return [];
  }
}

export interface FoundJson {
  query: string;
  release_id: string;
  results: ResultJson[];
}

export interface NotFoundJson {
  query: string;
  release_id: string;
  results: [];
  suggestions: { word: string; kind: SuggestionKind }[];
}

/**
 * A found word's answer: the candidates `pos` and `match` keep, in the
 * lookup's order, each shaped by the other filters. Filters that keep no
 * candidate leave `results` empty; the word was still found.
 */
export async function foundJson(result: FoundResult, readLemma: LemmaReader, filters: LookupFilters): Promise<FoundJson> {
  const candidates = await candidatesOf(result, readLemma);
  return {
    query: result.query.raw,
    release_id: result.release.releaseId,
    results: candidates
      .filter((candidate) => admits(filters, { pos: candidate.reading.pos, via: candidate.via }))
      .map((candidate) => resultJson(candidate, filters)),
  };
}

export function notFoundJson(result: NotFoundResult, nearby: Nearby): NotFoundJson {
  return {
    query: result.query.raw,
    release_id: result.release.releaseId,
    results: [],
    suggestions: suggestionsOf(nearby, result.query.raw).map(({ word, kind }) => ({ word, kind })),
  };
}

/** A candidate for `/lemmatize`: the lookup's core without any section. */
export interface LemmaJson {
  id: string;
  lemma: string;
  pos: string;
  pos_title: string;
  match: ResultCoreJson["match"];
  attribution: AttributionJson;
}

export const idOf = ({ recordId, ref }: Reading): string => publicEntryId(
  recordId === undefined
    ? { releaseId: ref.releaseId, revisionId: ref.revisionId, pageLine: ref.line }
    : { releaseId: ref.releaseId, lineNo: ref.lineNo },
);

export function lemmaJson(candidate: Candidate): LemmaJson {
  const { reading } = candidate;
  return {
    id: idOf(reading),
    lemma: reading.word,
    pos: reading.pos,
    pos_title: reading.posTitle,
    match: matchOf(candidate),
    attribution: attributionOf(reading.word),
  };
}

/** One cell of a reading's forms: its place, in Italian labels, and every spelling filed there. */
export interface InflectionJson {
  grammar: GrammarPlace;
  forms: string[];
}

/**
 * Every cell of a reading's forms, in the page's order: a verb's non-finite
 * forms, then each mood's tenses and persons; anything else's grid, then its
 * superlativo. A cell is placed exactly as `/lookup` places a match, so a
 * form `/inflect` returns is one `/lookup` reports at the same place. The
 * ausiliare is a fact about the verb, not one of its forms, so it is no cell.
 */
export function inflectionsOf(reading: Reading): InflectionJson[] {
  const layout = layoutOf(reading, NO_HIT);
  if (layout.conjugation === undefined) {
    const { grid, superlative } = layout.agreement;
    return [...gridInflections(grid, {}), ...gridInflections(superlative, { degree: "superlativo" })];
  }
  const nonFinite = new Map<string, InflectionJson>();
  for (const entry of layout.conjugation.nonFinite) {
    for (const form of entry.forms) {
      const grammar = nonFinitePlace(form);
      if (Object.keys(grammar).length === 0) continue;
      const key = JSON.stringify(grammar);
      const cell = nonFinite.get(key) ?? { grammar, forms: [] };
      cell.forms.push(form.surface);
      nonFinite.set(key, cell);
    }
  }
  const finite = layout.conjugation.moods.flatMap((table) =>
    [...table.simple, ...table.compound].flatMap((tense) =>
      tense.cells.flatMap((cell, i) =>
        cell.forms.length === 0
          ? []
          : [
              {
                grammar: { mood: table.mood.toLowerCase(), tense: tense.name, person: table.persons[i] },
                forms: cell.forms.map((form) => form.surface),
              },
            ],
      ),
    ),
  );
  return [...nonFinite.values(), ...finite];
}

function gridInflections(grid: Grid | undefined, degree: GrammarPlace): InflectionJson[] {
  return (grid?.rows ?? []).flatMap((row) =>
    row.cells.flatMap((cell, n) =>
      cell.spellings.length === 0
        ? []
        : [
            {
              grammar: { gender: GENDER_LABEL[row.gender], number: NUMBER_LABEL[NUMBERS[n]], ...degree },
              forms: cell.spellings.map((spelling) => spelling.surface),
            },
          ],
    ),
  );
}
