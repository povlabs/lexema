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
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountUsage, usageDays } from "../../src/api/usage.js";
import { EMPTY_DRAFT, type CreateKeyDraft, type CreateKeyProblems } from "../app/createKeyForm.ts";
import { Dashboard } from "../app/Dashboard";
import {
  answerOf,
  CREATE_KEY_ACTION,
  DELETE_ACCOUNT_ACTION,
  JSON_ANSWER,
  revokeKeyAction,
  sendAction,
  UNREACHABLE,
  type ActionAnswer,
} from "../app/dashboardActions.ts";
import { dashboardView } from "../app/dashboardView.ts";
import { apiNotFound, handleApi } from "../worker/api/handler.ts";
import {
  CONFIRM_DELETE_PAGE,
  CREATE_KEY_DRAFT_HEADER,
  CREATE_KEY_PAGE,
  createKeyDraftOf,
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

/** The Worker over a fresh database; each browser keeps its own cookies. `page` stands in for the App Router; `limits` for the rate limits. */
function site({ page, limits = {} }: { page?: (request: Request) => Response; limits?: Partial<LimitBindings> } = {}) {
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
            return page?.(request) ?? new Response("page", { headers: { "content-type": "text/html" } });
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
      const response = await worker(new Request(url, { ...init, headers }), { ...env, ...limits }, {} as ExecutionContext);
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
    const post = (path: string, fields: Record<string, string> | [string, string][] = {}, headers: Record<string, string> = { origin: DEVELOPERS }) => {
      // A list sends a field more than once, as a checklist does.
      const body = new URLSearchParams(Array.isArray(fields) ? fields : Object.entries(fields));
      if (!body.has(CSRF_FIELD)) body.set(CSRF_FIELD, csrf);
      return send(`${DEVELOPERS}${path}`, { method: "POST", headers, body });
    };
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

test("the create-key dialog's endpoints and expiry: Only some keeps the ticked endpoints, Expires sets the date, the defaults are every endpoint and never", async () => {
  const { db, browser } = site();
  const { post, accountId } = await browser(ada);
  const made = async () => (await listAccountKeys(db, accountId)).map((key) => [key.name, key.endpoints, key.expiresAt]);

  // Board 28b's defaults, as the form sends them: All endpoints, Never.
  assert.equal((await post("/dashboard/keys", { name: "", endpoints: "all", expires: "never" })).status, 303);
  // Board 28c: Only some, three ticked; 90 days.
  const ticked = await post("/dashboard/keys", [
    ["name", "Learning app"],
    ["endpoints", "some"],
    ["endpoint", "inflect"],
    ["endpoint", "lookup"],
    ["endpoint", "lemmatize"],
    ["expires", "90-days"],
  ]);
  assert.equal(ticked.status, 303);
  assert.equal(ticked.headers.get("location"), KEY_CREATED);
  // Ticked boxes are ignored while All endpoints is chosen, as the dialog hides them.
  assert.equal((await post("/dashboard/keys", [["endpoints", "all"], ["endpoint", "lookup"], ["expires", "1-year"]])).status, 303);
  assert.deepEqual(await made(), [
    ["Key 3", { kind: "all" }, "2027-09-28T12:00:00.000Z"],
    ["Learning app", { kind: "only", endpoints: ["lookup", "lemmatize", "inflect"] }, "2026-12-27T12:00:00.000Z"],
    ["Key 1", { kind: "all" }, null],
  ]);
});

test("a refused plain create form is answered 400 with the whole dashboard, its dialog drawn again holding what was sent; no key is made", async () => {
  // The page stands in for app/(developers)/developer-site/dashboard/page.tsx: the dialog the address asks for, holding the draft the Worker hands on.
  const view = dashboardView({ email: "ada@example.com", providers: ["google"] }, [], AccountUsage.of(usageDays(NOW), [], []), NOW);
  const { appSaw, browser, snapshot } = site({
    page: (request) => {
      const url = new URL(request.url);
      const dialog = requestedDialog(Object.fromEntries(url.searchParams)) === "create-key" ? { kind: "create-key" as const, draft: createKeyDraftOf(request.headers) ?? EMPTY_DRAFT } : undefined;
      return new Response(`<!doctype html>${renderToStaticMarkup(createElement(Dashboard, { view, csrf: "c", made: 0, dialog }))}`, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  });
  const { post } = await browser(ada);
  const before = snapshot();
  const refused: [string, [string, string][], CreateKeyDraft][] = [
    [
      "Tick at least one endpoint.",
      [["name", " Learning app "], ["endpoints", "some"], ["expires", "30-days"]],
      { ...EMPTY_DRAFT, name: "Learning app", scope: "some", expires: "30-days" },
    ],
    ["Tick at least one endpoint.", [["endpoints", "some"]], { ...EMPTY_DRAFT, scope: "some" }],
    [
      "That is not an endpoint.",
      [["endpoints", "some"], ["endpoint", "lookup"], ["endpoint", "everything"]],
      { ...EMPTY_DRAFT, scope: "some", ticked: ["lookup"], strayTick: true },
    ],
    ["Choose All endpoints or Only some.", [["endpoints", "none"]], { ...EMPTY_DRAFT, scope: "unknown" }],
    [
      "Choose when the key expires.",
      [["name", "app"], ["endpoints", "some"], ["endpoint", "inflect"], ["expires", "forever"]],
      { ...EMPTY_DRAFT, name: "app", scope: "some", ticked: ["inflect"], expires: "unknown" },
    ],
    ["A key&#x27;s name can be at most 200 characters.", [["name", "x".repeat(201)]], { ...EMPTY_DRAFT, name: "x".repeat(201) }],
  ];
  for (const [message, fields, draft] of refused) {
    const seen = appSaw.length;
    const answer = await post("/dashboard/keys", fields);
    const label = JSON.stringify(fields).slice(0, 80);
    assert.equal(answer.status, 400, label);
    assert.equal(answer.headers.get("cache-control"), "no-store", label);
    assert.match(answer.headers.get("content-type") ?? "", /^text\/html/, label);
    assert.deepEqual(answer.headers.getSetCookie(), [], label);
    // Never bare text: the dashboard, with the create-key dialog open over it, as `/dashboard?create=key` draws it.
    const html = await answer.text();
    assert.match(html, /<h1[^>]*>Dashboard<\/h1>/, label);
    assert.match(html, /<section[^>]*role="dialog"[^>]*>.*Create an API key/, label);
    assert.ok(html.includes(`role="alert">${message}</p>`), label);
    // The page was asked for with a GET, carrying what the form sent.
    assert.equal(appSaw.length, seen + 1);
    const asked = appSaw[seen];
    assert.equal(asked.method, "GET");
    assert.equal(new URL(asked.url).pathname + new URL(asked.url).search, `/developer-site${CREATE_KEY_PAGE}`);
    assert.deepEqual(createKeyDraftOf(asked.headers), draft, label);
  }
  assert.deepEqual(snapshot(), before, "no key was made");
});

test("a draft header a client sends never reaches the page", async () => {
  const { appSaw, browser } = site();
  const adas = await browser(ada);
  await adas.send(`${DEVELOPERS}${CREATE_KEY_PAGE}`, { headers: { [CREATE_KEY_DRAFT_HEADER]: "endpoints=some" } });
  assert.equal(createKeyDraftOf(appSaw[0].headers), undefined);
});

/** A script's fetch as the page sends it (app/dashboardActions.ts), from this browser, on this site. */
const scripted =
  (send: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch =>
  async (input, init) =>
    send(`${DEVELOPERS}${String(input)}`, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), origin: DEVELOPERS } });

/** A dashboard form as the page holds it: these fields and the session's CSRF token. */
function formOf(csrf: string, fields: [string, string][] = []): FormData {
  const form = new FormData();
  form.set(CSRF_FIELD, csrf);
  for (const [name, value] of fields) form.append(name, value);
  return form;
}

test("with a script, a create is answered in JSON: the new key's row and its secret, once; no cookie, no redirect, no page", async () => {
  const { db, appSaw, browser } = site();
  const adas = await browser(ada);
  const fetchFromPage = scripted(adas.send);

  const answer = await sendAction(
    CREATE_KEY_ACTION,
    formOf(adas.csrf, [
      ["name", " Learning app "],
      ["endpoints", "some"],
      ["endpoint", "lookup"],
      ["endpoint", "inflect"],
      ["expires", "90-days"],
    ]),
    fetchFromPage,
  );
  assert.equal(answer.outcome, "created");
  assert.ok(answer.outcome === "created");
  const [made] = await listAccountKeys(db, adas.accountId);
  assert.deepEqual(answer.key, {
    keyId: made.keyId,
    name: "Learning app",
    prefix: `${made.displayPrefix}…`,
    created: "28 Sep 2026",
    lastUsed: "never",
    endpoints: { kind: "only", endpoints: ["lookup", "inflect"] },
    expires: "27 Dec 2026",
  });
  assert.equal((await authenticate(db, answer.secret, NOW)).outcome, "accepted");
  assert.ok(!adas.jar.has(NEW_KEY_COOKIE), "the secret travels in the answer only");
  assert.deepEqual(appSaw, []);

  // The raw answer: 201, JSON, never kept by a cache. An empty name is still `Key N`.
  const raw = await fetchFromPage(CREATE_KEY_ACTION, { method: "POST", body: formOf(adas.csrf, [["name", ""]]), headers: { accept: JSON_ANSWER } });
  assert.equal(raw.status, 201);
  assert.equal(raw.headers.get("cache-control"), "no-store");
  assert.deepEqual(raw.headers.getSetCookie(), []);
  const body = (await raw.json()) as ActionAnswer;
  assert.ok(body.outcome === "created");
  assert.equal(body.key.name, "Key 2");
});

test("with a script, a refused create form is answered 400 in JSON with each problem by its field, and no key is made", async () => {
  const { browser, snapshot } = site();
  const adas = await browser(ada);
  const before = snapshot();
  const cases: [[string, string][], CreateKeyProblems][] = [
    [[["endpoints", "some"]], [{ field: "endpoints", message: "Tick at least one endpoint." }]],
    [[["name", "x".repeat(201)], ["expires", "forever"]], [
      { field: "name", message: "A key's name can be at most 200 characters." },
      { field: "expires", message: "Choose when the key expires." },
    ]],
  ];
  for (const [fields, problems] of cases) {
    const raw = await scripted(adas.send)(CREATE_KEY_ACTION, { method: "POST", body: formOf(adas.csrf, fields), headers: { accept: JSON_ANSWER } });
    assert.equal(raw.status, 400);
    assert.deepEqual(await answerOf(raw), { outcome: "refused-form", problems });
  }
  assert.deepEqual(snapshot(), before);
});

test("with a script, a missing or wrong CSRF token, another origin or no session is refused in JSON at the plain form's status, and nothing changes", async () => {
  const { db, browser, snapshot, worker } = site();
  const adas = await browser(ada);
  const bobs = await browser(bob);
  const key = await createAccountKey(db, adas.accountId, name("one"), NOW);
  assert.ok(key.outcome === "created");
  const before = snapshot();
  const json = { accept: JSON_ANSWER };
  for (const [action, fields] of [
    [CREATE_KEY_ACTION, [["name", "another"]]],
    [revokeKeyAction(key.keyId), []],
    [DELETE_ACCOUNT_ACTION, [["confirm", DELETE_CONFIRMATION]]],
  ] as [string, [string, string][]][]) {
    const cases: [string, Promise<Response>, number, string][] = [
      ["no CSRF token", scripted(adas.send)(action, { method: "POST", body: formOf("", fields), headers: json }), 403, "This form has expired. Reload the page and try again."],
      ["another session's token", scripted(adas.send)(action, { method: "POST", body: formOf(bobs.csrf, fields), headers: json }), 403, "This form has expired. Reload the page and try again."],
      [
        "another origin",
        adas.send(`${DEVELOPERS}${action}`, { method: "POST", body: formOf(adas.csrf, fields), headers: { ...json, origin: "https://evil.example" } }),
        403,
        "This action must come from this site.",
      ],
      [
        "no session",
        worker(new Request(`${DEVELOPERS}${action}`, { method: "POST", body: formOf(adas.csrf, fields), headers: { ...json, origin: DEVELOPERS } }), env, {} as ExecutionContext),
        401,
        "Sign in first.",
      ],
    ];
    for (const [label, sent, status, message] of cases) {
      const answer = await sent;
      assert.equal(answer.status, status, `${action}: ${label}`);
      assert.deepEqual(answer.headers.getSetCookie(), [], `${action}: ${label}`);
      assert.deepEqual(await answerOf(answer), { outcome: "refused", message }, `${action}: ${label}`);
    }
  }
  assert.deepEqual(snapshot(), before);
});

test("with a script, the key-creation limit still holds: its 429 is read as the reason, and no key is made", async () => {
  let asked = 0;
  const { browser, snapshot } = site({
    limits: {
      KEY_CREATE_LIMIT: {
        limit: async () => {
          asked += 1;
          return { success: false };
        },
      },
    },
  });
  const adas = await browser(ada);
  const before = snapshot();
  const answer = await sendAction(CREATE_KEY_ACTION, formOf(adas.csrf, [["name", "app"]]), scripted(adas.send));
  assert.deepEqual(answer, { outcome: "refused", message: "Too many keys made. Try again in a minute." });
  assert.equal(asked, 1, "the fetch counts against the same limit as the plain form");
  assert.deepEqual(snapshot(), before);
});

test("with a script, Revoke answers the revoked key in JSON, another account's key is a 404, and Delete account answers where to go with the session cleared", async () => {
  const { db, browser } = site();
  const adas = await browser(ada);
  const bobs = await browser(bob);
  const own = await createAccountKey(db, adas.accountId, name("own"), NOW);
  const other = await createAccountKey(db, bobs.accountId, name("bob's"), NOW);
  assert.ok(own.outcome === "created" && other.outcome === "created");
  const fetchFromPage = scripted(adas.send);

  assert.deepEqual(await sendAction(revokeKeyAction(own.keyId), formOf(adas.csrf), fetchFromPage), { outcome: "revoked", keyId: own.keyId });
  assert.equal((await authenticate(db, own.key, NOW)).outcome, "refused");
  assert.deepEqual(await sendAction(revokeKeyAction(other.keyId), formOf(adas.csrf), fetchFromPage), { outcome: "refused", message: "No such key." });
  assert.equal((await authenticate(db, other.key, NOW)).outcome, "accepted");

  assert.deepEqual(await sendAction(DELETE_ACCOUNT_ACTION, formOf(adas.csrf), fetchFromPage), { outcome: "refused", message: "Confirm the deletion first." });
  assert.equal(await adas.signedIn(), adas.accountId);
  const deleted = await sendAction(DELETE_ACCOUNT_ACTION, formOf(adas.csrf, [["confirm", DELETE_CONFIRMATION]]), fetchFromPage);
  assert.deepEqual(deleted, { outcome: "signed-out", location: AFTER_SIGN_OUT });
  assert.ok(!adas.jar.has(SESSION_COOKIE), "the session cookie is cleared");
  assert.equal(await bobs.signedIn(), bobs.accountId);
});

test("an action the page cannot reach is read as a refusal to show, never as a success", async () => {
  const offline: typeof fetch = async () => {
    throw new TypeError("network down");
  };
  assert.deepEqual(await sendAction(CREATE_KEY_ACTION, new FormData(), offline), { outcome: "refused", message: UNREACHABLE });
  assert.deepEqual(await answerOf(Response.json({ outcome: "hacked" })), { outcome: "refused", message: UNREACHABLE });
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
    ["/dashboard/keys", { name: "limited", endpoints: "some", endpoint: "lookup", expires: "30-days" }],
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
