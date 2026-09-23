// `GET /suggest?q=<prefix>`: the search field's suggestions, as JSON.
//
// A route handler rather than a page, so an answer costs the prefix query and
// nothing else — no React render, no layout, no fonts. The body is
// `SuggestAnswer` (web/app/suggestAnswer.ts); the query, its bounds and its
// order are src/lookup/suggest.ts.

import { suggestions } from "../db";
import type { SuggestAnswer } from "../suggestAnswer.ts";

/**
 * How long a browser may reuse an answer. A release is immutable, so the only
 * way an answer goes stale is the served release changing; five minutes of an
 * old suggestion is harmless, because choosing one runs the real lookup.
 */
const MAX_AGE_SECONDS = 300;

const json = (body: SuggestAnswer, status: number, cache: boolean): Response =>
  Response.json(body, {
    status,
    headers: { "cache-control": cache ? `public, max-age=${MAX_AGE_SECONDS}` : "no-store" },
  });

export async function GET(request: Request): Promise<Response> {
  const prefix = new URL(request.url).searchParams.get("q") ?? "";
  const result = await suggestions(prefix);
  switch (result.outcome) {
    case "suggested":
      return json({ outcome: "suggested", suggestions: result.suggestions }, 200, true);
    case "rejected":
      return json({ outcome: "rejected", reason: result.rejection.reason, limit: result.rejection.limit }, 400, true);
    case "failed":
      // The reason is in the Worker's log; the field only needs to know it
      // cannot offer anything, and must not cache that.
      return json({ outcome: "failed" }, 503, false);
  }
}
