// The browser security headers (#620): what every Worker response carries on
// each site, the Content Security Policy on the dictionary's and the developer
// site's pages, and the per-request nonce vinext stamps on its inline scripts.
//
// The app here stands in for vinext with vinext's own two halves of the nonce:
// it reads the nonce off the request's policy with the reader vinext's App
// Router uses (vinext/dist/server/csp.js, called from app-rsc-handler.js), and
// writes its inline script with the writer vinext's SSR uses
// (vinext/dist/server/html.js, called from app-ssr-entry.js and
// app-ssr-stream.js). Neither is a public export, so they are imported by path.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { TURNSTILE_ORIGIN, TURNSTILE_SCRIPT } from "@/lib/shared/turnstile.ts";
import { apiNotFound } from "@/worker/api/handler.ts";
import { byHost, type Site, siteOf } from "@/worker/shared/hosts.ts";
import { API_POLICY, CSP_HEADER, SECURITY_HEADERS, withSecurityHeaders } from "@/worker/shared/securityHeaders.ts";
import { type Stage, withStage } from "@/worker/shared/stage.ts";
import { getScriptNonceFromHeaders } from "../node_modules/vinext/dist/server/csp.js";
import { createInlineScriptTag } from "../node_modules/vinext/dist/server/html.js";

const WEB = fileURLToPath(new URL("..", import.meta.url));

/** The Worker's outer layers on `stage`, over an app that renders a page the way vinext stamps one. */
function worker(stage: Stage) {
  const fetch = withStage<object>(
    stage,
    withSecurityHeaders<object>(
      byHost<object>({
        app: async (request) => {
          const { pathname } = new URL(request.url);
          // A redirect's headers are immutable, as a fetched or asset response's are.
          if (pathname.endsWith("/moved")) return Response.redirect("https://lexema.fyi/", 303);
          if (pathname.endsWith("/data.rsc")) return new Response("0:{}", { headers: { "content-type": "text/x-component" } });
          const nonce = getScriptNonceFromHeaders(request.headers);
          return new Response(`<html><body><p>page</p>${createInlineScriptTag("self.__payload=1", nonce)}</body></html>`, {
            headers: { "content-type": "text/html; charset=utf-8", "set-cookie": "visitor=1" },
          });
        },
        api: async () => Response.json({ ok: true }),
        apiNotFound,
      }),
    ),
  );
  return (url: string, init?: RequestInit) => fetch(new Request(url, init), {}, {} as ExecutionContext);
}

/** One origin per site on each stage, as the Worker is reached there. */
const ORIGINS: readonly [Stage, string][] = [
  ["production", "https://lexema.fyi"],
  ["production", "https://developers.lexema.fyi"],
  ["production", "https://api.lexema.fyi"],
  ["preview", "https://branch.preview.lexema.fyi"],
  ["preview", "https://branch.developers-preview.lexema.fyi"],
  ["preview", "https://branch.api-preview.lexema.fyi"],
  ["local", "http://localhost:5173"],
  ["local", "http://developers.localhost:5173"],
  ["local", "http://api.localhost:5173"],
];

/** A policy's directives, by name: each one's sources. */
function directivesOf(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

/** The nonce a page's policy names in `script-src`. */
function policyNonceOf(response: Response): string {
  const sources = directivesOf(response.headers.get(CSP_HEADER) ?? "").get("script-src") ?? [];
  const nonces = sources.filter((source) => source.startsWith("'nonce-")).map((source) => source.slice("'nonce-".length, -1));
  assert.equal(nonces.length, 1, `one nonce in ${sources.join(" ")}`);
  return nonces[0];
}

test("every response on each of the three sites carries nosniff, the referrer policy, DENY framing and HSTS without preload", async () => {
  const seen = new Set<Site>();
  for (const [stage, origin] of ORIGINS) {
    const send = worker(stage);
    for (const path of ["/", "/?q=casa", "/moved", "/v1/lookup?q=sale", "/nowhere"]) {
      const url = `${origin}${path}`;
      seen.add(siteOf(new URL(url)));
      const response = await send(url);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff", url);
      assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin", url);
      assert.equal(response.headers.get("x-frame-options"), "DENY", url);
      const hsts = response.headers.get("strict-transport-security") ?? "";
      const maxAge = /(?:^|;)\s*max-age=(\d+)\s*(?:;|$)/i.exec(hsts);
      assert.ok(maxAge && Number(maxAge[1]) >= 31536000, `max-age of at least a year on ${url}: ${hsts}`);
      assert.doesNotMatch(hsts, /preload/i, url);
    }
  }
  assert.deepEqual([...seen].sort(), ["api", "developers", "lexema"]);
});

test("an HTML page on the dictionary and the developer site carries a policy with a nonce, Turnstile, and nothing framing it", async () => {
  for (const [stage, origin] of ORIGINS.filter(([, origin]) => siteOf(new URL(origin)) !== "api")) {
    const response = await worker(stage)(`${origin}/?q=casa`);
    const policy = response.headers.get(CSP_HEADER);
    assert.ok(policy, origin);
    const directives = directivesOf(policy);
    assert.deepEqual(directives.get("frame-ancestors"), ["'none'"], origin);
    assert.deepEqual(directives.get("object-src"), ["'none'"], origin);
    assert.ok(directives.has("base-uri"), origin);
    const scripts = directives.get("script-src") ?? [];
    assert.match(policyNonceOf(response), /^[A-Za-z0-9+/]{22}==$/, origin);
    assert.ok(!scripts.includes("'unsafe-eval'") && !scripts.includes("'unsafe-inline'"), `${origin}: ${scripts.join(" ")}`);
    assert.ok(scripts.includes(TURNSTILE_ORIGIN), origin);
    assert.ok(directives.get("frame-src")?.includes(TURNSTILE_ORIGIN), origin);
  }
  // The origin allowed is the one the report dialog loads Turnstile from.
  assert.equal(new URL(TURNSTILE_SCRIPT).origin, TURNSTILE_ORIGIN);
});

test("two requests get two nonces, and each page's inline script carries its own response's nonce", async () => {
  const send = worker("production");
  const nonces = new Set<string>();
  for (const url of ["https://lexema.fyi/?q=casa", "https://lexema.fyi/?q=casa", "https://developers.lexema.fyi/", "https://developers.lexema.fyi/"]) {
    const response = await send(url);
    const nonce = policyNonceOf(response);
    nonces.add(nonce);
    assert.match(await response.text(), new RegExp(`<script nonce="${nonce.replace(/[+/]/g, "\\$&")}">self\\.__payload=1</script>`), url);
  }
  assert.equal(nonces.size, 4);
});

test("a policy a client sends is replaced, so vinext stamps only the Worker's nonce", async () => {
  const response = await worker("production")("https://lexema.fyi/", { headers: { [CSP_HEADER]: "script-src 'nonce-chosenbytheclient'" } });
  const nonce = policyNonceOf(response);
  assert.notEqual(nonce, "chosenbytheclient");
  assert.match(await response.text(), new RegExp(`nonce="${nonce.replace(/[+/]/g, "\\$&")}"`));
});

test("only HTML gets the page policy; the API's JSON gets one that allows nothing", async () => {
  const rsc = await worker("production")("https://lexema.fyi/data.rsc");
  assert.equal(rsc.headers.get(CSP_HEADER), null);
  assert.equal(rsc.headers.get("x-content-type-options"), "nosniff");
  for (const path of ["/v1/lookup?q=sale", "/nowhere"]) {
    const response = await worker("production")(`https://api.lexema.fyi${path}`);
    assert.equal(response.headers.get(CSP_HEADER), API_POLICY, path);
  }
});

test("a response keeps the rest of itself, and a Preview's noindex still comes through", async () => {
  const page = await worker("preview")("https://branch.preview.lexema.fyi/?q=casa");
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-robots-tag"), "noindex");
  assert.equal(page.headers.get("set-cookie"), "visitor=1");
  assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
  const moved = await worker("preview")("https://branch.developers-preview.lexema.fyi/moved");
  assert.equal(moved.status, 303);
  assert.equal(moved.headers.get("location"), "https://lexema.fyi/");
  assert.equal(moved.headers.get("x-robots-tag"), "noindex");
  assert.equal(moved.headers.get("x-frame-options"), "DENY");
});

test("the security headers are named in one file under worker/ and wrapped around the Worker in one place", async () => {
  const names = [...Object.keys(SECURITY_HEADERS), CSP_HEADER];
  const files = (await readdir(join(WEB, "worker"), { recursive: true })).filter((path) => path.endsWith(".ts"));
  const naming: string[] = [];
  const wrapping: string[] = [];
  for (const path of files) {
    const source = (await readFile(join(WEB, "worker", path), "utf8")).toLowerCase();
    if (names.some((name) => source.includes(`"${name}"`))) naming.push(path);
    if (source.includes("withsecurityheaders<env>(")) wrapping.push(path);
  }
  assert.deepEqual(naming, ["shared/securityHeaders.ts"]);
  assert.deepEqual(wrapping, ["index.ts"]);
});
