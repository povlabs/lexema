// A word page whose lookup failed never stays in the reader's browser (#642).
//
// Here the real word page runs: app/(lexema)/page.tsx's `generateMetadata`
// and `Page`, in a vinext request scope as the Worker runs them
// (pageStatements.test.ts), over D1 stood in by the development fixture, or by
// a binding that throws as D1 does in an outage. Around it are worker/index.ts's
// layers from the security headers in to vinext, with the real per-visitor
// limits. vinext's own render stands in only for the HTML around the page: it
// renders the page's elements to markup and stamps its inline script with the
// nonce it reads off the request, as pageCache.test.ts's stand-in does.

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, before, mock, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { seedSql } from "../../src/import/seedSql.js";
import type { D1Like, D1StatementLike, SqlValue } from "../../src/lookup/database.js";
import { apiNotFound } from "@/worker/api/handler.ts";
import { PAGE_CACHE_CONTROL, withPageCache } from "@/worker/dictionary/pageCache.ts";
import { byHost } from "@/worker/shared/hosts.ts";
import { type LimitBindings, withRateLimits } from "@/worker/shared/rateLimit.ts";
import { CSP_HEADER, withSecurityHeaders } from "@/worker/shared/securityHeaders.ts";
import { headersContextFromRequest } from "vinext/shims/headers";
import { createRequestContext, runWithRequestContext } from "vinext/shims/unified-request-context";
import { getScriptNonceFromHeaders } from "../node_modules/vinext/dist/server/csp.js";
import { createInlineScriptTag } from "../node_modules/vinext/dist/server/html.js";
import { SITE_LIMITS } from "./siteLimits.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-failed-lookup-cache";
/** What vinext 1.0.0-beta.10 marks a dynamic page with (`NO_STORE_CACHE_CONTROL`). */
const VINEXT_DYNAMIC = "no-store, must-revalidate";

/** The Worker's `env` as `cloudflare:workers` hands it to the word page; a request sets `DB` before it runs. */
const WORKER_ENV: Record<string, unknown> = { LEXEMA_STAGE: "production", LEXEMA_RELEASE: RELEASE, LEXEMA_VERSION: { id: "test-version" } };
(globalThis as { lexemaFailedLookupEnv?: Record<string, unknown> }).lexemaFailedLookupEnv = WORKER_ENV;

type WordPage = typeof import("../app/(lexema)/page.tsx");

/** The word page's module outside workerd, as pageStatements.test.ts imports it: `next/headers` is vinext's own shim. */
async function wordPageModule(): Promise<WordPage> {
  const env = `data:text/javascript,${encodeURIComponent("export const env = globalThis.lexemaFailedLookupEnv;")}`;
  const hooks = registerHooks({
    resolve: (specifier, context, nextResolve) =>
      specifier === "cloudflare:workers"
        ? { url: env, shortCircuit: true }
        : nextResolve(specifier.startsWith("next/") ? `vinext/shims/${specifier.slice("next/".length)}` : specifier, context),
  });
  try {
    return (await import("../app/(lexema)/page.tsx")) as WordPage;
  } finally {
    hooks.deregister();
  }
}

let dir: string;
let sqlite: DatabaseSync;
let page: WordPage;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-failed-lookup-"));
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
  page = await wordPageModule();
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

/** D1 over the development fixture. */
function workingD1(): D1Like {
  const statement = (sql: string, params: SqlValue[]): D1StatementLike & { rows(): unknown[] } => ({
    bind: (...bound) => statement(sql, bound),
    rows: () => sqlite.prepare(sql).all(...params),
    all: async <T>() => ({ results: sqlite.prepare(sql).all(...params) as T[] }),
  });
  return {
    prepare: (sql) => statement(sql, []),
    batch: async (statements) => (statements as ReturnType<typeof statement>[]).map((one) => ({ results: one.rows() })),
  };
}

/** D1 in an outage: every call fails, as #550's and #611's did. */
function failingD1(): D1Like {
  const outage = () => Promise.reject(new Error("D1_ERROR: Network connection lost."));
  const statement: D1StatementLike = { bind: () => statement, all: outage };
  return { prepare: () => statement, batch: outage };
}

/** vinext's App Router as the Worker reaches it, running the real word page in a fresh request scope. */
async function vinext(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const searchParams = { q: url.searchParams.get("q") ?? undefined };
  const html = await runWithRequestContext(createRequestContext({ headersContext: headersContextFromRequest(request) }), async () => {
    const metadata = await page.generateMetadata({ searchParams });
    const body = renderToStaticMarkup(await page.default({ searchParams }));
    const script = createInlineScriptTag("self.__payload=1", getScriptNonceFromHeaders(request.headers));
    return `<html><head><title>${metadata.title}</title></head><body>${body}${script}</body></html>`;
  });
  return new Response(html, { headers: { "cache-control": VINEXT_DYNAMIC, vary: "RSC, Accept", "content-type": "text/html; charset=utf-8" } });
}

const allow: RateLimit = { limit: async () => ({ success: true }) };

/** The Worker from the security headers in, every per-visitor limit allowing; `d1` answers each request's reads. */
function worker(d1: () => D1Like) {
  const env: LimitBindings = {
    SEARCH_LIMIT: allow,
    SUGGEST_LIMIT: allow,
    REPORT_LIMIT: allow,
    REPORT_OPEN_LIMIT: allow,
    SIGN_IN_LIMIT: allow,
    KEY_CREATE_LIMIT: allow,
    BILLING_LIMIT: allow,
  };
  const fetch = withSecurityHeaders<LimitBindings>(
    withPageCache<LimitBindings>(
      byHost<LimitBindings>({
        app: withRateLimits(SITE_LIMITS, vinext),
        api: async () => Response.json({ ok: true }, { headers: { "cache-control": "no-store" } }),
        apiNotFound,
      }),
    ),
  );
  return (url: string): Promise<Response> => {
    WORKER_ENV.DB = d1();
    return fetch(new Request(url, { headers: { "cf-connecting-ip": "203.0.113.7" } }), env, {} as ExecutionContext);
  };
}

/** The nonce a page's policy names in `script-src`. */
function policyNonceOf(response: Response): string {
  const policy = response.headers.get(CSP_HEADER) ?? "";
  const nonces = [...policy.matchAll(/'nonce-([^']+)'/g)].map((match) => match[1]);
  assert.equal(nonces.length, 1, `one nonce in ${policy}`);
  return nonces[0];
}

const scriptNoncesOf = (html: string): string[] => [...html.matchAll(/<script nonce="([^"]+)">/g)].map((match) => match[1]);

/** How many lookups `run` ran, by the one line `searchOnce` logs for each that fails. */
async function failedLookups<T>(run: () => Promise<T>): Promise<{ result: T; lookups: number }> {
  const errors = mock.method(console, "error", () => {});
  try {
    const result = await run();
    return { result, lookups: errors.mock.calls.filter((call) => call.arguments[0] === "lookup failed").length };
  } finally {
    errors.mock.restore();
  }
}

test("a word page whose lookup failed leaves no-store, still says the lookup failed, and its policy and script share one nonce", async () => {
  const send = worker(failingD1);
  const { result: response, lookups } = await failedLookups(() => send("https://lexema.fyi/?q=bello"));
  assert.equal(response.status, 200);
  const cacheControl = response.headers.get("cache-control") ?? "";
  assert.notEqual(cacheControl, PAGE_CACHE_CONTROL);
  assert.doesNotMatch(cacheControl, /private|max-age=3600/);
  assert.match(cacheControl, /(?:^|,)\s*no-store\s*(?:,|$)/);
  const html = await response.text();
  assert.match(html, /The lookup failed, so this page cannot say whether/);
  assert.match(html, /role="alert"/);
  assert.deepEqual(scriptNoncesOf(html), [policyNonceOf(response)]);
  assert.equal(lookups, 1, "the title, the link preview and the result read one lookup");
});

test("a failed lookup leaves no mark on the response: it carries the headers a found word's page carries, and the next request is kept again", async () => {
  const failing = await failedLookups(() => worker(failingD1)("https://lexema.fyi/?q=bello"));
  const found = await worker(workingD1)("https://lexema.fyi/?q=bello");
  assert.match(await found.text(), /<h1[^>]*>[^<]*bello/i);
  assert.deepEqual([...failing.result.headers.keys()].sort(), [...found.headers.keys()].sort());
  assert.equal(found.headers.get("cache-control"), PAGE_CACHE_CONTROL, "once D1 answers again, the same word is kept");
});

test("with the lookup working, a found word, a word not found and the home page are kept for an hour, each with its nonce", async () => {
  const send = worker(workingD1);
  for (const [url, says] of [
    ["https://lexema.fyi/?q=bello", /bello/],
    ["https://lexema.fyi/?q=zzqxnotaword", /No entry for/],
    ["https://lexema.fyi/", /<form/],
  ] as const) {
    const response = await send(url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers.get("cache-control"), PAGE_CACHE_CONTROL, url);
    const html = await response.text();
    assert.match(html, says, url);
    assert.doesNotMatch(html, /The lookup failed/, url);
    assert.deepEqual(scriptNoncesOf(html), [policyNonceOf(response)], url);
  }
});
