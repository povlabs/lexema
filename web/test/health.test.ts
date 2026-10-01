// The health check (#413), as the Worker runs it: in front of the host routing
// and the per-visitor limits, on all three hosts.
//
// Each database is a real SQLite answering the real `SELECT 1`, behind the D1
// methods the check calls. The configuration is read through Wrangler's own
// reader, so what is checked about the logs is what a production deploy gets.

import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { unstable_readConfig } from "wrangler";
import { HEALTH_PATH, healthOf, withHealth, type HealthBindings } from "@/worker/health.ts";
import { byHost } from "@/worker/hosts.ts";
import { withRateLimits, type LimitBindings } from "@/worker/rateLimit.ts";
import { FakeRateLimit } from "./metering.ts";

/** A D1 binding over an in-memory SQLite, or one whose every query fails. */
function d1(fails = false): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  const run = (sql: string) => {
    if (fails) throw new Error("D1_ERROR: the database is unreachable");
    return sqlite.prepare(sql).all();
  };
  return {
    prepare: (sql: string) => ({
      first: async () => run(sql)[0],
      all: async () => ({ results: run(sql) }),
    }),
  } as unknown as D1Database;
}

type Env = HealthBindings & LimitBindings;

function worker(bindings: Partial<HealthBindings> = {}) {
  const search = new FakeRateLimit(0);
  const env: Env = {
    LEXEMA_RELEASE: "it-0c432803",
    DB: d1(),
    APP_DB: d1(),
    ...bindings,
    SEARCH_LIMIT: search,
    SUGGEST_LIMIT: new FakeRateLimit(0),
    REPORT_LIMIT: new FakeRateLimit(0),
    REPORT_OPEN_LIMIT: new FakeRateLimit(0),
    SIGN_IN_LIMIT: new FakeRateLimit(0),
    KEY_CREATE_LIMIT: new FakeRateLimit(0),
    BILLING_LIMIT: new FakeRateLimit(0),
  };
  const behind: string[] = [];
  const answer = async (request: Request) => {
    behind.push(new URL(request.url).pathname);
    return new Response("behind");
  };
  // The order worker/index.ts runs: the health check, then the hosts, then the
  // limits, here allowing no request at all.
  const handler = withHealth<Env>(byHost<Env>({ app: withRateLimits<Env>(answer), api: answer, apiNotFound: () => new Response(null, { status: 404 }) }));
  const fetch = (url: string, method = "GET") => handler(new Request(url, { method, headers: { "cf-connecting-ip": "203.0.113.7" } }), env, {} as ExecutionContext);
  return { fetch, behind, search };
}

test("each host answers 200 with the release and its databases' states", async (t) => {
  const { fetch } = worker();
  const cases = [
    ["https://lexema.fyi/health", { dictionary: "ok" }],
    ["https://developers.lexema.fyi/health", { dictionary: "ok", app: "ok" }],
    ["https://api.lexema.fyi/health", { dictionary: "ok", app: "ok" }],
    ["https://my-branch.preview.lexema.fyi/health", { dictionary: "ok" }],
    ["http://api.localhost:8790/health", { dictionary: "ok", app: "ok" }],
  ] as const;
  for (const [url, d1] of cases) {
    await t.test(url, async () => {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/json");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { ok: true, release: "it-0c432803", d1 });
    });
  }
});

test("the body names the release and the states and nothing else", async () => {
  const { fetch } = worker();
  const body = (await (await fetch("https://api.lexema.fyi/health")).json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["d1", "ok", "release"]);
  assert.deepEqual(Object.keys(body.d1 as object).sort(), ["app", "dictionary"]);
});

test("a database that fails or is not bound answers 503, and the body says which without its error", async () => {
  const failing = worker({ APP_DB: d1(true) });
  const errors: unknown[][] = [];
  const error = console.error;
  console.error = (...args: unknown[]) => void errors.push(args);
  let response: Response;
  try {
    response = await failing.fetch("https://developers.lexema.fyi/health");
  } finally {
    console.error = error;
  }
  assert.equal(response.status, 503);
  const text = await response.text();
  assert.deepEqual(JSON.parse(text), { ok: false, release: "it-0c432803", d1: { dictionary: "ok", app: "failed" } });
  assert.doesNotMatch(text, /D1_ERROR|unreachable/);
  assert.deepEqual(errors.map((args) => args.slice(0, 2)), [["health check failed", { database: "app" }]]);

  const unbound = worker({ DB: undefined });
  const bare = await unbound.fetch("https://lexema.fyi/health");
  assert.equal(bare.status, 503);
  assert.deepEqual(await bare.json(), { ok: false, release: "it-0c432803", d1: { dictionary: "unbound" } });
});

test("ok is read off the states, never set apart from them", () => {
  assert.equal(healthOf("r", { dictionary: "ok", app: "ok" }).ok, true);
  assert.equal(healthOf("r", { dictionary: "ok", app: "unbound" }).ok, false);
  assert.equal(healthOf("r", { dictionary: "failed" }).ok, false);
});

test("the health check is never counted by the per-visitor limits, even with a q", async () => {
  // Every limit here admits nothing, so a counted request would be a 429.
  const { fetch, behind, search } = worker();
  for (let i = 0; i < 20; i++) {
    assert.equal((await fetch("https://lexema.fyi/health?q=casa")).status, 200);
  }
  assert.deepEqual(behind, []);
  assert.equal(search.counts.size, 0);
  // And the same limits do block a search, so the 200s above are not the fake's doing.
  assert.equal((await fetch("https://lexema.fyi/?q=casa")).status, 429);
});

test("only GET and HEAD are answered; any other path is handed on", async () => {
  const { fetch, behind } = worker();
  const post = await fetch(`https://lexema.fyi${HEALTH_PATH}`, "POST");
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  assert.equal((await fetch("https://lexema.fyi/health", "HEAD")).status, 200);
  await fetch("https://lexema.fyi/healthz");
  await fetch("https://lexema.fyi/health/");
  assert.deepEqual(behind, ["/healthz", "/health/"]);
});

test("production writes no invocation logs, which carry each request's URL beside its headers", () => {
  const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
  for (const env of [undefined, "production"]) {
    const { observability } = unstable_readConfig({ config: configPath, env });
    assert.equal(observability?.enabled, true, `${env ?? "top level"}: Workers Logs on`);
    assert.equal(observability?.logs?.invocation_logs, false, `${env ?? "top level"}: invocation logs off`);
  }
});
