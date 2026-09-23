// `GET /suggest?q=<prefix>`: the search field's suggestions, as JSON.
//
// A route handler rather than a page, so an answer costs the prefix query and
// nothing else — no React render, no layout, no fonts. The body is
// `SuggestAnswer` (web/app/suggestAnswer.ts); the query, its bounds and its
// order are src/lookup/suggest.ts.
//
// Two caches sit in front of the query, because readers type the same prefixes
// over and over and a release never changes once served:
//
// - The browser keeps an answer for `BROWSER_SECONDS`, so retyping a prefix
//   sends no request at all.
// - Cloudflare's edge cache keeps it for `EDGE_SECONDS`, shared by every reader
//   near that location, so a request answered there never reaches D1. The key
//   carries the release, so serving a new release starts from an empty cache
//   and no reader is offered a word from the old one.

import { env } from "cloudflare:workers";
import { suggestions } from "../db";
import type { SuggestAnswer } from "../suggestAnswer.ts";

/**
 * How long a browser may reuse an answer. Five minutes of an old suggestion is
 * harmless even across a release change, because choosing one runs the real
 * lookup.
 */
const BROWSER_SECONDS = 300;

/** How long an edge location keeps an answer. The key is per release. */
const EDGE_SECONDS = 86_400;

const BROWSER_CACHE = `public, max-age=${BROWSER_SECONDS}`;

/**
 * The Workers runtime's default cache, or nothing where there is none, so the
 * route still answers — uncached — outside a Worker.
 */
function edgeCache(): Cache | undefined {
  const storage = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches;
  return storage?.default;
}

/** One edge entry per release and prefix, whatever else the URL carries. */
function edgeKey(url: URL, prefix: string): Request {
  const key = new URL("/suggest", url.origin);
  key.searchParams.set("release", env.LEXEMA_RELEASE);
  key.searchParams.set("q", prefix);
  return new Request(key);
}

const json = (body: SuggestAnswer, status: number, cacheControl: string, cache: "hit" | "miss" | "none"): Response =>
  Response.json(body, {
    status,
    headers: { "cache-control": cacheControl, "x-lexema-cache": cache },
  });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const prefix = url.searchParams.get("q") ?? "";
  const cache = edgeCache();
  const key = cache ? edgeKey(url, prefix) : undefined;

  if (cache && key) {
    const hit = await cache.match(key);
    if (hit) {
      // The stored copy carries the edge lifetime; the browser gets its own.
      return new Response(hit.body, {
        status: hit.status,
        headers: { "content-type": "application/json", "cache-control": BROWSER_CACHE, "x-lexema-cache": "hit" },
      });
    }
  }

  const result = await suggestions(prefix);
  let body: SuggestAnswer;
  let status: number;
  switch (result.outcome) {
    case "suggested":
      body = { outcome: "suggested", suggestions: result.suggestions };
      status = 200;
      break;
    case "rejected":
      body = { outcome: "rejected", reason: result.rejection.reason, limit: result.rejection.limit };
      status = 400;
      break;
    case "failed":
      // The reason is in the Worker's log; the field only needs to know it
      // cannot offer anything, and neither cache may keep that.
      return json({ outcome: "failed" }, 503, "no-store", "none");
  }

  if (cache && key) {
    await cache.put(key, json(body, status, `public, max-age=${EDGE_SECONDS}`, "miss"));
  }
  return json(body, status, BROWSER_CACHE, cache ? "miss" : "none");
}
