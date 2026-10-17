// A one-word headword typed without its final accent or apostrophe (#468):
// `città` typed `citta`, `be'` typed `be`. What that spelling is, which
// headword a search for it opens (#846), and what that search answers about
// the headword: opened, found as some other word, offered first, offered
// later, or not offered. `pnpm run measure:bare-spellings`
// (measureBareSpellings.ts) counts these over a seeded release.

import { accentlessSpelling } from "../italian/finalAccent.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import type { Nearby } from "./nearby.js";

/**
 * The headword key with its final accent or apostrophe taken off, or none when
 * it ends in neither or is more than one word: `città` → `citta`, `perché` →
 * `perche`, `è` → `e`, `be'` → `be`, `casa` → none. Only an accented vowel
 * counts (`accentlessSpelling`), and a lone apostrophe has no spelling left.
 */
export function bareSpelling(key: string): string | undefined {
  if (/\s/u.test(key) || !key.endsWith("'")) return accentlessSpelling(key);
  const rest = [...key].slice(0, -1).join("");
  return rest === "" ? undefined : rest;
}

/**
 * What searching a headword's bare spelling answers about the headword:
 * - `opened`: the search opens the headword itself (#846), as `perche` opens
 *   `perché`;
 * - `found`: the exact lookup finds the bare spelling, which is itself a word
 *   (`e` for `è`), so nothing is offered: the ambiguous case;
 * - `best`: not found, and the headword leads "Did you mean";
 * - `offered`: not found, and the headword is offered but not first;
 * - `missed`: not found, and the headword is not offered.
 */
export type BareSpellingOutcome = "opened" | "found" | "best" | "offered" | "missed";

/**
 * What a search for a bare spelling answered: found, with the headword it
 * opened when the accentless spelling rule found it (#846), or not found,
 * with what `findNearby` offered.
 */
export type BareSpellingAnswer = { found: true; opened?: string } | { found: false; nearby: Nearby };

/** The spellings an answer offers, in order, and whether the first is a "Did you mean" best guess. */
function offers(nearby: Nearby): { words: string[]; leads: boolean } {
  switch (nearby.kind) {
    case "accent":
    case "typo":
      return { words: [nearby.best, ...nearby.others, ...nearby.phrases.map((offer) => offer.phrase)], leads: true };
    case "phrase":
      return { words: [nearby.best, ...nearby.others].map((offer) => offer.phrase), leads: true };
    case "prefix":
      return { words: nearby.words, leads: false };
    case "none":
      return { words: [], leads: false };
  }
}

/** The outcome for `headword` of a search for its bare spelling: opened, found, or what `findNearby` offered. */
export function bareSpellingOutcome(headword: string, answer: BareSpellingAnswer): BareSpellingOutcome {
  const key = normalizeItalianExact(headword);
  if (answer.found) return answer.opened !== undefined && normalizeItalianExact(answer.opened) === key ? "opened" : "found";
  const { words, leads } = offers(answer.nearby);
  const at = words.findIndex((word) => normalizeItalianExact(word) === key);
  if (at === -1) return "missed";
  return at === 0 && leads ? "best" : "offered";
}
