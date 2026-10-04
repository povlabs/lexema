// Per-visitor rate limits on the requests worth counting before they run (#128).
//
// Not every request that reaches D1 is counted: a dashboard page, a key
// revoke or a sign-in callback is not. What is counted is what `Limit`
// names: searches, suggestions, reports and opening the report box on
// lexema.fyi, and on the developer site sign-in starts, key creations and the
// billing routes, each of which can call Stripe (#296).
//
// The check sits in front of vinext rather than inside a page, because it has
// to decide the response's status and a streamed page cannot: by the time a
// server component runs, the 200 is already on its way. Here it runs before
// the App Router sees the request, so a blocked search or suggestion never
// reaches the code that queries D1.
//
// The limits themselves (15 searches and 120 suggestions a minute, 10 sign-in
// starts, 5 key creations and 5 billing requests a minute on the developer
// site, and why) are the `ratelimits` bindings in web/wrangler.jsonc. This
// module counts a request and answers it once its count is spent. Which of a
// site's requests count, and what each says when blocked, is that site's:
// worker/dictionary/limits.ts and worker/developers/limits.ts. worker/index.ts
// hands both in, so this module imports neither site (#199).

import { log } from "@lexema/log/requestLog.ts";
import type { FetchHandler } from "./fetchHandler.ts";

/** What the dictionary counts: the database. */
export type DictionaryLimit = "search" | "suggest" | "report" | "report-open";
/** What the developer site counts: a sign-in, a key, or Stripe. */
export type DeveloperLimit = "sign-in" | "key-create" | "billing";
/** The things a visitor can do that are counted. */
export type Limit = DictionaryLimit | DeveloperLimit;

/** The bindings this module counts with, one per limit, as wrangler.jsonc names them. */
export interface LimitBindings {
  SEARCH_LIMIT: RateLimit;
  SUGGEST_LIMIT: RateLimit;
  REPORT_LIMIT: RateLimit;
  REPORT_OPEN_LIMIT: RateLimit;
  SIGN_IN_LIMIT: RateLimit;
  KEY_CREATE_LIMIT: RateLimit;
  BILLING_LIMIT: RateLimit;
}

const BINDING = {
  search: "SEARCH_LIMIT",
  suggest: "SUGGEST_LIMIT",
  report: "REPORT_LIMIT",
  "report-open": "REPORT_OPEN_LIMIT",
  "sign-in": "SIGN_IN_LIMIT",
  "key-create": "KEY_CREATE_LIMIT",
  billing: "BILLING_LIMIT",
} as const satisfies Record<
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
 * How each limit is answered once its count is spent. Only the types read it,
 * so a limit can carry no other kind of answer (#564).
 */
const ANSWERED_BY = {
  search: "page",
  suggest: "json",
  report: "json",
  "report-open": "json",
  "sign-in": "text",
  "key-create": "text",
  billing: "text",
} as const satisfies Record<Limit, "page" | "json" | "text">;

/** The limits answered with a JSON body. */
export type JsonLimit = { [L in Limit]: (typeof ANSWERED_BY)[L] extends "json" ? L : never }[Limit];

/** A value `Response.json` sends as it is. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * The body each of a site's JSON-answered limits carries. The site names its
 * own, since this module imports from no site: worker/dictionary/limits.ts.
 */
export type JsonBodies<L extends Limit> = { [K in Extract<L, JsonLimit>]: Json };

/** No body at all: the default, so a JSON answer cannot be written without its site's bodies. */
type NoBodies<L extends Limit> = { [K in Extract<L, JsonLimit>]: never };

/** How limit `L` is answered once spent, each a 429 that says when to retry. */
type Blocked<L extends Limit, B extends JsonBodies<L>> = {
  /** Handed to the app marked with `SEARCH_LIMITED_HEADER`, so its page renders the blocked state. */
  page: { by: "page" };
  /** Answered here with this JSON body; the app never sees it. */
  json: { by: "json"; body: B[Extract<L, JsonLimit>] };
  /** Answered here with this plain-text sentence; the app never sees it. */
  text: { by: "text"; sentence: string };
}[(typeof ANSWERED_BY)[L]];

/**
 * A counted request: the limit it counts against, and its answer once that is
 * spent. One member per limit, so each limit carries only its own answer.
 */
export type Counted<L extends Limit, B extends JsonBodies<L> = NoBodies<L>> = {
  [K in L]: { limit: K; blocked: Blocked<K, B> };
}[L];

/** Which of one site's requests count, or none for a request it does not count. */
export type Counter<L extends Limit, B extends JsonBodies<L> = NoBodies<L>> = (url: URL, method: string) => Counted<L, B> | undefined;

/**
 * Each site's counter, as worker/index.ts hands them in. Here a JSON body is
 * only something to send; its type is fixed where the site writes it.
 */
export interface SiteLimits {
  developers: Counter<DeveloperLimit>;
  dictionary: Counter<DictionaryLimit, JsonBodies<DictionaryLimit>>;
}

/**
 * What a request counts against, and how it is answered once that is spent, or none.
 *
 * The developer site is asked first. Its routes all sit under its own segment,
 * where no dictionary path is, but the dictionary counts any other request
 * carrying a `q` as a search, so asked first it would count a developer route
 * that carries a `q` as a search.
 */
function countedOf(limits: SiteLimits, url: URL, method: string): Counted<Limit, JsonBodies<Limit>> | undefined {
  return limits.developers(url, method) ?? limits.dictionary(url, method);
}

/** Which limit a request counts against, or none. */
export const limitOf = (limits: SiteLimits, url: URL, method: string): Limit | undefined => countedOf(limits, url, method)?.limit;

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

/**
 * Wrap the app so every request a site counts is counted before it runs.
 *
 * Admitted, the request goes to the app as it came, less any forged
 * `SEARCH_LIMITED_HEADER`. A blocked request is answered as its site says: a
 * suggestion, a report or a developer-site action is answered here with a 429
 * and the app never sees it; a blocked search still goes to the app, marked,
 * so the page can render its "too many searches" state around the search field
 * without running the lookup, and its response then leaves as a 429. Either
 * way a block is logged by which limit it was, never by the address.
 */
export function withRateLimits<E extends LimitBindings>(limits: SiteLimits, app: FetchHandler<E>): FetchHandler<E> {
  return async (request, env, ctx) => {
    const counted = countedOf(limits, new URL(request.url), request.method);
    const admitted =
      counted === undefined ||
      (await env[BINDING[counted.limit]].limit({ key: visitorKey(request.headers.get("cf-connecting-ip")) })).success;

    if (admitted) {
      return app(request.headers.has(SEARCH_LIMITED_HEADER) ? marked(request, false) : request, env, ctx);
    }

    log.warn("rate limited", { limit: counted.limit });
    const { blocked } = counted;
    if (blocked.by === "json") return Response.json(blocked.body, { status: 429, headers: tooManyHeaders() });
    if (blocked.by === "text") {
      const headers = tooManyHeaders();
      headers.set("content-type", "text/plain; charset=utf-8");
      return new Response(blocked.sentence, { status: 429, headers });
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
