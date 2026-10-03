// A one-word headword typed without its final accent or apostrophe (#468):
// `città` typed `citta`, `be'` typed `be`. What that spelling is, and what a
// search for it answers about the headword: found as some other word, offered
// first, offered later, or not offered. `pnpm run measure:bare-spellings`
// (measureBareSpellings.ts) counts these over a seeded release.

import { normalizeItalianExact } from "../italian/normalize.js";
import { foldKey, type Nearby } from "./nearby.js";

/**
 * The headword key with its final accent or apostrophe taken off, or none when
 * it ends in neither or is more than one word: `città` → `citta`, `perché` →
 * `perche`, `è` → `e`, `be'` → `be`, `casa` → none. Only an accented vowel
 * counts, and a lone apostrophe has no spelling left.
 */
export function bareSpelling(key: string): string | undefined {
  if (/\s/u.test(key)) return undefined;
  const letters = [...key];
  const last = letters.at(-1);
  if (last === undefined) return undefined;
  const rest = letters.slice(0, -1).join("");
  if (last === "'") return rest === "" ? undefined : rest;
  const plain = foldKey(last);
  return plain !== last && /^[aeiou]$/u.test(plain) ? rest + plain : undefined;
}

/**
 * What searching a headword's bare spelling answers about the headword:
 * - `found`: the exact lookup finds the bare spelling, which is itself a word
 *   (`e` for `è`), so nothing is offered: the ambiguous case;
 * - `best`: not found, and the headword leads "Did you mean";
 * - `offered`: not found, and the headword is offered but not first;
 * - `missed`: not found, and the headword is not offered.
 */
export type BareSpellingOutcome = "found" | "best" | "offered" | "missed";

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

/** The outcome for `headword` of a search for its bare spelling: `found`, or what `findNearby` offered. */
export function bareSpellingOutcome(headword: string, answer: { found: true } | { found: false; nearby: Nearby }): BareSpellingOutcome {
  if (answer.found) return "found";
  const { words, leads } = offers(answer.nearby);
  const key = normalizeItalianExact(headword);
  const at = words.findIndex((word) => normalizeItalianExact(word) === key);
  if (at === -1) return "missed";
  return at === 0 && leads ? "best" : "offered";
}
