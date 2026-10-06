// Suggestions while typing: a prefix in, at most ten headword spellings out.
// What it returns and the order it returns them in are in docs/LOOKUP.md
// § "Suggestions"; the measurements behind the bounds are in
// reports/2026-09-23-autocomplete-measurements.md.
//
// This is not a lookup. It names spellings a reader might mean, and choosing
// one runs the real lookup for it; nothing here reads a sense, a form or a
// grammar claim, so nothing here can say what a word means.
//
// A prefix of several words also gets the typed words completed so that they
// read as a multi-word headword (`vado v` → `vado via`, #214): the phrase rule
// of src/lookup/phrase.ts, run only while the list has room left.

import { IT_NORMALIZER_VERSION, normalizeItalianExact } from "../italian/normalize.js";
import type { LookupDatabase } from "./database.js";
import { HEADWORD_PREFIX_SQL, prefixUpperBound } from "./keyRange.js";
import { MAX_QUERY_LENGTH, readRelease } from "./lookup.js";
import { phraseCompletions, type PhraseOffer } from "./phrase.js";
import { inKeyOrder, servedReleases } from "./served.js";

/**
 * The shortest prefix answered, in characters of the normalized key. Two
 * letters, Huey's call of 2026-10-01 (#387): a single letter is not worth a
 * request. It was one letter before; the query was never the cost, since it
 * walks the index in key order and stops after a handful of rows, so the
 * bound exists to cut requests, not reads.
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
 * A prefix the index was probed for, and what it held. `suggestions` are the
 * headwords that begin with it, in key order; `phrases` follow them, the typed
 * words completed so that they read as a multi-word headword, none already
 * among `suggestions`. The two together are at most `SUGGESTION_LIMIT`
 * (`offered`). Both are empty when nothing begins with the prefix, which is an
 * answer and not a failure.
 */
export interface Suggested {
  outcome: "suggested";
  prefix: { raw: string; key: string };
  suggestions: string[];
  phrases: PhraseOffer[];
}

/** What the search field lists for an answer, in order: the headwords, then the completed phrases. */
export function offered(answer: Suggested): string[] {
  return [...answer.suggestions, ...answer.phrases.map((offer) => offer.phrase)];
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

/** Why a prefix is not sent to the index, or undefined when it may be: the refusals `suggest` makes, read before any database. */
export function prefixRejectionOf(prefix: string): PrefixRejected["rejection"] | undefined {
  const length = [...normalizeItalianExact(prefix)].length;
  if (length < MIN_PREFIX_LENGTH) return { reason: "too-short", length, limit: MIN_PREFIX_LENGTH };
  const trimmed = prefix.trim().length;
  if (trimmed > MAX_PREFIX_LENGTH) return { reason: "too-long", length: trimmed, limit: MAX_PREFIX_LENGTH };
  return undefined;
}

export { prefixUpperBound };

/** Whether a normalized key has several words, which is when `suggest` adds phrases. */
const hasSeveralWords = (key: string): boolean => /\s/.test(key);

/**
 * An answer that holds every suggestion for its prefix, so a longer prefix can
 * be answered from it without asking (#387).
 *
 * An answer holds everything when it is shorter than `SUGGESTION_LIMIT`: the
 * read only stops short of ten once the prefix has no rows left. And it holds
 * only headwords when the prefix is one word, since phrases are added only for
 * several. A longer one-word prefix then gets exactly the headwords of this
 * list whose key starts with its key, in this list's order: its rows are a
 * slice of this prefix's rows, read in the same key order, and a headword's key
 * is `normalizeItalianExact` of its spelling (src/import/importRelease.ts). A
 * full list, or a prefix of several words, cannot be built, so it can never
 * answer for the server.
 */
export class CompleteSuggestions {
  private constructor(
    private readonly key: string,
    private readonly offered: readonly string[],
  ) {}

  /** `offered` as the whole answer for `prefix`, or undefined when it may not be the whole answer. */
  static of(prefix: string, offered: readonly string[]): CompleteSuggestions | undefined {
    const key = normalizeItalianExact(prefix);
    if (prefixRejectionOf(prefix) !== undefined || offered.length >= SUGGESTION_LIMIT || hasSeveralWords(key)) return undefined;
    return new CompleteSuggestions(key, offered);
  }

  /**
   * What `suggest` offers for `prefix`, or undefined when only the server can
   * say: a prefix it would refuse, one that does not start with this answer's
   * prefix, or one of several words, which may also be offered phrases.
   */
  narrow(prefix: string): string[] | undefined {
    if (prefixRejectionOf(prefix) !== undefined) return undefined;
    const key = normalizeItalianExact(prefix);
    if (!key.startsWith(this.key) || hasSeveralWords(key)) return undefined;
    return this.offered.filter((word) => normalizeItalianExact(word).startsWith(key));
  }
}

// Headword spellings starting with a prefix, in alphabetical order of the
// normalized key: the first words in the dictionary under what was typed.
// Huey's ruling, 2026-09-23: "it should show alphabetical order like the first
// 10, if i write a it should show words from letter a from database".
//
// The read is `HEADWORD_PREFIX_SQL` (src/lookup/keyRange.ts), a range probe in
// key order that `LIMIT` stops early, once for each release the master serves
// and merged in key order. Only headwords are read: an embedded form is a
// spelling inside another record's table, and every form a reader could pick
// has a lookup of its own.
//
// One spelling can head several records (`sale` heads three), so more rows are
// read than are returned and repeats are dropped in order. `suggest()` starts
// with `FIRST_SCAN` rows and, only when a full read still holds fewer than ten
// distinct spellings, reads again with twice as many, so ten are always found
// when ten exist, however many records one spelling heads.

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
  const rejection = prefixRejectionOf(prefix);
  if (rejection !== undefined) return { outcome: "rejected", prefix: { raw: prefix }, rejection };
  const key = normalizeItalianExact(prefix);

  // The same two refusals exact lookup makes, for the same reasons: a release
  // that is not complete is not servable, and keys built by another normalizer
  // would be probed with the wrong prefix.
  // The served releases are read beside the release, not after it: one wait,
  // not two, and the refusals below still come before any prefix is read.
  const [release, releases] = await Promise.all([readRelease(db, releaseId), servedReleases(db, releaseId)]);
  if (release === undefined) throw new Error(`no complete release '${releaseId}'`);
  if (release.normalizer !== IT_NORMALIZER_VERSION) {
    throw new Error(
      `release '${releaseId}' was built with normalizer '${release.normalizer}', this build has '${IT_NORMALIZER_VERSION}'`,
    );
  }

  const upper = prefixUpperBound(key);
  let suggestions: string[] = [];
  for (let scan = FIRST_SCAN; ; scan *= 2) {
    const rows = await inKeyOrder<{ surface_key: string; surface: string }>(db, releases, HEADWORD_PREFIX_SQL, [key, upper], scan);
    suggestions = [...new Set(rows.map((row) => row.surface))].slice(0, SUGGESTION_LIMIT);
    // Enough spellings, or the prefix holds no more rows to read.
    if (suggestions.length === SUGGESTION_LIMIT || rows.length < scan) break;
  }
  // Only while the list has room, and only for a prefix of several words:
  // `phraseCompletions` reads nothing for one word.
  const room = SUGGESTION_LIMIT - suggestions.length;
  const listed = new Set(suggestions.map(normalizeItalianExact));
  const phrases =
    room > 0
      ? (await phraseCompletions(db, releaseId, releases, key, SUGGESTION_LIMIT)).filter((offer) => !listed.has(offer.phrase)).slice(0, room)
      : [];
  return { outcome: "suggested", prefix: { raw: prefix, key }, suggestions, phrases };
}
