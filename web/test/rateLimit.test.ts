// The per-visitor rate limits (#128), with a fake binding.
//
// `withRateLimits` is exercised as the Worker runs it: a request goes in, and
// the app behind it is a recorder, so "the database is not touched" is checked
// as "the app never saw the request" for a suggestion and as "the app was told
// the search is blocked" for a search. The page's side of that, rendering the
// blocked state instead of running the lookup, is in page.test.tsx.
//
// The configuration is read the way Wrangler reads it, through its own config
// reader, so what is checked is what a local run and a production deploy get.

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { unstable_readConfig } from "wrangler";
import { shownFor } from "../app/SearchField";
import type { SuggestAnswer } from "../app/suggestAnswer.ts";
import {
  RETRY_AFTER_SECONDS,
  SEARCH_LIMITED_HEADER,
  limitOf,
  visitorKey,
  withRateLimits,
  type LimitBindings,
} from "../worker/rateLimit.ts";

/** The binding's contract: `limit` answers success until a key has used up its allowance. */
class FakeRateLimit implements RateLimit {
  readonly counts = new Map<string, number>();
  constructor(readonly allowance: number) {}
  async limit({ key }: RateLimitOptions): Promise<RateLimitOutcome> {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { success: count <= this.allowance };
  }
}

function harness() {
  const env = {
    SEARCH_LIMIT: new FakeRateLimit(15),
    SUGGEST_LIMIT: new FakeRateLimit(120),
    REPORT_LIMIT: new FakeRateLimit(2),
    REPORT_OPEN_LIMIT: new FakeRateLimit(10),
  } satisfies LimitBindings;
  const seen: Request[] = [];
  const worker = withRateLimits<LimitBindings>(async (request) => {
    seen.push(request);
    return new Response("<p>page</p>", { status: 200, headers: { "content-type": "text/html" } });
  });
  const fetch = (path: string, ip = "203.0.113.7", headers: Record<string, string> = {}, method = "GET") =>
    worker(
      new Request(`https://lexema.fyi${path}`, {
        method,
        headers: { "cf-connecting-ip": ip, ...headers },
        body: method === "POST" ? "{}" : undefined,
      }),
      env,
      {} as ExecutionContext,
    );
  return { env, seen, fetch };
}

/** Run `body` with console.warn captured, and return what it logged. */
async function warnings(body: () => Promise<void>): Promise<unknown[][]> {
  const logged: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void logged.push(args);
  try {
    await body();
  } finally {
    console.warn = warn;
  }
  return logged;
}

test("a search is any request with a non-empty q, and /suggest is a suggestion", () => {
  const of = (path: string) => limitOf(new URL(`https://lexema.fyi${path}`));
  assert.equal(of("/?q=casa"), "search");
  assert.equal(of("/?q=casa&q=sale"), "search");
  assert.equal(of("/index.rsc?q=casa"), "search");
  assert.equal(of("//?q=casa"), "search");
  assert.equal(of("/suggest?q=ca"), "suggest");
  assert.equal(of("/suggest"), "suggest");
  // The home page without a query, and a query of only spaces, which the page
  // answers with the opening hint and no lookup.
  assert.equal(of("/"), undefined);
  assert.equal(of("/?q="), undefined);
  assert.equal(of("/?q=%20%20"), undefined);
  assert.equal(of("/attribution"), undefined);
  assert.equal(of("/_next/static/app.js"), undefined);
});

test("fifteen searches a minute go through, and the sixteenth is a 429 the page renders without a lookup", async () => {
  const { fetch, seen } = harness();
  for (let i = 0; i < 15; i++) {
    const response = await fetch(`/?q=casa${i}`);
    assert.equal(response.status, 200);
  }
  assert.ok(seen.every((request) => !request.headers.has(SEARCH_LIMITED_HEADER)));

  const logged = await warnings(async () => {
    const blocked = await fetch("/?q=sale");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after"), String(RETRY_AFTER_SECONDS));
    assert.equal(blocked.headers.get("cache-control"), "no-store");
    assert.equal(blocked.headers.get("content-type"), "text/html");
    assert.equal(await blocked.text(), "<p>page</p>");
  });
  assert.equal(seen.length, 16);
  assert.equal(seen[15].headers.get(SEARCH_LIMITED_HEADER), "1");
  assert.deepEqual(logged, [["rate limited", { limit: "search" }]]);
});

test("the home page and static paths are never counted", async () => {
  const { fetch, env } = harness();
  for (let i = 0; i < 40; i++) assert.equal((await fetch("/")).status, 200);
  assert.equal((await fetch("/attribution")).status, 200);
  assert.equal(env.SEARCH_LIMIT.counts.size, 0);
  assert.equal(env.SUGGEST_LIMIT.counts.size, 0);
});

test("a hundred and twenty suggestions a minute go through, and the next is a 429 the app never sees", async () => {
  const { fetch, seen } = harness();
  for (let i = 0; i < 120; i++) assert.equal((await fetch(`/suggest?q=c${i}`)).status, 200);
  const logged = await warnings(async () => {
    const blocked = await fetch("/suggest?q=ca");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after"), String(RETRY_AFTER_SECONDS));
    assert.equal(blocked.headers.get("cache-control"), "no-store");
    const answer = (await blocked.json()) as SuggestAnswer;
    assert.deepEqual(answer, { outcome: "limited" });
    // The field shows nothing for it: no list, and no "could not be loaded".
    assert.equal(shownFor(answer), null);
  });
  assert.equal(seen.length, 120);
  assert.deepEqual(logged, [["rate limited", { limit: "suggest" }]]);
});

test("two reports a minute reach the app, and the third is a 429 the app never sees", async () => {
  const { env, seen, fetch } = harness();
  const logged = await warnings(async () => {
    for (let i = 0; i < 2; i++) assert.equal((await fetch("/report", "203.0.113.7", {}, "POST")).status, 200);
    const blocked = await fetch("/report", "203.0.113.7", {}, "POST");
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), { outcome: "limited" });
  });
  assert.equal(seen.length, 2);
  assert.equal(env.SEARCH_LIMIT.counts.size, 0, "a report is not a search");
  // Opening the box is counted apart, so it does not use up sending.
  assert.equal((await fetch("/report/open", "203.0.113.7", {}, "POST")).status, 200);
  assert.equal(env.REPORT_OPEN_LIMIT.counts.get("v4:203.0.113.7"), 1);
  assert.deepEqual(logged, [["rate limited", { limit: "report" }]]);
});

test("searches and suggestions are counted apart", async () => {
  // The blocks these provoke are logged; the log is checked elsewhere.
  await warnings(async () => {
    const { fetch } = harness();
    for (let i = 0; i < 120; i++) await fetch(`/suggest?q=c${i}`);
    assert.equal((await fetch("/?q=casa")).status, 200);
    for (let i = 0; i < 14; i++) await fetch(`/?q=casa${i}`);
    assert.equal((await fetch("/?q=sale")).status, 429);
    assert.equal((await fetch("/suggest?q=zz")).status, 429);
  });
});

test("each visitor has their own count", async () => {
  // The blocks these provoke are logged; the log is checked elsewhere.
  await warnings(async () => {
    const { fetch } = harness();
    for (let i = 0; i < 16; i++) await fetch(`/?q=casa${i}`, "203.0.113.7");
    assert.equal((await fetch("/?q=casa", "203.0.113.7")).status, 429);
    assert.equal((await fetch("/?q=casa", "198.51.100.2")).status, 200);
  });
});

test("an IPv6 host cannot rotate past the limit inside its /64", async () => {
  // The blocks these provoke are logged; the log is checked elsewhere.
  await warnings(async () => {
    const { fetch } = harness();
    for (let i = 0; i < 15; i++) {
      assert.equal((await fetch(`/?q=casa${i}`, `2001:db8:abcd:12::${(i + 1).toString(16)}`)).status, 200);
    }
    assert.equal((await fetch("/?q=sale", "2001:db8:abcd:12:ffff:ffff:ffff:ffff")).status, 429);
    // The neighbouring /64 is someone else.
    assert.equal((await fetch("/?q=sale", "2001:db8:abcd:13::1")).status, 200);
  });
});

test("the visitor key is the IPv4 address, or the IPv6 /64 however it is written", () => {
  assert.equal(visitorKey("203.0.113.7"), "v4:203.0.113.7");
  const key = "v6:2001:db8:abcd:12::/64";
  assert.equal(visitorKey("2001:db8:abcd:12::1"), key);
  assert.equal(visitorKey("2001:0DB8:ABCD:0012:0000:0000:0000:0001"), key);
  assert.equal(visitorKey("2001:db8:abcd:12:1:2:3:4"), key);
  assert.equal(visitorKey("2001:db8:abcd:12:ffff::10.0.0.1"), key);
  assert.equal(visitorKey("2001:db8::1"), "v6:2001:db8:0:0::/64");
  assert.equal(visitorKey("::1"), "v6:0:0:0:0::/64");
  // An IPv4-mapped address is its IPv4 address, not the /64 every one of them shares.
  assert.equal(visitorKey("::ffff:203.0.113.7"), "v4:203.0.113.7");
  assert.equal(visitorKey("::ffff:cb00:7107"), "v4:203.0.113.7");
  // Missing or unreadable still counts, as one shared visitor.
  assert.equal(visitorKey(null), "unknown");
  assert.equal(visitorKey(""), "unknown");
  assert.equal(visitorKey("2001:db8::1::2"), "other:2001:db8::1::2");
  assert.equal(visitorKey("1:2:3:4:5:6:7"), "other:1:2:3:4:5:6:7");
});

test("a block is logged by limit, never by address", async () => {
  const { fetch } = harness();
  const ip = "2001:db8:abcd:12::1";
  const logged = await warnings(async () => {
    for (let i = 0; i < 17; i++) await fetch(`/?q=casa${i}`, ip);
  });
  assert.equal(logged.length, 2);
  const text = JSON.stringify(logged);
  assert.ok(!text.includes("2001"), text);
  assert.ok(!text.includes("db8"), text);
});

test("a blocked-search mark sent by the client is removed before the page sees it", async () => {
  const { fetch, seen } = harness();
  await fetch("/?q=casa", "203.0.113.7", { [SEARCH_LIMITED_HEADER]: "1" });
  await fetch("/", "203.0.113.7", { [SEARCH_LIMITED_HEADER]: "1" });
  assert.ok(seen.every((request) => !request.headers.has(SEARCH_LIMITED_HEADER)));
});

const WRANGLER = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
const read = (env?: string) => unstable_readConfig({ config: WRANGLER, env }, { hideWarnings: true });

test("the limits are the rulings, in the Wrangler configuration, the same in production", () => {
  const local = read();
  const production = read("production");
  assert.deepEqual(local.ratelimits, [
    { name: "SEARCH_LIMIT", namespace_id: "1281", simple: { limit: 15, period: 60 } },
    { name: "SUGGEST_LIMIT", namespace_id: "1282", simple: { limit: 120, period: 60 } },
    { name: "REPORT_LIMIT", namespace_id: "1283", simple: { limit: 2, period: 60 } },
    { name: "REPORT_OPEN_LIMIT", namespace_id: "1284", simple: { limit: 10, period: 60 } },
  ]);
  // Bindings are not inherited by an environment, so production repeats them.
  assert.deepEqual(production.ratelimits, local.ratelimits);
  // Retry-After is the window, which the code cannot read from the binding.
  for (const { simple } of local.ratelimits) assert.equal(simple.period, RETRY_AFTER_SECONDS);
});

test("production is what is live: the custom domain only, no D1, logs on; local keeps its D1", () => {
  const production = read("production");
  assert.equal(production.name, "lexema-web");
  assert.equal(production.workers_dev, false);
  assert.equal(production.preview_urls, false);
  assert.deepEqual(production.routes, [{ pattern: "lexema.fyi", custom_domain: true }]);
  assert.deepEqual(production.d1_databases, []);
  assert.equal(production.observability?.enabled, true);

  const local = read();
  assert.deepEqual(
    local.d1_databases.map(({ binding, database_name }: { binding: string; database_name?: string }) => ({
      binding,
      database_name,
    })),
    [{ binding: "DB", database_name: "lexema" }],
  );
  assert.equal(local.observability?.enabled, true);
});
