// A one-word query typed without the final accent of a headword (#846):
// `perche` for `perché`, `piu` for `più`. Huey's ruling of 2026-10-17
// (https://github.com/povlabs/lexema/issues/846#issuecomment-6233340944): such
// a query opens the accented word when nothing else answers it, so `papa` and
// `e` keep their own answers. When several headwords lack the same final
// accent, Huey's tie-break of that day
// (https://github.com/povlabs/lexema/issues/846#issuecomment-6240679313):
// where one is recorded in the source as a variant of another (`piú`,
// "variante ricercata di più"), the query opens the main word; otherwise it
// opens nothing. Huey's ruling of 2026-10-20 widens it to a final vowel typed
// with the wrong mark (#900,
// https://github.com/povlabs/lexema/issues/900#issuecomment-6286828410):
// `perchè` for `perché`, `caffé` for `caffè`, `sè` for `sé`, under the same
// guards and tie-break. What the lookup does with it is
// src/lookup/accentless.ts.

import { glossBase } from "./formOfGlossEdge.js";
import { normalizeItalianExact } from "./normalize.js";

/**
 * A key with any mark taken off its final vowel, or none when it is more than
 * one word or ends in no vowel: `perché` → `perche`, `perchè` → `perche`,
 * `perche` → `perche`, `è` → `e`; `be'`, `casa` and `caffè latte` → none.
 * Only the final letter changes, so `ùltimà` → `ùltima`. It is the spelling a
 * query and a headword share when they differ only in the mark on that vowel.
 */
export function plainFinalVowel(key: string): string | undefined {
  if (/\s/u.test(key)) return undefined;
  const letters = [...key];
  const last = letters.at(-1);
  if (last === undefined) return undefined;
  const plain = last.normalize("NFD").replace(/\p{M}/gu, "");
  return /^[aeiou]$/u.test(plain) ? letters.slice(0, -1).join("") + plain : undefined;
}

/**
 * A key with its final accent taken off, or none when it is more than one
 * word or ends in no accented vowel: `perché` → `perche`, `città` → `citta`,
 * `è` → `e`; `be'`, `casa` and `caffè latte` → none. Only the final letter
 * changes, so `ùltimà` → `ùltima`.
 */
export function accentlessSpelling(key: string): string | undefined {
  const plain = plainFinalVowel(key);
  return plain !== key ? plain : undefined;
}

/**
 * The letters a query is probed under when it may lack its final accent or
 * carry the wrong one: its accents taken off, as `accent_fold` keys a
 * headword (src/import/seedSql.ts), since such a query and its headword
 * differ by accents alone. None for a query that is more than one word or
 * ends in no vowel (`plainFinalVowel`), which opens no headword.
 */
export function accentlessProbe(key: string): string | undefined {
  if (plainFinalVowel(key) === undefined) return undefined;
  return key.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/**
 * The key of the word a sense's first gloss records its headword a variant
 * of, or none: a gloss that opens with "variante" and names a word after its
 * first "di" (`glossBase`). "variante ricercata di più" → `più`, "Variante
 * grafica di valigie" → `valigie`; "forma tronca di poco" and "più che mai"
 * → none.
 */
export function variantNamed(gloss: string): string | undefined {
  if (!/^variant/u.test(gloss.trimStart().toLocaleLowerCase("it-IT"))) return undefined;
  const named = glossBase(gloss);
  return named === undefined ? undefined : normalizeItalianExact(named.base);
}

/** A served headword a query may lack the final accent of: its key, and the keys its senses record it a variant of (`variantNamed`). */
export interface AccentedHeadword {
  key: string;
  variantOf: Iterable<string>;
}

/**
 * The headword a one-word query opens, among `headwords`, served headwords
 * that have its letters: one other than the query that writes its final vowel
 * with an accent and differs from it only in the mark on that vowel
 * (`plainFinalVowel`). `perche` opens `perché` (#846), and so do `perchè`
 * and `perchê` (#900); `caffé` opens `caffè`, `sè` opens `sé`. When several
 * are, it opens the main word: the one no variant of another, each other one
 * being recorded as its variant. `piu` opens `più`, since `piú` is "variante
 * ricercata di più". None when no headword is, or when several are and no
 * such variant link settles which, so the not-found answer offers them
 * instead. A query that differs from a headword by an apostrophe (`citta'`
 * of `città`, `pò` of `po'`), by an accent the headword lacks (`dò` of `do`)
 * or by an accent inside the word opens none.
 */
export function openedHeadword(key: string, headwords: Iterable<AccentedHeadword>): string | undefined {
  const typed = plainFinalVowel(key);
  if (typed === undefined) return undefined;
  const matches = new Map<string, Set<string>>();
  for (const headword of headwords) {
    if (headword.key === key || accentlessSpelling(headword.key) !== typed) continue;
    const variantOf = matches.get(headword.key) ?? new Set<string>();
    for (const word of headword.variantOf) variantOf.add(word);
    matches.set(headword.key, variantOf);
  }
  const isMain = (candidate: string): boolean =>
    [...matches].every(([other, variantOf]) => other === candidate || (variantOf.has(candidate) && !matches.get(candidate)?.has(other)));
  const [main, ...more] = [...matches.keys()].filter(isMain);
  return more.length === 0 ? main : undefined;
}
