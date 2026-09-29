// The dashboard's actions on developers.lexema.fyi (#168, #187) and its pages (#169, #190), through the Worker's
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
import type { CreateKeyProblems } from "../app/createKeyForm.ts";
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
import { afterDelete, takeNotice, type NoticeStore } from "../app/arrivalNotice.ts";
import { apiNotFound, handleApi } from "../worker/api/handler.ts";
import { CSRF_FIELD, csrfTokenOf, type DashboardBindings, DASHBOARD, DELETE_CONFIRMATION, SETTINGS, SIGN_IN_PAGE, withDashboard } from "../worker/dashboard.ts";
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

/** The Worker over a fresh database; each browser keeps its own cookies. `limits` stand in for the rate limits. */
function site({ limits = {} }: { limits?: Partial<LimitBindings> } = {}) {
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

    /** Post form fields to a dashboard action, from this site, with this session's token unless told otherwise. */
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

const ada: ProviderProfile = { subject: "g-ada", verifiedEmail: "ada@example.com", name: "Ada Lovelace" };
const bob: ProviderProfile = { subject: "g-bob", verifiedEmail: "bob@example.com", name: undefined };

const name = (text: string) => {
  const parsed = keyName(text);
  assert.ok(parsed !== undefined);
  return parsed;
};

test("the create-key dialog's form: a sent name is kept, trimmed; an empty one is `Key N`, revoked keys counted", async () => {
  const { db, browser } = site();
  const { post, accountId } = await browser(ada);
  const names = async () => (await listAccountKeys(db, accountId)).map((each) => each.name);

  // Board 28b's form always sends its Name field; a typed name is the key's, trimmed.
  const named = await post("/dashboard/keys", { name: "  Learning app " });
  assert.equal(named.status, 201);
  assert.deepEqual(await names(), ["Learning app"]);

  // Left empty, or only spaces, it is `Key N`: N counts every key made, so the first empty one is `Key 2`.
  assert.equal((await post("/dashboard/keys", { name: "" })).status, 201);
  assert.equal((await post("/dashboard/keys", { name: "   " })).status, 201);
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
  assert.equal((await post("/dashboard/keys", { name: "", endpoints: "all", expires: "never" })).status, 201);
  // Board 28c: Only some, three ticked; 90 days.
  const ticked = await post("/dashboard/keys", [
    ["name", "Learning app"],
    ["endpoints", "some"],
    ["endpoint", "inflect"],
    ["endpoint", "lookup"],
    ["endpoint", "lemmatize"],
    ["expires", "90-days"],
  ]);
  assert.equal(ticked.status, 201);
  // Ticked boxes are ignored while All endpoints is chosen, as the dialog hides them.
  assert.equal((await post("/dashboard/keys", [["endpoints", "all"], ["endpoint", "lookup"], ["expires", "1-year"]])).status, 201);
  assert.deepEqual(await made(), [
    ["Key 3", { kind: "all" }, "2027-09-28T12:00:00.000Z"],
    ["Learning app", { kind: "only", endpoints: ["lookup", "lemmatize", "inflect"] }, "2026-12-27T12:00:00.000Z"],
    ["Key 1", { kind: "all" }, null],
  ]);
});

/** A fetch as the page sends it (app/dashboardActions.ts), from this browser, on this site. */
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

test("a create is answered in JSON: the new key's row and its secret, once; no cookie, no redirect, no page", async () => {
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
  assert.deepEqual([...adas.jar.keys()], [SESSION_COOKIE], "the secret travels in the answer only");
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

test("a refused create form is answered 400 in JSON with each problem by its field, and no key is made", async () => {
  const { browser, snapshot } = site();
  const adas = await browser(ada);
  const before = snapshot();
  const only = (field: "name" | "endpoints" | "expires", message: string): CreateKeyProblems => [{ field, message }];
  const cases: [[string, string][], CreateKeyProblems][] = [
    // Only some with nothing ticked: the dialog's Create key is disabled then, and the server refuses it too.
    [[["name", " Learning app "], ["endpoints", "some"], ["expires", "30-days"]], only("endpoints", "Tick at least one endpoint.")],
    [[["endpoints", "some"]], only("endpoints", "Tick at least one endpoint.")],
    [[["endpoints", "some"], ["endpoint", "lookup"], ["endpoint", "everything"]], only("endpoints", "That is not an endpoint.")],
    [[["endpoints", "none"]], only("endpoints", "Choose All endpoints or Only some.")],
    [[["name", "app"], ["endpoints", "some"], ["endpoint", "inflect"], ["expires", "forever"]], only("expires", "Choose when the key expires.")],
    [[["name", "x".repeat(201)]], only("name", "A key's name can be at most 200 characters.")],
    [
      [
        ["name", "x".repeat(201)],
        ["expires", "forever"],
      ],
      [
        { field: "name", message: "A key's name can be at most 200 characters." },
        { field: "expires", message: "Choose when the key expires." },
      ],
    ],
  ];
  for (const [fields, problems] of cases) {
    const raw = await scripted(adas.send)(CREATE_KEY_ACTION, { method: "POST", body: formOf(adas.csrf, fields), headers: { accept: JSON_ANSWER } });
    assert.equal(raw.status, 400);
    assert.deepEqual(raw.headers.getSetCookie(), []);
    assert.deepEqual(await answerOf(raw), { outcome: "refused-form", problems });
  }
  assert.deepEqual(snapshot(), before);
});

test("a missing or wrong CSRF token, another origin or no session is refused in JSON, and nothing changes", async () => {
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

test("the key-creation limit holds: its 429 is read as the reason, and no key is made", async () => {
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
  assert.equal(asked, 1, "the create counts against the key-creation limit");
  assert.deepEqual(snapshot(), before);
});

test("Revoke answers the revoked key in JSON, another account's key is a 404, and Delete account answers where to go with the session cleared", async () => {
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

/** A tab's session storage, as the browser keeps it across the page it leaves and the one it opens. */
function tabStorage(): NoticeStore & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

test("Delete account on the settings page lands on the landing page, which says \u201cYour account was deleted.\u201d once (#190)", async () => {
  const { browser } = site();
  const adas = await browser(ada);
  const tab = tabStorage();
  const went: string[] = [];

  // A refusal stays on the page with its reason, and leaves nothing for the next one.
  const refused = await sendAction(DELETE_ACCOUNT_ACTION, formOf(adas.csrf), scripted(adas.send));
  assert.equal(afterDelete(refused, tab, (location) => went.push(location)), "Confirm the deletion first.");
  assert.equal(went.length, 0, "a refusal stays on the page");
  assert.equal(takeNotice(tab), undefined);

  const deleted = await sendAction(DELETE_ACCOUNT_ACTION, formOf(adas.csrf, [["confirm", DELETE_CONFIRMATION]]), scripted(adas.send));
  assert.equal(afterDelete(deleted, tab, (location) => went.push(location)), undefined);
  assert.deepEqual(went, ["/"], "the browser goes to developers.lexema.fyi/");
  assert.equal(await adas.signedIn(), undefined);

  // The landing page takes the notice as it opens: one toast, in board 28f's success style, and none on a reload.
  assert.deepEqual(takeNotice(tab), { tone: "success", message: "Your account was deleted." });
  assert.equal(takeNotice(tab), undefined);
  assert.equal(tab.items.size, 0);
});

test("a notice nobody left, or a storage the browser refuses, shows no toast and breaks nothing", () => {
  const tab = tabStorage();
  tab.setItem("lexema:arrival", "hacked");
  assert.equal(takeNotice(tab), undefined);
  assert.equal(takeNotice(undefined), undefined);
  const refusing: NoticeStore = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  };
  assert.equal(takeNotice(refusing), undefined);
  const went: string[] = [];
  assert.equal(afterDelete({ outcome: "signed-out", location: "/" }, refusing, (location) => went.push(location)), undefined);
  assert.deepEqual(went, ["/"], "the deletion still leaves the page, without its toast");
  assert.equal(afterDelete({ outcome: "revoked", keyId: 1 }, tab, () => {}), UNREACHABLE);
});

test("an action the page cannot reach is read as a refusal to show, never as a success", async () => {
  const offline: typeof fetch = async () => {
    throw new TypeError("network down");
  };
  assert.deepEqual(await sendAction(CREATE_KEY_ACTION, new FormData(), offline), { outcome: "refused", message: UNREACHABLE });
  assert.deepEqual(await answerOf(Response.json({ outcome: "hacked" })), { outcome: "refused", message: UNREACHABLE });
});

test("a visitor without a session who opens the dashboard is sent to sign-in", async () => {
  const { appSaw, browser, worker } = site();
  const answer = await worker(new Request(`${DEVELOPERS}${DASHBOARD}`), env, {} as ExecutionContext);
  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get("location"), SIGN_IN_PAGE);
  assert.equal(appSaw.length, 0);

  // Signed in, the dashboard reaches the page, never kept by a cache.
  const adas = await browser(ada);
  const page = await adas.send(`${DEVELOPERS}${DASHBOARD}`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(new URL(appSaw[0].url).pathname, "/developer-site/dashboard");
});

test("the settings page needs a session like the dashboard: without one, sign-in; with one, the page, never cached (#190)", async () => {
  const { appSaw, browser, worker } = site();
  const answer = await worker(new Request(`${DEVELOPERS}${SETTINGS}`), env, {} as ExecutionContext);
  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get("location"), SIGN_IN_PAGE);
  assert.equal(appSaw.length, 0);

  const adas = await browser(ada);
  const page = await adas.send(`${DEVELOPERS}${SETTINGS}`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(new URL(appSaw[0].url).pathname, "/developer-site/dashboard/settings");

  // Signed out again, the same.
  await adas.send(`${DEVELOPERS}/sign-out`, { method: "POST" });
  const after = await adas.send(`${DEVELOPERS}${SETTINGS}`);
  assert.equal(after.status, 303);
  assert.equal(after.headers.get("location"), SIGN_IN_PAGE);
});

test("revoke succeeds for the session's own key and is refused for another account's; deletion touches only the session's account", async () => {
  const { db, browser } = site();
  const adas = await browser(ada);
  const bobs = await browser(bob);
  const own = await createAccountKey(db, adas.accountId, name("own"), NOW);
  const other = await createAccountKey(db, bobs.accountId, name("bob's"), NOW);
  assert.ok(own.outcome === "created" && other.outcome === "created");

  const revoked = await adas.post(`/dashboard/keys/${own.keyId}/revoke`);
  assert.equal(revoked.status, 200);
  assert.equal((await authenticate(db, own.key, NOW)).outcome, "refused");
  // Revoking it again is answered the same way.
  assert.equal((await adas.post(`/dashboard/keys/${own.keyId}/revoke`)).status, 200);

  const refused = await adas.post(`/dashboard/keys/${other.keyId}/revoke`);
  assert.equal(refused.status, 404);
  assert.equal((await authenticate(db, other.key, NOW)).outcome, "accepted");

  const deleted = await adas.post("/dashboard/account/delete", { confirm: DELETE_CONFIRMATION });
  assert.equal(deleted.status, 200);
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
  const { db, browser } = site();
  const adas = await browser(ada);
  const secrets: string[] = [];
  for (const label of ["one", "two"]) {
    const answer = await answerOf(await adas.post("/dashboard/keys", { name: label }));
    assert.ok(answer.outcome === "created");
    secrets.push(answer.secret);
  }
  const cookie = `${SESSION_COOKIE}=${adas.jar.get(SESSION_COOKIE)}`;

  const deleted = await adas.post("/dashboard/account/delete", { confirm: DELETE_CONFIRMATION });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await answerOf(deleted), { outcome: "signed-out", location: AFTER_SIGN_OUT });
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
