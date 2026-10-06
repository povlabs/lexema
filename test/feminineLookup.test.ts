// A feminine compound form of an essere verb (#676): `sono andata` is found as
// the feminine of `sono andato`, which andare's table lists, by rule
// `it-essere-agreement/v1` — over the development fixture seeded the way
// `pnpm run seed:dev` seeds D1. The page over the same fixture is tested in
// web/test/page.test.tsx.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite, type DictionaryRead, type LookupDatabase, type SqlValue } from "../src/lookup/database.js";
import { exists, lookup, SEARCH_SQL } from "../src/lookup/lookup.js";
import type { FoundResult, LookupResult } from "../src/lookup/types.js";

const RELEASE = "it-feminine-test";

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-feminine-"));
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
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

const ask = (query: string): Promise<LookupResult> => lookup({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });

async function found(query: string): Promise<FoundResult> {
  const result = await ask(query);
  assert.equal(result.outcome, "found", `${query} is found`);
  return result as FoundResult;
}

/** The database, with every statement it is sent and every answer it gives, in order. */
function recording(): { db: LookupDatabase; log: { event: "sent" | "answered"; sql: DictionaryRead; params: readonly SqlValue[] }[] } {
  const inner = fromNodeSqlite(sqlite);
  const log: { event: "sent" | "answered"; sql: DictionaryRead; params: readonly SqlValue[] }[] = [];
  return {
    db: {
      all: async <T,>(sql: DictionaryRead, params: readonly SqlValue[]) => {
        log.push({ event: "sent", sql, params });
        const rows = await inner.all<T>(sql, params);
        log.push({ event: "answered", sql, params });
        return rows;
      },
    },
    log,
  };
}

/** The keys the search was probed with, in the order they were sent. */
const searchedKeys = (log: ReturnType<typeof recording>["log"]): SqlValue[] =>
  log.filter((entry) => entry.event === "sent" && entry.sql.startsWith(SEARCH_SQL)).map((entry) => entry.params[1]);

test("sono andata finds andare's io passato prossimo cell, as the feminine of sono andato (#676)", async () => {
  const result = await found("sono andata");
  assert.deepEqual(result.route, {
    kind: "feminine",
    agreement: { rule: "it-essere-agreement/v1", number: "singular", masculine: "sono andato", feminine: "sono andata" },
  });
  assert.deepEqual(result.readings.map((reading) => [reading.word, reading.pos, reading.isAboutQuery]), [["andare", "verb", false]]);
  const [andare] = result.readings;
  assert.deepEqual(
    andare.evidence.map((occurrence) => [occurrence.origin, occurrence.surface, "jsonPointer" in occurrence.ref ? occurrence.ref.jsonPointer : undefined]),
    [["embedded-form", "sono andato", "/forms/29/form"]],
  );
});

test("sono andate and siamo andate reach the plural cells of their masculine (#676)", async () => {
  const siamo = await found("siamo andate");
  assert.equal(siamo.route.kind, "feminine");
  assert.deepEqual(siamo.readings[0].evidence.map((occurrence) => occurrence.surface), ["siamo andati", "siamo andati"]);
  const sono = await found("sono andate");
  assert.deepEqual(sono.readings.map((reading) => reading.word), ["andare"]);
  assert.deepEqual(sono.readings[0].evidence.map((occurrence) => occurrence.surface), ["sono andati"]);
});

test("ho mangiata, è andate and sono andat are not found; the masculine finds what it always did (#676)", async () => {
  for (const query of ["ho mangiata", "è andate", "sono andat"]) {
    assert.equal((await ask(query)).outcome, "not-found", query);
    assert.equal((await exists({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query })).outcome, "absent", query);
  }
  for (const query of ["sono andato", "siamo andati", "ho mangiato"]) assert.deepEqual((await found(query)).route, { kind: "surface" }, query);
});

test("exists answers present with andare for sono andata, as lookup finds it (#676)", async () => {
  const answer = await exists({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query: "sono andata" });
  assert.equal(answer.outcome, "present");
  assert.equal(answer.outcome === "present" ? answer.word : undefined, "andare");
});

test("the feminine probe is sent only after the typed spelling found nothing, and only for a feminine the rule reads (#676)", async () => {
  const { db, log } = recording();
  await lookup({ db, releaseId: RELEASE, query: "sono andata" });
  assert.deepEqual(searchedKeys(log), ["sono andata", "sono andato"]);
  const typedAnswered = log.findIndex((entry) => entry.event === "answered" && entry.sql === SEARCH_SQL && entry.params[1] === "sono andata");
  const probeSent = log.findIndex((entry) => entry.event === "sent" && entry.sql === SEARCH_SQL && entry.params[1] === "sono andato");
  assert.ok(typedAnswered !== -1 && typedAnswered < probeSent, "the probe waits for the typed spelling's answer");

  // A query that is found as typed, is not two words, does not end in -a or
  // -e, or that the rule cannot read as a feminine, sends no probe.
  for (const query of ["sono andato", "andata", "sono andat", "ho mangiata", "casa", "xyzzy"]) {
    const run = recording();
    await lookup({ db: run.db, releaseId: RELEASE, query });
    assert.deepEqual(searchedKeys(run.log), [query], query);
  }
});
