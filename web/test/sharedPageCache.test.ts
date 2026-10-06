// A word page or the home page is kept in Cloudflare's cache for the served
// version, and the next reader gets the kept copy with a fresh nonce (#667).
//
// The Worker here is worker/index.ts's layers from the security headers in to
// vinext, with the real per-visitor limits and the shared cache in their place
// inside them. Cloudflare's cache and the served version stand in. vinext
// stands in as in pageCache.test.ts: it stamps two inline scripts with the
// nonce it reads off the request, by vinext's own reader and writer, says how
// many pages it has rendered, and fails the lookup of one word the way
// `search` does (lib/dictionary/db.ts).

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { unstable_readConfig } from "wrangler";
import { PAGE_CACHE_CONTROL, PAGE_SOURCE_HEADER, refuseKeeping, withPageCache, withSharedPageCache, type PageDesk } from "@/worker/dictionary/pageCache.ts";
import { byHost, routePathOf } from "@/worker/shared/hosts.ts";
import { type LimitBindings, SEARCH_LIMITED_HEADER, withRateLimits } from "@/worker/shared/rateLimit.ts";
import { CSP_HEADER, withSecurityHeaders } from "@/worker/shared/securityHeaders.ts";
import { getScriptNonceFromHeaders } from "../node_modules/vinext/dist/server/csp.js";
import { createInlineScriptTag } from "../node_modules/vinext/dist/server/html.js";
import { SITE_LIMITS } from "./siteLimits.ts";

/** What vinext 1.0.0-beta.10 marks a dynamic page with (`NO_STORE_CACHE_CONTROL`). */
const VINEXT_DYNAMIC = "no-store, must-revalidate";
const LEXEMA = "https://lexema.fyi";
/** The word whose lookup fails, as during a database outage (#642). */
const FAILING = "guasto";
/** The word whose page sets a cookie. */
const COOKIE_SETTING = "biscotto";
/** The word whose answer is an RSC payload although the request did not ask for one. */
const FLIGHT = "volo";

/** Cloudflare's cache as the Worker sees it: kept responses by URL, and every write. */
class StandInCache implements Pick<Cache, "match" | "put"> {
  readonly kept = new Map<string, { body: ArrayBuffer; status: number; headers: Headers }>();
  readonly puts: string[] = [];
  readonly matches: string[] = [];

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const url = new Request(request).url;
    this.matches.push(url);
    const kept = this.kept.get(url);
    return kept === undefined ? undefined : new Response(kept.body.slice(0), { status: kept.status, headers: kept.headers });
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const url = new Request(request).url;
    this.puts.push(url);
    this.kept.set(url, { body: await response.arrayBuffer(), status: response.status, headers: new Headers(response.headers) });
  }
}

const allow: RateLimit = { limit: async () => ({ success: true }) };
const refuse: RateLimit = { limit: async () => ({ success: false }) };

interface Options {
  limits?: Partial<LimitBindings>;
  cache?: StandInCache;
}

/** The Worker over one stand-in cache, with every per-visitor limit allowing except those in `limits`. */
function worker({ limits = {}, cache = new StandInCache() }: Options = {}) {
  const env: LimitBindings = {
    SEARCH_LIMIT: allow,
    SUGGEST_LIMIT: allow,
    REPORT_LIMIT: allow,
    REPORT_OPEN_LIMIT: allow,
    SIGN_IN_LIMIT: allow,
    KEY_CREATE_LIMIT: allow,
    BILLING_LIMIT: allow,
    ...limits,
  };
  const state = { version: "v1" as string | undefined, renders: 0, apiCalls: 0 };
  const pending: Promise<unknown>[] = [];

  async function vinext(request: Request): Promise<Response> {
    state.renders += 1;
    const url = new URL(request.url);
    const headers: Record<string, string> = { "cache-control": VINEXT_DYNAMIC, vary: "RSC, Accept" };
    const q = url.searchParams.get("q") ?? "";
    if (routePathOf(url.pathname) !== "/") return Response.json({ outcome: "sent" }, { headers: { "cache-control": "no-store" } });
    if (url.pathname.endsWith(".rsc") || request.headers.get("rsc") === "1" || q === FLIGHT) {
      return new Response("0:{}", { headers: { ...headers, "content-type": "text/x-component" } });
    }
    if (q === FAILING) refuseKeeping("lookup-failed");
    if (q === COOKIE_SETTING) headers["set-cookie"] = "visitor=1";
    const nonce = getScriptNonceFromHeaders(request.headers);
    const page = request.headers.has(SEARCH_LIMITED_HEADER) ? "too many searches" : `page ${q} at ${state.version} render ${state.renders}`;
    const scripts = createInlineScriptTag("self.__payload=1", nonce) + createInlineScriptTag("self.__boot=1", nonce);
    return new Response(`<html><body><p>${page}</p>${scripts}</body></html>`, { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  }

  const desk = (): PageDesk => ({
    version: async () => state.version,
    cache,
    waitUntil: (work) => pending.push(work),
  });
  const fetch = withSecurityHeaders<LimitBindings>(
    withPageCache(
      byHost({
        app: withRateLimits(SITE_LIMITS, withSharedPageCache(desk, vinext)),
        api: async () => {
          state.apiCalls += 1;
          return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
        },
        apiNotFound: () => new Response("Not Found", { status: 404 }),
      }),
    ),
  );

  /** Send one request, then let every write the response left behind finish. */
  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("cf-connecting-ip", "203.0.113.7");
    const response = await fetch(new Request(url, { ...init, headers }), env, {} as ExecutionContext);
    await Promise.all(pending.splice(0));
    return response;
  }
  return { send, state, cache };
}

/** The nonce a page's policy names in `script-src`. */
function policyNonceOf(response: Response): string {
  const policy = response.headers.get(CSP_HEADER) ?? "";
  const nonces = [...policy.matchAll(/'nonce-([^']+)'/g)].map((match) => match[1]);
  assert.equal(nonces.length, 1, `one nonce in ${policy}`);
  return nonces[0];
}

/** Every `nonce="…"` in a page. */
const scriptNoncesOf = (html: string): string[] => [...html.matchAll(/nonce="([^"]+)"/g)].map((match) => match[1]);

test("a second request for the same page on the same version is answered from the shared cache without a render", async () => {
  const { send, state, cache } = worker();
  for (const url of [`${LEXEMA}/?q=bello`, `${LEXEMA}/`]) {
    const first = await send(url);
    const rendered = state.renders;
    assert.equal(first.headers.get(PAGE_SOURCE_HEADER), "miss", url);
    const firstHtml = await first.text();

    const second = await send(url);
    assert.equal(state.renders, rendered, `${url}: no render on the second request`);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get(PAGE_SOURCE_HEADER), "hit", url);
    assert.equal(second.headers.get("content-type"), "text/html; charset=utf-8");
    const secondHtml = await second.text();
    assert.equal(secondHtml.replaceAll(policyNonceOf(second), "N"), firstHtml.replaceAll(policyNonceOf(first), "N"), "the same page");
  }
  assert.equal(cache.puts.length, 2, "one page kept per address");
  assert.ok(cache.puts.every((key) => !cache.kept.get(key)?.headers.has("set-cookie")));
  assert.ok(cache.puts.every((key) => !/private|no-store/.test(cache.kept.get(key)?.headers.get("cache-control") ?? "")), "the kept copy is one a data center stores");

  const head = await send(`${LEXEMA}/?q=bello`, { method: "HEAD" });
  assert.equal(head.headers.get(PAGE_SOURCE_HEADER), "hit", "a HEAD reads the kept page");
  assert.equal(await head.text(), "");
});

test("the key holds the served version: the same address under a new version is a miss, never the old page", async () => {
  const { send, state } = worker();
  const old = await (await send(`${LEXEMA}/?q=bello`)).text();
  assert.match(old, /at v1/);
  state.version = "v2";
  const fresh = await send(`${LEXEMA}/?q=bello`);
  assert.equal(fresh.headers.get(PAGE_SOURCE_HEADER), "miss");
  const html = await fresh.text();
  assert.match(html, /at v2/);
  assert.doesNotMatch(html, /at v1/);
  assert.equal((await send(`${LEXEMA}/?q=bello`)).headers.get(PAGE_SOURCE_HEADER), "hit");
});

test("when the served version cannot be read, the shared cache is neither read nor written", async () => {
  const cache = new StandInCache();
  const { send, state } = worker({ cache });
  await send(`${LEXEMA}/?q=bello`);
  const kept = cache.puts.length;
  state.version = undefined;
  const before = state.renders;
  for (let i = 0; i < 2; i += 1) {
    const response = await send(`${LEXEMA}/?q=bello`);
    assert.equal(response.headers.get(PAGE_SOURCE_HEADER), "unkept");
    assert.equal(response.headers.get("cache-control"), PAGE_CACHE_CONTROL, "the browser may still keep it");
  }
  assert.equal(state.renders, before + 2, "both rendered");
  assert.equal(cache.matches.length, 1, "only the first request, under a read version, asked the cache");
  assert.equal(cache.puts.length, kept, "nothing written");
});

test("every page answered from the cache carries a fresh nonce, the same in its policy and in every script", async () => {
  const { send } = worker();
  const seen = new Set<string>();
  for (let i = 0; i < 3; i += 1) {
    const response = await send(`${LEXEMA}/?q=bello`);
    const nonce = policyNonceOf(response);
    const scripts = scriptNoncesOf(await response.text());
    assert.equal(scripts.length, 2);
    for (const script of scripts) assert.equal(script, nonce);
    seen.add(nonce);
  }
  assert.equal(seen.size, 3, "the render and two hits, each with its own nonce");
});

test("a kept page leaves with the browser's header only: private for an hour, never public or s-maxage", async () => {
  const { send } = worker();
  for (const source of ["miss", "hit"]) {
    const response = await send(`${LEXEMA}/?q=bello`);
    assert.equal(response.headers.get(PAGE_SOURCE_HEADER), source);
    assert.equal(response.headers.get("cache-control"), "private, max-age=3600", source);
    assert.doesNotMatch(response.headers.get("cache-control") ?? "", /public|s-maxage/i, source);
    assert.equal(response.headers.get("x-lexema-page-nonce"), null, `${source}: the kept nonce stays in the cache`);
  }
});

test("other query parameters do not change which kept page a request reads", async () => {
  const { send, state, cache } = worker();
  await send(`${LEXEMA}/?q=bello`);
  const rendered = state.renders;
  for (const url of [`${LEXEMA}/?q=bello&utm_source=x`, `${LEXEMA}/?utm_source=x&q=bello`, `${LEXEMA}/?q=bello&q=brutto`, `${LEXEMA}/?q=bello&version=v0`]) {
    const response = await send(url);
    assert.equal(response.headers.get(PAGE_SOURCE_HEADER), "hit", url);
    assert.match(await response.text(), /page bello at v1 render 1/, url);
  }
  assert.equal(state.renders, rendered);
  assert.equal(cache.puts.length, 1, "no other entry was written");
});

test("excluded requests and responses are never kept and never answered from the cache", async () => {
  const cache = new StandInCache();
  const { send, state } = worker({ cache });
  // Warm the entries an excluded request would read if it read one.
  for (const q of ["bello", FAILING, COOKIE_SETTING, FLIGHT]) await send(`${LEXEMA}/?q=${q}`);
  assert.deepEqual(
    cache.puts.map((key) => new URL(key).searchParams.get("q")),
    ["bello"],
    "a failed lookup, a page that sets a cookie and an RSC payload are not kept",
  );
  const kept = cache.puts.length;

  const excluded: [string, string, RequestInit][] = [
    ["a failed lookup, again", `${LEXEMA}/?q=${FAILING}`, {}],
    ["a page that sets a cookie, again", `${LEXEMA}/?q=${COOKIE_SETTING}`, {}],
    ["a text/x-component answer, again", `${LEXEMA}/?q=${FLIGHT}`, {}],
    ["an RSC request by header", `${LEXEMA}/?q=bello`, { headers: { rsc: "1" } }],
    ["an RSC request by path", `${LEXEMA}/index.rsc?q=bello`, {}],
    ["an RSC request for the home page", `${LEXEMA}/.rsc?q=bello`, {}],
    ["a request with a cookie", `${LEXEMA}/?q=bello`, { headers: { cookie: "__Secure-lexema.session_token=abc" } }],
    ["a POST", `${LEXEMA}/?q=bello`, { method: "POST", body: "x" }],
    ["the report route", `${LEXEMA}/report?q=bello`, { method: "POST", body: "{}" }],
    ["the report box", `${LEXEMA}/report/open?q=bello`, { method: "POST" }],
    ["a developer-site page", "https://developers.lexema.fyi/?q=bello", {}],
    ["a Preview's developer-site page", "https://branch.developers-preview.lexema.fyi/?q=bello", {}],
  ];
  for (const [what, url, init] of excluded) {
    const rendered = state.renders;
    const response = await send(url, init);
    assert.equal(state.renders, rendered + 1, `${what}: rendered`);
    assert.notEqual(response.headers.get(PAGE_SOURCE_HEADER), "hit", what);
    assert.notEqual(response.headers.get(PAGE_SOURCE_HEADER), "miss", what);
  }

  const api = await send("https://api.lexema.fyi/v1/lookup?q=bello");
  assert.equal(state.apiCalls, 1, "the API answered");
  assert.equal(api.headers.get(PAGE_SOURCE_HEADER), null);

  const limited = await worker({ limits: { SEARCH_LIMIT: refuse }, cache }).send(`${LEXEMA}/?q=bello`);
  assert.equal(limited.status, 429);
  assert.match(await limited.text(), /too many searches/);
  assert.equal(limited.headers.get(PAGE_SOURCE_HEADER), null);

  assert.equal(cache.puts.length, kept, "none of them wrote an entry");
  assert.equal(cache.kept.size, 1);
});

test("a hit is counted by the per-visitor limits as a render is, and a visitor over the limit gets the 429 page, not the kept copy", async () => {
  const cache = new StandInCache();
  let counted = 0;
  const counting: RateLimit = {
    limit: async () => {
      counted += 1;
      return { success: counted <= 2 };
    },
  };
  const { send, state } = worker({ limits: { SEARCH_LIMIT: counting }, cache });
  assert.equal((await send(`${LEXEMA}/?q=bello`)).headers.get(PAGE_SOURCE_HEADER), "miss");
  assert.equal((await send(`${LEXEMA}/?q=bello`)).headers.get(PAGE_SOURCE_HEADER), "hit");
  assert.equal(counted, 2, "the render and the hit each counted once");

  const rendered = state.renders;
  const blocked = await send(`${LEXEMA}/?q=bello`);
  assert.equal(counted, 3);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("cache-control"), "no-store");
  assert.match(await blocked.text(), /too many searches/);
  assert.equal(state.renders, rendered + 1, "the blocked page was rendered, not read from the cache");

  assert.equal((await send(`${LEXEMA}/`)).headers.get(PAGE_SOURCE_HEADER), "miss", "the home page is not counted");
  assert.equal(counted, 3);
});

test("the shared cache adds no billed Cloudflare setting: no Workers Cache in the Wrangler configuration", () => {
  const config = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
  for (const env of [undefined, "production"]) {
    assert.equal(unstable_readConfig({ config, env }, { hideWarnings: true }).cache, undefined, env ?? "top level");
  }
});
