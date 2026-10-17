// A one-word query typed without the final accent of a headword (#846):
// `perche` for `perché`, `piu` for `più`. Huey's ruling of 2026-10-17
// (https://github.com/povlabs/lexema/issues/846#issuecomment-6233340944): such
// a query opens the accented word when nothing else answers it, so `papa` and
// `e` keep their own answers. When several headwords lack the same final
// accent, Huey's tie-break of that day
// (https://github.com/povlabs/lexema/issues/846#issuecomment-6240679313):
// where one is recorded in the source as a variant of another (`piú`,
// "variante ricercata di più"), the query opens the main word; otherwise it
// opens nothing. What the lookup does with it is src/lookup/accentless.ts.

import { glossBase } from "./formOfGlossEdge.js";
import { normalizeItalianExact } from "./normalize.js";

/**
 * A key with its final accent taken off, or none when it is more than one
 * word or ends in no accented vowel: `perché` → `perche`, `città` → `citta`,
 * `è` → `e`; `be'`, `casa` and `caffè latte` → none. Only the final letter
 * changes, so `ùltimà` → `ùltima`.
 */
export function accentlessSpelling(key: string): string | undefined {
  if (/\s/u.test(key)) return undefined;
  const letters = [...key];
  const last = letters.at(-1);
  if (last === undefined) return undefined;
  const plain = last.normalize("NFD").replace(/\p{M}/gu, "");
  return plain !== last && /^[aeiou]$/u.test(plain) ? letters.slice(0, -1).join("") + plain : undefined;
}

/**
 * The letters a query lacking a final accent is probed under, when it may lack
 * one: its accents taken off, as `accent_fold` keys a headword
 * (src/import/seedSql.ts), since a headword and its accentless spelling differ
 * by an accent alone. None for a query that is more than one word or ends in
 * no plain vowel, which is no key's `accentlessSpelling`.
 */
export function accentlessProbe(key: string): string | undefined {
  if (/\s/u.test(key) || !/[aeiou]$/u.test(key)) return undefined;
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
 * that have its letters: the one whose `accentlessSpelling` is the query.
 * `perche` opens `perché`. When several are, it opens the main word: the one
 * no variant of another, each other one being recorded as its variant. `piu`
 * opens `più`, since `piú` is "variante ricercata di più". None when no
 * headword is, or when several are and no such variant link settles which,
 * so the not-found answer offers them instead. A query that differs from a
 * headword by a wrong accent (`perchè` of `perché`) or by an apostrophe
 * (`citta'` of `città`) is no headword's accentless spelling, so it opens
 * none.
 */
export function openedHeadword(key: string, headwords: Iterable<AccentedHeadword>): string | undefined {
  const matches = new Map<string, Set<string>>();
  for (const headword of headwords) {
    if (accentlessSpelling(headword.key) !== key) continue;
    const variantOf = matches.get(headword.key) ?? new Set<string>();
    for (const word of headword.variantOf) variantOf.add(word);
    matches.set(headword.key, variantOf);
  }
  const isMain = (candidate: string): boolean =>
    [...matches].every(([other, variantOf]) => other === candidate || (variantOf.has(candidate) && !matches.get(candidate)?.has(other)));
  const [main, ...more] = [...matches.keys()].filter(isMain);
  return more.length === 0 ? main : undefined;
}
