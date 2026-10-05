// What one word page costs D1 (#393): the statements a page sends and the
// calls they go in, counted through `fromD1` over the development fixture.
// One page is the search the page runs (`searchAttempt`) and the served
// version it names its card and suggestions by (`servedVersion`), each through
// its own adapter, as web/lib/dictionary/db.ts reaches them.
//
// The ceilings are the counts measured before #393 at 0014d44 (bello 61,
// andare 35, casa 25, sale 56, studente 59 statements; 6 calls each). A page
// may cost less; it may not cost more. The answer read through `fromD1` is the
// answer read straight off SQLite, so a cheaper read is never a different page.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../../src/import/seedSql.js";
import { fromD1, fromNodeSqlite, type D1Like, type D1StatementLike, type SqlValue } from "../../src/lookup/database.js";
import { servedVersion } from "../../src/lookup/served.js";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-page-statements";

/** Statements per page before #393; the calls were 6 for every word. */
const BEFORE: Record<string, number> = { bello: 61, andare: 35, casa: 25, sale: 56, studente: 59 };
const CALLS_BEFORE = 6;

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-page-statements-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/dev-seed.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

/** What a page sent D1: every statement, and each call as the statements it carried. */
interface Sent {
  statements: number;
  calls: number;
}

/** A D1 over the local SQLite that counts what reaches it: a `batch()` is one call, a lone `all()` another. */
function countingD1(db: DatabaseSync, sent: Sent): D1Like {
  const statement = (sql: string, params: SqlValue[]): D1StatementLike & { run(): unknown[] } => ({
    bind: (...bound) => statement(sql, bound),
    run: () => db.prepare(sql).all(...params),
    all: async <T>() => {
      sent.calls += 1;
      sent.statements += 1;
      return { results: db.prepare(sql).all(...params) as T[] };
    },
  });
  return {
    prepare: (sql) => statement(sql, []),
    batch: async (statements) => {
      sent.calls += 1;
      sent.statements += statements.length;
      return statements.map((one) => ({ results: (one as ReturnType<typeof statement>).run() }));
    },
  };
}

for (const [word, ceiling] of Object.entries(BEFORE)) {
  test(`the page for '${word}' sends fewer than ${ceiling} statements in at most ${CALLS_BEFORE} calls, and reads the page SQLite reads`, async () => {
    const sent: Sent = { statements: 0, calls: 0 };
    const db = fromD1(countingD1(sqlite, sent));
    const [attempt] = await Promise.all([searchAttempt(db, RELEASE, word), servedVersion(db, RELEASE)]);
    assert.equal(attempt.outcome, "found", `${word}: expected a found page`);
    assert.ok(sent.statements < ceiling, `${word}: ${sent.statements} statements, not fewer than ${ceiling}`);
    assert.ok(sent.calls <= CALLS_BEFORE, `${word}: ${sent.calls} calls, more than ${CALLS_BEFORE}`);
    assert.deepEqual(attempt, await searchAttempt(fromNodeSqlite(sqlite), RELEASE, word));
  });
}
