// `load:names` (ADR 0032, #794): bring the dictionary's name entries in line
// with the committed Wikidata snapshot. It reads the master and writes
// nothing: the plan is the SQL a run applies, counted.
//
// A name is served only where the dictionary has nothing to read for its
// spelling: an item whose label's search key a served reading already answers
// with a meaning, or a table already lists, is left out, so every page that
// shows something today shows exactly that after the load. `Italia` and
// `Iran` are Wiktionary names with a meaning, and `Sale` the comune is the
// key of the salt noun, so none gets a name entry; `Hormuz` has no entry, so
// it gets one. Each run writes the snapshot's other items the master does not
// hold as the snapshot states them, and removes every held item it no longer
// serves, so a refresh is a diff, never a reload. No source row is touched.

import { normalizeItalianExact } from "../italian/normalize.js";
import { shownGloss } from "../italian/headwordEcho.js";
import { isFurnitureGloss } from "../italian/furniture.js";
import { literal } from "../import/seedSql.js";
import { PAGE_ENTRY_TABLES } from "../lookup/served.js";
import { readMasterRelease, select, upgradeNeededFor, type MasterReader } from "../update/master.js";
import { NAME_INDEXES, NAME_TABLES } from "../update/masterUpgrade.js";
import { PlanCounts } from "../update/planCounts.js";
import type { NameItem } from "./nameItem.js";
import { snapshotOf } from "./nameSnapshot.js";

/** The columns of `name_entry`, in the order a row is written. */
const COLUMNS = ["item", "label", "label_key", "description", "category"] as const;

/** One `name_entry` row, as stored. */
type NameRow = Record<(typeof COLUMNS)[number], string>;

/** The row an item is stored as. */
export const nameRow = (item: NameItem): NameRow => ({
  item: item.item,
  label: item.label,
  label_key: normalizeItalianExact(item.label),
  description: item.description,
  category: item.category,
});

const sameRow = (a: NameRow, b: NameRow): boolean => COLUMNS.every((column) => a[column] === b[column]);

/**
 * Whether `text`, a gloss or definition of a reading of `word`, is a meaning
 * the page shows: not empty, not only Wikizionario's missing-definition
 * placeholder, not only the headword (#255, #395), and not the bare headword
 * line (#28).
 */
export function isShownMeaning(text: string, word: string): boolean {
  const shown = shownGloss(text, word);
  return shown !== undefined && !isFurnitureGloss(shown, word);
}

/** What a run does. */
export interface NamePlan {
  masterReleaseId: string;
  /** Items written: absent from the master, or held with other text. */
  written: NameItem[];
  /** Held items no longer served: gone from the snapshot, or their key now answered by the source. */
  removed: NameRow[];
  /** Snapshot items left out because the dictionary already answers their label's search key. */
  explained: NameItem[];
  /** Empty when there is nothing to do. */
  sql: string;
  counts: PlanCounts;
}

/** What the upgrade creates for the names to be written into. */
const NAME_UPGRADE: readonly string[] = [...NAME_TABLES, ...NAME_INDEXES];

/** The upgrade names the names write into that the master lacks: run `update:upgrade` before the plan's SQL while any is listed. */
export const missingForNames = (reader: MasterReader): string[] => upgradeNeededFor(reader, NAME_UPGRADE);

const json = (values: unknown): string => literal(JSON.stringify(values));

/** Which of `names` the master has. */
const tablesIn = (reader: MasterReader, names: readonly string[]): Set<string> =>
  new Set(select<{ name: string }>(reader, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (SELECT value FROM json_each(${json(names)}))`).map((row) => row.name));

/**
 * How many keys one read asks about. The keys are inlined once per arm of the
 * read, five arms at most, and D1 caps a statement at 100 KB; 500 keys of the
 * snapshot's are about 10 KB, so the read stays near half of it.
 */
const LABELS_PAGE = 500;

/**
 * The search keys among `keys` whose lookup the dictionary already answers
 * with something to read: a served record headed by the key with a meaning the
 * page shows (a sense gloss or a recovered definition), any served record
 * whose table lists the key (its page shows that word's block), a page-only
 * entry with a definition, or a hand-kept reading. Search ignores capitals, so
 * `Sale` the comune is the key `sale`, which the salt noun already answers.
 * Read through the key indexes, a page of keys at a time.
 */
export function answeredKeys(reader: MasterReader, masterReleaseId: string, keys: readonly string[]): Set<string> {
  const tables = tablesIn(reader, [...PAGE_ENTRY_TABLES, "recovered_definition", "hand_kept_definition"]);
  // The served releases, read once and written into each read as literals.
  const served = select<{ release_id: string }>(reader, `SELECT release_id FROM served_release WHERE master_release_id = ${literal(masterReleaseId)}`)
    .map((row) => literal(row.release_id))
    .join(", ");
  const answered = new Set<string>();
  const distinct = [...new Set(keys)];
  if (served === "") return answered;
  for (let start = 0; start < distinct.length; start += LABELS_PAGE) {
    // Each arm reads the page's keys itself: a dictionary read is one SELECT, so there is no WITH to share them.
    // CROSS JOIN keeps the keys the outer loop, so each is one probe of a key index (release and key); left to
    // the planner, it walked a whole release of `lookup_form` and D1 reset the statement on its CPU limit.
    const asked = `json_each(${json(distinct.slice(start, start + LABELS_PAGE))}) a CROSS JOIN`;
    // A record's search rows, probed as a search probes them: a hidden record has none, and neither
    // has a record a change replaced, so every row found is a served record's.
    const records = (origin: string) => `FROM ${asked} lookup_form lf ON lf.release_id IN (${served}) AND lf.surface_key = a.value AND lf.origin = '${origin}'
        JOIN source_record r ON r.record_id = lf.record_id`;
    // A headword's text is judged below, as a page judges it; a table's listing answers the key whatever it says.
    const arms = [
      `SELECT a.value AS word_key, r.word AS word, g.text AS text ${records("headword")} JOIN sense s ON s.record_id = r.record_id JOIN sense_gloss g ON g.sense_id = s.sense_id`,
      `SELECT DISTINCT a.value, NULL, NULL ${records("embedded-form")}`,
      ...(tables.has("recovered_definition") ? [`SELECT a.value, r.word, d.text ${records("headword")} JOIN recovered_definition d ON d.record_id = r.record_id`] : []),
      ...(PAGE_ENTRY_TABLES.every((table) => tables.has(table))
        ? [
            `SELECT a.value, e.word, d.text FROM ${asked} recovered_entry e ON e.release_id IN (${served}) AND e.word_key = a.value
        JOIN entry_definition d ON d.entry_id = e.entry_id`,
          ]
        : []),
      ...(tables.has("hand_kept_definition") ? [`SELECT a.value, NULL, NULL FROM ${asked} hand_kept_definition h ON h.word_key = a.value`] : []),
    ];
    for (const row of select<{ word_key: string; word: string | null; text: string | null }>(reader, arms.join("\n      UNION ALL\n"))) {
      if (row.word === null || row.text === null || isShownMeaning(row.text, row.word)) answered.add(row.word_key);
    }
  }
  return answered;
}

/** How many rows one read of `name_entry` returns: each read is a Wrangler run, and a page this size stays a few hundred KB. */
const HELD_PAGE = 5_000;

/** The `name_entry` rows the master holds, by item, read a page at a time in item order; none when it has no such table yet. */
function heldRows(reader: MasterReader): Map<string, NameRow> {
  const held = new Map<string, NameRow>();
  if (!tablesIn(reader, NAME_TABLES).has("name_entry")) return held;
  for (let after = "";;) {
    const page = select<NameRow>(reader, `SELECT ${COLUMNS.join(", ")} FROM name_entry WHERE item > ${literal(after)} ORDER BY item LIMIT ${HELD_PAGE}`);
    for (const row of page) held.set(row.item, row);
    if (page.length < HELD_PAGE) return held;
    after = page[page.length - 1].item;
  }
}

/** At most this many bytes of SQL in one statement, as the update's other writes (src/update/apply.ts). */
const MAX_STATEMENT_BYTES = 64 * 1024;

/** `rows` as INSERT statements of at most `MAX_STATEMENT_BYTES` each. */
function inserts(rows: readonly NameRow[]): string[] {
  const head = `INSERT INTO name_entry (${COLUMNS.join(", ")}) VALUES\n  `;
  const statements: string[] = [];
  let batch: string[] = [];
  let bytes = head.length;
  for (const row of rows) {
    const tuple = `(${COLUMNS.map((column) => literal(row[column])).join(", ")})`;
    const size = Buffer.byteLength(tuple) + 4;
    if (batch.length > 0 && bytes + size > MAX_STATEMENT_BYTES) {
      statements.push(`${head}${batch.join(",\n  ")};`);
      batch = [];
      bytes = head.length;
    }
    batch.push(tuple);
    bytes += size;
  }
  if (batch.length > 0) statements.push(`${head}${batch.join(",\n  ")};`);
  return statements;
}

/** At most this many items in one DELETE's list. */
const DELETE_PAGE = 2_000;

/**
 * Plan bringing the master's name entries in line with `snapshot`. It reads
 * the master; it writes nothing. A master without `name_entry` is read as
 * holding none, so the plan counts the same before the upgrade as after it.
 */
export function planNames(reader: MasterReader, snapshot: readonly NameItem[]): NamePlan {
  const master = readMasterRelease(reader);
  const items = snapshotOf(snapshot);
  const answered = answeredKeys(reader, master.releaseId, items.map((item) => nameRow(item).label_key));
  const explained = items.filter((item) => answered.has(nameRow(item).label_key));
  const served = items.filter((item) => !answered.has(nameRow(item).label_key));
  const held = heldRows(reader);
  const written = served.filter((item) => {
    const row = held.get(item.item);
    return row === undefined || !sameRow(row, nameRow(item));
  });
  const servedIds = new Set<string>(served.map((item) => item.item));
  const removed = [...held.values()].filter((row) => !servedIds.has(row.item));
  // A changed item is deleted and written again, so it counts in both.
  const replaced = written.filter((item) => held.has(item.item));
  const deletes = [...removed.map((row) => row.item), ...replaced.map((item) => item.item)];
  if (written.length + removed.length === 0) return { masterReleaseId: master.releaseId, written, removed, explained, sql: "", counts: PlanCounts.NONE };

  const sql = [
    `-- Generated by src/names/loadNames.ts: ${written.length} name entr(ies) written and ${removed.length} removed in ${master.releaseId}.`,
  ];
  for (let start = 0; start < deletes.length; start += DELETE_PAGE) {
    sql.push(`DELETE FROM name_entry WHERE item IN (SELECT value FROM json_each(${json(deletes.slice(start, start + DELETE_PAGE))}));`);
  }
  sql.push(...inserts(written.map(nameRow)));
  const counts = new PlanCounts({ added: 0, changed: 0, removed: 0 }, { name_entry: written.length }, { name_entry: deletes.length });
  return { masterReleaseId: master.releaseId, written, removed, explained, sql: `${sql.join("\n")}\n`, counts };
}

/** Items the plan writes or removes whose rows the master does not read back as planned. */
export function unwrittenNames(reader: MasterReader, plan: NamePlan): string[] {
  const held = heldRows(reader);
  return [
    ...plan.written.filter((item) => {
      const row = held.get(item.item);
      return row === undefined || !sameRow(row, nameRow(item));
    }).map((item) => `${item.item} (${item.label})`),
    ...plan.removed.filter((row) => held.has(row.item)).map((row) => `${row.item} (${row.label}), still held`),
  ];
}
