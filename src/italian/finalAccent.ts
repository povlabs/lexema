// A one-word query typed without the final accent of a headword (#846):
// `perche` for `perché`, `piu` for `più`. Huey's ruling of 2026-10-17
// (https://github.com/povlabs/lexema/issues/846#issuecomment-6233340944): such
// a query opens the accented word when nothing else answers it, so `papa` and
// `e` keep their own answers. What the lookup does with it is
// src/lookup/accentless.ts.

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
 * The headword a one-word query opens: the one among `headwords`, served
 * headword keys, whose `accentlessSpelling` is the query. `perche` opens
 * `perché`. None when no headword is, or when two or more are (`piu` of `più`
 * and `piú`), so the not-found answer offers them instead. A query that
 * differs from a headword by a wrong accent (`perchè` of `perché`) or by an
 * apostrophe (`citta'` of `città`) is no headword's accentless spelling, so it
 * opens none.
 */
export function openedHeadword(key: string, headwords: Iterable<string>): string | undefined {
  const [only, ...more] = new Set([...headwords].filter((headword) => accentlessSpelling(headword) === key));
  return more.length === 0 ? only : undefined;
}
