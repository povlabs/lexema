// A random headword (#152), over the development fixture seeded the way
// `pnpm run seed:dev` seeds D1. The endpoint that serves it is tested in
// web/test/api.test.ts.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { applyAppMigrations } from "../src/db/app/migrations.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import {
  RANDOM_BOUNDS_BY_POS_SQL,
  RANDOM_BOUNDS_SQL,
  RANDOM_PICK_BY_POS_SQL,
  RANDOM_PICK_SQL,
  randomHeadword,
} from "../src/lookup/random.js";

const RELEASE = "it-random-test";

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-random-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile("fixtures/dev-seed.jsonl")));
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
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
  applyAppMigrations(sqlite);
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

const linesOf = (pos: string): number[] =>
  (sqlite.prepare("SELECT line_no FROM source_record WHERE release_id = ? AND pos = ? ORDER BY line_no").all(RELEASE, pos) as {
    line_no: number;
  }[]).map((row) => row.line_no);

test("every draw over a part of speech picks a record of it, and every one of them can be picked", async () => {
  const nouns = linesOf("noun");
  const [low, high] = [nouns[0], nouns[nouns.length - 1]];
  const picked = new Set<number>();
  // One draw per line of the span: each lands on the first noun at or after it.
  for (let line = low; line <= high; line++) {
    const draw = (line - low + 0.5) / (high - low + 1);
    const headword = await randomHeadword({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, pos: "noun", random: () => draw });
    assert.equal(headword?.pos, "noun", `line ${line}`);
    picked.add(headword.lineNo);
  }
  assert.deepEqual([...picked].sort((a, b) => a - b), nouns);
});

test("both reads of a pick probe an index, with or without a part of speech, and never scan source_record", () => {
  const cases: [string, (string | number)[], RegExp][] = [
    [RANDOM_BOUNDS_BY_POS_SQL, [RELEASE, "noun"], /SEARCH source_record USING COVERING INDEX source_record_by_pos \(release_id=\? AND pos=\?\)/],
    [RANDOM_PICK_BY_POS_SQL, [RELEASE, "noun", 10], /SEARCH source_record USING INDEX source_record_by_pos \(release_id=\? AND pos=\? AND line_no>\?\)/],
    [RANDOM_BOUNDS_SQL, [RELEASE], /SEARCH source_record USING COVERING INDEX sqlite_autoindex_source_record_1 \(release_id=\?\)/],
    [RANDOM_PICK_SQL, [RELEASE, 10], /SEARCH source_record USING INDEX sqlite_autoindex_source_record_1 \(release_id=\? AND line_no>\?\)/],
  ];
  for (const [sql, params, expected] of cases) {
    const plan = (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
    assert.ok(plan.some((step) => expected.test(step)), `${sql}\n${plan.join("\n")}`);
    assert.ok(!plan.some((step) => /\bSCAN (?!CONSTANT ROW)|TEMP B-TREE/.test(step)), `${sql}\n${plan.join("\n")}`);
  }
});
