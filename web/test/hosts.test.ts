// Host routing (#164): which site each request is for, and what the Worker
// answers without handing it on. The API's own answers over a database are in
// web/test/api.test.ts, which also sends one request to each host.

import assert from "node:assert/strict";
import { test } from "node:test";
import { apiNotFound } from "../worker/api/handler.ts";
import { byHost, destinationOf, DEVELOPERS_SEGMENT } from "../worker/hosts.ts";

const to = (url: string) => destinationOf(new URL(url));

/** The Worker with stand-ins behind it, recording what each was handed. */
function worker() {
  const app: string[] = [];
  const api: string[] = [];
  const fetch = byHost<object>({
    app: async (request) => {
      app.push(request.url);
      // The site sets a cookie, so a no-cookie check fails if a request reaches it.
      return new Response("page", { headers: { "set-cookie": "visitor=1" } });
    },
    api: async (request) => {
      api.push(request.url);
      return Response.json({});
    },
    apiNotFound,
  });
  return { app, api, send: (url: string) => fetch(new Request(url), {}, {} as ExecutionContext) };
}

test("lexema.fyi/api/v1/ answers 404 with no location: the API is only at api.lexema.fyi/v1/", async () => {
  const { app, api, send } = worker();
  for (const url of [
    "https://lexema.fyi/api/v1/lookup?q=sale",
    "https://lexema.fyi/api/v1/lookup/batch",
    "https://lexema.fyi/api//v1/exists?q=sale",
    "http://localhost:8790/api/v1/exists?q=sale",
  ]) {
    const response = await send(url);
    assert.equal(response.status, 404, url);
    assert.equal(response.headers.get("location"), null, url);
  }
  assert.deepEqual([app, api], [[], []]);
});

test("api.lexema.fyi answers a path outside /v1/ with a JSON 404 and no cookie", async () => {
  const { app, api, send } = worker();
  for (const path of ["/", "/api/v1/lookup?q=sale", "/developers", `/${DEVELOPERS_SEGMENT}`, "/v2/lookup"]) {
    const response = await send(`https://api.lexema.fyi${path}`);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("set-cookie"), null, path);
    assert.deepEqual(await response.json(), {
      error: { code: "not_found", message: `There is no endpoint at ${new URL(path, "https://x").pathname}.` },
    });
  }
  assert.deepEqual([app, api], [[], []]);
  await send("https://api.lexema.fyi/v1/lookup?q=sale");
  assert.deepEqual(api, ["https://api.lexema.fyi/v1/lookup?q=sale"]);
});

test("the developer route group requested on lexema.fyi answers 404, however its path is spelled", async () => {
  const { app, send } = worker();
  for (const path of [
    `/${DEVELOPERS_SEGMENT}`,
    `/${DEVELOPERS_SEGMENT}/`,
    `/${DEVELOPERS_SEGMENT}.rsc`,
    `/${DEVELOPERS_SEGMENT}/docs?q=sale`,
    "/developer%2Dsite",
    `//${DEVELOPERS_SEGMENT}`,
    `/x/%2E%2E/${DEVELOPERS_SEGMENT}`,
  ]) {
    assert.equal((await send(`https://lexema.fyi${path}`)).status, 404, path);
  }
  assert.deepEqual(app, []);
  // A path that only begins with the same letters is the site's to answer.
  assert.deepEqual(to(`https://lexema.fyi/${DEVELOPERS_SEGMENT}s`), { to: "site" });
});

test("developers.lexema.fyi is rewritten onto the route group, and cannot climb out of it", () => {
  const at = (path: string) => to(`https://developers.lexema.fyi${path}`);
  const root = `/${DEVELOPERS_SEGMENT}`;
  assert.deepEqual(at("/"), { to: "developers", path: root });
  assert.deepEqual(at("/.rsc"), { to: "developers", path: `${root}.rsc` });
  assert.deepEqual(at("/docs/"), { to: "developers", path: `${root}/docs` });
  assert.deepEqual(at("/docs.rsc"), { to: "developers", path: `${root}/docs.rsc` });
  // The dictionary's pages are not on this host.
  assert.deepEqual(at("/attribution"), { to: "developers", path: `${root}/attribution` });
  assert.deepEqual(at("/%2E%2E/attribution"), { to: "developers", path: `${root}/attribution` });
  assert.deepEqual(at("/a%2Fb"), { to: "developers", path: `${root}/a%2Fb` });
  assert.deepEqual(at("/api/v1/lookup"), { to: "developers", path: `${root}/api/v1/lookup` });
});

test("the query survives the rewrite, and every other host is the dictionary's", async () => {
  const { app, send } = worker();
  await send("https://developers.lexema.fyi/docs?tab=keys");
  await send("http://developers.localhost:8790/");
  assert.deepEqual(app, [
    `https://developers.lexema.fyi/${DEVELOPERS_SEGMENT}/docs?tab=keys`,
    `http://developers.localhost:8790/${DEVELOPERS_SEGMENT}`,
  ]);
  for (const url of [
    "https://lexema.fyi/?q=casa",
    "http://localhost:8790/attribution",
    "http://127.0.0.1:8790/",
    "https://www.lexema.fyi/v1/lookup?q=casa",
  ]) {
    assert.deepEqual(to(url), { to: "site" }, url);
  }
  assert.deepEqual(to("http://api.localhost:8790/v1/lookup?q=sale"), { to: "api" });
});

test("localhost relays Google's sign-in callback to developers.localhost with the same query; lexema.fyi does not (#185)", async () => {
  const { app, api, send } = worker();
  const relayed = await send("http://localhost:8791/sign-in/google/callback?code=x&state=y");
  assert.equal(relayed.status, 302);
  assert.equal(relayed.headers.get("location"), "http://developers.localhost:8791/sign-in/google/callback?code=x&state=y");
  assert.equal(relayed.headers.get("set-cookie"), null);
  assert.deepEqual([app, api], [[], []]);

  for (const url of [
    "https://lexema.fyi/sign-in/google/callback?code=x&state=y",
    "http://localhost:8791/sign-in/github/callback?code=x",
    "http://localhost:8791/sign-in/google",
    "http://127.0.0.1:8791/sign-in/google/callback?code=x",
  ]) {
    assert.deepEqual(to(url), { to: "site" }, url);
  }
  assert.deepEqual(to("http://developers.localhost:8791/sign-in/google/callback?code=x"), {
    to: "developers",
    path: `/${DEVELOPERS_SEGMENT}/sign-in/google/callback`,
  });
});
