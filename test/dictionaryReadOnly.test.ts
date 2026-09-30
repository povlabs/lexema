// The dictionary binding is read-only by construction (#240, ADR 0018).
// Production and every Preview share one dictionary D1, so a write through it
// would reach all of them at once. Three holds, each failing on its own:
//
// 1. The type: `LookupDatabase.all` takes only a `DictionaryRead`, so a write
//    does not type-check (`pnpm run typecheck` runs over this file).
// 2. The adapters: both refuse an INSERT, UPDATE, DELETE or DDL statement
//    before it reaches the database, for a string that got past the type.
// 3. The Worker: `DB` is reached only through `fromD1`, so no code path holds
//    the raw binding. The route tests run against a dictionary SQLite itself
//    refuses to write (test/databases.ts).

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DictionaryWriteRefused, fromD1, fromNodeSqlite, readOnly, type DictionaryRead, type LookupDatabase } from "../src/lookup/database.js";
import { readOnlyDictionary } from "./databases.js";

const file = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** Every kind of statement that changes the dictionary, as a caller might spell it. */
const WRITES = [
  "INSERT INTO source_release (release_id) VALUES ('it-x')",
  "insert or replace into source_release (release_id) values ('it-x')",
  "REPLACE INTO source_release (release_id) VALUES ('it-x')",
  "UPDATE source_release SET status = 'failed'",
  "DELETE FROM source_release",
  "  delete from source_release",
  "CREATE TABLE scratch (x)",
  "DROP TABLE source_release",
  "ALTER TABLE source_release ADD COLUMN x TEXT",
  "CREATE INDEX scratch ON source_release (status)",
  "WITH gone AS (SELECT 1) DELETE FROM source_release",
  "SELECT 1; DELETE FROM source_release",
  "PRAGMA query_only = OFF",
] as const;

function dictionary(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(file("src/db/schema.sql"), "utf8"));
  db.exec(`INSERT INTO source_release
    (release_id, source_name, archive_r2_key, archive_sha256, archive_bytes, normalizer, importer_version, schema_version)
    VALUES ('it-a', 'kaikki-it-wiktextract', 'releases/a.jsonl.gz', '${"0".repeat(64)}', 1, 'it-normalize/v1', 'it-import/v1', 1)`);
  return db;
}

const schemaOf = (db: DatabaseSync) =>
  JSON.stringify([db.prepare("SELECT type, name, sql FROM sqlite_schema ORDER BY name").all(), db.prepare("SELECT * FROM source_release").all()]);

test("a write does not type-check as a dictionary statement", () => {
  // Never called: the assertions here are the compiler's.
  const typed = (db: LookupDatabase) => [
    // @ts-expect-error an INSERT is not a DictionaryRead
    db.all("INSERT INTO source_release (release_id) VALUES ('it-x')", []),
    // @ts-expect-error an UPDATE is not a DictionaryRead
    db.all("UPDATE source_release SET status = 'failed'", []),
    // @ts-expect-error a DELETE is not a DictionaryRead
    db.all("DELETE FROM source_release", []),
    // @ts-expect-error DDL is not a DictionaryRead
    db.all("DROP TABLE source_release", []),
    // @ts-expect-error an unchecked string is not a DictionaryRead
    db.all(String("SELECT 1"), []),
    db.all("SELECT release_id FROM source_release", []),
  ];
  assert.equal(typeof typed, "function");
});

test("the node:sqlite adapter refuses every write before it runs, and the dictionary is unchanged", async () => {
  const db = dictionary();
  const unchanged = schemaOf(db);
  const reader = fromNodeSqlite(db);
  for (const sql of WRITES) {
    await assert.rejects(reader.all(sql as DictionaryRead, []), DictionaryWriteRefused, sql);
  }
  assert.equal(schemaOf(db), unchanged);
  const rows = await reader.all<{ release_id: string }>("SELECT release_id FROM source_release", []);
  assert.deepEqual(rows.map(({ release_id }) => release_id), ["it-a"]);
});

test("the D1 adapter refuses every write before D1 sees it", async () => {
  const prepared: string[] = [];
  const statement = { bind: () => statement, all: async () => ({ results: [] }) };
  const reader = fromD1({
    prepare: (sql: string) => {
      prepared.push(sql);
      return statement;
    },
  });
  for (const sql of WRITES) {
    await assert.rejects(reader.all(sql as DictionaryRead, []), DictionaryWriteRefused, sql);
  }
  assert.deepEqual(prepared, []);
  await reader.all("SELECT 1 AS one", []);
  assert.deepEqual(prepared, ["SELECT 1 AS one"]);
});

test("a single SELECT passes, with or without a trailing semicolon, and nothing else does", () => {
  assert.equal(readOnly("SELECT 1"), "SELECT 1");
  assert.equal(readOnly("SELECT\n  1;\n"), "SELECT\n  1");
  assert.throws(() => readOnly("SELECTION"), DictionaryWriteRefused);
  assert.throws(() => readOnly(""), DictionaryWriteRefused);
});

test("the dictionary the route tests use refuses writes in SQLite itself", () => {
  const db = dictionary();
  readOnlyDictionary(db);
  const unchanged = schemaOf(db);
  for (const sql of WRITES.filter((sql) => !sql.startsWith("PRAGMA") && !sql.startsWith("SELECT"))) {
    assert.throws(() => db.exec(sql), /attempt to write a readonly database/, sql);
  }
  assert.equal(schemaOf(db), unchanged);
});

/** Every Worker source file: what runs in production, not its tests. */
function workerSources(): string[] {
  const root = file("web");
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`)
    .filter((path) => !/\/(node_modules|dist|test|\.wrangler)\//.test(path) && !path.endsWith("worker-configuration.d.ts"));
}

test("the Worker reaches DB only through the read-only adapter", () => {
  const sources = workerSources();
  assert.ok(sources.some((path) => path.endsWith("lib/shared/database.ts")), "the scan reads the Worker's sources");
  const uses: string[] = [];
  for (const path of sources) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(/[^\n]*\benv\.DB\b[^\n]*/g)) {
      const line = match[0];
      // Allowed: wrapping it, or asking whether it is there.
      const rest = line.replaceAll("fromD1(env.DB)", "").replaceAll("env.DB === undefined", "");
      if (/\benv\.DB\b/.test(rest)) uses.push(`${path.slice(file("web").length)}: ${line.trim()}`);
    }
  }
  assert.deepEqual(uses, [], "a raw DB binding could be written through");
});
