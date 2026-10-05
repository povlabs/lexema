// What one word's page is made of, decided before anything renders.
//
// A lookup returns every record the query matches. Some are *about* the
// searched word (`isAboutQuery`); some merely list it in their own table. Each
// is a reading on the page except two kinds of form, each found only through
// declared `form_of` edges and matched by identity:
//
// - A form of the query's own readings: a record that only lists the query and
//   declares itself a form of a reading about it, or of a record already left
//   out this way (`formsOfQueryReadings`). `bello` does not repeat `bella`,
//   `belli` and `bellissimo` as readings, since its own reading already shows
//   their table (Huey, 2026-10-05, on #622).
// - Another form of the query's own lemma: a record that only lists the query
//   and declares itself a form of a lemma a reading about the query is a form
//   of, or of a record already left out this way (`otherFormsOfQueryLemmas`).
//   `bella` does not show `belli`, `belle` and `bellissimo` as readings, since
//   they are forms of `bello`, as `bella` is (Huey, 2026-10-05, on #626: "bella
//   is the same as bello").
//
// A record that lists the query and declares no such form is still a reading.
//
// A form reading carries its lemma's table when that table lists the query, the
// way the lemma's own page draws it: `andavano` shows *Forms of andare*, the
// conjugation, and `bella` the adjective shows *Forms of bello*, the gender and
// number grid, in place of its own (#626). The lookup does not return the lemma
// as a record of its own, so nothing is counted twice: the readings are the
// lookup's records, and the tables are their lemmas'. A verb's table comes with
// the lookup; a grid needs the lemma's whole record, which the search reads for
// the words `gridLemmaWords` names (web/lib/dictionary/searchAttempt.ts).

import { normalizeItalianExact } from "@lexema/italian/normalize.ts";
import { mergeExpressions } from "@lexema/lookup/expressions.ts";
import {
  entryKey,
  factRefKey,
  formsOfQueryReadings,
  isAdjectiveReading,
  isFormOfReading,
  isNounReading,
  isVerbReading,
  lemmasOfPartOfSpeech,
  otherFormsOfQueryLemmas,
  searchedSpellings,
  sourcePointerOf,
} from "@lexema/lookup/types.ts";
import { hasDefinitions } from "./definitions.ts";
import { agreementOf, type Agreement, type Spelling } from "./genderGrid.ts";
import { labelParts, readingsNamed, splitLabel } from "./readingLabels.ts";
import { relatedItems, type RelatedItem } from "./relatedList.ts";
import type {
  Expression,
  LemmaListing,
  LemmaTarget,
  Pronunciation,
  Hyphenation,
  Reading,
  RelatedWord,
  WordFacts,
  WordText,
} from "@lexema/lookup/types.ts";

/**
 * A lemma whose table lists the searched form, as its own page draws that
 * table. It renders under the form's reading as *Forms of andare* or *Forms of
 * bello* (design-system-manifest.md § "The result").
 *
 * - A verb's whole conjugation, opened where the form sits: `andare` for
 *   `andavano`.
 * - A noun's or adjective's gender and number grid, superlatives included,
 *   with nothing marked: `bello` for `bella`, `casa` for `case` (#626).
 */
export type LemmaTable =
  | { kind: "conjugation"; lemma: LemmaTarget; listing: LemmaListing }
  | { kind: "grid"; lemma: Reading; agreement: Agreement };

export interface PageReading {
  /**
   * 1-based among the readings that have a definition, and the same number the
   * jump links and the report dialog show. A reading with no definition has
   * none: its heading is its part of speech alone.
   */
  number: number | undefined;
  reading: Reading;
  /**
   * The lemmas whose tables list the query, one per distinct table. Two
   * records with the same table (`chiusi` names `chiudere` twice) show it once;
   * tables that differ each show.
   */
  lemmaTables: LemmaTable[];
  /**
   * Whether the reading shows its own table. A noun or adjective form that
   * shows its lemma's grid does not also show its own (#626); a verb form
   * keeps both, as before.
   */
  ownForms: boolean;
  /** The etymologies the source ties to this reading, their bracket label dropped. */
  etymologies: WordText[];
  /** The synonym groups the source labels with this reading's part of speech. */
  synonyms: RelatedItem[];
}

/** The word lists no reading took, as they show: words, and the notes among them. */
export interface WordLists {
  synonyms: RelatedItem[];
  antonyms: RelatedItem[];
  derived: RelatedItem[];
}

/**
 * One *Expressions* section (#213): the entry's own, or, on a form's page, one
 * per lemma it is a form of, *Expressions with andare*. A section with no row
 * is not a value this holds, so a page with none shows none (ADR 0016).
 */
export type ExpressionSection =
  | { kind: "own"; expressions: [Expression, ...Expression[]] }
  | { kind: "lemma"; lemma: string; expressions: [Expression, ...Expression[]] };

/** A list longer than this gets the *Find an expression* box once it is open (Huey, 2026-10-01, on #213). */
export const EXPRESSION_FILTER_ABOVE = 30;

/** Whether a section lists enough rows to be filtered. */
export const takesFilter = (section: ExpressionSection): boolean => section.expressions.length > EXPRESSION_FILTER_ABOVE;

/** Whether a row answers what was typed in *Find an expression*: its phrase or its meaning holds it. */
export function matchesExpression(expression: Expression, typed: string): boolean {
  const wanted = normalizeItalianExact(typed);
  if (wanted === "") return true;
  return [expression.phrase, ...expression.meanings].some((text) => normalizeItalianExact(text).includes(wanted));
}

export interface WordPage {
  /** The headword as the source spells it, or the query when no record is about it. */
  headword: string;
  readings: [PageReading, ...PageReading[]];
  /** The facts about the word no reading took: shown once, after the readings. */
  wordFacts: WordFacts;
  /** `wordFacts`' synonyms, antonyms and derived words, as the page lists them. */
  wordLists: WordLists;
  /** The entry's own expressions, then its lemmas', each once; the last of the word's facts. */
  expressionSections: ExpressionSection[];
  /**
   * The word whose Wiktionary page the one *Source* link opens: the spelling
   * the page is about, its title. That page holds every entry for the
   * spelling, so one link covers every reading (ADR 0009, amended on #281).
   */
  sourceWord: string;
}

/**
 * Direct readings stay in the source's order: a word with a base reading
 * leads with it, as in the design's sale and studente frames. When only a
 * form-of record matches the queried headword, it leads.
 */
export function pageOrder(readings: readonly Reading[]): Reading[] {
  if (readings.some((reading) => reading.isAboutQuery && !isFormOfReading(reading))) {
    return [...readings];
  }
  return [
    ...readings.filter((reading) => isFormOfReading(reading)),
    ...readings.filter((reading) => !isFormOfReading(reading)),
  ];
}

/** What a table shows: each form's spelling and the grammar the source states for it, in order. */
function tableKey(listing: LemmaListing): string {
  return JSON.stringify(
    listing.forms.map((form) => [
      form.surface,
      form.claims.map((claim) => (claim.status === "missing" ? "" : claim.sourceText)),
    ]),
  );
}

/**
 * The verb lemmas whose own tables list the query, for a verb reading that is
 * a form of them: every candidate of every link, once per distinct table.
 */
function conjugationTablesOf(reading: Reading): LemmaTable[] {
  if (!isVerbReading(reading)) return [];
  const tables = new Map<string, LemmaTable>();
  for (const link of reading.lemmaLinks) {
    if (link.kind !== "candidates") continue;
    for (const lemma of link.candidates) {
      if (lemma.pos !== "verb" || lemma.listing === undefined) continue;
      const key = `${lemma.word}\u0000${tableKey(lemma.listing)}`;
      if (!tables.has(key)) tables.set(key, { kind: "conjugation", lemma, listing: lemma.listing });
    }
  }
  return [...tables.values()];
}

/** Whether a reading is a noun or adjective form about the query: one whose lemma's grid it shows. */
const takesLemmaGrid = (reading: Reading): boolean =>
  isFormOfReading(reading) && (isNounReading(reading) || isAdjectiveReading(reading));

/** The lemma records a noun or adjective form names, of its own part of speech when it names one. */
const gridLemmasOf = (reading: Reading) => lemmasOfPartOfSpeech(reading.pos, reading.lemmaLinks);

/**
 * The words whose records a page needs read to draw its lemma grids: every
 * lemma a noun or adjective form about the query names (`bello` for `bella`).
 * Empty for any other page, so a search reads nothing more for it.
 */
export function gridLemmaWords(readings: readonly Reading[]): string[] {
  return [...new Set(readings.filter(takesLemmaGrid).flatMap((reading) => gridLemmasOf(reading).map((lemma) => lemma.word)))];
}

const spellingsOf = ({ grid, superlative }: Agreement): Spelling[] =>
  [grid, superlative].flatMap((one) => one?.rows.flatMap((row) => row.cells.flatMap((cell) => cell.spellings)) ?? []);

/** What a lemma's grids show: each row's gender and each cell's spellings, in order. */
const gridKey = ({ grid, superlative }: Agreement): string =>
  JSON.stringify(
    [grid, superlative].map((one) => one?.rows.map((row) => [row.gender, row.cells.map((cell) => cell.spellings.map((spelling) => spelling.surface))])),
  );

/**
 * The lemma grids that list the query, for a noun or adjective form about it:
 * each lemma record it names, drawn from `lemmas` as that record's own reading
 * draws it, once per distinct grid.
 *
 * A grid lists the query when one of its cells holds a `forms[]` entry the
 * query hit (`bello` lists `bella`), or the form's own record declared as the
 * lemma's plural (`casa` takes `case` from `case`, #145). Both are matched by
 * pointer and record, never by spelling.
 */
function gridTablesOf(reading: Reading, lemmas: readonly Reading[]): LemmaTable[] {
  if (!takesLemmaGrid(reading)) return [];
  const tables = new Map<string, LemmaTable>();
  for (const candidate of gridLemmasOf(reading)) {
    const lemma = lemmas.find((one) => entryKey(one) === entryKey(candidate));
    // A record that is itself a form is no lemma to draw: `costruttrice`, the
    // "femminile di costruttore" that `costruttrici` names, has no table of its
    // own, so `costruttrici` keeps its own.
    if (lemma === undefined || lemma.lemmaLinks.length > 0) continue;
    const agreement = agreementOf(lemma);
    const hit = candidate.listing === undefined ? new Set<string>() : searchedSpellings(candidate.listing).formPointers;
    const lists = spellingsOf(agreement).some(
      (spelling) =>
        spelling.forms.some((form) => hit.has(sourcePointerOf(form.ref) ?? "")) ||
        (reading.recordId !== undefined && spelling.declaredBy.some((record) => record.recordId === reading.recordId)),
    );
    if (!lists) continue;
    const key = `${lemma.word}\u0000${gridKey(agreement)}`;
    if (!tables.has(key)) tables.set(key, { kind: "grid", lemma, agreement });
  }
  return [...tables.values()];
}

/**
 * The page for `query`. `lemmas` are the records of the words
 * `gridLemmaWords(readings)` names, as the lookup reads them; a lemma grid is
 * drawn only from one of them.
 */
export function wordPage(query: string, readings: readonly [Reading, ...Reading[]], lemmas: readonly Reading[]): WordPage {
  const forms = formsOfQueryReadings(readings);
  const siblings = otherFormsOfQueryLemmas(readings);
  const ordered = pageOrder(readings.filter((reading) => !forms.has(reading) && !siblings.has(reading)));
  const about = ordered.filter((reading) => reading.isAboutQuery);
  const merged = mergeWordFacts(about);
  const placed = placeWordFacts(about, merged);
  // Readings with a definition number 1, 2, 3 among themselves, so the page
  // never shows a gap (Huey, 2026-09-30, on #250).
  let numbered = 0;
  const entries = ordered.map((reading): PageReading => {
    const grids = gridTablesOf(reading, lemmas);
    return {
      number: hasDefinitions(reading) ? ++numbered : undefined,
      reading,
      lemmaTables: [...conjugationTablesOf(reading), ...grids],
      ownForms: grids.length === 0,
      etymologies: placed.etymologies.get(reading) ?? [],
      synonyms: relatedItems(placed.synonyms.get(reading) ?? []),
    };
  });
  const [first, ...rest] = entries;
  if (first === undefined) throw new Error("a found result renders at least one reading");

  const headword = about[0]?.word ?? query;
  return {
    headword,
    readings: [first, ...rest],
    wordFacts: placed.rest,
    wordLists: {
      synonyms: relatedItems(placed.rest.synonyms),
      antonyms: relatedItems(placed.rest.antonyms),
      derived: relatedItems(placed.rest.derived),
    },
    expressionSections: expressionSections(headword, about),
    sourceWord: headword,
  };
}

const nonEmpty = <T>(items: T[]): [T, ...T[]] | undefined => {
  const [first, ...rest] = items;
  return first === undefined ? undefined : [first, ...rest];
};

/**
 * The entry's own list, every reading about the word merged, since the source
 * repeats one list on each of them; then one list per word the readings say
 * they are a form of, in page order, every record of that word merged
 * (`andavano`: *Expressions with andare*; `stato`: its own, then *with stare*).
 */
function expressionSections(headword: string, about: readonly Reading[]): ExpressionSection[] {
  const sections: ExpressionSection[] = [];
  const own = nonEmpty(mergeExpressions(about.map((reading) => reading.wordFacts.expressions)));
  if (own !== undefined) sections.push({ kind: "own", expressions: own });

  const byLemma = new Map<string, Expression[][]>();
  for (const reading of about.filter(isFormOfReading)) {
    for (const link of reading.lemmaLinks) {
      if (link.kind !== "candidates") continue;
      for (const lemma of link.candidates) {
        if (lemma.word === headword) continue;
        byLemma.set(lemma.word, [...(byLemma.get(lemma.word) ?? []), lemma.expressions]);
      }
    }
  }
  for (const [lemma, lists] of byLemma) {
    const expressions = nonEmpty(mergeExpressions(lists));
    if (expressions !== undefined) sections.push({ kind: "lemma", lemma, expressions });
  }
  return sections;
}

/**
 * The headword-level fields, once for the word.
 *
 * The source usually repeats them on every record of a headword, but not
 * always: 133 of the 16,792 headwords with several records in release
 * `it-0c432803` differ (docs/WEB.md). A union rather than the first record's
 * copy is what keeps a record that differs from being dropped without a word.
 */
function mergeWordFacts(readings: readonly Reading[]): WordFacts {
  const distinct = <T>(items: T[], key: (item: T) => string): T[] => {
    const seen = new Map<string, T>();
    for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
    return [...seen.values()];
  };
  const related = (pick: (facts: WordFacts) => RelatedWord[]): RelatedWord[] => {
    const byWord = new Map<string, RelatedWord>();
    for (const word of readings.flatMap((reading) => pick(reading.wordFacts))) {
      const existing = byWord.get(word.word);
      if (existing) existing.refs.push(...word.refs);
      else byWord.set(word.word, { word: word.word, refs: [...word.refs] });
    }
    return [...byWord.values()];
  };
  const all = <T>(pick: (facts: WordFacts) => T[]): T[] => readings.flatMap((reading) => pick(reading.wordFacts));

  return {
    pronunciations: distinct<Pronunciation>(all((facts) => facts.pronunciations), (p) => `${p.ipa}\u0000${p.note}`),
    hyphenations: distinct<Hyphenation>(all((facts) => facts.hyphenations), (h) => h.parts.join("\u0000")),
    etymologies: distinct<WordText>(all((facts) => facts.etymologies), (e) => e.text),
    synonyms: related((facts) => facts.synonyms),
    synonymList: all((facts) => facts.synonymList),
    antonyms: related((facts) => facts.antonyms),
    derived: related((facts) => facts.derived),
    expressions: mergeExpressions(readings.map((reading) => reading.wordFacts.expressions)),
  };
}

/**
 * The one reading a label names, or undefined. A label that names two
 * (`medico`'s `(aggettivo e sostantivo)`) would copy one text into both, so
 * it stays once after the readings instead (Huey: identical things show once).
 */
const onlyReading = (named: readonly Reading[]): Reading | undefined => (named.length === 1 ? named[0] : undefined);

/**
 * Etymologies and synonym groups the source ties to one part of speech, moved
 * into the readings of that part of speech (design-system-manifest.md §
 * "Layout"). Only a word with two readings or more has anything to move.
 *
 * - An etymology moves when its bracket label names one reading on the page
 *   (`sale`: `(sostantivo plurale) vedi sala`), even when it is the word's only
 *   one (`strutto`: `(voce verbale) vedi struggere`). It shows there without
 *   the label, which the reading's heading already says.
 * - A synonym moves when a part-of-speech label earlier in its record's list
 *   opens the group it is in and names one reading (`vivere`: `sostantivo` on
 *   `esistenza`, `verbo` on `esistere`).
 *
 * Whatever is not moved stays in `rest`, verbatim, once for the word.
 */
function placeWordFacts(
  about: readonly Reading[],
  merged: WordFacts,
): { etymologies: Map<Reading, WordText[]>; synonyms: Map<Reading, RelatedWord[]>; rest: WordFacts } {
  const etymologies = new Map<Reading, WordText[]>();
  const synonyms = new Map<Reading, RelatedWord[]>();
  if (about.length < 2) return { etymologies, synonyms, rest: merged };

  const keptEtymologies: WordText[] = [];
  for (const etymology of merged.etymologies) {
    const { label, rest } = splitLabel(etymology.text);
    const reading = label !== undefined ? onlyReading(readingsNamed(label, about)) : undefined;
    if (reading === undefined) keptEtymologies.push(etymology);
    // A text that was only its label says nothing the reading's heading does not.
    else if (rest !== "") etymologies.set(reading, [...(etymologies.get(reading) ?? []), { text: rest, ref: etymology.ref }]);
  }

  const placedRefs = new Set<string>();
  for (const record of about) {
    let group: Reading | undefined;
    for (const entry of record.wordFacts.synonymList) {
      const label = entry.rawTags.find((tag) => labelParts(tag).length > 0);
      if (label !== undefined) group = onlyReading(readingsNamed(label, about));
      if (group === undefined) continue;
      placedRefs.add(factRefKey(entry.ref));
      const words = synonyms.get(group) ?? [];
      const existing = words.find((word) => word.word === entry.word);
      if (existing === undefined) words.push({ word: entry.word, refs: [entry.ref] });
      else if (!existing.refs.some((ref) => factRefKey(ref) === factRefKey(entry.ref))) existing.refs.push(entry.ref);
      synonyms.set(group, words);
    }
  }
  const keptSynonyms = merged.synonyms.filter((word) => word.refs.some((ref) => !placedRefs.has(factRefKey(ref))));

  return { etymologies, synonyms, rest: { ...merged, etymologies: keptEtymologies, synonyms: keptSynonyms } };
}
