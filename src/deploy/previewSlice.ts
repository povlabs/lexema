// A Preview's dictionary slice (#447, ADR 0018): a small dictionary holding
// only the words a pull request's change declarations touch, with those
// changes applied, so the Preview of a pull request that changes dictionary
// data shows the change before it merges. Every other word still comes from
// the shared dictionary: the Worker reads the slice only for a word listed in
// its `preview_slice_word` (src/lookup/slice.ts).
//
// The slice is built here, in a local `node:sqlite` database, and only its
// finished rows are written to D1 (web/builds/previewSlice.ts). So the rows it
// writes are counted before anything is written, and the pull request's SQL
// meets D1's foreign keys here first: a change whose SQL names a row the slice
// lacks is refused with nothing written.
//
// What it copies from the shared dictionary, which it only reads (`select`,
// src/update/master.ts): the release rows; every row of each record that
// spells a touched word, of the lemma records those name, and of the records
// an applied change links them to; and of each record that only names the word
// as its form-of target, the rows a lookup lists it by. Beside them, the
// word's page-only entries and the spelling-index rows a not-found page reads
// for it. A lookup of a touched word then reads in the slice what it reads in
// the shared dictionary, less what other words alone hold: the multi-word
// expressions and inflection listings of words outside the slice.

import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { literal } from "../import/seedSql.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { bareKey, deletionKeys, foldKey } from "../lookup/nearby.js";
import { select, type MasterReader } from "../update/master.js";

/** The version of how a slice is built; part of the fingerprint, so a changed build rebuilds every slice. */
export const SLICE_FORMAT = "preview-slice/v1";

/**
 * The tables a slice holds beside the dictionary's: the words it serves, as
 * the lookup keys them, and the fingerprint of what it was built from. The
 * fingerprint row is written last, so a slice whose write stopped part way
 * has none and is built again.
 */
const SLICE_TABLES = `
CREATE TABLE preview_slice_word (
  word_key TEXT PRIMARY KEY
) STRICT, WITHOUT ROWID;
CREATE TABLE preview_slice (
  singleton   INTEGER PRIMARY KEY CHECK (singleton = 1),
  fingerprint TEXT NOT NULL,
  format      TEXT NOT NULL
) STRICT;
`;

/** The most UTF-8 bytes one INSERT carries, as the seed's (src/import/seedSql.ts); D1 refuses a statement over 100,000. */
const STATEMENT_BYTES = 64 * 1024;
/** Ids one read of the shared dictionary names. */
const CHUNK = 500;

/** A change declaration as a slice's fingerprint reads it: its path and its bytes. */
export interface DeclarationFile {
  readonly file: string;
  readonly text: string;
}

/**
 * What a slice is built from: the declarations a branch adds, the dictionary
 * schema and `SLICE_FORMAT`. Two builds with the same fingerprint build the
 * same slice from the same shared dictionary, so the second reuses the first.
 */
export function sliceFingerprint(declarations: readonly DeclarationFile[], schema: string): string {
  const hash = createHash("sha256").update(`${SLICE_FORMAT}\n`).update(schema);
  for (const { file, text } of [...declarations].sort((a, b) => (a.file < b.file ? -1 : 1))) hash.update(`\n${file}\n${text}`);
  return hash.digest("hex");
}

/** Why a slice could not be built; nothing was written anywhere. */
export class SliceRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SliceRefused";
  }
}

type Row = Record<string, string | number | null>;

const json = (values: readonly unknown[]): string => literal(JSON.stringify(values));
const releasesIn = "SELECT release_id FROM source_release";

function chunks<T>(values: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < values.length; start += CHUNK) out.push(values.slice(start, start + CHUNK));
  return out;
}

/** The rows of `table` whose `column` is one of `ids`, read a chunk at a time. */
function rowsWhere(reader: MasterReader, table: string, condition: (ids: string) => string, ids: readonly (number | string)[]): Row[] {
  return chunks([...new Set(ids)]).flatMap((chunk) => select<Row>(reader, `SELECT * FROM ${table} WHERE ${condition(json(chunk))}`));
}

const inList = (column: string) => (ids: string) => `${column} IN (SELECT value FROM json_each(${ids}))`;
const numbers = (rows: readonly Row[], column: string): number[] => rows.flatMap((row) => (typeof row[column] === "number" ? [row[column] as number] : []));

/** The shared dictionary's tables, so a master without an optional table is read without it. */
const tablesOf = (reader: MasterReader): Set<string> =>
  new Set(select<{ name: string }>(reader, "SELECT name FROM sqlite_schema WHERE type = 'table'").map(({ name }) => name));

/** The index key of each word, as a lookup keys its query (src/lookup/lookup.ts). */
export const sliceKeys = (words: readonly string[]): string[] => [...new Set(words.map((word) => normalizeItalianExact(word.trim())))].sort();

/**
 * The records a lookup of `keys` reads, in two kinds. Whole: those spelling a
 * key, the headword records their own edges name, and every record an applied
 * change links one of those to, until no link adds one. Listed: the records
 * that only name a key as a form-of target, which a lookup lists as the word's
 * inflections (`INFLECTION_SQL`, src/lookup/lookup.ts) or reads as a declared
 * lemma's forms (src/lookup/declaredLemma.ts), and never shows whole.
 */
function recordsFor(reader: MasterReader, keys: readonly string[], tables: ReadonlySet<string>): { whole: number[]; listed: number[]; targets: string[] } {
  const keyList = json(keys);
  const spelling = select<{ record_id: number }>(
    reader,
    `SELECT DISTINCT record_id FROM lookup_form WHERE release_id IN (${releasesIn}) AND surface_key IN (SELECT value FROM json_each(${keyList}))`,
  ).map(({ record_id }) => record_id);
  const naming = select<{ record_id: number }>(
    reader,
    `SELECT DISTINCT record_id FROM form_of_edge WHERE release_id IN (${releasesIn}) AND target_word_key IN (SELECT value FROM json_each(${keyList}))`,
  ).map(({ record_id }) => record_id);
  const targets = [
    ...new Set(rowsWhere(reader, "form_of_edge", inList("record_id"), spelling).map((row) => String(row.target_word_key))),
  ].sort();
  const lemmas = chunks(targets).flatMap((chunk) =>
    select<{ record_id: number }>(
      reader,
      `SELECT DISTINCT record_id FROM lookup_form WHERE release_id IN (${releasesIn}) AND origin = 'headword' AND surface_key IN (SELECT value FROM json_each(${json(chunk)}))`,
    ).map(({ record_id }) => record_id),
  );
  const whole = new Set([...spelling, ...lemmas]);
  if (tables.has("applied_change")) {
    let added = [...whole];
    while (added.length > 0) {
      const links = rowsWhere(reader, "applied_change", (ids) => `record_id IN (SELECT value FROM json_each(${ids})) OR replaced_record_id IN (SELECT value FROM json_each(${ids}))`, added);
      added = [...numbers(links, "record_id"), ...numbers(links, "replaced_record_id")].filter((id) => !whole.has(id));
      for (const id of added) whole.add(id);
    }
  }
  const ascending = (ids: Iterable<number>) => [...ids].sort((a, b) => a - b);
  return { whole: ascending(whole), listed: ascending(new Set(naming.filter((id) => !whole.has(id)))), targets };
}

/** Every row the slice copies, by table, read from the shared dictionary. */
function rowsToCopy(reader: MasterReader, keys: readonly string[]): Map<string, Row[]> {
  const tables = tablesOf(reader);
  const { whole, listed, targets } = recordsFor(reader, keys, tables);
  const rows = new Map<string, Row[]>();
  const read = (table: string, rowsOf: () => Row[]) => {
    if (tables.has(table)) rows.set(table, rowsOf());
  };
  const all = (table: string) => read(table, () => select<Row>(reader, `SELECT * FROM ${table}`));
  /** `table`'s rows of every whole record and, when `listing` names which, of every listed record. */
  const byRecord = (table: string, listing?: string) =>
    read(table, () => [
      ...rowsWhere(reader, table, inList("record_id"), whole),
      ...(listing === undefined ? [] : rowsWhere(reader, table, (ids) => `${inList("record_id")(ids)} AND (${listing})`, listed)),
    ]);

  // The releases, and what every Preview's dictionary carries whatever its words.
  for (const table of ["source_release", "release_table_rows", "feed_release", "hide_version", "correction_version", "grammar_value"]) all(table);

  // A whole record's every row; a listed record's only the rows its listing reads.
  for (const table of ["source_record_json", "lookup_form", "claim_review", "recovered_definition", "hidden_record"]) byRecord(table);
  for (const table of ["source_record", "form_of_edge", "corrected_claim"]) byRecord(table, "1 = 1");
  byRecord("sense", "sense_index IN (SELECT e.sense_index FROM form_of_edge e WHERE e.record_id = sense.record_id)");
  byRecord("grammar_claim", "scope = 'record' AND status = 'stated' AND dimension IN ('gender', 'number')");
  read("applied_change", () => rowsWhere(reader, "applied_change", inList("record_id"), whole));
  const wholeIds = new Set(whole);
  const listedSenses = new Set(numbers((rows.get("sense") ?? []).filter((row) => !wholeIds.has(Number(row.record_id))), "sense_id"));
  const senses = numbers(rows.get("sense") ?? [], "sense_id");
  read("sense_gloss", () => rowsWhere(reader, "sense_gloss", inList("sense_id"), senses).filter((row) => !listedSenses.has(Number(row.sense_id)) || row.gloss_index === 0));
  read("sense_label", () => rowsWhere(reader, "sense_label", inList("sense_id"), senses.filter((id) => !listedSenses.has(id))));
  const recovered = numbers(rows.get("recovered_definition") ?? [], "recovered_id");
  for (const table of ["recovered_label", "recovered_example"]) read(table, () => rowsWhere(reader, table, inList("recovered_id"), recovered));

  // Page-only entries of each word, and of each word a copied record names as its lemma.
  read("recovered_entry", () => rowsWhere(reader, "recovered_entry", (ids) => `release_id IN (${releasesIn}) AND word_key IN (SELECT value FROM json_each(${ids}))`, [...keys, ...targets]));
  const entries = numbers(rows.get("recovered_entry") ?? [], "entry_id");
  for (const table of ["entry_definition", "entry_label", "entry_example", "entry_fact", "corrected_definition"]) read(table, () => rowsWhere(reader, table, inList("entry_id"), entries));

  const pages = ["recovered_definition", "hidden_record", "recovered_entry"].flatMap((table) => numbers(rows.get(table) ?? [], "page_id"));
  read("raw_page", () => rowsWhere(reader, "raw_page", inList("page_id"), pages));

  // What a not-found page reads for each word: the accent and typo index rows under its own keys (src/lookup/nearby.ts).
  const folds = [...new Set(keys.flatMap((key) => [foldKey(key), bareKey(key)]))];
  read("accent_fold", () => rowsWhere(reader, "accent_fold", (ids) => `release_id IN (${releasesIn}) AND fold_key IN (SELECT value FROM json_each(${ids}))`, folds));
  const deletions = [...new Set(keys.flatMap(deletionKeys))];
  read("typo_key", () => rowsWhere(reader, "typo_key", (ids) => `release_id IN (${releasesIn}) AND deletion_key IN (SELECT value FROM json_each(${ids}))`, deletions));
  return rows;
}

/** One table of the slice as SQLite stores it: its name, its columns, and the indexes each row it holds is written to. */
interface StoredTable {
  readonly name: string;
  readonly columns: readonly string[];
  readonly indexes: number;
}

/**
 * One Preview's dictionary slice, built locally: the schema, the rows its
 * words read, the pull request's changes applied, and the words it serves.
 * `build` is the only way to make one, so a slice always holds all four.
 */
export class PreviewSlice {
  private constructor(
    /** The local database; the caller closes it. */
    readonly db: DatabaseSync,
    /** The lookup keys it serves. */
    readonly keys: readonly string[],
    readonly fingerprint: string,
  ) {}

  /**
   * Copy what `words` need from the shared dictionary `reader` reads into a
   * new database holding `schema`, run each change's SQL on it in order, and
   * record the words and the fingerprint. Foreign keys are on, as on D1.
   * Throws `SliceRefused` when a change's SQL does not run on the slice.
   */
  static build({ reader, words, schema, changes, fingerprint }: { reader: MasterReader; words: readonly string[]; schema: string; changes: readonly { file: string; sql: string }[]; fingerprint: string }): PreviewSlice {
    const keys = sliceKeys(words);
    if (keys.length === 0) throw new SliceRefused("a slice needs at least one word");
    const copied = rowsToCopy(reader, keys);
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys = ON");
      db.exec(schema);
      db.exec(SLICE_TABLES);
      const slice = new PreviewSlice(db, keys, fingerprint);
      slice.transaction(() => {
        for (const table of slice.tables()) slice.copy(table, ordered(table.name, copied.get(table.name) ?? []));
      });
      for (const { file, sql } of changes) {
        try {
          slice.transaction(() => db.exec(sql));
        } catch (error: unknown) {
          throw new SliceRefused(`${file} does not run on the slice: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      slice.transaction(() => {
        const word = db.prepare("INSERT INTO preview_slice_word (word_key) VALUES (?)");
        for (const key of keys) word.run(key);
        db.prepare("INSERT INTO preview_slice (singleton, fingerprint, format) VALUES (1, ?, ?)").run(fingerprint, SLICE_FORMAT);
      });
      return slice;
    } catch (error: unknown) {
      db.close();
      throw error;
    }
  }

  /**
   * The rows writing this slice to an empty D1 writes, as D1 counts them:
   * each row once for its table and once for each index it is written to
   * (https://developers.cloudflare.com/d1/platform/pricing/).
   */
  get rowsWritten(): number {
    return this.tables().reduce((sum, table) => sum + this.count(table.name) * (1 + table.indexes), 0);
  }

  /** The rows of each table, by table. */
  rowsByTable(): Record<string, number> {
    return Object.fromEntries(this.tables().map(({ name }) => [name, this.count(name)]));
  }

  /**
   * The whole slice as one SQL file for an empty D1: its schema, then its
   * rows table by table, parents before children, and the fingerprint row
   * last. Foreign keys are checked at the end, as the file is one write.
   */
  sql(): string {
    const schema = this.db
      .prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid")
      .all() as { sql: string }[];
    const tables = this.tables().filter(({ name }) => name !== "preview_slice");
    const last = this.tables().filter(({ name }) => name === "preview_slice");
    return [
      "PRAGMA defer_foreign_keys = true;",
      ...schema.map(({ sql }) => `${sql};`),
      ...[...tables, ...last].flatMap((table) => this.inserts(table)),
      "",
    ].join("\n");
  }

  close(): void {
    this.db.close();
  }

  /** Every table, in the order schema.sql creates them, which puts each parent before its children. */
  private tables(): StoredTable[] {
    const names = this.db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all() as { name: string }[];
    return names.map(({ name }) => ({
      name,
      columns: (this.db.prepare(`SELECT name FROM pragma_table_info(${literal(name)})`).all() as { name: string }[]).map((column) => column.name),
      indexes: (this.db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type = 'index' AND tbl_name = ?").get(name) as { n: number }).n,
    }));
  }

  private count(table: string): number {
    return (this.db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
  }

  private transaction(run: () => void): void {
    this.db.exec("BEGIN");
    try {
      run();
      this.db.exec("COMMIT");
    } catch (error: unknown) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * Copy `rows` into `table`, each with the columns both have: a master's
   * older table may lack a newer column or keep a dropped one. A row the
   * schema already wrote, such as `grammar_value`'s, is kept as it is.
   */
  private copy(table: StoredTable, rows: readonly Row[]): void {
    for (const row of rows) {
      const columns = table.columns.filter((column) => Object.hasOwn(row, column));
      this.db
        .prepare(`INSERT OR IGNORE INTO ${table.name} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
        .run(...columns.map((column) => row[column]));
    }
  }

  /** `table`'s rows as INSERTs of at most `STATEMENT_BYTES` each, in the order they were written here. */
  private inserts(table: StoredTable): string[] {
    const rows = this.db.prepare(`SELECT ${table.columns.join(", ")} FROM ${table.name}`).all() as Row[];
    const head = `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES\n  `;
    const statements: string[] = [];
    let batch: string[] = [];
    let bytes = 0;
    for (const row of rows) {
      const tuple = `(${table.columns.map((column) => literal(row[column])).join(", ")})`;
      const size = Buffer.byteLength(tuple, "utf8") + 4;
      if (batch.length > 0 && bytes + size > STATEMENT_BYTES) {
        statements.push(`${head}${batch.join(",\n  ")};`);
        batch = [];
        bytes = 0;
      }
      batch.push(tuple);
      bytes += size;
    }
    if (batch.length > 0) statements.push(`${head}${batch.join(",\n  ")};`);
    return statements;
  }
}

/** Rows in an order their own table's foreign keys accept: a lead-in before the definition it opens. */
function ordered(table: string, rows: readonly Row[]): Row[] {
  const by = (...columns: string[]) => (a: Row, b: Row) => {
    for (const column of columns) {
      const difference = Number(a[column]) - Number(b[column]);
      if (difference !== 0) return difference;
    }
    return 0;
  };
  if (table === "recovered_definition") return [...rows].sort(by("recovered_id"));
  if (table === "entry_definition") return [...rows].sort(by("entry_id", "definition_index"));
  return [...rows];
}
