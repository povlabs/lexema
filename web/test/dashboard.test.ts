// The dashboard's actions on developers.lexema.fyi (#168) and its pages (#169), through the Worker's
// host routing, rate limits, sign-in and dashboard wiring as deployed, over a
// local `node:sqlite` database with the real schema. Sign-in runs against the
// stub provider, as in signIn.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { ProviderProfile } from "../../src/accounts/providers.js";
import { authenticate } from "../../src/api/keys.js";
import { createAccountKey, keyName, listAccountKeys } from "../../src/api/ownedKeys.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { apiNotFound, handleApi } from "../worker/api/handler.ts";
import {
  CONFIRM_DELETE_PAGE,
  CREATE_KEY_PAGE,
  CSRF_FIELD,
  csrfTokenOf,
  type DashboardBindings,
  DASHBOARD,
  DELETE_CONFIRMATION,
  KEY_CREATED,
  NEW_KEY_COOKIE,
  NEW_KEY_HEADER,
  newKeyOf,
  requestedDialog,
  SIGN_IN_PAGE,
  withDashboard,
} from "../worker/dashboard.ts";
import { byHost } from "../worker/hosts.ts";
import { withRateLimits, type LimitBindings } from "../worker/rateLimit.ts";
import { AFTER_SIGN_OUT, SESSION_COOKIE, signedInAccount, withSignIn, type SignInBindings } from "../worker/signIn.ts";
import { StubProvider } from "./stubProvider.ts";

const SCHEMA = readFileSync(fileURLToPath(new URL("../../src/db/schema.sql", import.meta.url)), "utf8");
const NOW = Date.parse("2026-09-28T12:00:00Z");
const DEVELOPERS = "https://developers.lexema.fyi";

const allow: RateLimit = { limit: async () => ({ success: true }) };
const env: LimitBindings & SignInBindings & DashboardBindings = {
  SEARCH_LIMIT: allow,
  SUGGEST_LIMIT: allow,
  REPORT_LIMIT: allow,
  REPORT_OPEN_LIMIT: allow,
  SIGN_IN_LIMIT: allow,
  KEY_CREATE_LIMIT: allow,
};

/** The Worker over a fresh database; each browser keeps its own cookies. */
function site() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA);
  const db = fromNodeSqlite(sqlite);
  const google = new StubProvider("google");
  const appSaw: Request[] = [];
  const worker = byHost<typeof env>({
    app: withRateLimits(
      withSignIn(
        withDashboard(
          async (request) => {
            appSaw.push(request);
            return new Response("page", { headers: { "content-type": "text/html" } });
          },
          () => ({ db, now: NOW }),
        ),
        () => ({ providers: { google, github: undefined }, db, now: NOW }),
      ),
    ),
    api: async () => Response.json({}),
    apiNotFound,
  });

  /** A browser signed in with this profile. */
  async function browser(profile: ProviderProfile) {
    const jar = new Map<string, string>();
    const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    async function send(url: string, init: RequestInit = {}): Promise<Response> {
      const headers = new Headers(init.headers);
      if (jar.size > 0) headers.set("cookie", cookie());
      const response = await worker(new Request(url, { ...init, headers }), env, {} as ExecutionContext);
      for (const header of response.headers.getSetCookie()) {
        const [pair, ...attributes] = header.split(";").map((part) => part.trim());
        const at = pair.indexOf("=");
        if (attributes.some((attribute) => attribute.toLowerCase() === "max-age=0")) jar.delete(pair.slice(0, at));
        else jar.set(pair.slice(0, at), pair.slice(at + 1));
      }
      return response;
    }
    const start = await send(`${DEVELOPERS}/sign-in/google`);
    const back = await send(google.consent(start.headers.get("location") ?? "", profile).toString());
    assert.equal(back.status, 303);
    const accountId = await signedInAccount(cookie(), db, NOW);
    assert.ok(accountId !== undefined);
    const csrf = await csrfTokenOf(cookie());
    assert.ok(csrf !== undefined);

    /** Post a form to a dashboard action, from this site, with this session's token unless told otherwise. */
    const post = (path: string, fields: Record<string, string> = {}, headers: Record<string, string> = { origin: DEVELOPERS }) =>
      send(`${DEVELOPERS}${path}`, { method: "POST", headers, body: new URLSearchParams({ [CSRF_FIELD]: csrf, ...fields }) });
    return { jar, send, post, accountId, csrf, signedIn: () => signedInAccount(cookie(), db, NOW) };
  }

  /** Every row an action could change, to prove one changed nothing. */
  const snapshot = () =>
    ["developer_account", "provider_identity", "developer_session", "api_key"].map((table) =>
      sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((row) => ({ ...row })),
    );
  return { sqlite, db, appSaw, browser, snapshot, worker };
}

const ada: ProviderProfile = { subject: "g-ada", verifiedEmail: "ada@example.com" };
const bob: ProviderProfile = { subject: "g-bob", verifiedEmail: "bob@example.com" };

const name = (text: string) => {
  const parsed = keyName(text);
  assert.ok(parsed !== undefined);
  return parsed;
};

test("a signed-in form with its CSRF token makes a key, and its secret reaches the key-created page once", async () => {
  const { db, appSaw, browser } = site();
  const { post, send, jar, accountId } = await browser(ada);

  // The POST makes the key and redirects; it renders nothing, so reloading the page never posts again.
  // A form that sends no name gets the default, `Key 1`.
  const response = await post("/dashboard/keys");
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), KEY_CREATED);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(appSaw.length, 0);
  const [listed] = await listAccountKeys(db, accountId);
  assert.equal(listed.name, "Key 1");
  const carried = jar.get(NEW_KEY_COOKIE);
  assert.ok(carried !== undefined);
  assert.match(response.headers.getSetCookie()[0], /; Max-Age=60; Path=\/; HttpOnly; Secure; SameSite=Lax$/);

  // The GET it redirects to hands the secret to the page, once, and clears the cookie.
  const shown = await send(`${DEVELOPERS}${KEY_CREATED}`);
  assert.equal(shown.status, 200);
  assert.equal(shown.headers.get("cache-control"), "no-store");
  assert.ok(!jar.has(NEW_KEY_COOKIE), "the one-shot cookie is cleared");
  assert.equal(appSaw.length, 1);
  assert.equal(new URL(appSaw[0].url).pathname, "/developer-site/dashboard/key-created");
  const created = newKeyOf(appSaw[0].headers);
  assert.ok(created !== undefined);
  assert.deepEqual([listed.keyId, listed.displayPrefix], [created.keyId, created.key.slice(0, 11)]);
  assert.equal((await authenticate(db, created.key, NOW)).outcome, "accepted");

  // Reloading finds no secret and lands on the dashboard; a header a client sends is removed.
  const reloaded = await send(`${DEVELOPERS}${KEY_CREATED}`, { headers: { [NEW_KEY_HEADER]: `${created.keyId}.${created.key}` } });
  assert.equal(reloaded.status, 303);
  assert.equal(reloaded.headers.get("location"), DASHBOARD);
  assert.equal(appSaw.length, 1);
  assert.equal((await listAccountKeys(db, accountId)).length, 1, "reloading made no second key");

  // A name too long to keep makes nothing.
  assert.equal((await post("/dashboard/keys", { name: "x".repeat(201) })).status, 400);
  assert.equal((await listAccountKeys(db, accountId)).length, 1);
});

test("the create-key dialog's form: a sent name is kept, trimmed; an empty one is `Key N`, revoked keys counted", async () => {
  const { db, browser } = site();
  const { post, accountId } = await browser(ada);
  const names = async () => (await listAccountKeys(db, accountId)).map((each) => each.name);

  // Board 28b's form always sends its Name field; a typed name is the key's, trimmed.
  const named = await post("/dashboard/keys", { name: "  Learning app " });
  assert.equal(named.status, 303);
  assert.equal(named.headers.get("location"), KEY_CREATED);
  assert.deepEqual(await names(), ["Learning app"]);

  // Left empty, or only spaces, it is `Key N`: N counts every key made, so the first empty one is `Key 2`.
  assert.equal((await post("/dashboard/keys", { name: "" })).status, 303);
  assert.equal((await post("/dashboard/keys", { name: "   " })).status, 303);
  assert.deepEqual(await names(), ["Key 3", "Key 2", "Learning app"]);

  // A revoked key still counts, so no name comes round twice.
  const [newest] = await listAccountKeys(db, accountId);
  await post(`/dashboard/keys/${newest.keyId}/revoke`);
  await post("/dashboard/keys", { name: "" });
  assert.deepEqual(await names(), ["Key 4", "Key 3", "Key 2", "Learning app"]);
});

test("opening the create-key dialog makes no key: Create key is a link to a page the server draws", async () => {
  const { appSaw, browser, snapshot } = site();
  const adas = await browser(ada);
  const before = snapshot();
  const opened = await adas.send(`${DEVELOPERS}${CREATE_KEY_PAGE}`);
  assert.equal(opened.status, 200);
  assert.equal(opened.headers.get("cache-control"), "no-store");
  assert.equal(new URL(appSaw[0].url).pathname, "/developer-site/dashboard");
  assert.equal(new URL(appSaw[0].url).search, "?create=key");
  assert.deepEqual(snapshot(), before, "opening the dialog changed nothing");

  // The page reads which dialog to draw off the query alone.
  assert.equal(requestedDialog({ create: "key" }), "create-key");
  assert.equal(requestedDialog({ confirm: "delete" }), "confirm-delete");
  for (const other of [{}, { create: "" }, { create: "keys" }, { create: ["key", "key"] }]) assert.equal(requestedDialog(other), undefined);
});

test("a visitor without a session who opens the dashboard, its create-key or delete dialog, or the key-created page is sent to sign-in", async () => {
  const { appSaw, browser, worker } = site();
  for (const path of [DASHBOARD, CONFIRM_DELETE_PAGE, CREATE_KEY_PAGE, KEY_CREATED]) {
    const answer = await worker(new Request(`${DEVELOPERS}${path}`), env, {} as ExecutionContext);
    assert.equal(answer.status, 303, path);
    assert.equal(answer.headers.get("location"), SIGN_IN_PAGE, path);
  }
  // A new-key cookie alone signs nobody in.
  const forged = await worker(
    new Request(`${DEVELOPERS}${KEY_CREATED}`, { headers: { cookie: `${NEW_KEY_COOKIE}=1.lx_${"0".repeat(64)}` } }),
    env,
    {} as ExecutionContext,
  );
  assert.equal(forged.headers.get("location"), SIGN_IN_PAGE);
  assert.equal(appSaw.length, 0);

  // Signed in, the dashboard reaches the page, never kept by a cache.
  const adas = await browser(ada);
  const page = await adas.send(`${DEVELOPERS}${DASHBOARD}`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(new URL(appSaw[0].url).pathname, "/developer-site/dashboard");
  // So does the delete confirmation, which the page draws from its address alone.
  const confirming = await adas.send(`${DEVELOPERS}${CONFIRM_DELETE_PAGE}`);
  assert.equal(confirming.status, 200);
  assert.equal(new URL(appSaw[1].url).search, "?confirm=delete");
});

test("revoke succeeds for the session's own key and is refused for another account's; deletion touches only the session's account", async () => {
  const { db, browser } = site();
  const adas = await browser(ada);
  const bobs = await browser(bob);
  const own = await createAccountKey(db, adas.accountId, name("own"), NOW);
  const other = await createAccountKey(db, bobs.accountId, name("bob's"), NOW);
  assert.ok(own.outcome === "created" && other.outcome === "created");

  const revoked = await adas.post(`/dashboard/keys/${own.keyId}/revoke`);
  assert.equal(revoked.status, 303);
  assert.equal(revoked.headers.get("location"), DASHBOARD);
  assert.equal((await authenticate(db, own.key, NOW)).outcome, "refused");
  // Revoking it again lands on the dashboard as well.
  assert.equal((await adas.post(`/dashboard/keys/${own.keyId}/revoke`)).status, 303);

  const refused = await adas.post(`/dashboard/keys/${other.keyId}/revoke`);
  assert.equal(refused.status, 404);
  assert.equal((await authenticate(db, other.key, NOW)).outcome, "accepted");

  const deleted = await adas.post("/dashboard/account/delete", { confirm: DELETE_CONFIRMATION });
  assert.equal(deleted.status, 303);
  assert.equal((await authenticate(db, other.key, NOW)).outcome, "accepted");
  assert.equal(await bobs.signedIn(), bobs.accountId);
});

test("each action without a session, with a missing or wrong CSRF token, or from another origin is refused and changes nothing", async () => {
  const { db, appSaw, browser, snapshot, worker } = site();
  const adas = await browser(ada);
  const bobs = await browser(bob);
  const key = await createAccountKey(db, adas.accountId, name("one"), NOW);
  assert.equal(key.outcome, "created");
  const before = snapshot();

  const actions: [string, Record<string, string>][] = [
    ["/dashboard/keys", { name: "another" }],
    ["/dashboard/keys", { name: "" }],
    [`/dashboard/keys/${key.keyId}/revoke`, {}],
    ["/dashboard/account/delete", { confirm: DELETE_CONFIRMATION }],
  ];
  for (const [path, fields] of actions) {
    const cases: [string, Promise<Response>, number][] = [
      [
        "no session",
        worker(
          new Request(`${DEVELOPERS}${path}`, {
            method: "POST",
            headers: { origin: DEVELOPERS },
            body: new URLSearchParams({ [CSRF_FIELD]: adas.csrf, ...fields }),
          }),
          env,
          {} as ExecutionContext,
        ),
        401,
      ],
      ["no CSRF token", adas.post(path, { ...fields, [CSRF_FIELD]: "" }), 403],
      ["another session's CSRF token", adas.post(path, { ...fields, [CSRF_FIELD]: bobs.csrf }), 403],
      ["another origin", adas.post(path, fields, { origin: "https://evil.example" }), 403],
      ["no origin", adas.post(path, fields, {}), 403],
      ["the API's origin", adas.post(path, fields, { origin: "https://api.lexema.fyi" }), 403],
    ];
    for (const [label, response, status] of cases) {
      const answer = await response;
      assert.equal(answer.status, status, `${path}: ${label}`);
      assert.deepEqual(answer.headers.getSetCookie(), [], `${path}: ${label}`);
    }
    // A GET changes nothing either.
    assert.equal((await adas.send(`${DEVELOPERS}${path}`)).status, 405, path);
  }
  // Deleting without the confirmation is refused too.
  assert.equal((await adas.post("/dashboard/account/delete")).status, 400);
  assert.equal((await adas.post("/dashboard/account/delete", { confirm: "yes" })).status, 400);

  assert.deepEqual(snapshot(), before);
  assert.deepEqual(appSaw, []);
  assert.equal(await adas.signedIn(), adas.accountId);
});

test("after delete-account every key the account owned answers 401 revoked_key, and the session no longer reads as signed in", async () => {
  const { db, appSaw, browser } = site();
  const adas = await browser(ada);
  for (const label of ["one", "two"]) {
    assert.equal((await adas.post("/dashboard/keys", { name: label })).status, 303);
    assert.equal((await adas.send(`${DEVELOPERS}${KEY_CREATED}`)).status, 200);
  }
  const secrets = appSaw.map((request) => newKeyOf(request.headers)?.key ?? "");
  assert.equal(secrets.length, 2);
  const cookie = `${SESSION_COOKIE}=${adas.jar.get(SESSION_COOKIE)}`;

  const deleted = await adas.post("/dashboard/account/delete", { confirm: DELETE_CONFIRMATION });
  assert.equal(deleted.status, 303);
  assert.equal(deleted.headers.get("location"), AFTER_SIGN_OUT);
  assert.ok(!adas.jar.has(SESSION_COOKIE), "the session cookie is cleared");
  assert.equal(await signedInAccount(cookie, db, NOW), undefined);

  for (const key of secrets) {
    const request = new Request("https://api.lexema.fyi/v1/lookup?q=casa", { headers: { "x-api-key": key } });
    const answer = await handleApi(request, { db, releaseId: "it-dev", now: NOW });
    assert.equal(answer.status, 401);
    assert.equal(((await answer.json()) as { error: { code: string } }).error.code, "revoked_key");
  }
});

test("the dashboard actions exist on the developer site only", async () => {
  const { worker, appSaw } = site();
  const post = (url: string) =>
    worker(new Request(url, { method: "POST", headers: { origin: new URL(url).origin } }), env, {} as ExecutionContext);
  assert.equal((await post("https://lexema.fyi/developer-site/dashboard/keys")).status, 404);
  assert.equal((await post("https://api.lexema.fyi/dashboard/keys")).status, 404);
  // On lexema.fyi, /dashboard/keys is just a path the dictionary does not have.
  await post("https://lexema.fyi/dashboard/keys");
  assert.deepEqual(
    appSaw.map((request) => new URL(request.url).pathname),
    ["/dashboard/keys"],
  );
});
