// Which dictionary a lookup on a Preview reads (#447, ADR 0018). A Preview of
// a pull request that changes dictionary data may have a dictionary slice
// (src/deploy/previewSlice.ts): a small D1 holding only the words the pull
// request touches, with its changes applied. A lookup of one of those words
// reads the slice; any other word reads the shared dictionary.
//
// The route is by the word asked, never by whether the slice finds it: a word
// the pull request hides is in the slice's word list and not in its index, so
// it reads as not found instead of falling back to the shared dictionary that
// still has it.

import { normalizeItalianExact } from "../italian/normalize.js";
import type { DictionaryRead, LookupDatabase } from "./database.js";

/** Whether the slice serves a lookup key. */
export const SLICE_WORD_SQL: DictionaryRead = "SELECT word_key FROM preview_slice_word WHERE word_key = ?";

/**
 * The dictionary a lookup of `query` reads: `slice` when it serves the query's
 * key, else `shared`. With no slice, always `shared`. The key is the one the
 * lookup probes with (`keyOf`, src/lookup/lookup.ts).
 */
export async function dictionaryFor(query: string, shared: LookupDatabase, slice: LookupDatabase | undefined): Promise<LookupDatabase> {
  if (slice === undefined) return shared;
  const key = normalizeItalianExact(query.trim());
  if (key === "") return shared;
  const served = await slice.all<{ word_key: string }>(SLICE_WORD_SQL, [key]);
  return served.length > 0 ? slice : shared;
}
