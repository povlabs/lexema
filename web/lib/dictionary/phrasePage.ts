// The short page a searched expression opens (#214, Huey's page-shape ruling
// of 2026-09-30): `vado via` is titled as typed, and shows each form entry of
// `vado` with its lemma replaced by *andare via*, a link to that entry. No
// forms, no pronunciation and none of the headword's own meanings: the link
// goes there. What the lines say is the lookup's (`phraseForms`,
// src/lookup/phrase.ts); this file only numbers them for the page.

import type { FoundRoute, PhraseForm } from "@lexema/lookup/types.ts";

/** One record of a word the expression was searched with, numbered as a word page numbers its readings. */
export interface PhraseEntry {
  /** 1-based. */
  number: number;
  /** The record, as the footer's report names it. */
  reading: PhraseForm;
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
  /** The Wiktionary pages the lines come from: the searched words'. */
  sourceWords: string[];
}

export function phrasePage(query: string, route: Extract<FoundRoute, { kind: "phrase" }>): PhrasePage {
  const named = new Set(route.forms.flatMap((form) => form.definitions.map((definition) => definition.phrase)));
  return {
    headword: query,
    readings: route.forms.map((reading, i) => ({ number: i + 1, reading })),
    unnamed: route.phrases.map((phrase) => phrase.word).filter((word) => !named.has(word)),
    sourceWords: [...new Set(route.forms.map((form) => form.word))],
  };
}
