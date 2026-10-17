// What a dictionary keeps beside the source's readings of a word, read last
// and in one statement: the hand-kept readings (ADR 0031, src/lookup/handKept.ts),
// the name entries (ADR 0032, src/lookup/names.ts) and the Wikidata words
// (ADR 0033, src/lookup/wikidataWords.ts). All are keyed by the word's search
// key, and a lookup reads them for every word, so where the dictionary has
// the tables they go out as one statement, and a word page costs D1 no more
// statements than before the names and the words (#393's ceilings). The
// Wikidata words come back apart: a lookup shows them only when no Wiktionary
// reading answers the word (src/lookup/lookup.ts). A dictionary without the
// Wikidata word tables reads as it did before them: both other tables in one
// statement, or one table's own statement; one with none is sent none.

import { keyedRead, readKeys, type DictionaryRead, type KeyedRead, type LookupDatabase } from "./database.js";
import { handKeptHeadOf, handKeptReadingsFrom, handKeptReadingsOf, type HandKeptDefinitionRow, type HandKeptHead, type HandKeptHeadRow } from "./handKept.js";
import { inShownOrder, nameEntriesOf, nameHeadOf, nameReading, type NameHead, type NameRow } from "./names.js";
import type { DictionaryTables } from "./served.js";
import type { Reading } from "./types.js";
import { isLexicalCategory } from "../wikidataWords/lexicalCategories.js";
import { lexemeNumber } from "../wikidataWords/wikidataWord.js";
import { wikidataWordHeadOf, wikidataWordReading, type WikidataWordHead } from "./wikidataWords.js";

/** The newest row of each lexeme a key spells, as `WIKIDATA_WORD_SQL` reads it. */
const NEWEST = `k.snapshot = (SELECT MAX(l.snapshot) FROM wikidata_word l WHERE l.lexeme = k.lexeme)`;

/** One arm per layer of the read of one key's readings; every arm names every column, so any one may come first. */
const READING_ARMS = {
  kept: `SELECT 'kept' AS layer, reading_id, definition_index, word, pos, pos_title, text, page_line, wikitext,
       section_line, section_wikitext, evidence_url, revision_timestamp, NULL AS item, NULL AS category, NULL AS snapshot, NULL AS forms
  FROM hand_kept_definition WHERE word_key = ?1`,
  name: `SELECT 'name' AS layer, NULL AS reading_id, NULL AS definition_index, label AS word, NULL AS pos, NULL AS pos_title, description AS text, NULL AS page_line, NULL AS wikitext,
       NULL AS section_line, NULL AS section_wikitext, NULL AS evidence_url, NULL AS revision_timestamp, item, category, NULL AS snapshot, NULL AS forms
  FROM name_entry WHERE label_key = ?1`,
  lexeme: `SELECT 'lexeme' AS layer, NULL AS reading_id, NULL AS definition_index, w.lemma AS word, NULL AS pos, NULL AS pos_title, w.glosses AS text, NULL AS page_line, NULL AS wikitext,
       NULL AS section_line, NULL AS section_wikitext, NULL AS evidence_url, NULL AS revision_timestamp, w.lexeme AS item, w.category AS category, w.snapshot AS snapshot, w.forms AS forms
  FROM wikidata_word_key k JOIN wikidata_word w ON w.lexeme = k.lexeme AND w.snapshot = k.snapshot
 WHERE k.word_key = ?1 AND ${NEWEST}`,
} as const;

/** One arm per layer of the read of many keys' heads. */
const HEAD_ARMS = {
  kept: `SELECT word_key AS set_key, 'kept' AS layer, reading_id, MIN(definition_index) AS first_definition,
       word, pos, pos_title, section_line, evidence_url, NULL AS item, NULL AS category
  FROM hand_kept_definition WHERE word_key IN (SELECT value FROM json_each(?1))
 GROUP BY word_key, reading_id`,
  name: `SELECT label_key AS set_key, 'name' AS layer, NULL AS reading_id, NULL AS first_definition,
       label AS word, NULL AS pos, NULL AS pos_title, NULL AS section_line, NULL AS evidence_url, item, category
  FROM name_entry WHERE label_key IN (SELECT value FROM json_each(?1))`,
  lexeme: `SELECT k.word_key AS set_key, 'lexeme' AS layer, NULL AS reading_id, NULL AS first_definition,
       w.lemma AS word, NULL AS pos, NULL AS pos_title, NULL AS section_line, NULL AS evidence_url, w.lexeme AS item, w.category AS category
  FROM wikidata_word_key k JOIN wikidata_word w ON w.lexeme = k.lexeme AND w.snapshot = k.snapshot
 WHERE k.word_key IN (SELECT value FROM json_each(?1)) AND ${NEWEST}`,
} as const;

type Layer = keyof typeof READING_ARMS;

const readingsSql = (layers: readonly Layer[]): DictionaryRead =>
  `${layers.map((layer) => READING_ARMS[layer]).join("\n UNION ALL\n")}\n ORDER BY layer, reading_id, definition_index` as DictionaryRead;
const headsSql = (layers: readonly Layer[]): KeyedRead => keyedRead(`${layers.map((layer) => HEAD_ARMS[layer]).join("\n UNION ALL\n")}\n ORDER BY set_key, layer, reading_id`);

/** The read of a key's readings, for a dictionary with all three tables. Exported so a test can assert the plan. */
export const BESIDE_SOURCE_SQL: DictionaryRead = readingsSql(["kept", "name", "lexeme"]);

/** The read of many keys' heads, for a dictionary with all three tables. Exported so a test can assert the plan. */
export const BESIDE_SOURCE_HEADS_SQL: KeyedRead = headsSql(["kept", "name", "lexeme"]);

/** The two reads of a dictionary with the hand-kept readings and the name entries and no Wikidata words, as before #812. */
const KEPT_AND_NAMES_SQL: DictionaryRead = `SELECT 'kept' AS layer, reading_id, definition_index, word, pos, pos_title, text, page_line, wikitext,
       section_line, section_wikitext, evidence_url, revision_timestamp, NULL AS item, NULL AS category
  FROM hand_kept_definition WHERE word_key = ?1
 UNION ALL
SELECT 'name', NULL, NULL, label, NULL, NULL, description, NULL, NULL, NULL, NULL, NULL, NULL, item, category
  FROM name_entry WHERE label_key = ?1
 ORDER BY layer, reading_id, definition_index`;
const KEPT_AND_NAMES_HEADS_SQL: KeyedRead = keyedRead(`SELECT word_key AS set_key, 'kept' AS layer, reading_id, MIN(definition_index) AS first_definition,
       word, pos, pos_title, section_line, evidence_url, NULL AS item, NULL AS category
  FROM hand_kept_definition WHERE word_key IN (SELECT value FROM json_each(?1))
 GROUP BY word_key, reading_id
 UNION ALL
SELECT label_key, 'name', NULL, NULL, label, NULL, NULL, NULL, NULL, item, category
  FROM name_entry WHERE label_key IN (SELECT value FROM json_each(?1))
 ORDER BY set_key, layer, reading_id`);

type BesideRow =
  | ({ layer: "kept" } & HandKeptDefinitionRow)
  | { layer: "name"; word: string; text: string; item: `Q${number}`; category: string }
  | { layer: "lexeme"; word: string; text: string; item: `L${number}`; category: string; snapshot: string; forms: string };
type BesideHeadRow =
  | ({ layer: "kept" } & HandKeptHeadRow)
  | { layer: "name"; set_key: string; word: string; item: `Q${number}`; category: string }
  | { layer: "lexeme"; set_key: string; word: string; item: `L${number}`; category: string };

/** A key's readings beside the source: the hand-kept readings and name entries, and apart from them the Wikidata words. */
export interface BesideReadings {
  /** Hand-kept readings, then name entries, in shown order. */
  readings: Reading[];
  /** Wikidata words, in lexeme order: shown only where no Wiktionary reading answers the key. */
  wikidataWords: Reading[];
}

/** Many keys' heads beside the source, the Wikidata words apart, as `BesideReadings` holds them. */
export interface BesideHeads {
  heads: Map<string, (HandKeptHead | NameHead)[]>;
  wikidataWords: Map<string, WikidataWordHead[]>;
}

/** What a lookup reads beside the source: readings of a key, or heads of many keys, hand-kept first. */
export interface BesideSource {
  readings(key: string): Promise<BesideReadings>;
  heads(keys: readonly string[]): Promise<BesideHeads>;
}

/** The layers a dictionary has tables for, in read order. */
const layersOf = (tables: Pick<DictionaryTables, "handKeptReadings" | "names" | "wikidataWords">): Layer[] => [
  ...(tables.handKeptReadings ? (["kept"] as const) : []),
  ...(tables.names ? (["name"] as const) : []),
  ...(tables.wikidataWords ? (["lexeme"] as const) : []),
];

const NO_WORDS = { wikidataWords: [] };

/** The hand-kept readings, the name entries and the Wikidata words of a dictionary, in one statement where it has more than one of their tables. */
export function besideSourceOf(db: LookupDatabase, releaseId: string, tables: Pick<DictionaryTables, "handKeptReadings" | "names" | "wikidataWords">): BesideSource {
  const layers = layersOf(tables);
  if (!tables.wikidataWords) {
    // As before the Wikidata words (#812): one table's own statement, or both in one.
    const one = !tables.names ? handKeptReadingsOf(db, releaseId, tables) : !tables.handKeptReadings ? nameEntriesOf(db, releaseId, tables) : undefined;
    if (one !== undefined) {
      return {
        readings: async (key) => ({ readings: await one.readings(key), ...NO_WORDS }),
        heads: async (keys) => ({ heads: await one.heads(keys), wikidataWords: new Map() }),
      };
    }
    return layered(db, releaseId, KEPT_AND_NAMES_SQL, KEPT_AND_NAMES_HEADS_SQL);
  }
  return layered(db, releaseId, readingsSql(layers), headsSql(layers));
}

/** The readings and heads of every layer `readings` and `heads` read, in one statement each. */
function layered(db: LookupDatabase, releaseId: string, readings: DictionaryRead, heads: KeyedRead): BesideSource {
  return {
    readings: async (key) => {
      const rows = await db.all<BesideRow>(readings, [key]);
      const kept = rows.flatMap((row) => (row.layer === "kept" ? [row] : []));
      const names = rows.flatMap((row): NameRow[] => (row.layer === "name" ? [{ item: row.item, label: row.word, description: row.text, category: row.category }] : []));
      const words = rows
        .flatMap((row) => (row.layer === "lexeme" && isLexicalCategory(row.category) ? [{ ...row, category: row.category, lexeme: row.item, lemma: row.word, glosses: row.text }] : []))
        .sort((a, b) => lexemeNumber(a.lexeme) - lexemeNumber(b.lexeme));
      return {
        readings: [...handKeptReadingsFrom(releaseId, kept), ...inShownOrder(names).map((row) => nameReading(releaseId, row))],
        wikidataWords: words.map((row) => wikidataWordReading(releaseId, row)),
      };
    },
    heads: async (keys) => {
      const byKey = new Map<string, { kept: HandKeptHead[]; names: { item: `Q${number}`; label: string; category: string }[]; words: WikidataWordHead[] }>();
      for (const row of await readKeys<BesideHeadRow>(db, heads, keys)) {
        const held = byKey.get(row.set_key) ?? { kept: [], names: [], words: [] };
        if (row.layer === "kept") held.kept.push(handKeptHeadOf(releaseId, row));
        else if (row.layer === "name") held.names.push({ item: row.item, label: row.word, category: row.category });
        else if (isLexicalCategory(row.category)) held.words.push(wikidataWordHeadOf(releaseId, { lexeme: row.item, lemma: row.word, category: row.category }));
        byKey.set(row.set_key, held);
      }
      const entries = [...byKey];
      return {
        heads: new Map(entries.flatMap(([key, { kept, names }]) => (kept.length + names.length === 0 ? [] : [[key, [...kept, ...inShownOrder(names).map((row) => nameHeadOf(releaseId, row))]] as const]))),
        wikidataWords: new Map(
          entries.flatMap(([key, { words }]) => (words.length === 0 ? [] : [[key, [...words].sort((a, b) => lexemeNumber(a.lexeme) - lexemeNumber(b.lexeme))] as const])),
        ),
      };
    },
  };
}
