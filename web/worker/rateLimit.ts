// Per-visitor rate limits on the requests that reach the database (#128).
//
// The check sits in front of vinext rather than inside a page, because it has
// to decide the response's status and a streamed page cannot: by the time a
// server component runs, the 200 is already on its way. Here it runs before
// the App Router sees the request, so a blocked search or suggestion never
// reaches the code that queries D1.
//
// The limits themselves (15 searches and 120 suggestions a minute, and why)
// are the `ratelimits` bindings in web/wrangler.jsonc. This module decides
// which limit a request counts against, whose count it is, and what a blocked
// request is answered with.

import type { ReportAnswer } from "../app/report.ts";
import type { SuggestAnswer } from "../app/suggestAnswer.ts";

/** The three things a visitor can do that reach the database. */
export type Limit = "search" | "suggest" | "report";

/** The bindings this module counts with, one per limit, as wrangler.jsonc names them. */
export interface LimitBindings {
  SEARCH_LIMIT: RateLimit;
  SUGGEST_LIMIT: RateLimit;
  REPORT_LIMIT: RateLimit;
}

const BINDING = { search: "SEARCH_LIMIT", suggest: "SUGGEST_LIMIT", report: "REPORT_LIMIT" } as const satisfies Record<
  Limit,
  keyof LimitBindings
>;

/**
 * How long a blocked visitor is told to wait. The binding does not say when its
 * window ends, so this is the whole window: the `period` both limits carry in
 * wrangler.jsonc. web/test/rateLimit.test.ts fails if the two disagree.
 */
export const RETRY_AFTER_SECONDS = 60;

/**
 * Set on a search the limit blocked, before it is handed to the page, so the
 * page renders the "too many searches" state instead of running the lookup.
 * Only this module sets it: one arriving from the client is removed, so it is
 * never the visitor's to claim or to fake.
 */
export const SEARCH_LIMITED_HEADER = "x-lexema-search-limited";

/**
 * Which limit a request counts against, or none.
 *
 * `/suggest` is a suggestion. Anything else carrying a non-empty `q` is a
 * search: the page runs its lookup for the first `q` when its trimmed value is
 * not empty (app/page.tsx), and that holds for the HTML request and for an RSC
 * request for the same URL alike. Counting every other path with a `q` too
 * (`/attribution?q=…`, a mistyped path) costs a reader nothing and means no
 * spelling of the page's path that vinext normalizes back to `/` gets past the
 * limit. The home page without a query and static assets are never counted;
 * assets do not even reach the Worker.
 */
export function limitOf(url: URL): Limit | undefined {
  if (url.pathname === "/suggest") return "suggest";
  // A report's hourly allowance is counted over stored reports (app/report.ts);
  // this binding only stops a burst before the database is touched.
  if (url.pathname === "/report") return "report";
  if ((url.searchParams.get("q") ?? "").trim() !== "") return "search";
  return undefined;
}

/**
 * Whose count a request is, from `CF-Connecting-IP`.
 *
 * An IPv4 address is one visitor. An IPv6 host is usually handed a whole /64
 * and can pick any address in it, so an IPv6 address is keyed by its /64 or a
 * single host could rotate past the limit. An IPv4-mapped IPv6 address is the
 * IPv4 address it carries. A missing or unreadable header shares one count
 * rather than escaping the limit; Cloudflare always sets it in production.
 */
export function visitorKey(connectingIp: string | null): string {
  const address = connectingIp?.trim() ?? "";
  if (address === "") return "unknown";
  if (IPV4.test(address)) return `v4:${address}`;
  const groups = ipv6Groups(address);
  if (groups === undefined) return `other:${address}`;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return `v4:${[groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".")}`;
  }
  return `v6:${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const HEXTET = /^[0-9a-f]{1,4}$/i;

/** The eight 16-bit groups of an IPv6 address, or undefined if it is not one. */
function ipv6Groups(address: string): number[] | undefined {
  const halves = address.split("%")[0].split("::");
  if (halves.length > 2) return undefined;
  const parts = halves.map((half) => (half === "" ? [] : half.split(":")));
  // A dotted IPv4 tail stands for the last two groups.
  const last = parts[parts.length - 1];
  const tail = last[last.length - 1];
  if (tail !== undefined && tail.includes(".")) {
    if (!IPV4.test(tail)) return undefined;
    const [a, b, c, d] = tail.split(".").map(Number);
    last.splice(-1, 1, ((a << 8) | b).toString(16), ((c << 8) | d).toString(16));
  }
  if (!parts.every((part) => part.every((group) => HEXTET.test(group)))) return undefined;
  const written = parts.reduce((sum, part) => sum + part.length, 0);
  const elided = 8 - written;
  if (parts.length === 1 ? elided !== 0 : elided < 1) return undefined;
  const groups = parts.length === 1 ? parts[0] : [...parts[0], ...Array<string>(elided).fill("0"), ...parts[1]];
  return groups.map((group) => parseInt(group, 16));
}

/** The shape of a Worker's fetch handler, as vinext's App Router entry exports it. */
export type FetchHandler<E> = (request: Request, env: E, ctx: ExecutionContext) => Promise<Response>;

/**
 * Wrap the app so every search and suggestion is counted before it runs.
 *
 * Admitted, the request goes to the app as it came, less any forged
 * `SEARCH_LIMITED_HEADER`. A blocked suggestion is answered here with a 429
 * and the app never sees it. A blocked search still goes to the app, marked,
 * so the page can render its "too many searches" state around the search field
 * without running the lookup; its response then leaves as a 429. Either way a
 * block is logged by which limit it was, never by the address.
 */
export function withRateLimits<E extends LimitBindings>(app: FetchHandler<E>): FetchHandler<E> {
  return async (request, env, ctx) => {
    const limit = limitOf(new URL(request.url));
    const admitted =
      limit === undefined ||
      (await env[BINDING[limit]].limit({ key: visitorKey(request.headers.get("cf-connecting-ip")) })).success;

    if (admitted) {
      return app(request.headers.has(SEARCH_LIMITED_HEADER) ? marked(request, false) : request, env, ctx);
    }

    console.warn("rate limited", { limit });
    if (limit === "suggest") {
      const body: SuggestAnswer = { outcome: "limited" };
      return Response.json(body, { status: 429, headers: tooManyHeaders() });
    }
    if (limit === "report") {
      const body: ReportAnswer = { outcome: "limited" };
      return Response.json(body, { status: 429, headers: tooManyHeaders() });
    }
    const page = await app(marked(request, true), env, ctx);
    const headers = new Headers(page.headers);
    for (const [name, value] of tooManyHeaders()) headers.set(name, value);
    return new Response(page.body, { status: 429, statusText: "Too Many Requests", headers });
  };
}

function tooManyHeaders(): Headers {
  return new Headers({ "retry-after": String(RETRY_AFTER_SECONDS), "cache-control": "no-store" });
}

/** The request with the blocked-search mark set, or with any copy of it removed. */
function marked(request: Request, limited: boolean): Request {
  const headers = new Headers(request.headers);
  if (limited) headers.set(SEARCH_LIMITED_HEADER, "1");
  else headers.delete(SEARCH_LIMITED_HEADER);
  return new Request(request, { headers });
}
