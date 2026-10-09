// The tables and views a master needs before a change can be applied to it
// (#18), the page-entry tables lookups read (ADR 0024, #403) with their
// definition corrections (#450), and the tables `correct:records` and
// `hide:records` write (#420, #382), for a dictionary seeded before they
// existed. The dictionary deploy runs this as its own step before any data
// (#507), and no write command carries DDL of its own (#509): each refuses to
// write while the upgrade has something to do for it. They are read out of
// src/db/schema.sql rather than written a second time, so a fresh seed and an
// upgraded master cannot drift apart. The statements are safe to run again:
// the tables are created only when absent, and the views are replaced.
//
// The page-entry tables and `corrected_definition` (#507), the recovered
// definition tables and `hidden_record` (#511) are also held to their
// schema.sql definition: when the one a dictionary stores differs, the upgrade
// rebuilds that table's group with its rows (`rebuildSql`). That covers a
// `hidden_record` written before `form-of-foreign-lemma/v1` (#389), which
// lacks `lemma_line` and cannot hold that rule's rows. So is `corrected_form`
// (#743): one from before `surface_key` is rebuilt with each row keyed by the
// release's normalizer, which the plan applies, since SQL cannot. So is
// `corrected_edge` (#755): one from before an edge could be removed has a
// target on every row, and is rebuilt with its rows so a row may name none.
//
// The serving views are held to their schema.sql definition too (#525): when
// one a dictionary stores differs, the upgrade replaces the views
// (`masterUpgradeSql`). A view holds no rows, so that rebuilds no table.

import { DatabaseSync } from "node:sqlite";
import { normalizeItalianExact } from "../italian/normalize.js";
import { PAGE_ENTRY_FACT_TABLE, PAGE_ENTRY_TABLES } from "../lookup/served.js";

/** The tables #18 added, in the order their foreign keys need. */
export const UPDATE_TABLES = ["feed_release", "applied_change"] as const;

/**
 * The page-entry tables (ADR 0024), in the order their foreign keys need. The
 * upgrade creates them empty; lookups serve a master without them as one with
 * no page-only entries (src/lookup/served.ts), so the upgrade is not needed
 * to serve, only to load entries later.
 */
export { PAGE_ENTRY_TABLES };

/**
 * The table a curated definition correction is written to (#450). It points at
 * `entry_definition`, so it follows the page-entry tables. The upgrade creates
 * it so that a load of page-only entries carries no DDL (#507).
 */
export const PAGE_ENTRY_CORRECTION_TABLES = ["corrected_definition"] as const;

/**
 * The table a page-only entry's other fields are written to (ADR 0026, #439).
 * It points at the page-entry tables, so it follows them. The upgrade creates
 * it so that a load of page-only entries carries no DDL (#507).
 */
export const PAGE_ENTRY_FACT_TABLES = [PAGE_ENTRY_FACT_TABLE] as const;

/** The tables `correct:records` writes a record's curated facts (#420), edges (#722) and table cells (#723) to, after its cache revision. */
export const CORRECTION_TABLES = ["correction_version", "corrected_claim", "corrected_edge", "corrected_form"] as const;

/** The indexes lookups read a corrected edge through by the word it names (#722), and a corrected cell by its spelling (#743). */
export const CORRECTION_INDEXES = ["corrected_edge_by_target", "corrected_form_by_key"] as const;

/** The tables `hide:records` writes a hidden record to (#382), after its cache revision. */
export const HIDE_TABLES = ["hide_version", "hidden_record"] as const;

/** The indexes on the page-entry tables. */
export const PAGE_ENTRY_INDEXES = ["recovered_entry_by_key"] as const;

/** Every view that reads through them, each after the views it reads. */
export const SERVING_VIEWS = ["served_release", "served_record", "form_of_candidate", "surface_hit"] as const;

/** A serving view, which the upgrade replaces when its stored definition is not schema.sql's. */
export type ServingView = (typeof SERVING_VIEWS)[number];

/** Every table the upgrade creates when absent, in the order their foreign keys need. */
const UPGRADE_TABLES = [...UPDATE_TABLES, ...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES, ...CORRECTION_TABLES, ...HIDE_TABLES] as const;

/** Every table, index and view the upgrade creates, by its sqlite_schema name. */
export const UPGRADE_NAMES: readonly string[] = [...UPGRADE_TABLES, ...PAGE_ENTRY_INDEXES, ...CORRECTION_INDEXES, ...SERVING_VIEWS];

/** The recovered definitions (#28) with their labels and examples, which point at them, and their index. */
export const RECOVERED_TABLES = ["recovered_definition", "recovered_label", "recovered_example"] as const;
export const RECOVERED_INDEXES = ["recovered_definition_by_record"] as const;

/**
 * The tables the upgrade rebuilds when a stored definition differs from
 * schema.sql's, in groups, each group's tables in the order their foreign keys
 * need, with the indexes on them. A changed table or index rebuilds its whole
 * group and no other. No table outside a group points at one in it
 * (test/update.test.ts holds that), so a group is rebuilt without touching
 * another table. They hold few rows: `update:upgrade --plan-only` names each
 * table a rebuild drops, with its rows.
 */
export const REBUILT_GROUPS = [
  { tables: [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES], indexes: PAGE_ENTRY_INDEXES },
  { tables: RECOVERED_TABLES, indexes: RECOVERED_INDEXES },
  { tables: ["hidden_record"], indexes: [] },
  { tables: ["corrected_form"], indexes: ["corrected_form_by_key"] },
  { tables: ["corrected_edge"], indexes: ["corrected_edge_by_target"] },
] as const satisfies readonly { tables: readonly string[]; indexes: readonly string[] }[];

/** A table the upgrade may rebuild. */
export type RebuiltTable = (typeof REBUILT_GROUPS)[number]["tables"][number];

/**
 * Every table the upgrade may rebuild: the page-entry tables,
 * `corrected_definition`, `recovered_definition`, `recovered_label`,
 * `recovered_example`, `hidden_record`, `corrected_form` and `corrected_edge`.
 */
export const REBUILT_TABLES: readonly RebuiltTable[] = REBUILT_GROUPS.flatMap((group) => group.tables);

const REBUILT_INDEXES: readonly string[] = REBUILT_GROUPS.flatMap((group) => group.indexes);

/** Every name whose stored definition the upgrade compares with schema.sql's: those tables and their indexes. */
export const REBUILT_NAMES: readonly string[] = [...REBUILT_TABLES, ...REBUILT_INDEXES];

/** A column whose value is a key of another column of its row, which SQL cannot compute: the release's normalizer applied to it. */
export interface KeyedColumn {
  readonly column: string;
  readonly from: string;
  readonly key: (value: string) => string;
}

/**
 * The keyed columns of the rebuilt tables. `corrected_form.surface_key`
 * (#743) came after the table, so a rebuild of a `corrected_form` from before
 * it writes each row's key from its `surface`, as the seed does (`KeptTable.keys`).
 */
const KEYED_COLUMNS: Partial<Record<RebuiltTable, KeyedColumn>> = {
  corrected_form: { column: "surface_key", from: "surface", key: normalizeItalianExact },
};

/** The keyed column of `table`, or undefined when it has none. */
export const keyedColumnOf = (table: string): KeyedColumn | undefined => KEYED_COLUMNS[table as RebuiltTable];

/** The `CREATE` kind of a name in `REBUILT_NAMES`. */
export const rebuiltKind = (name: string): "TABLE" | "INDEX" => (REBUILT_INDEXES.includes(name) ? "INDEX" : "TABLE");

/** The groups that hold any of `names`, a table or an index, in rebuild order. */
const groupsOf = (names: readonly string[]) =>
  REBUILT_GROUPS.filter((group) => [...group.tables, ...group.indexes].some((name) => names.includes(name)));

/** Every table of each group that holds one of `names`: what a rebuild for them drops and creates again. */
export const rebuiltTablesFor = (names: readonly string[]): RebuiltTable[] => groupsOf(names).flatMap((group) => group.tables);

/**
 * The column `form-of-foreign-lemma/v1` added to `hidden_record` (#389). A
 * `hidden_record` without it is #382's: `hide:records` refuses to write into it
 * until the upgrade has rebuilt it (src/update/master.ts).
 */
export const HIDDEN_RECORD_SINCE_389 = "lemma_line";

/** The tokens of SQL text: quoted strings and names whole, words, and single other characters. Comments and whitespace are dropped. */
function tokens(sql: string): string[] {
  const found: string[] = [];
  for (let at = 0; at < sql.length; ) {
    const char = sql[at];
    if (/\s/.test(char)) {
      at += 1;
    } else if (sql.startsWith("--", at)) {
      const end = sql.indexOf("\n", at);
      at = end < 0 ? sql.length : end;
    } else if (sql.startsWith("/*", at)) {
      const end = sql.indexOf("*/", at + 2);
      at = end < 0 ? sql.length : end + 2;
    } else if (char === "'" || char === '"' || char === "`") {
      let end = at + 1;
      for (;;) {
        const close = sql.indexOf(char, end);
        if (close < 0) throw new Error(`unclosed ${char} in ${sql.slice(at, at + 40)}`);
        if (sql[close + 1] === char) end = close + 2;
        else {
          end = close + 1;
          break;
        }
      }
      found.push(sql.slice(at, end));
      at = end;
    } else {
      const word = /^[A-Za-z0-9_$]+/.exec(sql.slice(at))?.[0];
      found.push(word ?? char);
      at += word?.length ?? 1;
    }
  }
  return found;
}

/**
 * A table's, index's or view's definition as the upgrade compares it: the text
 * after `CREATE [UNIQUE] TABLE|INDEX|VIEW [IF NOT EXISTS] <name>`, without
 * comments, spacing or the closing semicolon. sqlite_schema keeps the text a
 * table or view was created with, comments included, and drops `IF NOT
 * EXISTS`, so the stored text and schema.sql's agree here exactly when they
 * define the same thing.
 */
export function definitionOf(sql: string): string {
  const all = tokens(sql);
  let at = 0;
  const take = (word: string): boolean => (all[at]?.toUpperCase() === word ? ((at += 1), true) : false);
  if (!take("CREATE")) throw new Error(`not a CREATE statement: ${sql.slice(0, 40)}`);
  take("UNIQUE");
  if (!take("TABLE") && !take("INDEX") && !take("VIEW")) throw new Error(`not a CREATE TABLE, INDEX or VIEW: ${sql.slice(0, 40)}`);
  if (take("IF")) {
    take("NOT");
    take("EXISTS");
  }
  at += 1; // the name
  const rest = all.slice(at);
  if (rest[rest.length - 1] === ";") rest.pop();
  return rest.join(" ");
}

/** The columns a `CREATE TABLE` statement defines, in order, as SQLite reads it. */
export function columnsOf(createTable: string): string[] {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(createTable);
    const name = /^CREATE TABLE (\w+)/.exec(createTable)?.[1];
    return db.prepare("SELECT name FROM pragma_table_info(?)").all(name ?? "").map((row) => String(row.name));
  } finally {
    db.close();
  }
}

/** A rebuilt table as the dictionary holds it before the upgrade: its columns and how many rows it has. */
export interface KeptTable {
  readonly name: RebuiltTable;
  readonly columns: readonly string[];
  readonly rows: number;
  /**
   * When the table lacks its keyed column (`keyedColumnOf`), the key of each
   * distinct value of the column it is keyed from, which the rebuild writes
   * beside the rows that hold it; absent otherwise.
   */
  readonly keys?: readonly (readonly [value: string, key: string])[];
}

/** Where a rebuilt table's rows wait while it is dropped and created again. */
const keptName = (name: string): string => `upgrade_kept_${name}`;

const sqlText = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/**
 * The statement that copies a kept table's rows back by the columns both
 * definitions share. When the new definition adds the table's keyed column,
 * each row also gets the key `keys` gives for its value, joined in as a
 * `VALUES` list: a row whose value `keys` lacks is not copied, and the
 * upgrade's read-back names the rows it lost.
 */
function copyBack(schema: string, { name, columns, keys = [] }: Pick<KeptTable, "name" | "columns" | "keys">): string {
  const target = new Set(columnsOf(createStatement(schema, "TABLE", name)));
  const shared = columns.filter((column) => target.has(column));
  const keyed = keyedColumnOf(name);
  if (keyed === undefined || columns.includes(keyed.column) || !target.has(keyed.column) || keys.length === 0) {
    return `INSERT INTO ${name} (${shared.join(", ")}) SELECT ${shared.join(", ")} FROM ${keptName(name)};`;
  }
  const values = keys.map(([value, key]) => `(${sqlText(value)}, ${sqlText(key)})`).join(", ");
  const columnsOut = [...shared, keyed.column].join(", ");
  const columnsIn = [...shared.map((column) => `k.${column}`), "d.column2"].join(", ");
  return `INSERT INTO ${name} (${columnsOut}) SELECT ${columnsIn} FROM ${keptName(name)} k JOIN (VALUES ${values}) d ON d.column1 = k.${keyed.from};`;
}

/**
 * SQL that rebuilds the groups of `kept` to schema.sql's definitions with every
 * row they hold, and then runs `masterUpgradeSql`. `kept` are the tables of
 * those groups the dictionary has, with their columns. Each one's rows are
 * copied aside, the tables are dropped children first, every table and index
 * of the groups is created from schema.sql, and the rows are copied back
 * parents first by the columns the old and new definitions share, so every
 * foreign key holds at each statement. A row the new definition refuses, or a
 * new column with no default, stops the batch, and D1 rolls it back whole.
 */
export function rebuildSql(schema: string, kept: readonly Pick<KeptTable, "name" | "columns" | "keys">[]): string {
  const groups = groupsOf(kept.map(({ name }) => name));
  const ordered = groups.flatMap((group) => group.tables).flatMap((name) => kept.filter((table) => table.name === name));
  const creates = groups.flatMap((group) => [
    ...group.tables.map((name) => createStatement(schema, "TABLE", name)),
    ...group.indexes.map((name) => createStatement(schema, "INDEX", name)),
  ]);
  const copies = ordered.map((table) => copyBack(schema, table));
  return [
    `-- Rebuild ${ordered.map(({ name }) => name).join(", ")} to schema.sql's definitions, keeping their rows (src/update/masterUpgrade.ts).`,
    ...ordered.map(({ name }) => `CREATE TABLE ${keptName(name)} AS SELECT * FROM ${name};`),
    ...[...ordered].reverse().map(({ name }) => `DROP TABLE ${name};`),
    ...creates,
    masterUpgradeSql(schema),
    ...copies,
    ...ordered.map(({ name }) => `DROP TABLE ${keptName(name)};`),
    "",
  ].join("\n");
}

/** The text of a statement up to the semicolon that ends it, without trailing comments. */
function statementFrom(schema: string, start: number): string {
  const lines: string[] = [];
  for (const line of schema.slice(start).split("\n")) {
    lines.push(line);
    const code = line.replace(/--.*$/, "").trimEnd();
    if (code.endsWith(";")) return lines.join("\n");
  }
  throw new Error("a statement in schema.sql has no closing semicolon");
}

/** The `CREATE <kind> <name>` statement of schema.sql, exactly as written there. */
export function createStatement(schema: string, kind: "TABLE" | "VIEW" | "INDEX", name: string): string {
  const pattern = new RegExp(`^CREATE ${kind} ${name}\\b`, "m");
  const found = pattern.exec(schema);
  if (found === null) throw new Error(`schema.sql has no CREATE ${kind} ${name}`);
  return statementFrom(schema, found.index);
}

/**
 * SQL that brings a master seeded from an older schema.sql to this one's
 * tables and views for applied changes, its empty page-entry tables and the
 * tables corrections and hides are written to, and leaves an up-to-date one as
 * it is. It adds no row and changes none.
 */
export function masterUpgradeSql(schema: string): string {
  const tables = UPGRADE_TABLES.map((name) =>
    createStatement(schema, "TABLE", name).replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS "),
  );
  const indexes = [...PAGE_ENTRY_INDEXES, ...CORRECTION_INDEXES].map((name) =>
    createStatement(schema, "INDEX", name).replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS "),
  );
  const drops = [...SERVING_VIEWS].reverse().map((name) => `DROP VIEW IF EXISTS ${name};`);
  const views = SERVING_VIEWS.map((name) => createStatement(schema, "VIEW", name));
  return [
    "-- The tables and views for changes applied from a later release, the empty page-entry tables, and the tables corrections and hides write (src/update/masterUpgrade.ts).",
    ...tables,
    ...indexes,
    ...drops,
    ...views,
    "",
  ].join("\n");
}
