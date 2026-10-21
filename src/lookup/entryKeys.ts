// Which of a page's related words have an entry (#635): a synonym, antonym or
// derived word is a link only when a search for it opens a page, so a reader
// who follows one never lands on "no entry". The check is the search's own
// first probe, `SEARCH_SQL`'s key on `lookup_form`, read once for every word a
// page lists. A word only a later route of the search reaches (a hand-kept
// reading, a name entry, a word shape …) shows as text: it misses a link, but
// no link leads nowhere.

import { normalizeItalianExact } from "../italian/normalize.js";
import { keyedRead, readKeys, type KeyedRead, type LookupDatabase } from "./database.js";
import { servedBy } from "./served.js";

/**
 * Which of the keys a search finds by `SEARCH_SQL`'s first probe: a
 * `lookup_form` row of any origin in a served release, keyed by
 * `normalizeItalianExact`, that is not an auxiliary's cell, which that probe
 * passes over. One statement for any number of keys, and on D1 one for every
 * list a page asks in one wait (`KeyedRead`, #393). Exported so a test can
 * assert the plan.
 */
export const ENTRY_KEY_SQL: KeyedRead = keyedRead(`SELECT DISTINCT lf.surface_key AS set_key
       FROM lookup_form lf
      WHERE lf.release_id IN (${servedBy("?2")})
        AND lf.surface_key IN (SELECT value FROM json_each(?1))
        AND NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')`);

/** The words of a page that have an entry, by the key a search of each probes. */
export class EntryKeys {
  /** No word has an entry: what a page that read none knows. */
  static readonly none = new EntryKeys(new Set());

  private constructor(private readonly keys: ReadonlySet<string>) {}

  /** The keys `ENTRY_KEY_SQL` answered. */
  static of(keys: Iterable<string>): EntryKeys {
    return new EntryKeys(new Set(keys));
  }

  /** Whether a search for `word`, as spelled, opens an entry. */
  has(word: string): boolean {
    return this.keys.has(normalizeItalianExact(word));
  }
}

/** Which of `words` have an entry: one read of `ENTRY_KEY_SQL`, and none when `words` is empty. */
export async function readEntryKeys(db: LookupDatabase, releaseId: string, words: readonly string[]): Promise<EntryKeys> {
  if (words.length === 0) return EntryKeys.none;
  const rows = await readKeys<{ set_key: string }>(db, ENTRY_KEY_SQL, words.map(normalizeItalianExact), [releaseId]);
  return EntryKeys.of(rows.map((row) => row.set_key));
}
