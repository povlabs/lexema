// The name entries a dictionary serves (ADR 0032, #794): proper names from
// Wikidata, read from `name_entry` beside the source's readings of their
// spelling, after them. `Hormuz` reads the island; `Brent` reads the river.
// Each is a reading of its own, `Nome proprio`, whose one definition is the
// item's Italian description, and whose ref is its Wikidata item. A spelling
// several items share reads each of them, in the snapshot's order: by
// category, then the older item first.

import { categoryRank, isNameCategoryId } from "../names/nameCategories.js";
import { readingPartOfSpeech } from "./articles.js";
import { keyedRead, readKeys, type DictionaryRead, type KeyedRead, type LookupDatabase } from "./database.js";
import { NO_ENTRY_FACTS } from "./pageFacts.js";
import type { DictionaryTables } from "./served.js";
import type { NameRef, Reading } from "./types.js";

export { wikidataItemUrl } from "../names/nameItem.js";

/** A name entry's part-of-speech title: every name entry is a proper name. */
export const NAME_POS_TITLE = "Nome proprio" as const;

/** One name entry, as `NAME_SQL` reads it. */
export interface NameRow {
  item: `Q${number}`;
  label: string;
  description: string;
  category: string;
}

/** Every name entry of a key. */
export const NAME_SQL: DictionaryRead = `SELECT item, label, description, category FROM name_entry WHERE label_key = ?1`;

/** `NAME_SQL` for many keys in one read, light: each entry named, without its description. Exported so a test can assert the plan. */
export const NAME_HEADS_SQL: KeyedRead = keyedRead(`SELECT label_key AS set_key, item, label, category
  FROM name_entry WHERE label_key IN (SELECT value FROM json_each(?1))`);

/** A name entry named, without its description: what a batch candidate carries (src/lookup/batch.ts). */
export interface NameHead {
  nameItem: `Q${number}`;
  releaseId: string;
  word: string;
  pos: "name";
  posTitle: typeof NAME_POS_TITLE;
}

/** The name entries of a dictionary. */
export interface NameEntries {
  /** The entries spelled as the query key, in shown order. */
  readings(key: string): Promise<Reading[]>;
  /** The entries of each of `keys`, named, in the order `readings` gives them: one statement for every key. */
  heads(keys: readonly string[]): Promise<Map<string, NameHead[]>>;
}

const NONE: NameEntries = { readings: async () => [], heads: async () => new Map() };

/** Shown order: by category, then by item number, an older item first. */
export const inShownOrder = <T extends Pick<NameRow, "item" | "category">>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => rankOf(a.category) - rankOf(b.category) || Number(a.item.slice(1)) - Number(b.item.slice(1)));

/** A stored category's place in the list; a category the list no longer has goes last. */
const rankOf = (category: string): number => (isNameCategoryId(category) ? categoryRank(category) : Number.MAX_SAFE_INTEGER);

/** The dictionary's name entries; none on one seeded before their table (#794), which is never sent a statement that names it. */
export function nameEntriesOf(db: LookupDatabase, releaseId: string, tables: Pick<DictionaryTables, "names">): NameEntries {
  if (!tables.names) return NONE;
  return {
    readings: async (key) => inShownOrder(await db.all<NameRow>(NAME_SQL, [key])).map((row) => nameReading(releaseId, row)),
    heads: async (keys) => {
      const byKey = new Map<string, NameHeadRow[]>();
      for (const row of await readKeys<NameHeadRow>(db, NAME_HEADS_SQL, keys)) {
        byKey.set(row.set_key, [...(byKey.get(row.set_key) ?? []), row]);
      }
      return new Map([...byKey].map(([key, rows]) => [key, inShownOrder(rows).map((row) => nameHeadOf(releaseId, row))]));
    },
  };
}

/** One name entry named, as `NAME_HEADS_SQL` reads it. */
export type NameHeadRow = Pick<NameRow, "item" | "label" | "category"> & { set_key: string };

/** A name entry named by its head row. */
export const nameHeadOf = (releaseId: string, row: Pick<NameRow, "item" | "label">): NameHead => ({
  nameItem: row.item, releaseId, word: row.label, pos: "name", posTitle: NAME_POS_TITLE,
});

/** One name entry as a reading: a proper name with one definition and nothing else, since it keys to no record. */
export function nameReading(releaseId: string, row: NameRow): Reading {
  const ref: NameRef = { releaseId, wiki: "www.wikidata.org", item: row.item };
  const { claims, forms, wordFacts, lemmaLinks } = NO_ENTRY_FACTS;
  return {
    nameItem: row.item, description: row.description, ref, word: row.label,
    ...readingPartOfSpeech("name", row.label, claims), posTitle: NAME_POS_TITLE,
    isAboutQuery: true, evidence: [], senses: [], recovered: [], forms, wordFacts, translations: [],
    grammar: { record: claims, byForm: new Map(), bySense: new Map() },
    lemmaLinks, inflections: [], reviews: [],
  };
}
