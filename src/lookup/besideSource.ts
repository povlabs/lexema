// What a dictionary keeps beside the source's readings of a word, read last
// and in one statement: the hand-kept readings (ADR 0031, src/lookup/handKept.ts)
// and then the name entries (ADR 0032, src/lookup/names.ts). Both are keyed by
// the word's search key, and a lookup reads both for every word, so where the
// dictionary has both tables they go out as one statement, and a word page
// costs D1 no more statements than before the names (#393's ceilings). A
// dictionary with one of the tables reads that one's own statement; one with
// neither is sent none.

import { keyedRead, readKeys, type DictionaryRead, type KeyedRead, type LookupDatabase } from "./database.js";
import { handKeptHeadOf, handKeptReadingsFrom, handKeptReadingsOf, type HandKeptDefinitionRow, type HandKeptHead, type HandKeptHeadRow } from "./handKept.js";
import { inShownOrder, nameEntriesOf, nameHeadOf, nameReading, type NameHead, type NameRow } from "./names.js";
import type { DictionaryTables } from "./served.js";
import type { Reading } from "./types.js";

/** `HAND_KEPT_SQL`, then `NAME_SQL`, as one statement: each row says which it is. Exported so a test can assert the plan. */
export const BESIDE_SOURCE_SQL: DictionaryRead = `SELECT 'kept' AS layer, reading_id, definition_index, word, pos, pos_title, text, page_line, wikitext,
       section_line, section_wikitext, evidence_url, revision_timestamp, NULL AS item, NULL AS category
  FROM hand_kept_definition WHERE word_key = ?1
 UNION ALL
SELECT 'name', NULL, NULL, label, NULL, NULL, description, NULL, NULL, NULL, NULL, NULL, NULL, item, category
  FROM name_entry WHERE label_key = ?1
 ORDER BY layer, reading_id, definition_index`;

/** `HAND_KEPT_HEADS_SQL`, then `NAME_HEADS_SQL`, as one statement for many keys. Exported so a test can assert the plan. */
export const BESIDE_SOURCE_HEADS_SQL: KeyedRead = keyedRead(`SELECT word_key AS set_key, 'kept' AS layer, reading_id, MIN(definition_index) AS first_definition,
       word, pos, pos_title, section_line, evidence_url, NULL AS item, NULL AS category
  FROM hand_kept_definition WHERE word_key IN (SELECT value FROM json_each(?1))
 GROUP BY word_key, reading_id
 UNION ALL
SELECT label_key, 'name', NULL, NULL, label, NULL, NULL, NULL, NULL, item, category
  FROM name_entry WHERE label_key IN (SELECT value FROM json_each(?1))
 ORDER BY set_key, layer, reading_id`);

type BesideRow = ({ layer: "kept" } & HandKeptDefinitionRow) | { layer: "name"; word: string; text: string; item: `Q${number}`; category: string };
type BesideHeadRow = ({ layer: "kept" } & HandKeptHeadRow) | { layer: "name"; set_key: string; word: string; item: `Q${number}`; category: string };

/** What a lookup reads beside the source: readings of a key, or heads of many keys, hand-kept first. */
export interface BesideSource {
  readings(key: string): Promise<Reading[]>;
  heads(keys: readonly string[]): Promise<Map<string, (HandKeptHead | NameHead)[]>>;
}

/** The hand-kept readings and the name entries of a dictionary, in one statement where it has both tables. */
export function besideSourceOf(db: LookupDatabase, releaseId: string, tables: Pick<DictionaryTables, "handKeptReadings" | "names">): BesideSource {
  if (!tables.names) return handKeptReadingsOf(db, releaseId, tables);
  if (!tables.handKeptReadings) return nameEntriesOf(db, releaseId, tables);
  return {
    readings: async (key) => {
      const rows = await db.all<BesideRow>(BESIDE_SOURCE_SQL, [key]);
      const kept = rows.flatMap((row) => (row.layer === "kept" ? [row] : []));
      const names = rows.flatMap((row): NameRow[] => (row.layer === "name" ? [{ item: row.item, label: row.word, description: row.text, category: row.category }] : []));
      return [...handKeptReadingsFrom(releaseId, kept), ...inShownOrder(names).map((row) => nameReading(releaseId, row))];
    },
    heads: async (keys) => {
      const byKey = new Map<string, { kept: HandKeptHead[]; names: { item: `Q${number}`; label: string; category: string }[] }>();
      for (const row of await readKeys<BesideHeadRow>(db, BESIDE_SOURCE_HEADS_SQL, keys)) {
        const held = byKey.get(row.set_key) ?? { kept: [], names: [] };
        if (row.layer === "kept") held.kept.push(handKeptHeadOf(releaseId, row));
        else held.names.push({ item: row.item, label: row.word, category: row.category });
        byKey.set(row.set_key, held);
      }
      return new Map([...byKey].map(([key, { kept, names }]) => [key, [...kept, ...inShownOrder(names).map((row) => nameHeadOf(releaseId, row))]]));
    },
  };
}
