// A feminine compound form of an essere verb (#676): `sono andata` is found as
// the feminine of `sono andato`, which andare's table lists, and `mi sono
// arresa` as the feminine of the first spelling of arrendersi's `mi sono
// arreso, arresosi`, by rule `it-essere-agreement/v1`. Read over the
// development fixture and the release lines of accorgersi, arrendersi,
// assorbire and perdersi (`fixtures/essere-compound-cells.jsonl`), seeded the
// way `pnpm run seed:dev` seeds D1. The page over the same lines is tested in
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
import { exists, FIRST_SPELLING_SQL, lookup, SEARCH_SQL } from "../src/lookup/lookup.js";
import type { FoundResult, LookupResult } from "../src/lookup/types.js";

const RELEASE = "it-feminine-test";

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-feminine-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  const lines = `${(await readFile("fixtures/dev-seed.jsonl", "utf8")).trimEnd()}\n${await readFile("fixtures/essere-compound-cells.jsonl", "utf8")}`;
  await writeFile(archive, gzipSync(lines));
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

/** Each reading's word, and the surface and pointer of every cell it was found by. */
const evidenceOf = (result: FoundResult): [string, string, string | undefined][] =>
  result.readings.flatMap((reading) =>
    reading.evidence.map((occurrence) => [reading.word, occurrence.surface, "jsonPointer" in occurrence.ref ? occurrence.ref.jsonPointer : undefined] as [string, string, string | undefined]),
  );

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

/** The keys the search and the first-spelling range were probed with, in the order they were sent. */
const searchedKeys = (log: ReturnType<typeof recording>["log"]): SqlValue[][] =>
  log
    .filter((entry) => entry.event === "sent" && (entry.sql.startsWith(SEARCH_SQL) || entry.sql === FIRST_SPELLING_SQL))
    .map((entry) => (entry.sql === FIRST_SPELLING_SQL ? ["range", ...entry.params.slice(1)] : [entry.params[1]]));

test("sono andata finds andare's io passato prossimo cell, as the feminine of sono andato (#676)", async () => {
  const result = await found("sono andata");
  assert.equal(result.route.kind, "feminine");
  assert.ok(result.route.kind === "feminine");
  assert.deepEqual(
    [result.route.agreement.number, result.route.agreement.first, result.route.agreement.feminine],
    ["singular", "sono andato", "sono andata"],
  );
  assert.deepEqual(result.readings.map((reading) => [reading.word, reading.pos, reading.isAboutQuery]), [["andare", "verb", false]]);
  assert.deepEqual(evidenceOf(result), [["andare", "sono andato", "/forms/29/form"]]);
});

test("sono andate and siamo andate reach the plural cells of their masculine (#676)", async () => {
  const siamo = await found("siamo andate");
  assert.equal(siamo.route.kind, "feminine");
  assert.deepEqual(siamo.readings[0].evidence.map((occurrence) => occurrence.surface), ["siamo andati", "siamo andati"]);
  const sono = await found("sono andate");
  assert.deepEqual(sono.readings.map((reading) => reading.word), ["andare"]);
  assert.deepEqual(sono.readings[0].evidence.map((occurrence) => occurrence.surface), ["sono andati"]);
});

test("mi sono accorta and ci siamo accorte reach accorgersi's reflexive cells (#676)", async () => {
  const mi = await found("mi sono accorta");
  assert.equal(mi.route.kind, "feminine");
  assert.deepEqual(evidenceOf(mi), [["accorgersi", "mi sono accorto", "/forms/29/form"]]);
  const ci = await found("ci siamo accorte");
  assert.deepEqual(evidenceOf(ci), [
    ["accorgersi", "ci siamo accorti", "/forms/32/form"],
    ["accorgersi", "ci siamo accorti", "/forms/80/form"],
  ]);
});

test("mi sono arresa and mi sono arreso both reach arrendersi's cell mi sono arreso, arresosi by its first spelling (#676)", async () => {
  const arresa = await found("mi sono arresa");
  assert.equal(arresa.route.kind, "feminine");
  assert.deepEqual(evidenceOf(arresa), [["arrendersi", "mi sono arreso, arresosi", "/forms/30/form"]]);
  const arreso = await found("mi sono arreso");
  assert.equal(arreso.route.kind, "first-spelling");
  assert.deepEqual(evidenceOf(arreso), [["arrendersi", "mi sono arreso, arresosi", "/forms/30/form"]]);
});

test("a feminine nothing agrees with is not found; the masculine and the whole cell find what they always did (#676)", async () => {
  for (const query of ["ho mangiata", "è andate", "sono andat", "siamo assorbite", "mi sono perduta"]) {
    assert.equal((await ask(query)).outcome, "not-found", query);
    assert.equal((await exists({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query })).outcome, "absent", query);
  }
  for (const query of ["sono andato", "siamo andati", "ho mangiato", "mi sono accorto", "mi sono arreso, arresosi"]) {
    assert.deepEqual((await found(query)).route, { kind: "surface" }, query);
  }
});

test("exists answers present with andare for sono andata and accorgersi for mi sono accorta, as lookup finds them (#676)", async () => {
  for (const [query, word] of [["sono andata", "andare"], ["mi sono accorta", "accorgersi"]]) {
    const answer = await exists({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });
    assert.equal(answer.outcome, "present", query);
    assert.equal(answer.outcome === "present" ? answer.word : undefined, word, query);
  }
});

test("the feminine probe and the first-spelling range are sent only after the typed spelling found nothing, and only for a query of the rule's shape (#676)", async () => {
  const run = async (query: string) => {
    const { db, log } = recording();
    await lookup({ db, releaseId: RELEASE, query });
    return log;
  };
  const andata = await run("sono andata");
  assert.deepEqual(searchedKeys(andata), [["sono andata"], ["sono andato"]]);
  const typedAnswered = andata.findIndex((entry) => entry.event === "answered" && entry.sql === SEARCH_SQL && entry.params[1] === "sono andata");
  const probeSent = andata.findIndex((entry) => entry.event === "sent" && entry.sql === SEARCH_SQL && entry.params[1] === "sono andato");
  assert.ok(typedAnswered !== -1 && typedAnswered < probeSent, "the probe waits for the typed spelling's answer");

  // The masculine finds no cell, so the range of cells it starts is read.
  const arresa = await run("mi sono arresa");
  assert.deepEqual(searchedKeys(arresa), [["mi sono arresa"], ["mi sono arreso"], ["range", "mi sono arreso, ", "mi sono arreso,!"]]);
  const masculineAnswered = arresa.findIndex((entry) => entry.event === "answered" && entry.sql === SEARCH_SQL && entry.params[1] === "mi sono arreso");
  const rangeSent = arresa.findIndex((entry) => entry.event === "sent" && entry.sql === FIRST_SPELLING_SQL);
  assert.ok(masculineAnswered !== -1 && masculineAnswered < rangeSent, "the range waits for the masculine's answer");
  // A masculine typed as the query has already found nothing: only the range is read.
  assert.deepEqual(searchedKeys(await run("mi sono arreso")), [["mi sono arreso"], ["range", "mi sono arreso, ", "mi sono arreso,!"]]);

  // A query found as typed, or without the rule's shape, sends neither.
  for (const query of ["sono andato", "mi sono accorto", "andata", "sono andat", "ho mangiata", "mi arrendo", "casa", "xyzzy"]) {
    assert.deepEqual(searchedKeys(await run(query)), [[query]], query);
  }
});

test("the first-spelling range reads lookup_form_by_key, never a scan (#676)", () => {
  const plan = (
    sqlite.prepare(`EXPLAIN QUERY PLAN ${FIRST_SPELLING_SQL}`).all(RELEASE, "mi sono arreso, ", "mi sono arreso,!") as { detail: string }[]
  ).map((row) => row.detail);
  assert.ok(!plan.some((step) => /SCAN (lookup_form|grammar_claim|lf|g)\b/.test(step)), `range probe degraded to a scan:\n${plan.join("\n")}`);
  assert.ok(
    plan.some((step) => /lookup_form_by_key \(release_id=\? AND surface_key>\? AND surface_key<\?\)/.test(step)),
    plan.join("\n"),
  );
  assert.ok(plan.some((step) => step.includes("grammar_claim_by_record")), plan.join("\n"));
});
