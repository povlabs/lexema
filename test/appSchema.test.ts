// The six app tables moved from src/db/schema.sql into Drizzle (#228) with no
// change in shape. The key tables are held to the tables as they stood before
// the move (fixtures/app-tables-before-drizzle.sql), read back through SQLite's
// own pragmas, so what is compared is what the database built, not the SQL text.
// The account, identity and session tables then became better-auth's (#229),
// with its `verification` beside them; each is held to its columns here.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { applyAppMigrations } from "../src/db/app/migrations.js";

const file = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

/** The key tables, unchanged since the move. */
const KEY_TABLES = ["api_key", "api_key_minute", "api_key_usage"] as const;
/** better-auth's tables, under Lexema's names (#229). */
const AUTH_TABLES = ["developer_account", "provider_identity", "developer_session", "verification"] as const;
const APP_TABLES = [...AUTH_TABLES, ...KEY_TABLES] as const;

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

test("the migrations build every key table in the shape schema.sql gave it", () => {
  const reference = before();
  const db = migrated();
  for (const table of KEY_TABLES) assert.deepEqual(shape(db, table), shape(reference, table), table);
});

test("better-auth's tables are STRICT, keep Lexema's names for the columns other code reads, and are what an owned key's owner is", () => {
  const db = migrated();
  const columns = (table: string) =>
    rows(db, `PRAGMA table_info(${table})`).map(({ name, type, notnull, pk }) => `${String(name)} ${String(type)}${notnull ? " NOT NULL" : ""}${pk ? " PK" : ""}`);
  for (const table of AUTH_TABLES) assert.equal(shape(db, table).table[0]?.strict, 1, table);
  assert.deepEqual(columns("developer_account"), [
    "account_id INTEGER NOT NULL PK",
    "name TEXT NOT NULL",
    "email TEXT NOT NULL",
    "email_verified INTEGER NOT NULL",
    "image TEXT",
    "created_at TEXT NOT NULL",
    "updated_at TEXT NOT NULL",
    "deleted_at TEXT",
  ]);
  assert.deepEqual(columns("provider_identity"), [
    "identity_id INTEGER NOT NULL PK",
    "account_id INTEGER NOT NULL",
    "provider TEXT NOT NULL",
    "provider_user_id TEXT NOT NULL",
    "email TEXT NOT NULL",
    "display_name TEXT",
    "linked_at TEXT NOT NULL",
    "updated_at TEXT NOT NULL",
    "access_token TEXT",
    "refresh_token TEXT",
    "id_token TEXT",
    "access_token_expires_at TEXT",
    "refresh_token_expires_at TEXT",
    "scope TEXT",
    "password TEXT",
  ]);
  assert.deepEqual(columns("developer_session"), [
    "session_id INTEGER NOT NULL PK",
    "token TEXT NOT NULL",
    "account_id INTEGER NOT NULL",
    "expires_at TEXT NOT NULL",
    "created_at TEXT NOT NULL",
    "updated_at TEXT NOT NULL",
    "ip_address TEXT",
    "user_agent TEXT",
  ]);
  assert.deepEqual(columns("verification"), [
    "verification_id INTEGER NOT NULL PK",
    "identifier TEXT NOT NULL",
    "value TEXT NOT NULL",
    "expires_at TEXT NOT NULL",
    "created_at TEXT NOT NULL",
    "updated_at TEXT NOT NULL",
  ]);
  for (const table of ["api_key", "provider_identity", "developer_session"]) {
    const [reference] = shape(db, table).foreignKeys.filter(({ table: parent }) => parent === "developer_account");
    assert.equal(reference?.to, "account_id", table);
  }
});

test("better-auth's tables refuse what Lexema never keeps: a provider's tokens, a picture, a session's address, an unverified account", () => {
  const db = migrated();
  const at = "2026-09-30T12:00:00.000Z";
  db.prepare("INSERT INTO developer_account (name, email, email_verified, created_at, updated_at) VALUES ('Ada', 'ada@example.com', 1, ?, ?)").run(at, at);
  const refused: [string, string][] = [
    ["an unverified account", "INSERT INTO developer_account (name, email, email_verified, created_at, updated_at) VALUES ('', 'bob@example.com', 0, '', '')"],
    ["a picture", "UPDATE developer_account SET image = 'https://example.com/ada.png'"],
    ["an uppercase email", "UPDATE developer_account SET email = 'Ada@example.com'"],
    [
      "a provider's token",
      "INSERT INTO provider_identity (account_id, provider, provider_user_id, email, linked_at, updated_at, access_token) VALUES (1, 'google', 'g', 'ada@example.com', '', '', 'ya29')",
    ],
    ["a provider Lexema has not", "INSERT INTO provider_identity (account_id, provider, provider_user_id, email, linked_at, updated_at) VALUES (1, 'apple', 'a', 'ada@example.com', '', '')"],
    ["a session's address", "INSERT INTO developer_session (token, account_id, expires_at, created_at, updated_at, ip_address) VALUES ('t', 1, '', '', '', '127.0.0.1')"],
  ];
  for (const [what, sql] of refused) assert.throws(() => db.exec(sql), /CHECK constraint failed/, what);
});

test("the migrations add only the app tables and their indexes", () => {
  const dictionary = new DatabaseSync(":memory:");
  dictionary.exec(file("src/db/schema.sql"));
  const names = (db: DatabaseSync) =>
    new Set(rows(db, "SELECT type || ' ' || name AS entry FROM sqlite_schema").map(({ entry }) => String(entry)));
  const added = [...names(migrated())].filter((entry) => !names(dictionary).has(entry)).sort();
  assert.deepEqual(added, [
    "index api_key_by_owner",
    "index developer_account_email_unique",
    "index developer_session_by_account",
    "index developer_session_by_expiry",
    "index developer_session_token_unique",
    "index provider_identity_by_account",
    "index provider_identity_provider_user",
    "index sqlite_autoindex_api_key_1",
    "index sqlite_autoindex_api_key_minute_1",
    "index sqlite_autoindex_api_key_usage_1",
    "index verification_by_expiry",
    "index verification_by_identifier",
    ...APP_TABLES.map((table) => `table ${table}`).sort(),
  ]);
});
