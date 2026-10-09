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
//
// When the slice of every touched word would write more rows than a Preview
// may (#741, ADR 0018), the slice is a sample: the words the declarations name
// in their `lookups` first, then the others in key order, as many as fit. The
// touched words it leaves out read the shared dictionary, as any other word
// does, and a change's rows for them are dropped from the sample.

import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { literal } from "../import/seedSql.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { correctedEdgeServed } from "../lookup/correctedEdge.js";
import { readOnly } from "../lookup/database.js";
import { bareKey, deletionKeys, foldKey } from "../lookup/nearby.js";
import { lacksKeyedColumn, select, type MasterReader } from "../update/master.js";
import { keyedColumnOf } from "../update/masterUpgrade.js";

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
 * `corrected_form`'s rows as the slice's schema holds them: a shared
 * dictionary whose table predates `surface_key` (#743) has each row keyed
 * here, as its upgrade will key it (`keyedColumnOf`).
 */
function correctedFormRows(reader: MasterReader, rows: readonly Row[]): Row[] {
  const keyed = keyedColumnOf("corrected_form");
  if (keyed === undefined || !lacksKeyedColumn(reader, "corrected_form")) return [...rows];
  return rows.map((row) => ({ ...row, [keyed.column]: keyed.key(String(row[keyed.from])) }));
}

/** The records with a corrected cell spelled as one of `keys` (#743), which a search reads beside `lookup_form`. */
function correctedCellsSpelling(reader: MasterReader, keys: readonly string[], tables: ReadonlySet<string>): number[] {
  if (!tables.has("corrected_form")) return [];
  if (!lacksKeyedColumn(reader, "corrected_form")) {
    return select<{ record_id: number }>(
      reader,
      `SELECT DISTINCT record_id FROM corrected_form WHERE release_id IN (${releasesIn}) AND surface_key IN (SELECT value FROM json_each(${json(keys)}))`,
    ).map(({ record_id }) => record_id);
  }
  // The table holds only curated cells, a few dozen rows, so one without the key is keyed whole.
  const wanted = new Set(keys);
  const rows = correctedFormRows(reader, select<Row>(reader, "SELECT record_id, surface FROM corrected_form"));
  return [...new Set(rows.filter((row) => wanted.has(String(row.surface_key))).map((row) => Number(row.record_id)))];
}

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
  const spelling = [
    ...select<{ record_id: number }>(
      reader,
      `SELECT DISTINCT record_id FROM lookup_form WHERE release_id IN (${releasesIn}) AND surface_key IN (SELECT value FROM json_each(${keyList}))`,
    ).map(({ record_id }) => record_id),
    ...correctedCellsSpelling(reader, keys, tables),
  ];
  // A corrected edge (#722) names a word as a source edge does, while its record is served.
  const edgeTables = ["form_of_edge", ...(tables.has("corrected_edge") ? ["corrected_edge"] : [])];
  const naming = edgeTables.flatMap((table) =>
    select<{ record_id: number }>(
      reader,
      `SELECT DISTINCT e.record_id FROM ${table} e WHERE e.release_id IN (${releasesIn}) AND e.target_word_key IN (SELECT value FROM json_each(${keyList}))${
        table === "corrected_edge" ? ` AND ${correctedEdgeServed("e")}` : ""
      }`,
    ).map(({ record_id }) => record_id),
  );
  // A corrected edge that removes its sense's edges (#755) names no word.
  const targets = [
    ...new Set(
      edgeTables.flatMap((table) =>
        rowsWhere(reader, table, inList("record_id"), spelling).flatMap((row) => (row.target_word_key === null ? [] : [String(row.target_word_key)])),
      ),
    ),
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
  read("corrected_form", () => correctedFormRows(reader, rowsWhere(reader, "corrected_form", inList("record_id"), whole)));
  for (const table of ["source_record", "form_of_edge", "corrected_claim", "corrected_edge"]) byRecord(table, "1 = 1");
  byRecord(
    "sense",
    `sense_index IN (SELECT e.sense_index FROM form_of_edge e WHERE e.record_id = sense.record_id)${
      tables.has("corrected_edge") ? " OR sense_index IN (SELECT c.sense_index FROM corrected_edge c WHERE c.record_id = sense.record_id)" : ""
    }`,
  );
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

  // Hand-kept readings of each word (ADR 0031): they key to no record or page.
  read("hand_kept_definition", () => rowsWhere(reader, "hand_kept_definition", inList("word_key"), keys));

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

/** Every table of `db`, in the order schema.sql creates them, which puts each parent before its children. */
function storedTables(db: DatabaseSync): StoredTable[] {
  const names = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all() as { name: string }[];
  return names.map(({ name }) => ({
    name,
    columns: (db.prepare(`SELECT name FROM pragma_table_info(${literal(name)})`).all() as { name: string }[]).map((column) => column.name),
    indexes: (db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type = 'index' AND tbl_name = ?").get(name) as { n: number }).n,
  }));
}

function transaction(db: DatabaseSync, run: () => void): void {
  db.exec("BEGIN");
  try {
    run();
    db.exec("COMMIT");
  } catch (error: unknown) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Copy `rows` into `table`, each with the columns both have: a master's
 * older table may lack a newer column or keep a dropped one. A row the
 * schema already wrote, such as `grammar_value`'s, is kept as it is.
 */
function copyRows(db: DatabaseSync, table: StoredTable, rows: readonly Row[]): void {
  for (const row of rows) {
    const columns = table.columns.filter((column) => Object.hasOwn(row, column));
    db.prepare(`INSERT OR IGNORE INTO ${table.name} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(...columns.map((column) => row[column]));
  }
}

/**
 * A new local database holding `schema`, then `extra`, and the rows `keys`
 * read from the dictionary `reader` reads. Foreign keys are on, as on D1.
 */
function copiedDatabase(reader: MasterReader, keys: readonly string[], schema: string, extra: string): DatabaseSync {
  const copied = rowsToCopy(reader, keys);
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(schema);
    db.exec(extra);
    transaction(db, () => {
      for (const table of storedTables(db)) copyRows(db, table, ordered(table.name, copied.get(table.name) ?? []));
    });
    return db;
  } catch (error: unknown) {
    db.close();
    throw error;
  }
}

/**
 * Delete every row of `db` whose foreign key names a row `db` lacks, until
 * none is left. On a sample these are the rows a change writes for a word the
 * sample left out, whose own rows were not copied. Deleting a row can leave
 * a row that names it, so the check runs again.
 */
function dropOrphans(db: DatabaseSync): void {
  for (;;) {
    const broken = db.prepare("PRAGMA foreign_key_check").all() as { table: string; fkid: number }[];
    if (broken.length === 0) return;
    for (const key of new Set(broken.map(({ table, fkid }) => JSON.stringify([table, fkid])))) {
      const [table, fkid] = JSON.parse(key) as [string, number];
      const pairs = db.prepare(`SELECT "table" AS parent, "from" AS child, "to" AS referenced FROM pragma_foreign_key_list(${literal(table)}) WHERE id = ? ORDER BY seq`).all(fkid) as {
        parent: string;
        child: string;
        referenced: string | null;
      }[];
      const parent = pairs[0].parent;
      const primaryKey = (db.prepare(`SELECT name FROM pragma_table_info(${literal(parent)}) WHERE pk > 0 ORDER BY pk`).all() as { name: string }[]).map(({ name }) => name);
      const columns = pairs.map(({ child, referenced }, index) => ({ child, referenced: referenced ?? primaryKey[index] }));
      const named = columns.map(({ child }) => `${table}.${child} IS NOT NULL`).join(" AND ");
      const matches = columns.map(({ child, referenced }) => `p.${referenced} = ${table}.${child}`).join(" AND ");
      db.exec(`DELETE FROM ${table} WHERE ${named} AND NOT EXISTS (SELECT 1 FROM ${parent} p WHERE ${matches})`);
    }
  }
}

/**
 * The rows every word a branch touches reads, copied once from the shared
 * dictionary into a local database (#741). Every slice of those words, or of
 * fewer, is built from it, so the shared dictionary is read once however
 * many slices a sample measures: the rows a set of words reads only grow
 * with the set, so fewer words read a part of what the copy holds.
 */
export class SliceSource {
  private constructor(
    private readonly db: DatabaseSync,
    /** The lookup keys of every touched word, sorted. */
    readonly keys: readonly string[],
  ) {}

  /** Copy what `words` read from the shared dictionary `reader` reads. Throws `SliceRefused` for no word. */
  static copy({ reader, words, schema }: { reader: MasterReader; words: readonly string[]; schema: string }): SliceSource {
    const keys = sliceKeys(words);
    if (keys.length === 0) throw new SliceRefused("a slice needs at least one word");
    return new SliceSource(copiedDatabase(reader, keys, schema, ""), keys);
  }

  /** The copy, read as the shared dictionary is: single SELECTs only. */
  get reader(): MasterReader {
    return { query: <R>(sql: string): R[] => this.db.prepare(readOnly(sql)).all() as R[] };
  }

  close(): void {
    this.db.close();
  }
}

/** What a slice is built of beside its words: the schema, the pull request's changes in order, and the fingerprint. */
interface SliceInputs {
  readonly schema: string;
  readonly changes: readonly { file: string; sql: string }[];
  readonly fingerprint: string;
}

/**
 * One Preview's dictionary slice, built locally: the schema, the rows its
 * words read, the pull request's changes applied, and the words it serves.
 * `build` and `fitting` are the only ways to make one, so a slice always
 * holds all four. A whole slice serves every word it was asked for; a sample
 * (#741) serves some of the words a branch touches and names the rest in
 * `leftOut`, which a lookup reads from the shared dictionary.
 */
export class PreviewSlice {
  private constructor(
    /** The local database; the caller closes it. */
    readonly db: DatabaseSync,
    /** The lookup keys it serves. */
    readonly keys: readonly string[],
    readonly fingerprint: string,
    /** The touched words' keys it does not serve, sorted: none for a whole slice. */
    readonly leftOut: readonly string[],
  ) {}

  /**
   * Copy what `words` need from the shared dictionary `reader` reads into a
   * new database holding `schema`, run each change's SQL on it in order, and
   * record the words and the fingerprint. Foreign keys are on, as on D1.
   * Throws `SliceRefused` when a change's SQL does not run on the slice.
   */
  static build({ reader, words, ...inputs }: { reader: MasterReader; words: readonly string[] } & SliceInputs): PreviewSlice {
    const keys = sliceKeys(words);
    if (keys.length === 0) throw new SliceRefused("a slice needs at least one word");
    return PreviewSlice.assemble(reader, keys, [], inputs);
  }

  /**
   * The slice of every word `source` holds when it writes at most `cap`
   * rows; else a sample of them that does (#741). The sample takes the
   * touched words `named` names first, in their order, then the other
   * touched words in key order, while the slice built of them writes at most
   * `cap` rows: the first word past that, and every word after it, is left
   * out. Each candidate is measured on the slice actually built, since two
   * words can share rows, and the longest run that fits is found by halving.
   *
   * The whole slice is built first, with foreign keys checked as each change
   * runs, so a change that does not run on it is refused as `build` refuses
   * it. On a sample, a row a change writes that names a row the sample left
   * out is dropped, and the change's rows for the sampled words are kept.
   * Throws `SliceRefused` when not even the first word fits under the cap.
   */
  static fitting({ source, named, cap, ...inputs }: { source: SliceSource; named: readonly string[]; cap: number } & SliceInputs): PreviewSlice {
    const whole = PreviewSlice.assemble(source.reader, source.keys, [], inputs);
    if (whole.rowsWritten <= cap) return whole;
    whole.close();
    const order = sampleOrder(source.keys, named);
    const sampleOf = (count: number) => PreviewSlice.assemble(source.reader, order.slice(0, count), order.slice(count), inputs);
    // `fits` is the longest run found that fits; a run of `over` words is known not to.
    let fits = sampleOf(1);
    if (fits.rowsWritten > cap) {
      const rows = fits.rowsWritten;
      fits.close();
      throw new SliceRefused(`not even one word fits under the cap: a slice of ${order[0]} alone would write ${rows} rows, over the cap of ${cap}; nothing was written`);
    }
    let over = order.length;
    while (over - fits.keys.length > 1) {
      const count = Math.floor((fits.keys.length + over) / 2);
      const candidate = sampleOf(count);
      if (candidate.rowsWritten <= cap) {
        fits.close();
        fits = candidate;
      } else {
        candidate.close();
        over = count;
      }
    }
    return fits;
  }

  /** The slice of `keys`, leaving out `leftOut`: a change's orphaned rows are dropped only when it leaves one out. */
  private static assemble(reader: MasterReader, keys: readonly string[], leftOut: readonly string[], { schema, changes, fingerprint }: SliceInputs): PreviewSlice {
    const served = sliceKeys(keys);
    const db = copiedDatabase(reader, served, schema, SLICE_TABLES);
    try {
      const slice = new PreviewSlice(db, served, fingerprint, [...leftOut].sort());
      for (const { file, sql } of changes) {
        try {
          transaction(db, () => {
            if (!slice.isSample) db.exec(sql);
            else {
              db.exec("PRAGMA defer_foreign_keys = ON");
              db.exec(sql);
              dropOrphans(db);
            }
          });
        } catch (error: unknown) {
          throw new SliceRefused(`${file} does not run on the slice: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      transaction(db, () => {
        const word = db.prepare("INSERT INTO preview_slice_word (word_key) VALUES (?)");
        for (const key of served) word.run(key);
        db.prepare("INSERT INTO preview_slice (singleton, fingerprint, format) VALUES (1, ?, ?)").run(fingerprint, SLICE_FORMAT);
      });
      return slice;
    } catch (error: unknown) {
      db.close();
      throw error;
    }
  }

  /** Whether the slice serves only some of the words the branch touches. */
  get isSample(): boolean {
    return this.leftOut.length > 0;
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

  private tables(): StoredTable[] {
    return storedTables(this.db);
  }

  private count(table: string): number {
    return (this.db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
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

/**
 * The order a sample takes the touched `keys` in (#741): the key of each word
 * `named` names, in its order and once, then every other key in key order. A
 * named word the branch does not touch is not the slice's to serve, so it is
 * not taken.
 */
export function sampleOrder(keys: readonly string[], named: readonly string[]): string[] {
  const touched = new Set(keys);
  const first = [...new Set(named.map((word) => normalizeItalianExact(word.trim())))].filter((key) => touched.has(key));
  const taken = new Set(first);
  return [...first, ...keys.filter((key) => !taken.has(key))];
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
