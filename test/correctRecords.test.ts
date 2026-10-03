// `pnpm run correct:records` (src/import/correctRecords.ts): the curated
// corrections (#420) written into a master seeded before them, read back, and
// a second run that plans nothing. Every record is a verbatim archive line,
// from fixtures/curated-corrections.jsonl (test/correctionFixture.ts).

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import type { CuratedCorrection } from "../src/italian/curatedCorrections.js";
import { describeEntry, planCorrections, unwritten } from "../src/import/correctRecords.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { servedVersion, versionToken } from "../src/lookup/served.js";
import type { MasterReader } from "../src/update/master.js";
import { atFixtureLines, correctionFixtureLines } from "./correctionFixture.js";

const RELEASE = "it-correct";
const SCHEMA = "src/db/schema.sql";

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });

/** The fixture seeded with `corrections`, as complete as a served master. */
async function seeded(corrections: readonly CuratedCorrection[]): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-correct-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${(await correctionFixtureLines()).join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: SCHEMA,
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      corrections,
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    return db;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Run the plan's SQL as one transaction, as `wrangler d1 execute --file` does. */
function execute(db: DatabaseSync, sql: string): void {
  db.exec("BEGIN");
  try {
    db.exec(sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));
const correctedRows = (db: DatabaseSync): unknown[] => all(db, "SELECT * FROM corrected_claim ORDER BY record_id, dimension");

/** The gender a lookup of `word` gives its one reading, and where that came from. */
async function genderOf(db: DatabaseSync, word: string): Promise<string[]> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
  assert.ok(result.outcome === "found");
  return result.readings[0].grammar.record.flatMap((claim) => (claim.status !== "unclassified" && claim.dimension === "gender" ? [`${claim.status} ${claim.status === "missing" ? "" : claim.value}`] : []));
}

test("a master seeded before the corrections gets what a seed now writes, once, and reads it back", async () => {
  const lines = await correctionFixtureLines();
  const corrections = atFixtureLines(lines, RELEASE);
  const fresh = await seeded(corrections);
  // A master seeded before #420: no corrections table and no revision.
  const before = await seeded([]);
  try {
    before.exec("DROP TABLE corrected_claim; DROP TABLE correction_version;");
    const rawBefore = all(before, "SELECT * FROM source_record_json ORDER BY record_id");
    const claimsBefore = all(before, "SELECT * FROM grammar_claim ORDER BY claim_id");
    // A lookup on it reads no correction and fails nothing.
    assert.deepEqual(await genderOf(before, "fissazione"), ["stated masculine"]);
    const versionBefore = versionToken(await servedVersion(fromNodeSqlite(before), RELEASE));

    const reader = readerOf(before);
    const schema = await readFile(SCHEMA, "utf8");
    const plan = planCorrections(reader, corrections, schema);
    assert.deepEqual(plan.entries.map((entry) => entry.state), Array(20).fill("write"));
    execute(before, plan.sql);
    assert.deepEqual(unwritten(reader, plan), []);

    assert.deepEqual(correctedRows(before), correctedRows(fresh));
    assert.equal(correctedRows(before).length, 22);
    assert.deepEqual(all(before, "SELECT * FROM source_record_json ORDER BY record_id"), rawBefore);
    assert.deepEqual(all(before, "SELECT * FROM grammar_claim ORDER BY claim_id"), claimsBefore);
    assert.deepEqual(await genderOf(before, "fissazione"), ["corrected feminine"]);
    // Cards and suggestions move to a new address with the corrected facts.
    const versionAfter = versionToken(await servedVersion(fromNodeSqlite(before), RELEASE));
    assert.equal(versionAfter, `${versionBefore}.fix-1`);

    // A second run plans nothing.
    const again = planCorrections(reader, corrections, schema);
    assert.equal(again.sql, "");
    assert.deepEqual(again.entries.map((entry) => entry.state), Array(20).fill("already"));
  } finally {
    before.close();
    fresh.close();
  }
});

test("a master that holds #420's twelve gets #449's eight and leaves the twelve as written", async () => {
  const corrections = atFixtureLines(await correctionFixtureLines(), RELEASE);
  const db = await seeded(corrections.slice(0, 12));
  const fresh = await seeded(corrections);
  try {
    const reader = readerOf(db);
    const versionBefore = versionToken(await servedVersion(fromNodeSqlite(db), RELEASE));
    const plan = planCorrections(reader, corrections, await readFile(SCHEMA, "utf8"));
    assert.deepEqual(plan.entries.map((entry) => entry.state), [...Array(12).fill("already"), ...Array(8).fill("write")]);
    execute(db, plan.sql);
    assert.deepEqual(unwritten(reader, plan), []);
    assert.deepEqual(correctedRows(db), correctedRows(fresh));
    assert.notEqual(versionToken(await servedVersion(fromNodeSqlite(db), RELEASE)), versionBefore);
  } finally {
    db.close();
    fresh.close();
  }
});

test("an entry the master cannot hold as named is reported, not written", async () => {
  const lines = await correctionFixtureLines();
  const [first, second, third, ...rest] = atFixtureLines(lines, RELEASE);
  const db = await seeded([]);
  try {
    const plan = planCorrections(
      readerOf(db),
      [
        { ...first, record: { ...first.record, lineSha256: "0".repeat(64) } },
        { ...second, record: { ...second.record, lineNo: 999 } },
        { ...third, record: { ...third.record, releaseId: "it-0c432803" } },
        ...rest,
      ],
      await readFile(SCHEMA, "utf8"),
    );
    assert.deepEqual(plan.entries.slice(0, 3).map(describeEntry), [
      `  ${RELEASE}:${first.record.lineNo} fiaschetteria: not written; the record at line ${first.record.lineNo} is not the line the entry names`,
      `  ${RELEASE}:999 fissazione: not written; the master holds no record at line 999`,
      `  it-0c432803:${third.record.lineNo} rimbalzo: keyed to it-0c432803, not this master`,
    ]);
    execute(db, plan.sql);
    assert.deepEqual(all(db, "SELECT DISTINCT correction_id FROM corrected_claim WHERE correction_id IN ('" + [first, second].map((c) => `${RELEASE}:${c.record.lineNo}`).join("','") + "')"), []);
  } finally {
    db.close();
  }
});
