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
// A page that finds nothing is held to its own counts the same way (#663).
//
// The last tests run one whole word-page request, `generateMetadata` and
// `Page` both, in a vinext request scope as the Worker does (#644): each half
// asks for the lookup and the served version, and D1 must see each once.
// The same holds for a request through the shared page cache (#673): the
// version the cache step reads for its key is the one the page renders with.

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
import { rawPageSource, readSavedPage } from "../../src/source/rawPage.js";
import { fromD1, fromNodeSqlite, type D1Like, type D1StatementLike, type SqlValue } from "../../src/lookup/database.js";
import { lookup, withVerbDefinitions } from "../../src/lookup/lookup.js";
import { servedVersion } from "../../src/lookup/served.js";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { PAGE_SOURCE_HEADER, withPageCache, withSharedPageCache } from "@/worker/dictionary/pageCache.ts";
import { CSP_HEADER } from "@/worker/shared/securityHeaders.ts";
import { headersContextFromRequest } from "vinext/shims/headers";
import { createRequestContext, runWithRequestContext } from "vinext/shims/unified-request-context";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-page-statements";
const FIXTURES = ["fixtures/dev-seed.jsonl", "fixtures/salivate.jsonl", "fixtures/vira.jsonl", "fixtures/fiaccando.jsonl", "fixtures/sfocato.jsonl"];
/**
 * The one raw page the seed recovers definitions from: `fiaccare`, whose
 * record lost a definition its page states. No other fixture word has a page
 * here, so no other page reads a recovered definition.
 */
const PAGES = ["fixtures/upstream-pages/fiaccare.wikitext"];

/** Statements per page before #393; the calls were 6 for every word. */
const BEFORE: Record<string, number> = { bello: 61, andare: 35, casa: 25, sale: 56, studente: 59 };
const CALLS_BEFORE = 6;

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-page-statements-"));
  // The development fixture, then the real lines of `salivate` and `vira`
  // (fixtures/salivate.jsonl, fixtures/vira.jsonl), whose pages show a verb's
  // own Definitions (#686), and of `fiaccando` and `sfocato`
  // (fixtures/fiaccando.jsonl, fixtures/sfocato.jsonl, #691), with the page
  // `fiaccare` recovers from.
  const archive = join(dir, "dev-seed.jsonl.gz");
  const lines = await Promise.all(FIXTURES.map(async (file) => (await readFile(join(REPO, file), "utf8")).trimEnd()));
  await writeFile(archive, gzipSync(`${lines.join("\n")}\n`));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    rawPages: rawPageSource(await Promise.all(PAGES.map(async (file) => readSavedPage(await readFile(join(REPO, file), "utf8"), file)))),
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
  /** The SQL of each statement, in the order sent. */
  sql: string[];
}

const nothingSent = (): Sent => ({ statements: 0, calls: 0, sql: [] });

/** A D1 over the local SQLite that counts what reaches it: a `batch()` is one call, a lone `all()` another. */
function countingD1(db: DatabaseSync, sent: Sent): D1Like {
  const statement = (sql: string, params: SqlValue[]): D1StatementLike & { sql: string; run(): unknown[] } => ({
    sql,
    bind: (...bound) => statement(sql, bound),
    run: () => db.prepare(sql).all(...params),
    all: async <T>() => {
      sent.calls += 1;
      sent.statements += 1;
      sent.sql.push(sql);
      return { results: db.prepare(sql).all(...params) as T[] };
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
 * A verb form block reads its verb's table only when that table does not list
 * the query (#666). `andavano` and `sono andato` are listed by andare's table,
 * so they send what they sent at e380d77, before the read was added; `andati`,
 * which andare's table does not list, sends andare's table read beside the
 * reads it already made, in no more calls.
 *
 * A block also lists its verb's own Definitions (#686). A verb record that is a
 * reading on the page (`sono andato`'s andare, `salivate`'s salire) brings its
 * definitions with it, and a noun or adjective form's lemma record is read
 * whole already (`bella`'s bello), so those reads add nothing. A verb that a
 * verb form record names (andare for `andavano` and `andati`, virare for
 * `vira`, salivare for `salivate`) is not a reading, so its definitions are
 * read once, beside the reads a page makes after the lookup
 * (`withVerbDefinitions`): more statements, no more calls. The counts before
 * are those at 975d5aa, `vira`, `bella` and `salivate` measured over this
 * fixture. `bella`'s were measured again at #695, whose fixture adds the four
 * bellissimo records the release has: they list bella and bello, so the
 * lookups of both read their rows and resolve their links (41 statements in 6
 * calls before; the old search sends the same 52 in 8 over the new fixture).
 * #700's fixture adds the records of belli, belle, andata and andate, which
 * list bella or andati in their tables. `bella` reads two more rows (54) in
 * the same 8 calls. `andati` sends 61 in 8 calls, not 50 in 6: the lookup
 * also finds andata's and andate's adjective records, which list andati, and
 * reads theirs. #700 changes no read: over this fixture less andata's and
 * andate's lines, the same search sends 50 in 6 (measured on #700).
 */
const VERB_FORMS_BEFORE: Record<string, { statements: number; calls: number }> = {
  andavano: { statements: 19, calls: 5 },
  "sono andato": { statements: 20, calls: 5 },
  andati: { statements: 54, calls: 8 },
  vira: { statements: 18, calls: 4 },
  bella: { statements: 54, calls: 8 },
  salivate: { statements: 25, calls: 6 },
};

/** The statements one table read sends: a record's grammar and its forms (`readTable`, src/lookup/lookup.ts). */
const TABLE_READ_STATEMENTS = 3;

/**
 * The statements one verb's definitions send (#686): its archive line, its
 * sense glosses, its sense labels and its recovered definitions, which carry
 * their own labels and examples (#691), so a verb with recovered definitions
 * sends no more.
 */
const DEFINITIONS_READ_STATEMENTS = 4;

/**
 * The statement every lookup sends for the curated table cells spelled as the
 * query (`CORRECTED_CELL_SEARCH_SQL`, #743). It goes in the call that reads
 * the page-only entries, so it adds no call.
 */
const CELL_SEARCH_STATEMENTS = 1;

/** The lookups a page runs: its own, and for `andati` and `bella` the lookup of the lemma whose grid the page draws (#626). */
const LOOKUPS: Record<string, number> = { andati: 2, bella: 2 };

/** What each page reads beyond what it read before: a table its verb's does not list, a verb's definitions, and the corrected cells' search. */
const EXTRA: Record<string, number> = {
  andavano: DEFINITIONS_READ_STATEMENTS,
  andati: TABLE_READ_STATEMENTS + DEFINITIONS_READ_STATEMENTS,
  vira: DEFINITIONS_READ_STATEMENTS,
  salivate: DEFINITIONS_READ_STATEMENTS,
};

for (const [word, then] of Object.entries(VERB_FORMS_BEFORE)) {
  const extra = (EXTRA[word] ?? 0) + (LOOKUPS[word] ?? 1) * CELL_SEARCH_STATEMENTS;
  test(`the page for '${word}' sends ${then.statements + extra} statements in ${then.calls} calls, and reads the page SQLite reads`, async () => {
    const sent = nothingSent();
    const attempt = await searchAttempt(fromD1(countingD1(sqlite, sent)), RELEASE, word);
    assert.equal(attempt.outcome, "found", `${word}: expected a found page`);
    assert.equal(sent.statements, then.statements + extra, `${word}: statements`);
    assert.equal(sent.calls, then.calls, `${word}: calls`);
    assert.deepEqual(attempt, await searchAttempt(fromNodeSqlite(sqlite), RELEASE, word));
  });
}

/**
 * The two pages a verb form's Definitions could cost more on (#691). Both are
 * real words: release it-0c432803 lines 138358 `fiaccare` and 335510
 * `fiaccando` (fixtures/fiaccando.jsonl), with revision 4067084 of `fiaccare`
 * from the dump itwiktionary-20260701, and lines 122428 and 122429 `sfocato`
 * (fixtures/sfocato.jsonl).
 *
 * - `fiaccando` names `fiaccare`, whose record lost the sub-term `fiaccare le
 *   corna a uno` its page states, so its verb's Definitions carry a recovered
 *   definition.
 * - `sfocato`'s verb record names `sfocato`, and the only verb that heads
 *   `sfocato` is that record itself: the verb its block names is a reading on
 *   the same page.
 * - `fiaccare`'s own page reads its recovered definition as a reading.
 *
 * The counts before are those at c036f41, before #691. Each page now sends
 * what it sent then less what #691 cut, below.
 */
const DEFINITIONS_PAGES_BEFORE: Record<string, { statements: number; calls: number }> = {
  fiaccando: { statements: 24, calls: 4 },
  sfocato: { statements: 26, calls: 5 },
  fiaccare: { statements: 21, calls: 5 },
};

/**
 * The statements a record's recovered definitions no longer send on their
 * own: their labels and their examples, which come inside the recovered read
 * (`RECOVERED_SQL`), so the recovered read is one wait, not two.
 */
const RECOVERED_PARTS_STATEMENTS = 2;

/** What #691 cut from each page: the recovered read's own labels and examples, or the verb read again that is a reading on the page. */
const CUT: Record<string, { statements: number; calls: number }> = {
  fiaccando: { statements: RECOVERED_PARTS_STATEMENTS, calls: 0 },
  sfocato: { statements: DEFINITIONS_READ_STATEMENTS, calls: 0 },
  fiaccare: { statements: RECOVERED_PARTS_STATEMENTS, calls: 0 },
};

for (const [word, then] of Object.entries(DEFINITIONS_PAGES_BEFORE)) {
  const now = { statements: then.statements - CUT[word].statements + CELL_SEARCH_STATEMENTS, calls: then.calls - CUT[word].calls };
  test(`the page for '${word}' sends ${now.statements} statements in ${now.calls} calls, and reads the page SQLite reads`, async () => {
    const sent = nothingSent();
    const attempt = await searchAttempt(fromD1(countingD1(sqlite, sent)), RELEASE, word);
    assert.equal(attempt.outcome, "found", `${word}: expected a found page`);
    assert.equal(sent.statements, now.statements, `${word}: statements`);
    assert.equal(sent.calls, now.calls, `${word}: calls`);
    assert.deepEqual(attempt, await searchAttempt(fromNodeSqlite(sqlite), RELEASE, word));
  });
}

/**
 * A verb's Definitions, read alone, are one wait whether or not the verb has
 * recovered definitions: `fiaccare` (one recovered) costs what `virare` (none)
 * costs. At c036f41 `fiaccare` cost 6 statements in 2 calls, the second for
 * its recovered labels and examples. `sfocato`'s verb is a reading on its own
 * page, so its Definitions read nothing.
 */
const DEFINITIONS_ALONE: Record<string, { statements: number; calls: number }> = {
  fiaccando: { statements: DEFINITIONS_READ_STATEMENTS, calls: 1 },
  vira: { statements: DEFINITIONS_READ_STATEMENTS, calls: 1 },
  sfocato: { statements: 0, calls: 0 },
};

for (const [word, cost] of Object.entries(DEFINITIONS_ALONE)) {
  test(`the Definitions of the verb '${word}' names send ${cost.statements} statements in ${cost.calls} calls`, async () => {
    const found = await lookup({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query: word });
    assert.ok(found.outcome === "found", `${word}: expected a found page`);
    const sent = nothingSent();
    const readings = await withVerbDefinitions(fromD1(countingD1(sqlite, sent)), found.readings);
    assert.deepEqual({ statements: sent.statements, calls: sent.calls }, cost);
    const verbs = new Set(
      readings.flatMap((reading) =>
        reading.lemmaLinks.flatMap((link) =>
          link.kind === "candidates" ? link.candidates.filter((candidate) => candidate.definitions !== undefined).map((candidate) => candidate.recordId) : [],
        ),
      ),
    );
    assert.equal(verbs.size, 1, `${word}: one verb's Definitions`);
  });
}

test("a verb that is a reading on its page lends its block the definitions it shows as that reading", async () => {
  const found = await lookup({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query: "sfocato" });
  assert.ok(found.outcome === "found");
  const readings = await withVerbDefinitions(fromNodeSqlite(sqlite), found.readings);
  const verb = readings.find((reading) => reading.pos === "verb");
  assert.ok(verb !== undefined);
  const [link] = verb.lemmaLinks;
  assert.ok(link?.kind === "candidates");
  const self = link.candidates.find((candidate) => candidate.recordId === verb.recordId);
  // The reading's own values, not a copy read again.
  assert.equal(self?.definitions?.senses, verb.senses);
  assert.equal(self?.definitions?.recovered, verb.recovered);
});

test("a verb's recovered definitions reach its block: fiaccando's fiaccare carries 'fiaccare le corna a uno'", async () => {
  const found = await lookup({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query: "fiaccando" });
  assert.ok(found.outcome === "found");
  const readings = await withVerbDefinitions(fromD1(countingD1(sqlite, nothingSent())), found.readings);
  const terms = readings.flatMap((reading) =>
    reading.lemmaLinks.flatMap((link) =>
      link.kind === "candidates" ? link.candidates.flatMap((candidate) => candidate.definitions?.recovered ?? []) : [],
    ),
  );
  assert.deepEqual(
    terms.map((definition) => (definition.route === "sub-term" ? definition.term : definition.route)),
    ["fiaccare le corna a uno"],
  );
});

/**
 * A search that finds nothing (#663, #665): a not-found page sends no more
 * statements than it did at f6731dd, before the "Did you mean" reads were sent
 * in fewer waits, and makes at most the calls below. `mangare` gets a typo
 * match, which never uses the words that begin with it, so it pays for no
 * prefix read and keeps f6731dd's 8 calls. `citta` may make 7 calls, one more
 * than at e380d77, so that a typo page reads no prefix list (Huey's ruling,
 * https://github.com/povlabs/lexema/issues/665#issuecomment-6012462663).
 */
const NOT_FOUND: Record<string, { kind: string; statements: number; calls: number }> = {
  zzzz: { kind: "none", statements: 16, calls: 7 },
  citta: { kind: "accent", statements: 15, calls: 7 },
  xqzt: { kind: "none", statements: 16, calls: 7 },
  qwrtz: { kind: "none", statements: 16, calls: 7 },
  mangare: { kind: "typo", statements: 14, calls: 8 },
};

for (const [word, then] of Object.entries(NOT_FOUND)) {
  const ceiling = { ...then, statements: then.statements + CELL_SEARCH_STATEMENTS };
  test(`the not-found page for '${word}' sends at most ${ceiling.statements} statements in at most ${ceiling.calls} calls, and reads the page SQLite reads`, async () => {
    const sent = nothingSent();
    const db = fromD1(countingD1(sqlite, sent));
    const [attempt] = await Promise.all([searchAttempt(db, RELEASE, word), servedVersion(db, RELEASE)]);
    assert.ok(attempt.outcome === "not-found", `${word}: expected a not-found page`);
    assert.equal(attempt.nearby.kind, ceiling.kind, `${word}: expected a '${ceiling.kind}' offer`);
    assert.ok(sent.calls <= ceiling.calls, `${word}: ${sent.calls} calls, more than ${ceiling.calls}`);
    assert.ok(sent.statements <= ceiling.statements, `${word}: ${sent.statements} statements, more than ${ceiling.statements}`);
    assert.deepEqual(attempt, await searchAttempt(fromNodeSqlite(sqlite), RELEASE, word));
  });
}

/** The Worker's `env` as `cloudflare:workers` hands it to the word page; a request sets `DB` before it runs. */
const WORKER_ENV: Record<string, unknown> = { LEXEMA_STAGE: "production", LEXEMA_RELEASE: RELEASE, LEXEMA_VERSION: { id: "test-version" } };
(globalThis as { lexemaPageEnv?: Record<string, unknown> }).lexemaPageEnv = WORKER_ENV;

type WordPage = typeof import("../app/(lexema)/page.tsx") & Pick<typeof import("../worker/dictionary/pageDesk.ts"), "workerPageDesk">;

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
    const page = await import("../app/(lexema)/page.tsx");
    const { workerPageDesk } = await import("../worker/dictionary/pageDesk.ts");
    return { ...page, workerPageDesk } as WordPage;
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

/** Cloudflare's cache, empty, so every request through the shared page cache is a miss. */
const emptyCache: Pick<Cache, "match" | "put"> = { match: async () => undefined, put: async () => {} };
(globalThis as { caches?: unknown }).caches = { default: emptyCache };

/** What one request through the shared page cache did: the SQL it sent, where its page came from, and what the page was rendered with. */
interface CachedRequest {
  sql: string[];
  source: string | null;
  rendered: Rendered;
}

/** What a word page is rendered with: its metadata, and the version its search field names. */
interface Rendered {
  metadata: unknown;
  version: unknown;
}

/** `generateMetadata` and `Page` for `word`, in the request scope vinext opens for `request`, as `wordPageRequest` runs them. */
async function renderWordPage({ generateMetadata, default: Page }: WordPage, word: string, request: Request): Promise<Rendered> {
  return runWithRequestContext(createRequestContext({ headersContext: headersContextFromRequest(request) }), async () => {
    const searchParams = { q: word };
    const metadata = await generateMetadata({ searchParams });
    const page = (await Page({ searchParams })) as { props: { version: unknown } };
    return { metadata, version: page.props.version };
  });
}

interface CachedOptions {
  init?: RequestInit;
  /** The served version the cache step reads; by default the Worker's own read, `servedVersionOnce`. */
  version?: () => Promise<string | undefined>;
}

/**
 * One request for the page of `word` through `withPageCache` and
 * `withSharedPageCache` with the Worker's own desk (worker/dictionary/pageDesk.ts),
 * as worker/index.ts layers them, over an empty cache.
 */
async function cachedWordPageRequest(page: WordPage, word: string, { init = {}, version }: CachedOptions = {}): Promise<CachedRequest> {
  let rendered: Rendered | undefined;
  const app = async (request: Request): Promise<Response> => {
    rendered = await renderWordPage(page, word, request);
    return new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
  };
  const desk = (env: unknown, request: Request, ctx: ExecutionContext) => {
    const own = page.workerPageDesk(env, request, ctx);
    return version === undefined ? own : { ...own, version };
  };
  let source: string | null = null;
  const sql = await sqlSent(async (d1) => {
    WORKER_ENV.DB = d1;
    const headers = new Headers(init.headers);
    headers.set(CSP_HEADER, "script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA=='");
    const request = new Request(`https://lexema.fyi/?q=${encodeURIComponent(word)}`, { ...init, headers });
    const ctx = { waitUntil: () => {} } as unknown as ExecutionContext;
    const response = await withPageCache(withSharedPageCache(desk, app))(request, {}, ctx);
    await response.text();
    source = response.headers.get(PAGE_SOURCE_HEADER);
  });
  assert.ok(rendered !== undefined, `${word}: the page rendered`);
  return { sql, source, rendered };
}

test("a request the shared page cache misses reads the served version once, and the page renders with the version it read", async () => {
  const page = await wordPageModule();
  const cached = await cachedWordPageRequest(page, "bello");
  assert.equal(cached.source, "miss");
  assertSentOnce(cached.sql, await oneOfEach("bello"), "bello through the shared cache");
  assert.doesNotMatch(String(cached.rendered.version), /unread/);

  // The page alone, as before #673, renders with the same metadata and version, so the same HTML.
  let alone: Rendered | undefined;
  await sqlSent(async (d1) => {
    WORKER_ENV.DB = d1;
    alone = await renderWordPage(page, "bello", new Request("https://lexema.fyi/?q=bello"));
  });
  assert.deepEqual(cached.rendered, alone);
});

test("a request the shared page cache does not take still reads the served version once, through the page", async () => {
  const page = await wordPageModule();
  const cached = await cachedWordPageRequest(page, "bello", { init: { headers: { cookie: "visitor=1" } } });
  assert.equal(cached.source, null, "the shared cache did not take it");
  assertSentOnce(cached.sql, await oneOfEach("bello"), "bello with a cookie");
});

test("when the cache step cannot read the served version, the page names the unread version without reading it again", async () => {
  const page = await wordPageModule();
  const cached = await cachedWordPageRequest(page, "bello", { version: async () => undefined });
  assert.equal(cached.source, "unkept");
  assert.match(String(cached.rendered.version), /^it-page-statements\.unread\.code-test-version$/);
  assert.deepEqual(cached.sql, await sqlSent((d1) => searchAttempt(fromD1(d1), RELEASE, "bello")), "the lookup alone");
});

test("two requests through the shared page cache each read their own served version", async () => {
  const page = await wordPageModule();
  const once = await oneOfEach("sale");
  assertSentOnce((await cachedWordPageRequest(page, "sale")).sql, once, "sale, first request");
  assertSentOnce((await cachedWordPageRequest(page, "sale")).sql, once, "sale, second request");
});
