// The phrase of one `proverbs[]` item as a page and the API show it (#213).
//
// Three of the four rewrites Huey ruled on #213 (2026-10-01) act on one item's
// phrase, and they live here; the fourth, one row per phrase, acts on a list
// and lives in src/lookup/expressions.ts. They are source text normalizations
// (ADR 0019) applied at display time: the page and the API read the phrase
// off `source_record_json`, which is never rewritten, so the original is one
// pointer away.

/** An item that opens with an ellipsis: three dots or the one-character `…`, then any space. */
const LEADING_DOTS = /^(?:\.\.\.|…)\s*/u;

/**
 * `bello`'s "...in bello" is "in bello": the dots say the phrase continues a
 * sentence, and the row has none before it. Dots anywhere else stay.
 */
export function withoutLeadingDots(phrase: string): string {
  return phrase.replace(LEADING_DOTS, "");
}

/**
 * `piano`'s "(di secondo piano)" is "di secondo piano". Only brackets that
 * wrap the whole phrase go: the opening one must close at the very end, so
 * "(di) colore (vivo)" stays as written.
 */
export function withoutWrappingBrackets(phrase: string): string {
  if (!phrase.startsWith("(") || !phrase.endsWith(")")) return phrase;
  let depth = 0;
  for (let i = 0; i < phrase.length; i += 1) {
    if (phrase[i] === "(") depth += 1;
    else if (phrase[i] === ")") depth -= 1;
    // The opening bracket closed before the end: it does not wrap the phrase.
    if (depth === 0 && i < phrase.length - 1) return phrase;
  }
  return depth === 0 ? phrase.slice(1, -1).trim() : phrase;
}

/** Whether a phrase has a letter in it. A lone ":" (`battaglia`, `affare`) has none. */
export function hasLetters(phrase: string): boolean {
  return /\p{L}/u.test(phrase);
}

/**
 * The phrase a row shows for one item's `word`, or undefined when the item
 * gives no row: a word with no letters at all is dropped.
 */
export function expressionPhrase(word: string): string | undefined {
  if (!hasLetters(word)) return undefined;
  return withoutWrappingBrackets(withoutLeadingDots(word));
}
