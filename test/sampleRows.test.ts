// The sample rows CI's `d1` job writes to local D1 (#330), held here on
// node:sqlite: they cover exactly the tables the migrations create, and each is
// valid, so a red `d1` job means D1 refused what SQLite accepts.

import assert from "node:assert/strict";
import test from "node:test";
import { tablesTheMigrationsCreate } from "../src/db/app/migrations.js";
import { SAMPLE_ROWS, sampleCoverage, writeSampleRows } from "../src/db/app/sampleRows.js";
import { freshAppDatabase } from "./databases.js";

test("the sample rows write every table the migrations create, and no other", () => {
  assert.deepEqual(sampleCoverage(tablesTheMigrationsCreate()), { unwritten: [], uncreated: [] });
});

test("a table the migrations create with no sample row is named", () => {
  const coverage = sampleCoverage([...tablesTheMigrationsCreate(), "new_table"]);
  assert.deepEqual(coverage, { unwritten: ["new_table"], uncreated: [] });
});

test("every sample row is written, foreign keys enforced, one row per table", async () => {
  const { sqlite, appDb } = freshAppDatabase();
  assert.equal(sqlite.prepare("PRAGMA foreign_keys").get()?.foreign_keys, 1);
  await writeSampleRows(appDb.app);
  for (const { name } of SAMPLE_ROWS) {
    assert.equal(sqlite.prepare(`SELECT count(*) AS n FROM "${name}"`).get()?.n, 1, name);
  }
});

test("a refused sample row names its table", async () => {
  const { sqlite, appDb } = freshAppDatabase();
  sqlite.exec(`CREATE TRIGGER refuse BEFORE INSERT ON api_key_usage BEGIN SELECT RAISE(ABORT, 'refused'); END`);
  await assert.rejects(writeSampleRows(appDb.app), /^Error: api_key_usage: the sample row was refused$/);
});
