// The master as the diff and the apply read it (#18): its release, the feeds
// it took changes from, and the records it serves. Every read here is a
// SELECT through `readOnly`, so reading the master can never change it.

import { readOnly } from "../lookup/database.js";
import type { MasterRecord } from "./changes.js";
import {
  createStatement,
  definitionOf,
  type KeptTable,
  masterUpgradeSql,
  REBUILT_NAMES,
  rebuildSql,
  rebuiltKind,
  rebuiltTablesFor,
  type RebuiltTable,
  UPGRADE_NAMES,
} from "./masterUpgrade.js";

/**
 * A dictionary database the update reads: one statement in, its rows out.
 * Wrangler's `d1 execute --command` for a real one, `node:sqlite` in tests.
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
   * seeded before #18 has not; the first apply adds them (masterUpgrade.ts).
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
 * The rebuilt tables and indexes the master has whose stored definition is not
 * schema.sql's (`definitionOf`), in creation order. Any one listed makes the
 * upgrade rebuild its group (`rebuildSql`).
 */
export function changedUpgrade(reader: MasterReader, schema: string): string[] {
  const names = REBUILT_NAMES.map((name) => `'${name}'`).join(", ");
  const stored = new Map(select<{ name: string; sql: string }>(reader, `SELECT name, sql FROM sqlite_schema WHERE name IN (${names})`).map((row) => [row.name, row.sql]));
  return REBUILT_NAMES.filter((name) => {
    const sql = stored.get(name);
    return sql !== undefined && definitionOf(sql) !== definitionOf(createStatement(schema, rebuiltKind(name), name));
  });
}

/** Those of `tables` the master has, with their columns and row counts. */
function keptTables(reader: MasterReader, tables: readonly RebuiltTable[]): KeptTable[] {
  const present = new Set(
    select<{ name: string }>(reader, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (${tables.map((name) => `'${name}'`).join(", ")})`).map(
      (row) => row.name,
    ),
  );
  return tables.filter((name) => present.has(name)).map((name) => ({
    name,
    columns: select<{ name: string }>(reader, `SELECT name FROM pragma_table_info('${name}')`).map((row) => row.name),
    rows: select<{ n: number }>(reader, `SELECT count(*) AS n FROM ${name}`)[0].n,
  }));
}

/**
 * What `update:upgrade` would do: the names it adds, the definitions it
 * changes, and its SQL, which writes no row and keeps every row it rebuilds.
 */
export interface UpgradePlan {
  missing: string[];
  /** The rebuilt tables and indexes whose definition changes; empty when none does. */
  changed: string[];
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

/** Plan the upgrade of the master `reader` reads, from schema.sql's text; it writes nothing. */
export function planUpgrade(reader: MasterReader, schema: string): UpgradePlan {
  const missing = missingUpgrade(reader);
  const changed = changedUpgrade(reader, schema);
  if (changed.length > 0) {
    const kept = keptTables(reader, rebuiltTablesFor(changed));
    return { missing, changed, kept, sql: rebuildSql(schema, kept) };
  }
  return { missing, changed, kept: [], sql: missing.length === 0 ? "" : masterUpgradeSql(schema) };
}

/** What the master `after` an upgrade still lacks or differs in from `plan`'s aim, as reasons; empty when the upgrade did all it planned. */
export function upgradeShortfall(after: MasterReader, schema: string, plan: Pick<UpgradePlan, "kept">): string[] {
  const rows = new Map(keptTables(after, plan.kept.map((table) => table.name)).map((table) => [table.name, table.rows]));
  return [
    ...missingUpgrade(after).map((name) => `the upgrade did not add ${name}`),
    ...changedUpgrade(after, schema).map((name) => `the upgrade left ${name} unlike schema.sql's definition`),
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
