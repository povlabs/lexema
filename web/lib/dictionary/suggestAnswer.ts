// The body `GET /suggest` answers with, shared by the route that writes it and
// the field that reads it. Types only, so the field's bundle carries none of
// the server.

export type SuggestAnswer =
  /**
   * Headword spellings starting with the prefix, alphabetically, then the typed
   * words completed as a multi-word headword (`vado v` → `vado via`); at most
   * ten, possibly none.
   */
  | { outcome: "suggested"; suggestions: string[] }
  /** The prefix was outside the bounds and the index was not asked. */
  | { outcome: "rejected"; reason: "too-short" | "too-long"; limit: number }
  /** The index could not be read. */
  | { outcome: "failed" }
  /**
   * Too many suggestions asked for this minute (worker/rateLimit.ts); sent with
   * a 429 and the index was not asked.
   */
  | { outcome: "limited" };
