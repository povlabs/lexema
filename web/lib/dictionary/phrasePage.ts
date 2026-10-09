// The short page a searched expression opens (#214, Huey's page-shape rulings
// of 2026-09-30): `vado via` is titled as typed, and each record of `vado` is a
// reading. Right under its heading are `vado`'s form entries with the lemma
// replaced by *andare via*, a link to that entry, unnumbered, as a word page's
// form lines read (Huey's rule 4 of 2026-10-06 on #695, "Same layout
// everywhere"; P11, built by #700). Then *Definitions*: the expression's own
// meanings, as imported, only each expression's first until `+ altro` opens
// the rest. No forms and no pronunciation. What the form lines say is the
// lookup's (`phraseForms`, src/lookup/phrase.ts); the meanings are the
// headword's senses, read as its own page reads them (definitions.ts). This
// file only orders and numbers them for the page.

import type { EntryIdentity, FoundRoute, PhraseDefinition, PhraseForm, Reading } from "@lexema/lookup/types.ts";
import { definitionsOf, type DefinitionItem } from "./definitions.ts";

type NonEmpty<T> = [T, ...T[]];

/**
 * One meaning of an expression, copied from the record that holds it. Every
 * meaning but an expression's first is `folded`: it waits for `+ altro` (Huey's
 * hand check of 2026-09-30, 11:19Z on #214).
 */
export interface PhraseMeaning {
  reading: Reading;
  item: DefinitionItem;
  folded: boolean;
}

/** The record a numbered reading of the page shows: its heading, and where the source writes it. */
export type PhraseRecord = EntryIdentity & { word: string; posTitle: string };

/**
 * What a reading shows. A searched word's record: its form lines naming an
 * expression, then the meanings of each expression they name, the first time
 * the page names it; an expression with no gloss has none. The expression's
 * own record: its meanings alone. Never neither.
 */
export type PhraseReadingText =
  | { kind: "form"; forms: NonEmpty<PhraseDefinition>; meanings: PhraseMeaning[] }
  | { kind: "own"; meanings: NonEmpty<PhraseMeaning> };

/**
 * One numbered reading of the page, as a word page numbers its readings: a
 * record of a word the expression was searched with, or, when no searched
 * word has a form line naming the expression, a record of the expression
 * itself.
 */
export interface PhraseEntry {
  /** 1-based. */
  number: number;
  /** The record, as the footer's report names it. */
  reading: PhraseRecord;
  text: PhraseReadingText;
}

export interface PhrasePage {
  /** The search as typed: `vado via`. What a report from the page is about. */
  headword: string;
  readings: PhraseEntry[];
  /**
   * Each headword the query spells that no line names: no form line, and no
   * gloss (#250) to show. Linked on its own, so every headword the lookup
   * found stays reachable.
   */
  unnamed: string[];
  /**
   * The word whose Wiktionary page the one *Source* link opens: the first
   * expression the page shows, in display order, never the searched words'
   * (Huey's hand check of 2026-09-30, 11:19Z on #214; one link per page, #281;
   * display order, #291).
   */
  sourceWord: string;
}

/** The expression a reading shows first: its first form line's, else the headword its first meaning is copied from. */
const firstPhraseOf = (text: PhraseReadingText): string => (text.kind === "form" ? text.forms[0].phrase : text.meanings[0].reading.word);

/**
 * `headwords` are the found result's readings: the records of the expressions
 * the query spells. A headword with no gloss (#250) has no meanings to copy,
 * so its reading shows the form lines alone. A headword no form line names —
 * `hanno fatte fuori` when the participle's records never write *fare* —
 * still shows its meanings, as readings of its own after the searched words'
 * (Huey's ruling of 2026-09-30, 10:22Z on #214).
 */
export function phrasePage(
  query: string,
  route: Extract<FoundRoute, { kind: "phrase" }>,
  headwords: readonly Reading[],
): PhrasePage {
  // An expression's meanings, from each of its records: the first shows, the rest fold.
  const meaningsFrom = (readings: readonly Reading[]): PhraseMeaning[] =>
    readings
      .flatMap((reading) => definitionsOf(reading).items.map((item) => ({ reading, item })))
      .map(({ reading, item }, i): PhraseMeaning => ({ reading, item, folded: i > 0 }));
  const meaningsOf = (phrase: string): PhraseMeaning[] => meaningsFrom(headwords.filter((reading) => reading.word === phrase));
  const defined = new Set<string>();
  const textOf = (form: PhraseForm): PhraseReadingText => {
    const [first, ...rest] = form.definitions;
    // `form.definitions` is never empty: a record is a phrase form through its definitions.
    if (first === undefined) throw new Error(`no line for record ${form.recordId}`);
    const meanings: PhraseMeaning[] = [];
    for (const phrase of new Set(form.definitions.map((definition) => definition.phrase))) {
      if (defined.has(phrase)) continue;
      defined.add(phrase);
      meanings.push(...meaningsOf(phrase));
    }
    return { kind: "form", forms: [first, ...rest], meanings };
  };
  const formed = route.forms.map((reading) => ({ reading, text: textOf(reading) }));
  const named = new Set(route.forms.flatMap((form) => form.definitions.map((definition) => definition.phrase)));
  // Each headword no form line names, as its own reading of its meanings.
  const own = headwords.flatMap((reading): Omit<PhraseEntry, "number">[] => {
    if (named.has(reading.word)) return [];
    const [head, ...tail] = meaningsFrom([reading]);
    return head === undefined ? [] : [{ reading, text: { kind: "own", meanings: [head, ...tail] } }];
  });
  const readings = [...formed, ...own].map((entry, i) => ({ number: i + 1, ...entry }));
  const shown = new Set([...named, ...own.map(({ reading }) => reading.word)]);
  const unnamed = route.phrases.map((phrase) => phrase.word).filter((word) => !shown.has(word));
  // Readings show before the unnamed headwords, so the first expression shown
  // is the first reading's, else the first unnamed headword.
  const [first] = readings;
  return {
    headword: query,
    readings,
    unnamed,
    sourceWord: first === undefined ? route.phrases[0].word : firstPhraseOf(first.text),
  };
}
