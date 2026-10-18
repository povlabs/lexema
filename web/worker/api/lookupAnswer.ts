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
// A declared lemma (#453, #818) has no record: nothing heads the query, and
// form-of records name it. It is answered with one result per part of speech,
// `declared_lemma`, carrying the forms those records place, laid out as its
// page lays them out (lib/dictionary/declaredLemmaPage.ts), and no definition.
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
import { declaredLemmaHead, entryKey, isFormOfReading, isNameEntry, isVerbReading, isSearchedForm, isWikidataWord, lemmasOfPartOfSpeech, NOTHING_SEARCHED, publicEntryId, searchedSpellings } from "@lexema/lookup/types.ts";
import { wikidataItemUrl } from "@lexema/lookup/names.ts";
import type {
  CitedRevision,
  DeclaredLemmaHead,
  DeclaredLemmaReading,
  DeclaredLemmaResult,
  DeclaredVerbForm,
  FoundResult,
  LemmaTarget,
  NotFoundResult,
  Reading,
  RecoveredDefinition,
  SearchedSpellings,
  SourceForm,
  Translation,
} from "@lexema/lookup/types.ts";
import { conjugationOf, slotOf, type Conjugation, type TableForm } from "@/lib/dictionary/conjugation.ts";
import { declaredTableOf, type DeclaredTable } from "@/lib/dictionary/declaredLemmaPage.ts";
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
import { citedRevisionUrl, lexemePageUrl, sourcePageUrl } from "@/lib/dictionary/sourcePage.ts";
import {
  admits,
  fits,
  narrows,
  type AgreementNarrowing,
  type Languages,
  type LookupFilters,
  type Section,
  type VerbNarrowing,
} from "./lookupFilters.ts";

/** How the query reached a candidate's record, or, `declared_lemma`, that it is a word only form-of records name. */
export type Via = "headword" | "form" | "form_of" | "phrase" | "declared_lemma";

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
    .filter((form) => isSearchedForm(hit, form.ref))
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
          (hit.headword && spelling.headword) || spelling.forms.some((form) => isSearchedForm(hit, form.ref)),
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
 * Where a declared lemma's non-finite form sits, by the slot its gloss names
 * (#818): a finite or imperative slot never reaches the non-finite line.
 */
function declaredNonFinitePlace(form: DeclaredVerbForm): GrammarPlace {
  switch (form.slot.kind) {
    case "gerund":
      return NON_FINITE_PLACE.gerundio;
    case "present-participle":
      return NON_FINITE_PLACE["participio presente"];
    case "past-participle":
      return NON_FINITE_PLACE["participio passato"];
    default:
      return {};
  }
}

/**
 * A conjugation as JSON, narrowed to the cells whose place fits. A tense or a
 * mood the narrowing empties is left out, and a conjugation it empties is
 * still a conjugation, with no moods. `placeOf` says where a non-finite form
 * sits: by its tags for a record's form, by its gloss for a declared lemma's.
 */
function conjugationJson<F extends TableForm>(conjugation: Conjugation<F>, narrowing: VerbNarrowing, placeOf: (form: F) => GrammarPlace): FormsJson {
  if (conjugation.moods.length === 0 && conjugation.nonFinite.length === 0) return null;
  const narrowed = narrows(narrowing);
  const surfaces = (forms: readonly { surface: string }[]) => forms.map((form) => form.surface);
  const nonFinite = conjugation.nonFinite.flatMap((entry) => {
    const kept = narrowed ? entry.forms.filter((form) => fits(placeOf(form), narrowing)) : entry.forms;
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
  if (item.from === "name") return { definition: item.description, labels: [], examples: item.examples, items: [] };
  if (item.from === "lexeme") return { definition: item.gloss.text, labels: [], examples: item.examples, items: [] };
  if (item.from === "page") return { ...recoveredJson(item.definition), examples: item.examples };
  return {
    definition: item.sense.glosses.map((gloss) => gloss.text).join("\n"),
    labels: senseLabels(item.sense.labels.map((label) => label.label)),
    examples: item.examples,
    items: item.sense.recoveredItems.map(recoveredJson),
  };
}

/**
 * The credit every result carries, so a client can pass it on (ADR 0009): the
 * Wiktionary page of the word; for a hand-kept reading, the en.wiktionary
 * revision it cites, under the same licence (ADR 0031, #856); or, for a name
 * entry, its Wikidata item, which is CC0 (ADR 0032).
 */
export type AttributionJson =
  | {
      licence: "CC BY-SA 4.0";
      licence_url: "https://creativecommons.org/licenses/by-sa/4.0/";
      source: "Wikizionario";
      source_url: string;
    }
  | {
      licence: "CC BY-SA 4.0";
      licence_url: "https://creativecommons.org/licenses/by-sa/4.0/";
      source: "Wiktionary";
      source_url: string;
    }
  | {
      licence: "CC0 1.0";
      licence_url: "https://creativecommons.org/publicdomain/zero/1.0/";
      source: "Wikidata";
      source_url: string;
    };

/** The credit of a word's Wiktionary page. */
export const attributionOf = (word: string): AttributionJson => ({
  licence: "CC BY-SA 4.0",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/",
  source: "Wikizionario",
  source_url: sourcePageUrl(word),
});

/**
 * The credit of one entry: the en.wiktionary revision a hand-kept reading
 * cites (#856), its Wikidata item for a name entry, its lexeme for a Wikidata
 * word (ADR 0033), both under CC0, the Wiktionary page of the first record
 * that declares itself a form of a declared lemma's reading (#818), else its
 * word's Wiktionary page. A lookup, a batch lookup and `/exists` each hand it
 * the entry they found, so the three credit one entry alike.
 */
export const entryAttribution = (entry: {
  word: string;
  cites?: CitedRevision;
  nameItem?: `Q${number}`;
  lexeme?: `L${number}`;
  declaredLemma?: Pick<DeclaredLemmaHead, "credit">;
}): AttributionJson => {
  if (entry.declaredLemma !== undefined) return attributionOf(entry.declaredLemma.credit);
  if (entry.cites !== undefined) return citedRevisionAttribution(entry.cites);
  if (entry.nameItem !== undefined) return wikidataAttribution(wikidataItemUrl(entry.nameItem));
  if (entry.lexeme !== undefined) return wikidataAttribution(lexemePageUrl(entry.lexeme));
  return attributionOf(entry.word);
};

/** The credit of the en.wiktionary revision a hand-kept reading cites: where its text came from, under CC BY-SA 4.0 as Wikizionario's is. */
const citedRevisionAttribution = (cites: CitedRevision): AttributionJson => ({
  licence: "CC BY-SA 4.0",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/",
  source: "Wiktionary",
  source_url: citedRevisionUrl(cites),
});

/** The credit of a Wikidata page, which Lexema passes on under CC0 as it received it. */
const wikidataAttribution = (sourceUrl: string): AttributionJson => ({
  licence: "CC0 1.0",
  licence_url: "https://creativecommons.org/publicdomain/zero/1.0/",
  source: "Wikidata",
  source_url: sourceUrl,
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
  translations: TranslationJson[];
}

/**
 * One of the record's own `translations[]` (#739): `lang` is the source's
 * `lang_code`, `word` the translation, and `sense` the source's label for the
 * meaning, verbatim, or null when it gives none.
 */
export interface TranslationJson {
  lang: string;
  word: string;
  sense: string | null;
}

/** A record's translations as JSON, in source order, kept to `languages` when it is given. */
export function translationsJson(translations: readonly Translation[], languages: Languages | undefined): TranslationJson[] {
  return translations
    .filter((translation) => languages === undefined || languages.keeps(translation.langCode))
    .map((translation) => ({ lang: translation.langCode, word: translation.word, sense: translation.sense }));
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
  translations: "translations",
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
  const hit = candidate.hit ?? NOTHING_SEARCHED;
  return { surface: candidate.surface, via: candidate.via, grammar: grammarOf(candidate, hit, layoutOf(candidate.reading, hit)) };
}

/** One candidate as JSON, shaped by the filters that kept it. */
export function resultJson(candidate: Candidate, filters: LookupFilters): ResultJson {
  const { reading } = candidate;
  const hit = candidate.hit ?? NOTHING_SEARCHED;
  const layout = layoutOf(reading, hit);
  const { conjugation, agreement } = layout;
  const grammar = grammarOf(candidate, hit, layout);

  const forms: FormsJson =
    conjugation !== undefined
      ? conjugationJson(conjugation, filters.verb, nonFinitePlace)
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
    translations: translationsJson(reading.translations, filters.languages),
    attribution: entryAttribution(reading),
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

/**
 * One reading of a declared lemma as the core of a result (#818): named by
 * its word and part of speech, never by a record's line, reached as the query
 * itself, placed where its page puts it (a noun's lemma in the singolare cells
 * its plurals give it), and credited to the first record that declares a form.
 */
function declaredCoreJson(reading: DeclaredLemmaReading, releaseId: string, table: DeclaredTable | undefined): ResultCoreJson {
  const head = declaredLemmaHead(reading);
  const headword: SearchedSpellings = { headword: true, forms: new Set() };
  return {
    id: publicEntryId({ releaseId, declaredLemma: head }),
    word: head.word,
    pos: head.pos,
    pos_title: head.posTitle,
    match: { surface: head.word, via: "declared_lemma", grammar: table?.shape === "grid" ? gridPlaces(table.grid, headword, {}) : [] },
    attribution: entryAttribution({ word: head.word, declaredLemma: head }),
  };
}

/**
 * A declared lemma's answer (#818): one result per reading the filters keep,
 * in the lookup's order, each with its forms laid out as its page lays them
 * out (`declaredTableOf`), or null when none takes a cell. It has no record,
 * so every other section is empty: no definition, no pronunciation, nothing
 * Lexema would have to make up.
 */
export function declaredLemmaJson(result: DeclaredLemmaResult, filters: LookupFilters): FoundJson {
  const releaseId = result.release.releaseId;
  return {
    query: result.query.raw,
    release_id: releaseId,
    results: result.readings
      .filter((reading) => admits(filters, { pos: reading.pos, via: "declared_lemma" }))
      .map((reading) => {
        const table = declaredTableOf(reading);
        const forms: FormsJson =
          table === undefined
            ? null
            : table.shape === "conjugation"
              ? conjugationJson(table.conjugation, filters.verb, declaredNonFinitePlace)
              : { type: "gender_number", grid: gridJson(table.grid, filters.agreement), superlativo: null };
        return shaped(
          {
            ...declaredCoreJson(reading, releaseId, table),
            pronunciations: [],
            definitions: [],
            examples: [],
            forms,
            etymology: null,
            synonyms: [],
            antonyms: [],
            derived: [],
            expressions: [],
            translations: [],
          },
          filters,
        );
      }),
  };
}

/** A declared lemma's readings for `/lemmatize`: each is its own lemma (#818). */
export function declaredLemmaLemmas(result: DeclaredLemmaResult): LemmaJson[] {
  return result.readings.map((reading) => {
    const { id, word, pos, pos_title, match, attribution } = declaredCoreJson(reading, result.release.releaseId, declaredTableOf(reading));
    return { id, lemma: word, pos, pos_title, match, attribution };
  });
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

export const idOf = (reading: Reading): string => {
  if (isNameEntry(reading)) return publicEntryId({ releaseId: reading.ref.releaseId, nameItem: reading.nameItem });
  if (isWikidataWord(reading)) return publicEntryId({ releaseId: reading.ref.releaseId, lexeme: reading.lexeme });
  const { recordId, ref } = reading;
  return publicEntryId(
    recordId === undefined
      ? { releaseId: ref.releaseId, revisionId: ref.revisionId, pageLine: ref.line }
      : { releaseId: ref.releaseId, lineNo: ref.lineNo },
  );
};

export function lemmaJson(candidate: Candidate): LemmaJson {
  const { reading } = candidate;
  return {
    id: idOf(reading),
    lemma: reading.word,
    pos: reading.pos,
    pos_title: reading.posTitle,
    match: matchOf(candidate),
    attribution: entryAttribution(reading),
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
  const layout = layoutOf(reading, NOTHING_SEARCHED);
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
