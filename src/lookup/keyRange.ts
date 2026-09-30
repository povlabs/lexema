// The key range a prefix covers, for the range probes on
// `lookup_form_headword_by_key` (src/lookup/suggest.ts, src/lookup/phrase.ts).
// A module of its own so both can import it: suggest.ts imports lookup.ts,
// which imports phrase.ts.

/**
 * The least key greater than every key that starts with `key`, so that
 * `surface_key >= key AND surface_key < upper` is exactly the keys with that
 * prefix. SQLite compares TEXT byte by byte in UTF-8, which orders strings by
 * code point, so incrementing the last code point is the successor. The
 * surrogate range is skipped because a lone surrogate is not text, and a last
 * code point already at U+10FFFF has no successor, so it is dropped and the
 * one before it is incremented.
 */
export function prefixUpperBound(key: string): string {
  const points = [...key];
  while (points.length > 0) {
    const last = points.pop()!.codePointAt(0)!;
    if (last < 0x10ffff) {
      const next = last === 0xd7ff ? 0xe000 : last + 1;
      return points.join("") + String.fromCodePoint(next);
    }
  }
  // Every code point was U+10FFFF: no string is greater, so there is no bound.
  // No normalized key reaches here, and a caller would rather fail than scan.
  throw new Error("a prefix of U+10FFFF alone has no upper bound");
}
