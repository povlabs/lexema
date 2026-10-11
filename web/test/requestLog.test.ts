// Every Worker log line names its request, and nothing thrown leaves unlogged (#413).

import assert from "node:assert/strict";
import test from "node:test";
import { log } from "@lexema/log/requestLog.ts";
import { REQUEST_FAILED, REQUEST_ID_HEADER, withRequestLog } from "@/worker/shared/requestLog.ts";
import { onRequestError } from "@/instrumentation.ts";

/** Run `body` with console.error and console.warn captured, and return what they printed. */
async function printed(body: () => Promise<unknown>): Promise<unknown[][]> {
  const lines: unknown[][] = [];
  const { error, warn } = console;
  console.error = (...args: unknown[]) => void lines.push(args);
  console.warn = (...args: unknown[]) => void lines.push(args);
  try {
    await body();
  } finally {
    Object.assign(console, { error, warn });
  }
  return lines;
}

const request = (headers: Record<string, string> = {}) =>
  new Request("https://lexema.fyi/?q=gatto", { headers: { "cf-connecting-ip": "203.0.113.7", ...headers } });

test("every line logged while a request runs names its cf-ray", async () => {
  const handler = withRequestLog(async () => {
    log.warn("rate limited", { limit: "search" });
    await Promise.resolve();
    log.error("lookup failed", {}, new Error("D1_ERROR"));
    return new Response("ok");
  });
  const lines = await printed(() => handler(request({ "cf-ray": "8f1e2d3c4b5a6978-MXP" }), {}, {} as ExecutionContext));
  assert.deepEqual(lines[0], ["rate limited", { requestId: "8f1e2d3c4b5a6978-MXP", limit: "search" }]);
  assert.deepEqual(lines[1].slice(0, 2), ["lookup failed", { requestId: "8f1e2d3c4b5a6978-MXP" }]);
});

test("a request without a cf-ray, as under wrangler dev, still gets an id of its own", async () => {
  const handler = withRequestLog(async () => {
    log.error("lookup failed");
    return new Response("ok");
  });
  const lines = await printed(async () => {
    await handler(request(), {}, {} as ExecutionContext);
    await handler(request(), {}, {} as ExecutionContext);
  });
  const ids = lines.map((line) => (line[1] as { requestId: string }).requestId);
  assert.match(ids[0], /^[0-9a-f-]{36}$/);
  assert.notEqual(ids[0], ids[1]);
});

/** The English sentence the developer site and the API answer a crash with, as it was before #793. */
const ENGLISH_FAILED = "Something went wrong on our side. Try again in a moment.";

/** Every host a crash can be met on, live, local and a Preview's, with the site it is. */
const CRASH_HOSTS = [
  { host: "lexema.fyi", site: "lexema" },
  { host: "localhost:5173", site: "lexema" },
  { host: "pr-793.preview.lexema.fyi", site: "lexema" },
  { host: "developers.lexema.fyi", site: "developers" },
  { host: "developers.localhost:5173", site: "developers" },
  { host: "pr-793.developers-preview.lexema.fyi", site: "developers" },
  { host: "api.lexema.fyi", site: "api" },
  { host: "api.localhost:5173", site: "api" },
  { host: "pr-793.api-preview.lexema.fyi", site: "api" },
] as const;

/** A crash on `host`: the response, and what was logged. */
async function crashOn(host: string): Promise<{ response: Response; lines: unknown[][] }> {
  const handler = withRequestLog(async () => {
    throw new Error("boom");
  });
  const protocol = host.includes("localhost") ? "http" : "https";
  let response: Response | undefined;
  const lines = await printed(async () => {
    response = await handler(
      new Request(`${protocol}://${host}/cerca?q=gatto`, { headers: { "cf-connecting-ip": "203.0.113.7", "cf-ray": "8f1e2d3c4b5a6978-MXP" } }),
      {},
      {} as ExecutionContext,
    );
  });
  assert.ok(response);
  return { response, lines };
}

for (const { host, site } of CRASH_HOSTS) {
  test(`a throw past the handlers on ${host} is logged without the query and answered 500 with the id`, async () => {
    const { response, lines } = await crashOn(host);
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get(REQUEST_ID_HEADER), "8f1e2d3c4b5a6978-MXP");
    assert.equal(await response.text(), REQUEST_FAILED[site]);
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0].slice(0, 2), ["request failed", { requestId: "8f1e2d3c4b5a6978-MXP", method: "GET", path: "/cerca" }]);
    assert.doesNotMatch(JSON.stringify(lines[0].slice(0, 2)), /gatto|203\.0\.113\.7/);
  });
}

test("a crash on lexema.fyi, live, local or a Preview, is answered in Italian, with no English", async () => {
  for (const { host } of CRASH_HOSTS.filter(({ site }) => site === "lexema")) {
    const body = await (await crashOn(host)).response.text();
    assert.equal(body, "Qualcosa è andato storto da parte nostra. Riprova tra un momento.", host);
    assert.doesNotMatch(body, /something|wrong|try again/i, host);
  }
});

test("a crash on the developer site or the API, live, local or a Preview, is still answered in English", async () => {
  for (const { host } of CRASH_HOSTS.filter(({ site }) => site !== "lexema")) {
    assert.equal(await (await crashOn(host)).response.text(), ENGLISH_FAILED, host);
  }
});

test("a page's render error, which vinext prints nothing for in production, is logged with the route and the id", async () => {
  const handler = withRequestLog(async () => {
    onRequestError(new Error("boom"), { path: "/?q=gatto", method: "GET", headers: {} }, { routePath: "/", routeType: "render" });
    return new Response("error page", { status: 500 });
  });
  const lines = await printed(() => handler(request({ "cf-ray": "abc-MXP" }), {}, {} as ExecutionContext));
  assert.deepEqual(lines[0].slice(0, 2), ["app request failed", { requestId: "abc-MXP", routePath: "/", routeType: "render" }]);
  assert.doesNotMatch(JSON.stringify(lines[0].slice(0, 2)), /gatto/);
});

test("outside a request, as in a CLI, a line is exactly what was passed", async () => {
  const lines = await printed(async () => log.warn("rate limited", { limit: "search" }));
  assert.deepEqual(lines, [["rate limited", { limit: "search" }]]);
});
