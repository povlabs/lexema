// A word page and the home page may stay in the reader's browser for an hour,
// and nothing else changes how it is cached (#641).
//
// The Worker here is worker/index.ts's layers from the security headers in to
// vinext, with the real per-visitor limits, sign-in, dashboard and report
// routes. vinext itself stands in, as in securityHeaders.test.ts: it stamps its
// inline script with the nonce it reads off the request, by vinext's own reader
// and writer, and marks every page and RSC payload with the `cache-control`
// vinext gives a dynamic page (vinext/dist/server/cache-control.js).

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import type { ProviderProfile } from "../../src/accounts/providers.js";
import { freshAppDatabase } from "../../test/databases.js";
import { apiNotFound } from "@/worker/api/handler.ts";
import { DASHBOARD, type DashboardBindings, withDashboard } from "@/worker/developers/dashboard.ts";
import { type SignInBindings, withSignIn } from "@/worker/developers/signIn.ts";
import { browserMayKeep, PAGE_CACHE_CONTROL, withPageCache } from "@/worker/dictionary/pageCache.ts";
import { byHost, routePathOf } from "@/worker/shared/hosts.ts";
import { type LimitBindings, SEARCH_LIMITED_HEADER, withRateLimits } from "@/worker/shared/rateLimit.ts";
import { CSP_HEADER, withSecurityHeaders } from "@/worker/shared/securityHeaders.ts";
import { getScriptNonceFromHeaders } from "../node_modules/vinext/dist/server/csp.js";
import { createInlineScriptTag } from "../node_modules/vinext/dist/server/html.js";
import { SITE_LIMITS } from "./siteLimits.ts";
import { StubProvider } from "./stubProvider.ts";
import { BILLING_OFF } from "./stubStripe.ts";

/** What vinext 1.1.0 marks a dynamic page with (`NO_STORE_CACHE_CONTROL`). */
const VINEXT_DYNAMIC = "no-store, must-revalidate";
const NOW = Date.parse("2026-10-06T12:00:00Z");
const DEVELOPERS = "https://developers.lexema.fyi";

/** The Worker's `env` as `cloudflare:workers` hands it to the report routes: production, with the report box's secrets unset. */
(globalThis as { lexemaTestEnv?: Record<string, unknown> }).lexemaTestEnv = { LEXEMA_STAGE: "production", LEXEMA_RELEASE: "it-page-cache-test" };

type RouteModule = { POST: (request: Request) => Promise<Response> };

/** A route module, imported outside workerd with `cloudflare:workers` stood in for. */
async function route(path: string): Promise<RouteModule> {
  const source = `export const env = globalThis.lexemaTestEnv; export class DurableObject {}`;
  const hooks = registerHooks({
    resolve: (specifier, context, nextResolve) =>
      specifier === "cloudflare:workers"
        ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
        : nextResolve(specifier, context),
  });
  try {
    return (await import(path)) as RouteModule;
  } finally {
    hooks.deregister();
  }
}

const report = await route("../app/(lexema)/report/route.ts");
const reportOpen = await route("../app/(lexema)/report/open/route.ts");

/** vinext as the Worker reaches it: the two report routes, an RSC payload, and a page stamped with the request's nonce. */
async function vinext(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = routePathOf(url.pathname);
  if (request.method === "POST" && path === "/report") return report.POST(request);
  if (request.method === "POST" && path === "/report/open") return reportOpen.POST(request);
  const headers = { "cache-control": VINEXT_DYNAMIC, vary: "RSC, Accept" };
  if (url.pathname.endsWith(".rsc") || request.headers.get("rsc") === "1") {
    return new Response("0:{}", { headers: { ...headers, "content-type": "text/x-component" } });
  }
  const nonce = getScriptNonceFromHeaders(request.headers);
  const state = request.headers.has(SEARCH_LIMITED_HEADER) ? "too many searches" : "page";
  return new Response(`<html><body><p>${state}</p>${createInlineScriptTag("self.__payload=1", nonce)}</body></html>`, {
    headers: { ...headers, "content-type": "text/html; charset=utf-8" },
  });
}

const allow: RateLimit = { limit: async () => ({ success: true }) };
const refuse: RateLimit = { limit: async () => ({ success: false }) };

/** The Worker, with every per-visitor limit allowing except those in `limits`; one browser's cookies kept across requests. */
function worker(limits: Partial<LimitBindings> = {}) {
  const env: LimitBindings & SignInBindings & DashboardBindings = {
    SEARCH_LIMIT: allow,
    SUGGEST_LIMIT: allow,
    REPORT_LIMIT: allow,
    REPORT_OPEN_LIMIT: allow,
    SIGN_IN_LIMIT: allow,
    KEY_CREATE_LIMIT: allow,
    BILLING_LIMIT: allow,
    ...limits,
  };
  const { appDb } = freshAppDatabase();
  const google = new StubProvider("google");
  const fetch = withSecurityHeaders<typeof env>(
    withPageCache<typeof env>(
      byHost<typeof env>({
        app: withRateLimits(
          SITE_LIMITS,
          withSignIn(
            withDashboard(vinext, () => ({ appDb, billing: BILLING_OFF, now: NOW })),
            () => ({ providers: { google, github: undefined }, appDb, now: NOW }),
          ),
        ),
        api: async () => Response.json({ ok: true }, { headers: { "cache-control": "no-store" } }),
        apiNotFound,
      }),
    ),
  );
  const jar = new Map<string, string>();
  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("cf-connecting-ip", "203.0.113.7");
    if (jar.size > 0) headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
    const response = await fetch(new Request(url, { ...init, headers }), env, {} as ExecutionContext);
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";")[0];
      const at = pair.indexOf("=");
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return response;
  }
  /** Sign this browser in as `profile`, through the stub provider; the sign-in responses, in order. */
  async function signIn(profile: ProviderProfile): Promise<Response[]> {
    const start = await send(`${DEVELOPERS}/sign-in/google`);
    const back = await send(google.consent(start.headers.get("location") ?? "", profile).toString());
    assert.equal(back.status, 303);
    return [start, back];
  }
  return { send, signIn };
}

/** The nonce a page's policy names in `script-src`. */
function policyNonceOf(response: Response): string {
  const policy = response.headers.get(CSP_HEADER) ?? "";
  const nonces = [...policy.matchAll(/'nonce-([^']+)'/g)].map((match) => match[1]);
  assert.equal(nonces.length, 1, `one nonce in ${policy}`);
  return nonces[0];
}

const isNoStore = (response: Response): boolean => /(?:^|,)\s*no-store\s*(?:,|$)/.test(response.headers.get("cache-control") ?? "");

test("the home page and a word page are kept by the browser for an hour, with the request's policy and the nonce their scripts carry", async () => {
  const { send } = worker();
  const nonces = new Set<string>();
  for (const url of ["https://lexema.fyi/", "https://lexema.fyi/?q=bello", "https://lexema.fyi/?q=bello"]) {
    const response = await send(url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers.get("cache-control"), "private, max-age=3600", url);
    const nonce = policyNonceOf(response);
    nonces.add(nonce);
    const scripts = [...(await response.text()).matchAll(/<script nonce="([^"]+)">/g)].map((match) => match[1]);
    assert.deepEqual(scripts, [nonce], url);
  }
  assert.equal(nonces.size, 3, "each request still gets its own nonce");
  const head = await send("https://lexema.fyi/?q=bello", { method: "HEAD" });
  assert.equal(head.headers.get("cache-control"), PAGE_CACHE_CONTROL);
});

test("a 429 'too many searches' page, the report routes, the dashboard and sign-in stay no-store", async () => {
  const limited = await worker({ SEARCH_LIMIT: refuse }).send("https://lexema.fyi/?q=bello");
  assert.equal(limited.status, 429);
  assert.match(await limited.text(), /too many searches/);
  assert.equal(limited.headers.get("cache-control"), "no-store");

  const { send, signIn } = worker();
  const posted = await send("https://lexema.fyi/report", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const opened = await send("https://lexema.fyi/report/open", { method: "POST" });
  for (const [what, response] of [["POST /report", posted], ["POST /report/open", opened]] as const) {
    assert.equal(response.headers.get("cache-control"), "no-store", what);
  }

  const signedOut = await send(`${DEVELOPERS}${DASHBOARD}`);
  assert.equal(signedOut.status, 303, "signed out, the dashboard sends the browser to sign in");
  assert.ok(isNoStore(signedOut));
  const signingIn = await signIn({ subject: "g-ada", verifiedEmail: "ada@example.com", name: "Ada Lovelace" });
  for (const response of signingIn) {
    assert.ok(response.headers.getSetCookie().length > 0, "a sign-in response sets a cookie");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  const dashboard = await send(`${DEVELOPERS}${DASHBOARD}`);
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.headers.get("content-type")?.startsWith("text/html"));
  assert.equal(dashboard.headers.get("cache-control"), "no-store");
});

test("nothing else changes: an RSC payload keeps vinext's header, the developer site's own home stays vinext's, and no response turns public", async () => {
  const { send } = worker();
  for (const [url, init] of [
    ["https://lexema.fyi/?q=bello", { headers: { rsc: "1" } }],
    ["https://lexema.fyi/index.rsc?q=bello", {}],
    ["https://lexema.fyi/.rsc", {}],
    [`${DEVELOPERS}/`, {}],
    [`${DEVELOPERS}/?q=bello`, {}],
    ["https://lexema.fyi/licence", {}],
  ] as const) {
    const response = await send(url, init);
    assert.equal(response.headers.get("cache-control"), VINEXT_DYNAMIC, url);
  }
  for (const url of ["https://lexema.fyi/", "https://lexema.fyi/?q=bello", `${DEVELOPERS}/`, `${DEVELOPERS}${DASHBOARD}`, "https://api.lexema.fyi/v1/lookup?q=bello"]) {
    const cacheControl = (await send(url)).headers.get("cache-control") ?? "";
    assert.doesNotMatch(cacheControl, /public|s-maxage/i, url);
  }
});

test("only a 200 HTML answer to a GET or HEAD of / on the dictionary, setting no cookie, whose lookup did not fail, is a page the browser may keep", () => {
  const html = (status = 200, headers: Record<string, string> = {}) =>
    new Response(null, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
  const ask = (url: string, method = "GET") => new Request(url, { method });
  const keeps = (url: string, response = html(), method = "GET") => browserMayKeep(ask(url, method), response);

  for (const url of ["https://lexema.fyi/", "https://lexema.fyi/?q=bello", "https://lexema.fyi//?q=bello", "https://branch.preview.lexema.fyi/?q=bello", "http://localhost:5173/"]) {
    assert.ok(keeps(url), url);
    assert.ok(keeps(url, html(), "HEAD"), `HEAD ${url}`);
  }
  assert.ok(!keeps("https://lexema.fyi/", html(), "POST"), "a POST");
  for (const status of [204, 301, 404, 429, 500, 503]) assert.ok(!keeps("https://lexema.fyi/?q=bello", html(status)), String(status));
  assert.ok(!keeps("https://lexema.fyi/?q=bello", new Response("0:{}", { headers: { "content-type": "text/x-component" } })), "an RSC payload");
  assert.ok(!keeps("https://lexema.fyi/?q=bello", html(200, { "set-cookie": "visitor=1" })), "a response that sets a cookie");
  assert.ok(!browserMayKeep(ask("https://lexema.fyi/?q=bello"), html(), "lookup-failed"), "a page whose lookup failed (#642)");
  for (const url of ["https://lexema.fyi/licence", "https://lexema.fyi/privacy", "https://lexema.fyi/suggest?q=bel", "https://lexema.fyi/report/open"]) {
    assert.ok(!keeps(url), url);
  }
  for (const url of [`${DEVELOPERS}/`, "https://branch.developers-preview.lexema.fyi/", "https://api.lexema.fyi/"]) assert.ok(!keeps(url), url);
  assert.equal(PAGE_CACHE_CONTROL, "private, max-age=3600");
});
