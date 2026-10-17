// Which dictionary a lookup on a Preview reads (#447, #863, ADR 0018). A
// Preview of a pull request that changes dictionary data may have a dictionary
// slice (src/deploy/previewSlice.ts): a small D1 holding only the words the
// pull request touches, with its changes applied. A lookup reads the slice
// when it reaches one of those words, and the shared dictionary otherwise.
//
// A lookup reaches a slice word in one of two ways. Its own key is a slice
// word: `cosetta`. Or one of the spellings rule `it-word-shape/v1` reads it as
// a shape of is a slice word, and the source spells nothing as the key itself:
// `cosette`, a plural of `cosetta` (`shapeKeysOf`, src/lookup/wordShape.ts).
// The lookup reads those shapes only when nothing spells the query
// (src/lookup/lookup.ts), so a word some source record spells keeps reading
// the shared dictionary, which holds every record that spells it. Whether the
// source spells the key is read from the shared dictionary's `lookup_form` for
// any release and form, so a doubtful case reads the shared dictionary, as
// every lookup did before #863.
//
// The route is by the words reached, never by whether the slice finds them: a
// word the pull request hides is in the slice's word list and not in its
// index, so it reads as not found instead of falling back to the shared
// dictionary that still has it. So does a shape of it.

import { normalizeItalianExact } from "../italian/normalize.js";
import type { DictionaryRead, LookupDatabase } from "./database.js";
import { shapeKeysOf } from "./wordShape.js";

/** The lookup keys of a JSON array of keys that the slice serves. */
export const SLICE_WORD_SQL: DictionaryRead = "SELECT word_key FROM preview_slice_word WHERE word_key IN (SELECT value FROM json_each(?1))";

/** Whether some source record spells a lookup key, in any release and as any form. */
export const SPELLED_SQL: DictionaryRead = "SELECT 1 AS spelled FROM lookup_form WHERE surface_key = ?1 LIMIT 1";

/**
 * The dictionary a lookup of `query` reads: `slice` when its key is a slice
 * word, or when a shape spelling of the key is one and `shared` has no record
 * spelling the key; else `shared`. With no slice, always `shared`. The key is
 * the one the lookup probes with (`keyOf`, src/lookup/lookup.ts).
 */
export async function dictionaryFor(query: string, shared: LookupDatabase, slice: LookupDatabase | undefined): Promise<LookupDatabase> {
  if (slice === undefined) return shared;
  const key = normalizeItalianExact(query.trim());
  if (key === "") return shared;
  const served = await slice.all<{ word_key: string }>(SLICE_WORD_SQL, [JSON.stringify([key, ...shapeKeysOf(key)])]);
  if (served.length === 0) return shared;
  if (served.some(({ word_key }) => word_key === key)) return slice;
  const spelled = await shared.all<{ spelled: number }>(SPELLED_SQL, [key]);
  return spelled.length > 0 ? shared : slice;
}
