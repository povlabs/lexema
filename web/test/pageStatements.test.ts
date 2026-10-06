// What one word page costs D1 (#393): the statements a page sends and the
// calls they go in, counted through `fromD1` over the development fixture.
// One page is the search the page runs (`searchAttempt`) and the served
// version it names its card and suggestions by (`servedVersion`), through one
// adapter, as the baseline on #393 was measured. web/lib/dictionary/db.ts
// reaches them through an adapter each, so a deployed page makes two more
// calls than counted here: the served version's own two waits.
//
// The ceilings are the counts measured before #393 at 0014d44 (bello 61,
// andare 35, casa 25, sale 56, studente 59 statements; 6 calls each). A page
// may cost less; it may not cost more. The answer read through `fromD1` is the
// answer read straight off SQLite, so a cheaper read is never a different page.
//
// D1 also costs the Worker CPU by the bytes it returns (#646), so each search
// here, word page or not-found page, has a ceiling on the calls it waits on and
// the bytes of the rows it reads (`READS`).
//
// The last tests run one whole word-page request, `generateMetadata` and
// `Page` both, in a vinext request scope as the Worker does (#644): each half
// asks for the lookup and the served version, and D1 must see each once.

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
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
import { headersContextFromRequest } from "vinext/shims/headers";
import { createRequestContext, runWithRequestContext } from "vinext/shims/unified-request-context";

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
  /** Bytes of the rows D1 returned, as their JSON. */
  bytes: number;
  /** The SQL of each statement, in the order sent. */
  sql: string[];
}

const nothingSent = (): Sent => ({ statements: 0, calls: 0, bytes: 0, sql: [] });

/** A D1 over the local SQLite that counts what reaches it: a `batch()` is one call, a lone `all()` another. */
function countingD1(db: DatabaseSync, sent: Sent): D1Like {
  const returned = (rows: unknown[]): unknown[] => {
    sent.bytes += Buffer.byteLength(JSON.stringify(rows));
    return rows;
  };
  const statement = (sql: string, params: SqlValue[]): D1StatementLike & { sql: string; run(): unknown[] } => ({
    sql,
    bind: (...bound) => statement(sql, bound),
    run: () => returned(db.prepare(sql).all(...params)),
    all: async <T>() => {
      sent.calls += 1;
      sent.statements += 1;
      sent.sql.push(sql);
      return { results: returned(db.prepare(sql).all(...params)) as T[] };
    },
  });
  return {
    prepare: (sql) => statement(sql, []),
    batch: async (statements) => {
      const bound = statements as ReturnType<typeof statement>[];
      sent.calls += 1;
      sent.statements += bound.length;
      sent.sql.push(...bound.map((one) => one.sql));
      return bound.map((one) => ({ results: one.run() }));
    },
  };
}

for (const [word, ceiling] of Object.entries(BEFORE)) {
  test(`the page for '${word}' sends fewer than ${ceiling} statements in at most ${CALLS_BEFORE} calls, and reads the page SQLite reads`, async () => {
    const sent = nothingSent();
    const db = fromD1(countingD1(sqlite, sent));
    const [attempt] = await Promise.all([searchAttempt(db, RELEASE, word), servedVersion(db, RELEASE)]);
    assert.equal(attempt.outcome, "found", `${word}: expected a found page`);
    assert.ok(sent.statements < ceiling, `${word}: ${sent.statements} statements, not fewer than ${ceiling}`);
    assert.ok(sent.calls <= CALLS_BEFORE, `${word}: ${sent.calls} calls, more than ${CALLS_BEFORE}`);
    assert.deepEqual(attempt, await searchAttempt(fromNodeSqlite(sqlite), RELEASE, word));
  });
}

/**
 * What one search costs D1 at most since #646: the calls it waits on, and the
 * bytes of the rows it reads, as JSON. Measured over this fixture, one search
 * through one adapter. Before #646, at 439c0da, the words read bello 74,035,
 * andare 138,860, casa 27,320, sale 334,514 and studente 48,971 bytes, and the
 * not-found searches took stud 10, citta 9, mangare 8, vadoo via 12 and xqzt
 * 10 calls.
 */
const READS: Record<string, { outcome: "found" | "not-found"; calls: number; bytes: number }> = {
  bello: { outcome: "found", calls: 5, bytes: 35_298 },
  andare: { outcome: "found", calls: 5, bytes: 106_967 },
  casa: { outcome: "found", calls: 5, bytes: 12_099 },
  sale: { outcome: "found", calls: 6, bytes: 228_304 },
  studente: { outcome: "found", calls: 5, bytes: 16_829 },
  stud: { outcome: "not-found", calls: 6, bytes: 1_356 },
  citta: { outcome: "not-found", calls: 6, bytes: 1_343 },
  mangare: { outcome: "not-found", calls: 6, bytes: 1_303 },
  "vadoo via": { outcome: "not-found", calls: 11, bytes: 1_333 },
  xqzt: { outcome: "not-found", calls: 6, bytes: 1_111 },
};

for (const [query, ceiling] of Object.entries(READS)) {
  test(`a search for '${query}' waits on at most ${ceiling.calls} D1 calls and reads at most ${ceiling.bytes} bytes, and reads what SQLite reads`, async () => {
    const sent = nothingSent();
    const attempt = await searchAttempt(fromD1(countingD1(sqlite, sent)), RELEASE, query);
    assert.equal(attempt.outcome, ceiling.outcome, query);
    assert.ok(sent.calls <= ceiling.calls, `${query}: ${sent.calls} calls, more than ${ceiling.calls}`);
    assert.ok(sent.bytes <= ceiling.bytes, `${query}: ${sent.bytes} bytes, more than ${ceiling.bytes}`);
    assert.deepEqual(attempt, await searchAttempt(fromNodeSqlite(sqlite), RELEASE, query));
  });
}

/** The Worker's `env` as `cloudflare:workers` hands it to the word page; a request sets `DB` before it runs. */
const WORKER_ENV: Record<string, unknown> = { LEXEMA_STAGE: "production", LEXEMA_RELEASE: RELEASE, LEXEMA_VERSION: { id: "test-version" } };
(globalThis as { lexemaPageEnv?: Record<string, unknown> }).lexemaPageEnv = WORKER_ENV;

type WordPage = typeof import("../app/(lexema)/page.tsx");

/**
 * The word page's module outside workerd: `cloudflare:workers` is stood in
 * for, and `next/headers` is vinext's own shim, the one the Worker's build
 * serves for it, so `headers()` reads the request scope it is called in.
 */
async function wordPageModule(): Promise<WordPage> {
  const env = `data:text/javascript,${encodeURIComponent("export const env = globalThis.lexemaPageEnv;")}`;
  const hooks = registerHooks({
    resolve: (specifier, context, nextResolve) =>
      specifier === "cloudflare:workers"
        ? { url: env, shortCircuit: true }
        : nextResolve(specifier === "next/headers" ? "vinext/shims/headers" : specifier, context),
  });
  try {
    return (await import("../app/(lexema)/page.tsx")) as WordPage;
  } finally {
    hooks.deregister();
  }
}

/** The SQL `run` sends D1, sorted, so two runs compare whatever their order. */
async function sqlSent(run: (d1: D1Like) => Promise<unknown>): Promise<string[]> {
  const sent = nothingSent();
  await run(countingD1(sqlite, sent));
  return sent.sql.sort();
}

/**
 * One request for the page of `word` as the Worker serves it: a fresh vinext
 * request scope, in which vinext resolves the page's metadata and then renders
 * the page. Answers the SQL the request sent D1.
 */
function wordPageRequest({ generateMetadata, default: Page }: WordPage, word: string): Promise<string[]> {
  return sqlSent(async (d1) => {
    WORKER_ENV.DB = d1;
    const request = new Request(`https://lexema.test/?q=${encodeURIComponent(word)}`);
    await runWithRequestContext(createRequestContext({ headersContext: headersContextFromRequest(request) }), async () => {
      const searchParams = { q: word };
      await generateMetadata({ searchParams });
      await Page({ searchParams });
    });
  });
}

/** The SQL of one lookup of `word` and one served-version read, each run once, as db.ts runs them. */
async function oneOfEach(word: string): Promise<string[]> {
  const lookup = await sqlSent((d1) => searchAttempt(fromD1(d1), RELEASE, word));
  const version = await sqlSent((d1) => servedVersion(fromD1(d1), RELEASE));
  return [...lookup, ...version].sort();
}

/** `request` sent exactly the SQL `once` holds: a lookup or a served version run twice sends its statements twice. */
function assertSentOnce(request: string[], once: string[], word: string): void {
  assert.ok(once.length > 0, `${word}: one lookup sends D1 something`);
  assert.equal(request.length, once.length, `${word}: the request sent ${request.length} statements; one lookup and one served version send ${once.length}`);
  assert.deepEqual(request, once);
}

for (const word of ["sale", "bello"]) {
  test(`one request for the page of '${word}', metadata and page, runs the lookup and reads the served version once each`, async () => {
    const page = await wordPageModule();
    assertSentOnce(await wordPageRequest(page, word), await oneOfEach(word), word);
  });
}

test("two requests for one word page share nothing: each runs its own lookup and served-version read", async () => {
  const page = await wordPageModule();
  const once = await oneOfEach("sale");
  assertSentOnce(await wordPageRequest(page, "sale"), once, "sale, first request");
  assertSentOnce(await wordPageRequest(page, "sale"), once, "sale, second request");
});
