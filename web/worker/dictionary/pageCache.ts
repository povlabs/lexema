// Where a word page or the home page is kept, so the next reader does not
// render it again: the reader's browser for an hour (#641), and Cloudflare's
// cache in each data center for the served version (#667).
//
// vinext marks every dynamic page `no-store, must-revalidate`
// (vinext/dist/server/cache-control.js), so going back, going forward or
// opening the same word again ran a whole render on the Worker.
//
// The browser cache. Huey ruled on #641 that the dictionary's pages may be
// kept by the browser: the response says `private`, never `public` or
// `s-maxage`. A kept page keeps the Content Security Policy it came with
// (worker/shared/securityHeaders.ts), so its scripts still carry the nonce
// that policy names.
//
// Only one kind of response qualifies: a 200 HTML answer to a GET or HEAD of
// `/` on the dictionary's host, with or without `?q=`, that sets no cookie,
// and whose lookup did not fail. Everything else leaves with the header it
// already has, `no-store` among its directives: a page whose lookup failed,
// such as during a database outage (#642), a 429 "too many searches" page and
// any other status, an RSC payload on the same address (`text/x-component`),
// the report routes, the developer site and the API.
//
// A failed lookup is still a 200 page, so the response alone cannot tell it
// from a found word. The page says so instead: `search`
// (lib/dictionary/db.ts) calls `refuseKeeping` when its lookup fails, which
// notes it on this request's `PageNotes`. The notes live in an
// AsyncLocalStorage that `withPageCache` opens around the request, as
// worker/shared/requestLog.ts opens the request id the page's log lines carry.
// Nothing is written on the response, so nothing has to be stripped before it
// leaves. vinext builds a page's response only once its shell has rendered
// (vinext/dist/server/app-page-render.js), and the lookup has no streaming
// boundary around it (app/(lexema)/page.tsx, #115), so the note is in place
// before the response reaches the rule.
//
// The shared cache. Huey approved it on #667 on the condition that it costs no
// more: it is the Workers Cache API's `caches.default`, which stores for free
// in each data center, and a hit is billed as one request, as a render is. It
// is not Workers Cache (`cache` in wrangler.jsonc), which is billed. A page
// the browser may keep is also kept there, under its origin, its first `q`
// as the page reads it (lib/dictionary/params.ts) and the served version
// (lib/dictionary/db.ts). The version changes on every deploy and every
// dictionary apply, so a kept page is never answered for another version, and
// no other query parameter splits or poisons the key. When the version cannot
// be read, the shared cache is neither read nor written. The browser still
// gets `private, max-age=3600`; only the stored copy carries an edge
// `max-age`, since `caches.default` stores nothing marked `private`.
//
// `withSharedPageCache` sits inside the per-visitor limits
// (worker/shared/rateLimit.ts, worker/index.ts), so a hit is counted exactly
// as a render was, and a search over the limit reaches it marked and is
// rendered, never answered from the cache. It answers nothing for an RSC
// request, a request carrying a cookie, or any request `withPageCache` would
// not mark, and it stores a page only when its lookup did not fail, read again
// once the whole page has been read. A kept page holds the nonce of the
// request that rendered it, so a hit swaps in this request's nonce, in every
// script and in the policy. `x-lexema-page` says where a page came from, as
// `x-lexema-card` does for a card (worker/dictionary/card.ts).

import { AsyncLocalStorage } from "node:async_hooks";
import type { FetchHandler } from "../shared/fetchHandler.ts";
import { isRscPath, routePathOf, siteOf } from "../shared/hosts.ts";
import { SEARCH_LIMITED_HEADER } from "../shared/rateLimit.ts";
import { CSP_HEADER, isHtml, scriptNonceOf, type ScriptNonce } from "../shared/securityHeaders.ts";

/** How long a reader's browser may keep a word page or the home page. */
export const PAGE_MAX_AGE_SECONDS = 3600;

/** The `cache-control` a page the browser may keep is sent with: the browser's cache only. */
export const PAGE_CACHE_CONTROL = `private, max-age=${PAGE_MAX_AGE_SECONDS}`;

/** How long a data center keeps a page: a day, since its key changes whenever the page could. */
export const SHARED_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Says where a page came from: `hit` (shared cache), `miss` (rendered and kept), `unkept` (rendered, not kept). */
export const PAGE_SOURCE_HEADER = "x-lexema-page";

/** On a kept page only: the nonce of the request that rendered it, which a hit replaces. */
const KEPT_NONCE_HEADER = "x-lexema-page-nonce";

/** Why a page the browser could otherwise keep must not be kept: its lookup failed. */
export type KeepRefusal = "lookup-failed";

/** What a request's page said about itself while it rendered: whether it refused to be kept. */
class PageNotes {
  #refusal: KeepRefusal | undefined;

  refuse(reason: KeepRefusal): void {
    this.#refusal = reason;
  }

  get refusal(): KeepRefusal | undefined {
    return this.#refusal;
  }
}

const pageNotes = new AsyncLocalStorage<PageNotes>();

/** Note that this request's page must not be kept, by the browser or the shared cache. Outside `withPageCache`, as in a test of the page alone, nothing is noted. */
export function refuseKeeping(reason: KeepRefusal): void {
  pageNotes.getStore()?.refuse(reason);
}

/** Whether `response`, the answer to `request`, is a dictionary page a reader's browser may keep; `refusal` is the page's own word against it. */
export function browserMayKeep(request: Request, response: Response, refusal?: KeepRefusal): boolean {
  const url = new URL(request.url);
  return (
    refusal === undefined &&
    siteOf(url) === "lexema" &&
    (request.method === "GET" || request.method === "HEAD") &&
    routePathOf(url.pathname) === "/" &&
    response.status === 200 &&
    isHtml(response) &&
    !response.headers.has("set-cookie")
  );
}

/** Every response `handler` gives, with `PAGE_CACHE_CONTROL` on the pages a browser may keep. */
export function withPageCache<E>(handler: FetchHandler<E>): FetchHandler<E> {
  return async (request, env, ctx) => {
    const notes = new PageNotes();
    const response = await pageNotes.run(notes, () => handler(request, env, ctx));
    if (!browserMayKeep(request, response, notes.refusal)) return response;
    return withHeaders(response, { "cache-control": PAGE_CACHE_CONTROL });
  };
}

/** What the shared cache needs; the Worker's own (worker/dictionary/pageDesk.ts), or a test's. */
export interface PageDesk {
  /** The served version's token, read now; undefined when it could not be read. */
  version: () => Promise<string | undefined>;
  /** Where pages are kept: Cloudflare's cache in the Worker. */
  cache: Pick<Cache, "match" | "put">;
  /** Keeps work going after the response has left. */
  waitUntil: (work: Promise<unknown>) => void;
}

/** A request for a page the shared cache may answer: what its key is made of, and the policy and nonce its own render would carry. */
class SharedAsk {
  private constructor(
    readonly origin: string,
    readonly query: string,
    readonly policy: string,
    readonly nonce: ScriptNonce,
    readonly head: boolean,
  ) {}

  /** The ask `request` makes, or none when the shared cache must not answer it. */
  static of(request: Request): SharedAsk | undefined {
    const url = new URL(request.url);
    const { headers, method } = request;
    const policy = headers.get(CSP_HEADER);
    const nonce = scriptNonceOf(policy);
    if (
      policy === null ||
      nonce === undefined ||
      siteOf(url) !== "lexema" ||
      (method !== "GET" && method !== "HEAD") ||
      routePathOf(url.pathname) !== "/" ||
      isRscPath(url.pathname) ||
      headers.get("rsc") === "1" ||
      headers.has(SEARCH_LIMITED_HEADER) ||
      headers.has("cookie")
    ) {
      return undefined;
    }
    // The page reads the first `q`, and none as empty (`firstQuery`).
    return new SharedAsk(url.origin, url.searchParams.get("q") ?? "", policy, nonce, method === "HEAD");
  }

  /** The key this page is kept under for `version`: nothing else of the URL is in it. */
  keyFor(version: string): Request {
    const key = new URL("/", this.origin);
    key.searchParams.set("q", this.query);
    key.searchParams.set("version", version);
    return new Request(key);
  }

  /** A kept page, answered to this request with its own nonce, or none when `kept` is not one this module stored. */
  async answer(kept: Response): Promise<Response | undefined> {
    const keptNonce = kept.headers.get(KEPT_NONCE_HEADER);
    // Not awaited: a cancelled branch of a teed body settles only once the other branch is cancelled too.
    if (keptNonce === null || this.head) void kept.body?.cancel();
    if (keptNonce === null) return undefined;
    const headers = new Headers(kept.headers);
    headers.delete(KEPT_NONCE_HEADER);
    headers.delete("content-length");
    headers.set(CSP_HEADER, this.policy);
    headers.set("cache-control", PAGE_CACHE_CONTROL);
    headers.set(PAGE_SOURCE_HEADER, "hit");
    const body = this.head ? null : (await kept.text()).replaceAll(keptNonce, this.nonce);
    return new Response(body, { status: 200, headers });
  }

  /** Keep `copy`, this request's rendered page, under `key`, unless its lookup failed after all. */
  async keep(cache: PageDesk["cache"], key: Request, copy: Response, notes: PageNotes): Promise<void> {
    const html = await copy.text();
    if (notes.refusal !== undefined) return;
    const headers = new Headers(copy.headers);
    for (const name of ["set-cookie", CSP_HEADER, PAGE_SOURCE_HEADER, "content-length"]) headers.delete(name);
    headers.set("cache-control", `max-age=${SHARED_MAX_AGE_SECONDS}`);
    headers.set(KEPT_NONCE_HEADER, this.nonce);
    await cache.put(key, new Response(html, { status: 200, headers }));
  }
}

/**
 * Answer a dictionary page from the shared cache when it holds one for the
 * served version; otherwise `app` renders it, and a page the browser may keep
 * is kept. Sits inside `withPageCache`, whose notes say whether the lookup
 * failed, and inside the per-visitor limits.
 */
export function withSharedPageCache<E>(desk: (env: E, request: Request, ctx: ExecutionContext) => PageDesk, app: FetchHandler<E>): FetchHandler<E> {
  return async (request, env, ctx) => {
    const ask = SharedAsk.of(request);
    const notes = pageNotes.getStore();
    if (ask === undefined || notes === undefined) return app(request, env, ctx);
    const { version, cache, waitUntil } = desk(env, request, ctx);

    const served = await version();
    if (served === undefined) return withHeaders(await app(request, env, ctx), { [PAGE_SOURCE_HEADER]: "unkept" });
    const key = ask.keyFor(served);
    const kept = await cache.match(key);
    const hit = kept === undefined ? undefined : await ask.answer(kept);
    if (hit !== undefined) return hit;

    const response = await app(request, env, ctx);
    if (ask.head || !browserMayKeep(request, response, notes.refusal)) {
      return withHeaders(response, { [PAGE_SOURCE_HEADER]: "unkept" });
    }
    waitUntil(ask.keep(cache, key, response.clone(), notes));
    return withHeaders(response, { [PAGE_SOURCE_HEADER]: "miss" });
  };
}

/** `response` with `set` on its headers. A fetched or asset response has immutable headers, so this is a copy. */
function withHeaders(response: Response, set: Readonly<Record<string, string>>): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(set)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
