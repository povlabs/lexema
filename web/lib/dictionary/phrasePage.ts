// The short page a searched expression opens (#214, Huey's page-shape rulings
// of 2026-09-30): `vado via` is titled as typed, and each record of `vado` is a
// reading whose definitions are *andare via*'s own meanings, as imported, then
// `vado`'s form entries with the lemma replaced by *andare via*, a link to that
// entry. No forms and no pronunciation. What the form lines say is the
// lookup's (`phraseForms`, src/lookup/phrase.ts); the meanings are the
// headword's senses, read as its own page reads them (definitions.ts). This
// file only orders and numbers them for the page.

import type { FoundRoute, PhraseDefinition, PhraseForm, Reading } from "@lexema/lookup/types.ts";
import { definitionsOf, type DefinitionItem } from "./definitions.ts";

/**
 * One numbered definition of a reading: a meaning of the expression's headword,
 * copied from the record that holds it, or a form line naming the expression.
 */
export type PhraseLine =
  | { kind: "meaning"; reading: Reading; item: DefinitionItem }
  | { kind: "form"; definition: PhraseDefinition };

/** One record of a word the expression was searched with, numbered as a word page numbers its readings. */
export interface PhraseEntry {
  /** 1-based. */
  number: number;
  /** The record, as the footer's report names it. */
  reading: PhraseForm;
  /**
   * For each expression the record's form entries name, in their order: the
   * expression's meanings, the first time the page names it, then those form
   * entries. Never empty, because every record has a form line.
   */
  lines: [PhraseLine, ...PhraseLine[]];
}

export interface PhrasePage {
  /** The search as typed: `vado via`. What a report from the page is about. */
  headword: string;
  readings: PhraseEntry[];
  /**
   * Each headword the query spells that no line names, because the source's
   * form entries never write its lemma as a word. Linked on its own, so every
   * headword the lookup found stays reachable.
   */
  unnamed: string[];
  /**
   * The Wiktionary pages the lines come from: the searched words', for the
   * form lines, then each expression's whose meanings show.
   */
  sourceWords: string[];
}

/**
 * `headwords` are the found result's readings: the records of the expressions
 * the query spells. A headword with no gloss (#250) has no meanings to copy,
 * so its reading shows the form lines alone.
 */
export function phrasePage(
  query: string,
  route: Extract<FoundRoute, { kind: "phrase" }>,
  headwords: readonly Reading[],
): PhrasePage {
  const meaningsOf = (phrase: string): PhraseLine[] =>
    headwords
      .filter((reading) => reading.word === phrase)
      .flatMap((reading) => definitionsOf(reading).items.map((item): PhraseLine => ({ kind: "meaning", reading, item })));
  const defined = new Set<string>();
  const linesOf = (form: PhraseForm): [PhraseLine, ...PhraseLine[]] => {
    const lines: PhraseLine[] = [];
    for (const phrase of new Set(form.definitions.map((definition) => definition.phrase))) {
      if (!defined.has(phrase)) {
        defined.add(phrase);
        lines.push(...meaningsOf(phrase));
      }
      for (const definition of form.definitions) {
        if (definition.phrase === phrase) lines.push({ kind: "form", definition });
      }
    }
    const [head, ...tail] = lines;
    // `form.definitions` is never empty, and each one is pushed as a form line.
    if (head === undefined) throw new Error(`no line for record ${form.recordId}`);
    return [head, ...tail];
  };
  const readings = route.forms.map((reading, i) => ({ number: i + 1, reading, lines: linesOf(reading) }));
  const named = new Set(route.forms.flatMap((form) => form.definitions.map((definition) => definition.phrase)));
  // The searched words' pages, then the page of each expression whose meanings show.
  const meaningPages = readings.flatMap(({ lines }) => lines.flatMap((line) => (line.kind === "meaning" ? [line.reading.word] : [])));
  return {
    headword: query,
    readings,
    unnamed: route.phrases.map((phrase) => phrase.word).filter((word) => !named.has(word)),
    sourceWords: [...new Set([...route.forms.map((form) => form.word), ...meaningPages])],
  };
}
