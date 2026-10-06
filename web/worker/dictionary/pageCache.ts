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
// `/` on the dictionary's host, with or without `?q=`, that sets no cookie.
// Everything else leaves with the header it already has: a 429 "too many
// searches" page and any other status, an RSC payload on the same address
// (`text/x-component`), the report routes, the developer site and the API.

import type { FetchHandler } from "../shared/fetchHandler.ts";
import { routePathOf, siteOf } from "../shared/hosts.ts";
import { isHtml } from "../shared/securityHeaders.ts";

/** How long a reader's browser may keep a word page or the home page. */
export const PAGE_MAX_AGE_SECONDS = 3600;

/** The `cache-control` a page the browser may keep is sent with: the browser's cache only. */
export const PAGE_CACHE_CONTROL = `private, max-age=${PAGE_MAX_AGE_SECONDS}`;

/** Whether `response`, the answer to `request`, is a dictionary page a reader's browser may keep. */
export function browserMayKeep(request: Request, response: Response): boolean {
  const url = new URL(request.url);
  return (
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
    const response = await handler(request, env, ctx);
    if (!browserMayKeep(request, response)) return response;
    // A fetched or asset response has immutable headers, so this is a copy.
    const headers = new Headers(response.headers);
    headers.set("cache-control", PAGE_CACHE_CONTROL);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
