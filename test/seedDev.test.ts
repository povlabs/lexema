import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_WORDS, buildSeedSql, readContentFixtures } from "../src/import/seedDev.js";

test("the development fixture contract names exactly the committed words", async () => {
  const files = await readContentFixtures();
  assert.equal(files.length, 50);
  assert.deepEqual(files.map((file) => file.word), [...FIXTURE_WORDS]);
  assert.ok(files.every((file) => file.entries.length > 0));
});

test("content seeding emits schema first and foreign-key-safe inserts", async () => {
  const { sql, files } = await buildSeedSql({ releaseId: "test-seed" });
  assert.equal(files.length, 50);
  assert.ok(sql.indexOf("CREATE TABLE source_release") < sql.indexOf("INSERT INTO source_release"));
  assert.ok(sql.indexOf("INSERT INTO source_release") < sql.indexOf("INSERT INTO source_record "));
  assert.ok(sql.indexOf("INSERT INTO source_record ") < sql.indexOf("INSERT INTO lookup_form "));
  assert.ok(sql.includes("'test-seed'"));
  assert.ok(sql.includes("INSERT INTO form_of_edge"));
  assert.ok(sql.includes("INSERT INTO grammar_claim"));
});

test("the generated SQL is byte-for-byte repeatable", async () => {
  const first = await buildSeedSql({ releaseId: "repeatable" });
  const second = await buildSeedSql({ releaseId: "repeatable" });
  assert.equal(second.sql, first.sql);
});

test("a missing listed word fails by name before SQL generation", async () => {
  const root = await mkdtemp(join(tmpdir(), "lexema-missing-fixtures-"));
  try {
    await assert.rejects(
      readContentFixtures(root),
      (error: unknown) => error instanceof Error && /missing content fixture for "casa"/.test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
