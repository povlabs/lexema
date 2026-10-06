// The reader's browser may keep a word page or the home page for an hour (#641).
//
// vinext marks every dynamic page `no-store, must-revalidate`
// (vinext/dist/server/cache-control.js), so going back, going forward or
// opening the same word again ran a whole render on the Worker. Huey ruled on
// #641 that the dictionary's pages may be kept by the browser alone:
// `private`, never `public` or `s-maxage`, so no shared or edge cache keeps
// one. A kept page keeps the Content Security Policy it came with
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

import { AsyncLocalStorage } from "node:async_hooks";
import type { FetchHandler } from "../shared/fetchHandler.ts";
import { routePathOf, siteOf } from "../shared/hosts.ts";
import { isHtml } from "../shared/securityHeaders.ts";

/** How long a reader's browser may keep a word page or the home page. */
export const PAGE_MAX_AGE_SECONDS = 3600;

/** The `cache-control` a page the browser may keep is sent with: the browser's cache only. */
export const PAGE_CACHE_CONTROL = `private, max-age=${PAGE_MAX_AGE_SECONDS}`;

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

/** Note that this request's page must not stay in the reader's browser. Outside `withPageCache`, as in a test of the page alone, nothing is noted. */
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
    // A fetched or asset response has immutable headers, so this is a copy.
    const headers = new Headers(response.headers);
    headers.set("cache-control", PAGE_CACHE_CONTROL);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
