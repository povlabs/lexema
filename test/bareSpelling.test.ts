// A headword typed without its final accent or apostrophe (#468): the pure
// parts of `pnpm run measure:bare-spellings` (src/lookup/bareSpelling.ts), then
// what the search offers over real archive lines.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { bareSpelling, bareSpellingOutcome } from "../src/lookup/bareSpelling.js";
import type { LookupDatabase } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { findNearby, type Nearby } from "../src/lookup/nearby.js";
import { readOnlyDictionary } from "./databases.js";

test("a bare spelling takes off a final accented vowel's accent or a final apostrophe, and nothing else", () => {
  assert.equal(bareSpelling("città"), "citta");
  assert.equal(bareSpelling("perché"), "perche");
  assert.equal(bareSpelling("abbandonò"), "abbandono");
  assert.equal(bareSpelling("po'"), "po");
  assert.equal(bareSpelling("è"), "e");
  assert.equal(bareSpelling("'"), undefined, "a lone apostrophe has no spelling left to search");
  assert.equal(bareSpelling("casa"), undefined);
  assert.equal(bareSpelling("caffè latte"), undefined, "two words");
  assert.equal(bareSpelling("çà"), "ça", "only the final mark goes");
});

test("the outcome is found, the best offer, offered later, or not offered", () => {
  assert.equal(bareSpellingOutcome("è", { found: true }), "found");
  const accent: Nearby = { kind: "accent", best: "città", others: ["cittadino"], phrases: [] };
  assert.equal(bareSpellingOutcome("città", { found: false, nearby: accent }), "best");
  assert.equal(bareSpellingOutcome("cittadino", { found: false, nearby: accent }), "offered");
  assert.equal(bareSpellingOutcome("po’", { found: false, nearby: { kind: "accent", best: "po'", others: [], phrases: [] } }), "best", "apostrophes compare as one");
  // Words that begin with the query are a list, not a best guess.
  assert.equal(bareSpellingOutcome("be'", { found: false, nearby: { kind: "prefix", words: ["be'", "bea"] } }), "offered");
  assert.equal(bareSpellingOutcome("be'", { found: false, nearby: { kind: "none" } }), "missed");
});

// The search over real archive lines (fixtures/bare-spellings.jsonl): città,
// perché, più, caffè and abbandonò, `dall'` with dalla and dallo, and the
// pairs whose bare spelling is a word of its own: e and è, Po and po',
// abbandono and abbandonò.
async function withBareSpellings(run: (db: LookupDatabase) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-bare-spellings-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile("fixtures/bare-spellings.jsonl")));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
    await run(readOnlyDictionary(sqlite));
  } finally {
    sqlite.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const RELEASE = "it-0c432803";

async function search(db: LookupDatabase, query: string): Promise<{ found: true } | { found: false; nearby: Nearby }> {
  const result = await lookup({ db, releaseId: RELEASE, query });
  return result.outcome === "not-found" ? { found: false, nearby: await findNearby({ db, releaseId: RELEASE, query }) } : { found: true };
}

test("a search without a final accent or apostrophe offers the written word first, and a bare spelling that is a word stays found", async () => {
  await withBareSpellings(async (db) => {
    for (const [query, written] of [
      ["citta", "città"],
      ["perche", "perché"],
      ["piu", "più"],
      ["caffe", "caffè"],
      // The apostrophe case: before #468, `dall` led with `dalla`, one edit away.
      ["dall", "dall'"],
    ] as const) {
      const answer = await search(db, query);
      assert.ok(!answer.found && answer.nearby.kind === "accent", `${query} is not found and offers a spelling with the same letters`);
      assert.equal(bareSpellingOutcome(written, answer), "best", `${query} offers ${written} first`);
    }
    for (const query of ["po", "e", "abbandono"]) assert.deepEqual(await search(db, query), { found: true }, `${query} is a word of its own`);
  });
});
