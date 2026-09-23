// Suggestions while typing: a prefix in, at most ten headword spellings out.
// What it returns and the order it returns them in are in docs/LOOKUP.md
// § "Suggestions"; the measurements behind the bounds are in
// reports/2026-09-23-autocomplete-measurements.md.
//
// This is not a lookup. It names spellings a reader might mean, and choosing
// one runs the real lookup for it; nothing here reads a sense, a form or a
// grammar claim, so nothing here can say what a word means.

import { IT_NORMALIZER_VERSION, normalizeItalianExact } from "../italian/normalize.js";
import type { LookupDatabase } from "./database.js";
import { MAX_QUERY_LENGTH, readRelease } from "./lookup.js";

/**
 * The shortest prefix answered, in characters of the normalized key. One letter
 * is enough: Huey's ruling is that typing `a` lists the first words under `a`.
 * The query walks the index in key order and stops after a handful of rows, so
 * a one-letter prefix costs no more than a long one.
 */
export const MIN_PREFIX_LENGTH = 1;

/** The longest prefix answered: the same bound exact lookup puts on a query. */
export const MAX_PREFIX_LENGTH = MAX_QUERY_LENGTH;

/** The most suggestions one answer carries, Huey's "5-10 word list". */
export const SUGGESTION_LIMIT = 10;

export interface SuggestOptions {
  db: LookupDatabase;
  releaseId: string;
  prefix: string;
}

/**
 * A prefix the index was probed for, and what it held, in key order. `suggestions`
 * is empty when no headword starts with the prefix, which is an answer and
 * not a failure.
 */
export interface Suggested {
  outcome: "suggested";
  prefix: { raw: string; key: string };
  suggestions: string[];
}

/** A prefix outside the bounds, which is never sent to the index. */
export interface PrefixRejected {
  outcome: "rejected";
  prefix: { raw: string };
  rejection:
    | { reason: "too-short"; length: number; limit: typeof MIN_PREFIX_LENGTH }
    | { reason: "too-long"; length: number; limit: typeof MAX_PREFIX_LENGTH };
}

export type SuggestResult = Suggested | PrefixRejected;

/**
 * Whether a prefix is long enough to ask about, counted as the server counts
 * it: in characters of the normalized key, so `è` is one and a trailing space
 * is none. Exported so the field can skip a request the server would refuse.
 */
export function isAskablePrefix(raw: string): boolean {
  const length = [...normalizeItalianExact(raw)].length;
  return length >= MIN_PREFIX_LENGTH && raw.trim().length <= MAX_PREFIX_LENGTH;
}

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

/**
 * Headword spellings starting with a prefix, in alphabetical order of the
 * normalized key: the first words in the dictionary under what was typed.
 * Huey's ruling, 2026-09-23: "it should show alphabetical order like the first
 * 10, if i write a it should show words from letter a from database".
 *
 * The range probe walks `lookup_form_headword_by_key` in key order, so the rows
 * come back already sorted and `LIMIT` stops the scan early; `test/suggest.test.ts`
 * asserts the plan. Only headwords are read: an embedded form is a spelling
 * inside another record's table, and every form a reader could pick has a
 * lookup of its own.
 *
 * One spelling can head several records (`sale` heads three), so more rows are
 * read than are returned and repeats are dropped in order. `suggest()` starts
 * with `FIRST_SCAN` rows and, only when a full read still holds fewer than ten
 * distinct spellings, reads again with twice as many, so ten are always found
 * when ten exist, however many records one spelling heads.
 */
export const SUGGEST_SQL = `SELECT surface
       FROM lookup_form
      WHERE release_id = ?1 AND origin = 'headword'
        AND surface_key >= ?2 AND surface_key < ?3
      ORDER BY surface_key
      LIMIT ?4`;

/**
 * Rows read on the first pass: the fewest that answer every prefix in one
 * read. Measured over all 1,132,910 prefixes of every headword in release
 * `it-0c432803`, 22 rows finds ten distinct spellings every time; 21 needs a
 * second read for 2 prefixes and 20 for 5, each costing another round trip. On
 * one- to four-letter prefixes it reads 10.4 rows on average. No spelling heads
 * more than six records.
 */
export const FIRST_SCAN = 22;

export async function suggest({ db, releaseId, prefix }: SuggestOptions): Promise<SuggestResult> {
  const key = normalizeItalianExact(prefix);
  const length = [...key].length;
  if (length < MIN_PREFIX_LENGTH) {
    return { outcome: "rejected", prefix: { raw: prefix }, rejection: { reason: "too-short", length, limit: MIN_PREFIX_LENGTH } };
  }
  const trimmed = prefix.trim().length;
  if (trimmed > MAX_PREFIX_LENGTH) {
    return { outcome: "rejected", prefix: { raw: prefix }, rejection: { reason: "too-long", length: trimmed, limit: MAX_PREFIX_LENGTH } };
  }

  // The same two refusals exact lookup makes, for the same reasons: a release
  // that is not complete is not servable, and keys built by another normalizer
  // would be probed with the wrong prefix.
  const release = await readRelease(db, releaseId);
  if (release === undefined) throw new Error(`no complete release '${releaseId}'`);
  if (release.normalizer !== IT_NORMALIZER_VERSION) {
    throw new Error(
      `release '${releaseId}' was built with normalizer '${release.normalizer}', this build has '${IT_NORMALIZER_VERSION}'`,
    );
  }

  const upper = prefixUpperBound(key);
  let suggestions: string[] = [];
  for (let scan = FIRST_SCAN; ; scan *= 2) {
    const rows = await db.all<{ surface: string }>(SUGGEST_SQL, [releaseId, key, upper, scan]);
    suggestions = [...new Set(rows.map((row) => row.surface))].slice(0, SUGGESTION_LIMIT);
    // Enough spellings, or the prefix holds no more rows to read.
    if (suggestions.length === SUGGESTION_LIMIT || rows.length < scan) break;
  }
  return { outcome: "suggested", prefix: { raw: prefix, key }, suggestions };
}
