// How the dictionary deploy sends one SQL batch to D1 (src/deploy/d1Batch.ts,
// #507): through the query API up to 100,000 bytes, as an import past that,
// and never with a LIKE or GLOB pattern D1 refuses.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { overlongPatterns, sqlPatterns } from "../src/db/d1PatternLimit.js";
import { D1Batch, D1BatchRefused, QUERY_API_LIMIT } from "../src/deploy/d1Batch.js";
import type { DeployTarget } from "../src/deploy/dictionaryDeploy.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";

/** A DeployTarget that records each `execute` call and answers it as Wrangler would on success. */
function recording(): DeployTarget & { calls: string[][] } {
  const calls: string[][] = [];
  return { dictionary: "lexema-dictionary", calls, execute: (args) => (calls.push([...args]), "") };
}

/** A statement of exactly `bytes` UTF-8 bytes. */
const sqlOf = (bytes: number): string => {
  const head = "INSERT INTO t (v) VALUES ('";
  const tail = "');";
  return `${head}${"x".repeat(bytes - head.length - tail.length)}${tail}`;
};

test(`a batch of at most ${QUERY_API_LIMIT} bytes runs through the query API, --command, and writes no file`, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-batch-"));
  try {
    const target = recording();
    const sql = sqlOf(QUERY_API_LIMIT);
    const batch = D1Batch.of(sql);
    assert.equal(batch.bytes, QUERY_API_LIMIT);
    assert.equal(batch.route, "command");
    await batch.run(target, join(dir, "batch.sql"));
    assert.deepEqual(target.calls, [["--command", sql]]);
    await assert.rejects(readFile(join(dir, "batch.sql")), { code: "ENOENT" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test(`a batch over ${QUERY_API_LIMIT} bytes is imported with --file, from the file it writes`, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-batch-"));
  try {
    const target = recording();
    const sql = sqlOf(QUERY_API_LIMIT + 1);
    const batch = D1Batch.of(sql);
    assert.equal(batch.route, "file");
    const file = join(dir, "batch.sql");
    await batch.run(target, file);
    assert.deepEqual(target.calls, [["--file", file]]);
    assert.equal(await readFile(file, "utf8"), sql);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the size is counted in UTF-8 bytes, not characters", () => {
  // `è` is two bytes, so half as many characters reach the limit.
  const sql = `SELECT '${"è".repeat(QUERY_API_LIMIT / 2)}';`;
  assert.ok(sql.length <= QUERY_API_LIMIT);
  assert.equal(D1Batch.of(sql).route, "file");
});

test("a failed execute throws out of run, so no caller reads it as written", async () => {
  const target: DeployTarget = {
    dictionary: "lexema-dictionary",
    execute: () => {
      throw new Error('{"D1_RESET_DO":true}');
    },
  };
  await assert.rejects(D1Batch.of("SELECT 1;").run(target, "unused.sql"), /D1_RESET_DO/);
});

test("a batch holding a LIKE or GLOB pattern over 50 bytes is refused before anything is sent", () => {
  const sql = "CREATE TABLE IF NOT EXISTS t (u TEXT CHECK (u GLOB 'https://*.wiktionary.org/w/index.php?title=*&oldid=*'));";
  assert.throws(() => D1Batch.of(sql), (error: unknown) => error instanceof D1BatchRefused && /GLOB 'https:\/\/\*\.wiktionary\.org.*' \(52 bytes\)/.test(error.message));
  assert.equal(D1Batch.of("CREATE TABLE IF NOT EXISTS t (u TEXT CHECK (u GLOB 'https://*'));").route, "command");
});

// test/d1PatternLimit.test.ts holds schema.sql to the limit. The deploy also
// runs the upgrade's DDL itself, and every CREATE a data plan writes is a
// statement of schema.sql (createStatement); D1Batch refuses anything else.
test("every LIKE and GLOB pattern in the upgrade the deploy runs is within D1's limit", async () => {
  const upgrade = masterUpgradeSql(await readFile("src/db/schema.sql", "utf8"));
  assert.ok(sqlPatterns(upgrade).some(({ pattern }) => pattern.includes("wiktionary.org")), "the upgrade creates corrected_definition, with its evidence_url CHECK");
  assert.deepEqual(overlongPatterns(upgrade), []);
  assert.equal(D1Batch.of(upgrade).route, "command");
});
