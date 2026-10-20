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
// with the wrong mark, or with an apostrophe and an accent swapped (#900,
// https://github.com/povlabs/lexema/issues/900#issuecomment-6286828410):
// `perchè` for `perché`, `caffé` for `caffè`, `sè` for `sé`, `citta'` for
// `città`, `pò` for `po'`, under the same guards and tie-break. What the
// lookup does with it is src/lookup/accentless.ts.

import { glossBase } from "./formOfGlossEdge.js";
import { normalizeItalianExact } from "./normalize.js";

/**
 * How a one-word key ends: in a plain vowel (`perche`), an accented one
 * (`perché`), or a plain one followed by an apostrophe (`po'`, `citta'`).
 */
export type FinalMark = "none" | "accent" | "apostrophe";

/**
 * The end of a one-word key that may open a headword: `plain`, the key with
 * its final mark taken off, accent or apostrophe, and `mark`, which it was.
 */
export interface FinalVowel {
  plain: string;
  mark: FinalMark;
}

const isPlainVowel = (char: string): boolean => /^[aeiou]$/u.test(char);

/**
 * How a key ends, or none when it is more than one word or ends in no vowel,
 * nor in a plain vowel and an apostrophe: `perché` and `perchè` → `perche`
 * marked with an accent, `perche` → `perche` with none, `citta'` → `citta`
 * and `po'` → `po` with an apostrophe; `bar`, `d'` and `caffè latte` → none.
 * Only the final mark goes, so `ùltimà` → `ùltima`.
 */
export function finalVowel(key: string): FinalVowel | undefined {
  if (/\s/u.test(key)) return undefined;
  const letters = [...key];
  const last = letters.at(-1);
  if (last === undefined) return undefined;
  if (last === "'") {
    const vowel = letters.at(-2);
    return vowel !== undefined && isPlainVowel(vowel) ? { plain: letters.slice(0, -1).join(""), mark: "apostrophe" } : undefined;
  }
  const plain = last.normalize("NFD").replace(/\p{M}/gu, "");
  if (!isPlainVowel(plain)) return undefined;
  return { plain: letters.slice(0, -1).join("") + plain, mark: plain === last ? "none" : "accent" };
}

/**
 * A key with its final accent taken off, or none when it is more than one
 * word or ends in no accented vowel: `perché` → `perche`, `città` → `citta`,
 * `è` → `e`; `be'`, `casa` and `caffè latte` → none. Only the final letter
 * changes, so `ùltimà` → `ùltima`.
 */
export function accentlessSpelling(key: string): string | undefined {
  const end = finalVowel(key);
  return end?.mark === "accent" ? end.plain : undefined;
}

/**
 * Whether a query whose final vowel ends in `typed` may open a headword whose
 * final vowel ends in `written`, their letters otherwise the same. A headword
 * with a final accent opens for that vowel typed plain (`perche`, #846), with
 * the wrong mark (`perchè`) or with an apostrophe for the accent (`citta'`,
 * #900). A headword with a final apostrophe opens only for an accent typed in
 * its place (`pò` for `po'`, #900), never for the apostrophe left off (`po`,
 * `dall`). A headword with neither mark never opens, so `dò` opens no `do`.
 */
export function marksOpen(typed: FinalMark, written: FinalMark): boolean {
  switch (written) {
    case "accent":
      return true;
    case "apostrophe":
      return typed === "accent";
    case "none":
      return false;
  }
}

/**
 * What a query that may open a headword is probed under, or none for a query
 * that is more than one word or ends in no vowel (`finalVowel`), which opens
 * no headword. `fold`: its letters with every accent and the final apostrophe
 * taken off, as `accent_fold` keys a headword with an accent
 * (src/import/seedSql.ts): `perchè` and `citta'` → `perche` and `citta`.
 * `elided`: for a query whose final vowel carries an accent, the key that
 * writes an apostrophe in its place, since `accent_fold` holds no key with
 * no accent: `pò` → `po'`.
 */
export interface AccentProbe {
  fold: string;
  elided: string | undefined;
}

/** The probe a key is read under (`AccentProbe`), or none when it opens no headword. */
export function accentlessProbe(key: string): AccentProbe | undefined {
  const end = finalVowel(key);
  if (end === undefined) return undefined;
  const fold = end.plain.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
  return { fold, elided: end.mark === "accent" ? `${end.plain}'` : undefined };
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
 * that have its letters: one other than the query whose final vowel the
 * query writes with a mark it may open (`marksOpen`), the letters before it
 * the same (`finalVowel`). `perche` opens `perché` (#846), and so do `perchè`
 * and `perchê` (#900); `caffé` opens `caffè`, `sè` opens `sé`, `citta'` opens
 * `città` and `pò` opens `po'`. When several are, it opens the main word: the
 * one no variant of another, each other one being recorded as its variant.
 * `piu` opens `più`, since `piú` is "variante ricercata di più". None when no
 * headword is, or when several are and no such variant link settles which,
 * so the not-found answer offers them instead. A query that differs from a
 * headword by an accent the headword lacks (`dò` of `do`), by a final
 * apostrophe it leaves off (`po` of `po'`) or by an accent inside the word
 * opens none.
 */
export function openedHeadword(key: string, headwords: Iterable<AccentedHeadword>): string | undefined {
  const typed = finalVowel(key);
  if (typed === undefined) return undefined;
  const matches = new Map<string, Set<string>>();
  for (const headword of headwords) {
    const written = finalVowel(headword.key);
    if (headword.key === key || written === undefined || written.plain !== typed.plain || !marksOpen(typed.mark, written.mark)) continue;
    const variantOf = matches.get(headword.key) ?? new Set<string>();
    for (const word of headword.variantOf) variantOf.add(word);
    matches.set(headword.key, variantOf);
  }
  const isMain = (candidate: string): boolean =>
    [...matches].every(([other, variantOf]) => other === candidate || (variantOf.has(candidate) && !matches.get(candidate)?.has(other)));
  const [main, ...more] = [...matches.keys()].filter(isMain);
  return more.length === 0 ? main : undefined;
}
