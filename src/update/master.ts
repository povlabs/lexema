// The master as the diff and the apply read it (#18): its release, the feeds
// it took changes from, and the records it serves. Every read here is a
// SELECT through `readOnly`, so reading the master can never change it.

import { readOnly } from "../lookup/database.js";
import type { MasterRecord } from "./changes.js";
import {
  createStatement,
  definitionOf,
  HIDDEN_RECORD_SINCE_389,
  type KeptTable,
  keyedColumnOf,
  masterUpgradeSql,
  REBUILT_NAMES,
  rebuildSql,
  rebuiltKind,
  rebuiltTablesFor,
  type RebuiltTable,
  SERVING_VIEWS,
  type ServingView,
  UPGRADE_NAMES,
} from "./masterUpgrade.js";

/**
 * A dictionary database the update reads: one statement in, its rows out.
 * Wrangler's `d1 execute --command=<sql>` for a real one, `node:sqlite` in tests.
 */
export interface MasterReader {
  query<Row>(sql: string): Row[];
}

/** A release the master has applied changes from. */
export interface FeedRelease {
  releaseId: string;
  archiveSha256: string;
}

/** What the update needs to know about the master before it compares or writes. */
export interface MasterState {
  /** The complete release the dictionary was seeded from, which names it. */
  releaseId: string;
  normalizer: string;
  archiveSha256: string;
  /**
   * Whether the database has the tables changes are recorded in. A master
   * seeded before #18 has not until `update:upgrade` adds them (masterUpgrade.ts).
   */
  upgraded: boolean;
  feeds: FeedRelease[];
  /** Every record the master serves. */
  records: MasterRecord[];
  /** The largest record id in the database, served or not. */
  maxRecordId: number;
}

/** How many records one read asks for: a few megabytes of JSON from Wrangler. */
const PAGE = 50_000;

const quoted = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** Run one SELECT. */
export function select<Row>(reader: MasterReader, sql: string): Row[] {
  return reader.query<Row>(readOnly(sql));
}

/**
 * The tables, indexes and views `update:upgrade` creates that the master does
 * not have yet, in creation order. Empty means the upgrade has nothing to do.
 */
export function missingUpgrade(reader: MasterReader): string[] {
  const names = UPGRADE_NAMES.map((name) => `'${name}'`).join(", ");
  const present = new Set(select<{ name: string }>(reader, `SELECT name FROM sqlite_schema WHERE name IN (${names})`).map((row) => row.name));
  return UPGRADE_NAMES.filter((name) => !present.has(name));
}

/**
 * Whether the master's `hidden_record` is #382's, without the column
 * `form-of-foreign-lemma/v1` added (#389). Its stored definition then differs
 * from schema.sql's, so `changedUpgrade` lists it and the upgrade rebuilds it;
 * a master without the table has nothing to rebuild.
 */
export function hiddenRecordBefore389(reader: MasterReader): boolean {
  const columns = select<{ name: string }>(reader, "SELECT name FROM pragma_table_info('hidden_record')").map((row) => row.name);
  return columns.length > 0 && !columns.includes(HIDDEN_RECORD_SINCE_389);
}

/**
 * Whether the master's `corrected_edge` is #722's, whose every row names a
 * word: one from before an edge could be removed (#755) refuses a row that
 * names none. Its stored definition then differs from schema.sql's, so
 * `changedUpgrade` lists it and the upgrade rebuilds it; a master without the
 * table has nothing to rebuild.
 */
export function correctedEdgeBefore755(reader: MasterReader): boolean {
  return select<{ notnull: number }>(reader, "SELECT \"notnull\" FROM pragma_table_info('corrected_edge') WHERE name = 'target_word'").some((row) => row.notnull === 1);
}

/**
 * Whether the master has `table` without its keyed column (`keyedColumnOf`):
 * a `corrected_form` from before #743, with no `surface_key`. Its stored
 * definition then differs from schema.sql's, so the upgrade rebuilds it, keying
 * each row; a master without the table has nothing to rebuild.
 */
export function lacksKeyedColumn(reader: MasterReader, table: string): boolean {
  const keyed = keyedColumnOf(table);
  if (keyed === undefined) return false;
  const columns = select<{ name: string }>(reader, `SELECT name FROM pragma_table_info('${table}')`).map((row) => row.name);
  return columns.length > 0 && !columns.includes(keyed.column);
}

/** The stored `sql` of each of `names` the master has, by name. */
function storedSql(reader: MasterReader, names: readonly string[]): Map<string, string> {
  const listed = names.map((name) => `'${name}'`).join(", ");
  return new Map(select<{ name: string; sql: string }>(reader, `SELECT name, sql FROM sqlite_schema WHERE name IN (${listed})`).map((row) => [row.name, row.sql]));
}

/**
 * The rebuilt tables and indexes the master has whose stored definition is not
 * schema.sql's (`definitionOf`), in creation order. Any one listed makes the
 * upgrade rebuild its group (`rebuildSql`). A changed serving view is not
 * listed here: `changedViews` lists it, and the upgrade replaces it without
 * rebuilding any table.
 */
export function changedUpgrade(reader: MasterReader, schema: string): string[] {
  const stored = storedSql(reader, REBUILT_NAMES);
  return REBUILT_NAMES.filter((name) => {
    const sql = stored.get(name);
    return sql !== undefined && definitionOf(sql) !== definitionOf(createStatement(schema, rebuiltKind(name), name));
  });
}

/**
 * The serving views the master has whose stored definition is not schema.sql's
 * (`definitionOf`, so comments and spacing do not count), in creation order.
 * Any one listed makes the upgrade replace the views (`masterUpgradeSql`). A
 * view holds no rows, so replacing one rebuilds no table.
 */
export function changedViews(reader: MasterReader, schema: string): ServingView[] {
  const stored = storedSql(reader, SERVING_VIEWS);
  return SERVING_VIEWS.filter((name) => {
    const sql = stored.get(name);
    return sql !== undefined && definitionOf(sql) !== definitionOf(createStatement(schema, "VIEW", name));
  });
}

/**
 * The upgrade names among `names` the master lacks, or holds as the upgrade
 * still rebuilds them (`hidden_record` from before #389, `corrected_edge` from
 * before #755, a table without its keyed column), in the order of
 * `names`. A command whose SQL writes into them refuses to write while any is
 * listed: its SQL holds no DDL, and `update:upgrade` is what clears them.
 */
export function upgradeNeededFor(reader: MasterReader, names: readonly string[]): string[] {
  const needed = new Set(missingUpgrade(reader));
  if (names.includes("hidden_record") && hiddenRecordBefore389(reader)) needed.add("hidden_record");
  if (names.includes("corrected_edge") && correctedEdgeBefore755(reader)) needed.add("corrected_edge");
  for (const name of names) if (lacksKeyedColumn(reader, name)) needed.add(name);
  return names.filter((name) => needed.has(name));
}

/** Why a command does not write into `dictionary` while the upgrade has `needed` to do: it names the command that does it. */
export const upgradeFirst = (dictionary: string, needed: readonly string[]): string =>
  `${dictionary} needs pnpm run update:upgrade first, for ${needed.join(", ")}. Nothing was written.`;

/**
 * Those of `tables` the master has, with their columns and row counts, and,
 * for a table without its keyed column, the key of each value it is keyed from.
 */
function keptTables(reader: MasterReader, tables: readonly RebuiltTable[]): KeptTable[] {
  const present = new Set(
    select<{ name: string }>(reader, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (${tables.map((name) => `'${name}'`).join(", ")})`).map(
      (row) => row.name,
    ),
  );
  return tables.filter((name) => present.has(name)).map((name) => {
    const columns = select<{ name: string }>(reader, `SELECT name FROM pragma_table_info('${name}')`).map((row) => row.name);
    const rows = select<{ n: number }>(reader, `SELECT count(*) AS n FROM ${name}`)[0].n;
    const keyed = keyedColumnOf(name);
    if (keyed === undefined || columns.includes(keyed.column)) return { name, columns, rows };
    const values = select<{ value: string }>(reader, `SELECT DISTINCT ${keyed.from} AS value FROM ${name} ORDER BY 1`).map((row) => row.value);
    return { name, columns, rows, keys: values.map((value) => [value, keyed.key(value)] as const) };
  });
}

/**
 * What `update:upgrade` would do: the names it adds, the table definitions it
 * rebuilds, the serving views it replaces, and its SQL, which writes no row
 * and keeps every row it rebuilds.
 */
export interface UpgradePlan {
  missing: string[];
  /** The rebuilt tables and indexes whose definition changes; empty when none does. */
  changed: string[];
  /** The serving views whose stored definition is not schema.sql's, which the upgrade replaces and rebuilds no table for; empty when none differs. */
  replaced: ServingView[];
  /** The tables a rebuild drops and creates again, every table of each group that holds a `changed` name, with the rows each holds before: empty unless something `changed`. */
  kept: readonly KeptTable[];
  /** Empty when the master has every table and view already, each as schema.sql defines it. */
  sql: string;
}

/** A table a rebuild drops and creates again, with the rows it holds before. */
export interface Rebuild {
  readonly table: RebuiltTable;
  readonly rows: number;
}

/** The tables `plan` rebuilds, each with its rows: what a reader checks before a rebuild runs on the shared dictionary. */
export const rebuildsOf = (plan: Pick<UpgradePlan, "kept">): Rebuild[] => plan.kept.map(({ name, rows }) => ({ table: name, rows }));

/**
 * Plan the upgrade of the master `reader` reads, from schema.sql's text; it
 * writes nothing. A changed table or index rebuilds its group (`rebuildSql`).
 * A missing name or a changed serving view runs `masterUpgradeSql`, which
 * creates what is absent and replaces the views, and rebuilds no table.
 */
export function planUpgrade(reader: MasterReader, schema: string): UpgradePlan {
  const missing = missingUpgrade(reader);
  const changed = changedUpgrade(reader, schema);
  const replaced = changedViews(reader, schema);
  if (changed.length > 0) {
    const kept = keptTables(reader, rebuiltTablesFor(changed));
    return { missing, changed, replaced, kept, sql: rebuildSql(schema, kept) };
  }
  return { missing, changed, replaced, kept: [], sql: missing.length === 0 && replaced.length === 0 ? "" : masterUpgradeSql(schema) };
}

/** What the master `after` an upgrade still lacks or differs in from `plan`'s aim, as reasons; empty when the upgrade did all it planned. */
export function upgradeShortfall(after: MasterReader, schema: string, plan: Pick<UpgradePlan, "kept">): string[] {
  const rows = new Map(keptTables(after, plan.kept.map((table) => table.name)).map((table) => [table.name, table.rows]));
  return [
    ...missingUpgrade(after).map((name) => `the upgrade did not add ${name}`),
    ...changedUpgrade(after, schema).map((name) =>
      name === "hidden_record" && hiddenRecordBefore389(after) ? `the upgrade left hidden_record without its ${HIDDEN_RECORD_SINCE_389} column` : `the upgrade left ${name} unlike schema.sql's definition`,
    ),
    ...changedViews(after, schema).map((name) => `the upgrade left the view ${name} unlike schema.sql's definition`),
    ...plan.kept
      .filter((table) => rows.get(table.name) !== table.rows)
      .map((table) => `the upgrade left ${rows.get(table.name) ?? 0} row(s) in ${table.name}, which held ${table.rows}`),
  ];
}

/** The master without its records: its release, whether it has the update tables yet, and its feeds. */
export type MasterRelease = Omit<MasterState, "records">;

/** The master's release and its feeds, or why the database cannot be read as a master. */
export function readMasterRelease(reader: MasterReader): MasterRelease {
  const releases = select<{ release_id: string; normalizer: string; archive_sha256: string }>(
    reader,
    "SELECT release_id, normalizer, archive_sha256 FROM source_release WHERE status = 'complete' ORDER BY release_id",
  );
  if (releases.length !== 1) {
    throw new Error(
      `a master holds exactly one complete release, this database holds ${releases.length}` +
        (releases.length > 0 ? `: ${releases.map((row) => row.release_id).join(", ")}` : ""),
    );
  }
  const [master] = releases;
  const tables = new Set(
    select<{ name: string }>(reader, "SELECT name FROM sqlite_schema WHERE name IN ('feed_release', 'applied_change', 'served_record')").map(
      (row) => row.name,
    ),
  );
  const upgraded = tables.has("feed_release") && tables.has("applied_change") && tables.has("served_record");
  const feeds = upgraded
    ? select<{ release_id: string; archive_sha256: string }>(
        reader,
        `SELECT f.release_id, r.archive_sha256 FROM feed_release f JOIN source_release r ON r.release_id = f.release_id
          WHERE f.master_release_id = ${quoted(master.release_id)} ORDER BY f.release_id`,
      ).map((row) => ({ releaseId: row.release_id, archiveSha256: row.archive_sha256 }))
    : [];
  const [{ max }] = select<{ max: number | null }>(reader, "SELECT max(record_id) AS max FROM source_record");
  return {
    releaseId: master.release_id,
    normalizer: master.normalizer,
    archiveSha256: master.archive_sha256,
    upgraded,
    feeds,
    maxRecordId: max ?? 0,
  };
}

/** The master's release, its feeds and the records it serves, or why it cannot be read as a master. */
export function readMaster(reader: MasterReader): MasterState {
  const release = readMasterRelease(reader);
  // Before the first apply every record of the master's release is served.
  const served = release.upgraded
    ? `SELECT record_id, release_id, line_no, word, pos, line_sha256 FROM served_record WHERE master_release_id = ${quoted(release.releaseId)}`
    : `SELECT record_id, release_id, line_no, word, pos, line_sha256 FROM source_record WHERE release_id = ${quoted(release.releaseId)}`;
  const records: MasterRecord[] = [];
  for (let after = 0; ; ) {
    const page = select<{ record_id: number; release_id: string; line_no: number; word: string; pos: string; line_sha256: string }>(
      reader,
      `${served} AND record_id > ${after} ORDER BY record_id LIMIT ${PAGE}`,
    );
    for (const row of page) {
      records.push({ recordId: row.record_id, releaseId: row.release_id, lineNo: row.line_no, word: row.word, pos: row.pos, lineSha256: row.line_sha256 });
    }
    if (page.length < PAGE) break;
    after = page[page.length - 1].record_id;
  }
  return { ...release, records };
}

/**
 * How many lines one read asks for. Each read is a Wrangler run of a second or
 * two, so fewer is faster; the ids are inlined, and D1 caps a statement at
 * 100 KB, which 8,000 ids of seven digits stay well under.
 */
const LINES_PAGE = 8_000;

/** The verbatim lines of the records named, by record id. */
export function readLines(reader: MasterReader, recordIds: readonly number[]): Map<number, string> {
  const lines = new Map<number, string>();
  for (let start = 0; start < recordIds.length; start += LINES_PAGE) {
    const ids = recordIds.slice(start, start + LINES_PAGE);
    for (const row of select<{ record_id: number; raw_json: string }>(
      reader,
      `SELECT record_id, raw_json FROM source_record_json WHERE record_id IN (SELECT value FROM json_each(${quoted(JSON.stringify(ids))}))`,
    )) {
      lines.set(row.record_id, row.raw_json);
    }
  }
  const missing = recordIds.filter((id) => !lines.has(id));
  if (missing.length > 0) throw new Error(`no stored line for record(s) ${missing.slice(0, 10).join(", ")}`);
  return lines;
}
