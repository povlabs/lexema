// The six app tables moved from src/db/schema.sql into Drizzle (#228) with no
// change in shape. The migrations are held to the tables as they stood before
// the move (fixtures/app-tables-before-drizzle.sql), read back through SQLite's
// own pragmas, so what is compared is what the database built, not the SQL text.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { applyAppMigrations } from "../src/db/app/migrations.js";

const file = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

const APP_TABLES = [
  "developer_account",
  "provider_identity",
  "developer_session",
  "api_key",
  "api_key_minute",
  "api_key_usage",
] as const;

type Row = Record<string, unknown>;

const rows = (db: DatabaseSync, sql: string): Row[] => db.prepare(sql).all().map((row) => ({ ...row }));

/**
 * Each CHECK in a table's stored DDL, whitespace and identifier quotes
 * normalised, sorted. Column-level and table-level checks enforce the same
 * thing, so where one is written is not part of the shape.
 */
function checksOf(ddl: string): string[] {
  const text = ddl.replace(/--[^\n]*/g, "");
  const checks: string[] = [];
  const keyword = /\bCHECK\s*\(/gi;
  for (let match = keyword.exec(text); match !== null; match = keyword.exec(text)) {
    let depth = 1;
    let at = keyword.lastIndex;
    let quoted = false;
    for (; depth > 0; at += 1) {
      const char = text[at];
      if (char === "'") quoted = !quoted;
      else if (!quoted && char === "(") depth += 1;
      else if (!quoted && char === ")") depth -= 1;
    }
    checks.push(
      text
        .slice(keyword.lastIndex, at - 1)
        .replace(/[`"]/g, "")
        .replace(/\s+/g, " ")
        .replace(/\( /g, "(")
        .replace(/ \)/g, ")")
        .trim(),
    );
  }
  return checks.sort();
}

/** Everything SQLite reports about one table that a query or a write can tell apart. */
function shape(db: DatabaseSync, table: string) {
  const [ddl] = rows(db, `SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = '${table}'`);
  assert.ok(ddl !== undefined, `${table} exists`);
  return {
    table: rows(db, `PRAGMA table_list(${table})`).map(({ type, ncol, wr, strict }) => ({ type, ncol, wr, strict })),
    // The declared type's spelling (`TEXT` or `text`) is not part of the type.
    columns: rows(db, `PRAGMA table_xinfo(${table})`).map((column) => ({ ...column, type: String(column.type).toUpperCase() })),
    indexes: rows(db, `PRAGMA index_list(${table})`)
      .map(({ name, unique, origin, partial }) => ({
        name,
        unique,
        origin,
        partial,
        columns: rows(db, `PRAGMA index_xinfo(${String(name)})`),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    foreignKeys: rows(db, `PRAGMA foreign_key_list(${table})`),
    checks: checksOf(String(ddl.sql)),
  };
}

function before(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(file("fixtures/app-tables-before-drizzle.sql"));
  return db;
}

function migrated(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(file("src/db/schema.sql"));
  applyAppMigrations(db);
  return db;
}

test("src/db/schema.sql defines none of the app tables", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(file("src/db/schema.sql"));
  const present = rows(db, "SELECT name FROM sqlite_schema WHERE type = 'table'").map(({ name }) => name);
  for (const table of APP_TABLES) assert.ok(!present.includes(table), `${table} is still in schema.sql`);
});

test("the migrations build every app table in the shape schema.sql gave it", () => {
  const reference = before();
  const db = migrated();
  for (const table of APP_TABLES) assert.deepEqual(shape(db, table), shape(reference, table), table);
});

test("the migrations add only the app tables and their indexes", () => {
  const dictionary = new DatabaseSync(":memory:");
  dictionary.exec(file("src/db/schema.sql"));
  const names = (db: DatabaseSync) =>
    new Set(rows(db, "SELECT type || ' ' || name AS entry FROM sqlite_schema").map(({ entry }) => String(entry)));
  const added = [...names(migrated())].filter((entry) => !names(dictionary).has(entry)).sort();
  const expected = [...names(before())].sort();
  assert.deepEqual(added, expected);
});
