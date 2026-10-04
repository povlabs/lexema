// Host routing (#164): which site each request is for, and what the Worker
// answers without handing it on. The API's own answers over a database are in
// web/test/api.test.ts, which also sends one request to each host.

import assert from "node:assert/strict";
import { test } from "node:test";
import { apiNotFound } from "@/worker/api/handler.ts";
import { byHost, destinationOf, DEVELOPERS_SEGMENT, ORIGIN, originsOf } from "@/worker/shared/hosts.ts";

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
    "http://localhost:8790/licence",
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

test("each preview host routes as its production host does, as a Preview URL and as a deployment URL (ADR 0018)", async () => {
  const { app, api, send } = worker();
  // A Preview answers at <name>.<domain>; one deployment of it at <deployment-id>-<name>.<domain>.
  for (const name of ["huey-242-preview-stage", "a1b2c3d4-huey-242-preview-stage"]) {
    const on = (domain: string, path: string) => to(`https://${name}.${domain}${path}`);
    assert.deepEqual(on("preview.lexema.fyi", "/?q=casa"), { to: "site" }, name);
    assert.deepEqual(on("preview.lexema.fyi", `/${DEVELOPERS_SEGMENT}`), { to: "not-found", site: "lexema" }, name);
    assert.deepEqual(on("preview.lexema.fyi", "/api/v1/lookup"), { to: "not-found", site: "lexema" }, name);
    assert.deepEqual(on("developers-preview.lexema.fyi", "/docs/"), { to: "developers", path: `/${DEVELOPERS_SEGMENT}/docs` }, name);
    assert.deepEqual(on("developers-preview.lexema.fyi", "/.rsc"), { to: "developers", path: `/${DEVELOPERS_SEGMENT}.rsc` }, name);
    assert.deepEqual(on("api-preview.lexema.fyi", "/v1/lookup?q=sale"), { to: "api" }, name);
    assert.deepEqual(on("api-preview.lexema.fyi", "/"), { to: "not-found", site: "api" }, name);

    await send(`https://${name}.developers-preview.lexema.fyi/docs?tab=keys`);
    await send(`https://${name}.api-preview.lexema.fyi/v1/lookup?q=sale`);
    const missing = await send(`https://${name}.api-preview.lexema.fyi/v2/lookup`);
    assert.equal(missing.status, 404, name);
    assert.equal(missing.headers.get("set-cookie"), null, name);
  }
  assert.deepEqual(app, [
    `https://huey-242-preview-stage.developers-preview.lexema.fyi/${DEVELOPERS_SEGMENT}/docs?tab=keys`,
    `https://a1b2c3d4-huey-242-preview-stage.developers-preview.lexema.fyi/${DEVELOPERS_SEGMENT}/docs?tab=keys`,
  ]);
  assert.deepEqual(api, [
    "https://huey-242-preview-stage.api-preview.lexema.fyi/v1/lookup?q=sale",
    "https://a1b2c3d4-huey-242-preview-stage.api-preview.lexema.fyi/v1/lookup?q=sale",
  ]);
});

test("a preview domain names a site only one label below it", () => {
  for (const url of [
    // The bare domains serve no Preview.
    "https://api-preview.lexema.fyi/v1/lookup",
    "https://developers-preview.lexema.fyi/docs",
    // Two labels below is not a Preview name.
    "https://a.b.api-preview.lexema.fyi/v1/lookup",
    "https://a.b.developers-preview.lexema.fyi/docs",
    // A lookalike domain is not a preview domain.
    "https://x.api-preview.lexema.fyi.example.com/v1/lookup",
    "https://x.api-previews.lexema.fyi/v1/lookup",
  ]) {
    assert.deepEqual(to(url), { to: "site" }, url);
  }
  // `developers-preview` and `api-preview` end in `-preview`, not `.preview`, so neither reads as the dictionary's.
  assert.deepEqual(to("https://x.api-preview.lexema.fyi/v1/lookup"), { to: "api" });
});

test("a Preview's pages name its sibling hosts, under the same label, from each of its three hosts (#266)", () => {
  for (const name of ["huey-266-preview-links", "a1b2c3d4-huey-266-preview-links"]) {
    const siblings = {
      lexema: `https://${name}.preview.lexema.fyi`,
      developers: `https://${name}.developers-preview.lexema.fyi`,
      api: `https://${name}.api-preview.lexema.fyi`,
    };
    for (const domain of ["preview.lexema.fyi", "developers-preview.lexema.fyi", "api-preview.lexema.fyi"]) {
      assert.deepEqual(originsOf(`${name}.${domain}`), siblings, `${name}.${domain}`);
    }
  }
});

test("live and local hosts, and any host not a Preview's, name the live sites (#266)", () => {
  for (const hostname of [
    "lexema.fyi",
    "developers.lexema.fyi",
    "api.lexema.fyi",
    "localhost",
    "developers.localhost",
    "api.localhost",
    "",
    "developers-preview.lexema.fyi",
    "a.b.developers-preview.lexema.fyi",
    "x.api-preview.lexema.fyi.example.com",
  ]) {
    assert.deepEqual(originsOf(hostname), ORIGIN, hostname);
  }
  assert.deepEqual(ORIGIN, { lexema: "https://lexema.fyi", developers: "https://developers.lexema.fyi", api: "https://api.lexema.fyi" });
});
