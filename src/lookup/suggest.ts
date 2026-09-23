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
 * The shortest prefix answered, in characters of the normalized key. One
 * letter matches a tenth of the release (`a` is 59,642 headword rows) and says
 * nothing about which word is meant; two is where Italian's own two-letter
 * words — `io`, `tu`, `re`, `va` — can come back as the exact match.
 */
export const MIN_PREFIX_LENGTH = 2;

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
 * A prefix the index was probed for, and what it held, ranked. `suggestions`
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
 * Headword spellings starting with a prefix, one row per spelling, ranked.
 *
 * The range probe is served by `lookup_form_headword_by_key`, the partial index
 * over headword rows; `test/suggest.test.ts` asserts the plan. Only headwords
 * are read: an embedded form is a spelling inside another record's table, and
 * every form a reader could pick already has a lookup of its own.
 *
 * The rank, and the reason for each key, is in docs/LOOKUP.md § "Suggestions".
 * In short: the exact spelling first; then spellings at least one of whose
 * records has a sense of its own, rather than only senses that say which word
 * it is a form of; then the shorter spelling; then the key, then the spelling,
 * so the order is total and the same on every run.
 *
 * `defined` is read per record and folded per spelling, so one defining record
 * among several form-of records (`sale`, salt, beside two plurals) counts.
 */
export const SUGGEST_SQL = `SELECT surface
       FROM (SELECT lf.surface, lf.surface_key,
                    EXISTS (SELECT 1 FROM sense s
                             WHERE s.record_id = lf.record_id
                               AND NOT EXISTS (SELECT 1 FROM form_of_edge e
                                                WHERE e.record_id = s.record_id
                                                  AND e.sense_index = s.sense_index)) AS defined
               FROM lookup_form lf
              WHERE lf.release_id = ?1 AND lf.origin = 'headword'
                AND lf.surface_key >= ?2 AND lf.surface_key < ?3)
      GROUP BY surface
      ORDER BY MAX(surface_key = ?2) DESC, MAX(defined) DESC, length(surface), surface_key, surface
      LIMIT ?4`;

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

  const rows = await db.all<{ surface: string }>(SUGGEST_SQL, [releaseId, key, prefixUpperBound(key), SUGGESTION_LIMIT]);
  return { outcome: "suggested", prefix: { raw: prefix, key }, suggestions: rows.map((row) => row.surface) };
}
