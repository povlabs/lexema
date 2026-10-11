// Every request runs under its own id, and nothing it throws leaves unlogged (#413).
//
// The id is the request's `cf-ray`, the id Cloudflare gives each request at
// its edge, or a fresh UUID where there is none, as in `wrangler dev`. Inside,
// every line written through `log` (src/log/requestLog.ts) names it.
//
// A failure the handlers do not answer themselves is caught here, logged with
// the method and the path and never the query, which is where a search string
// is, and answered 500 with the id in `x-request-id`, so a reader who reports
// it can be matched to the log. The 500's sentence is in the language of the
// site the request is for (#793): Italian on lexema.fyi, which is Italian since
// #791, and English on the developer site and the API (ADR 0015).

import { inRequest, log } from "@lexema/log/requestLog.ts";
import type { FetchHandler } from "./fetchHandler.ts";
import { type Site, siteOf } from "./hosts.ts";

/** The response header a failed request's id is returned in. */
export const REQUEST_ID_HEADER = "x-request-id";

/** The plain-text sentence each site answers a failed request with, in that site's language. */
export const REQUEST_FAILED: Readonly<Record<Site, string>> = {
  lexema: "Qualcosa è andato storto da parte nostra. Riprova tra un momento.",
  developers: "Something went wrong on our side. Try again in a moment.",
  api: "Something went wrong on our side. Try again in a moment.",
};

/** The id a request is logged under: Cloudflare's ray id, or a fresh one. */
export const requestIdOf = (request: Request): string => request.headers.get("cf-ray") ?? crypto.randomUUID();

/** Run `handler` under the request's id, and answer anything it throws with a logged 500. */
export function withRequestLog<E>(handler: FetchHandler<E>): FetchHandler<E> {
  return (request, env, ctx) => {
    const requestId = requestIdOf(request);
    return inRequest(requestId, async () => {
      try {
        return await handler(request, env, ctx);
      } catch (failure) {
        const url = new URL(request.url);
        log.error("request failed", { method: request.method, path: url.pathname }, failure);
        return new Response(REQUEST_FAILED[siteOf(url)], {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
        });
      }
    });
  };
}
