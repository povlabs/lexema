// The test sign-in on a Preview's developer site (#245, ADR 0018): the route
// through the Worker's own layers on each stage and host, over a local
// `node:sqlite` app database, and the button the sign-in page shows for it.
// No network and no secret: stubProvider.ts sets a test-only
// BETTER_AUTH_SECRET.

import "./stubProvider.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { accountProfile } from "../../src/accounts/accounts.js";
import { TEST_DEVELOPER_PROFILE } from "../../src/accounts/testDeveloper.js";
import { freshAppDatabase } from "../../test/databases.js";
import { SignIn } from "@/components/developers/SignIn";
import { SIGN_IN_PROVIDER } from "@/components/shared/styles.ts";
import { apiNotFound } from "@/worker/api/handler.ts";
import { byHost, ORIGIN, originsOf } from "@/worker/shared/hosts.ts";
import { limitOf, withRateLimits, type LimitBindings } from "@/worker/shared/rateLimit.ts";
import { SITE_LIMITS } from "./siteLimits.ts";
import { AFTER_SIGN_IN, SESSION_COOKIE, signedInAccount, withSignIn, type SignInBindings } from "@/worker/developers/signIn.ts";
import type { Stage } from "@/worker/shared/stage.ts";
import { offersTestSignIn, TEST_SIGN_IN, withTestSignIn } from "@/worker/developers/testSignIn.ts";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const PREVIEW_DEVELOPERS = "https://huey-245-test-sign-in.developers-preview.lexema.fyi";
/** The sites as that Preview's pages name them. */
const PREVIEW_ORIGINS = originsOf(new URL(PREVIEW_DEVELOPERS).hostname);

const allow: RateLimit = { limit: async () => ({ success: true }) };
const env: LimitBindings & SignInBindings = {
  SEARCH_LIMIT: allow,
  SUGGEST_LIMIT: allow,
  REPORT_LIMIT: allow,
  REPORT_OPEN_LIMIT: allow,
  SIGN_IN_LIMIT: allow,
  KEY_CREATE_LIMIT: allow,
  BILLING_LIMIT: allow,
};

/**
 * The Worker's layers as worker/index.ts puts them together, on `stage`, over a
 * fresh app database. The App Router is a stand-in that answers every path it
 * is handed as a missing page, as vinext answers a path with no route.
 */
function worker(stage: Stage) {
  const { sqlite, appDb } = freshAppDatabase();
  const context = () => ({ providers: { google: undefined, github: undefined }, appDb, now: NOW });
  const fetch = byHost<typeof env>({
    app: withRateLimits(SITE_LIMITS, withTestSignIn(stage, withSignIn(async () => new Response("Not Found", { status: 404 }), context), context)),
    api: async () => Response.json({}),
    apiNotFound,
  });
  const send = (url: string, init: RequestInit = {}) => fetch(new Request(url, init), env, {} as ExecutionContext);
  const count = (table: string) => (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
  return { appDb, send, count };
}

/** A form POST of the test sign-in from `origin`'s own sign-in page. */
const post = (origin: string, cookie?: string): RequestInit => ({
  method: "POST",
  headers: { origin, ...(cookie === undefined ? {} : { cookie }) },
});

/** The session cookie a response sets, as a `Cookie` header, with its attributes. */
function sessionOf(response: Response) {
  const [set, ...more] = response.headers.getSetCookie().filter((value) => value.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(set !== undefined && more.length === 0, "one session cookie");
  const [pair, ...attributes] = set.split(";").map((part) => part.trim());
  return { cookie: pair, attributes: attributes.map((attribute) => attribute.toLowerCase()) };
}

test("the test sign-in is a 404 on the production and local stages, on every host", async () => {
  const hosts = [
    PREVIEW_DEVELOPERS,
    "https://developers.lexema.fyi",
    "http://developers.localhost:8790",
    "https://lexema.fyi",
    "http://localhost:8790",
    "https://api.lexema.fyi",
  ];
  for (const stage of ["production", "local"] as const) {
    const { send, count } = worker(stage);
    for (const origin of hosts) {
      const response = await send(`${origin}${TEST_SIGN_IN}`, post(origin));
      assert.equal(response.status, 404, `${stage} ${origin}`);
      assert.deepEqual(response.headers.getSetCookie(), [], `${stage} ${origin}`);
    }
    assert.equal(count("developer_account"), 0, stage);
    assert.equal(count("developer_session"), 0, stage);
  }
});

test("on the preview stage the test sign-in is a 404 on every host but a Preview's developer host", async () => {
  const { send, count } = worker("preview");
  for (const origin of [
    "https://huey-245-test-sign-in.preview.lexema.fyi",
    "https://huey-245-test-sign-in.api-preview.lexema.fyi",
    "https://developers.lexema.fyi",
    "http://developers.localhost:8790",
    "https://developers-preview.lexema.fyi",
    "https://a.b.developers-preview.lexema.fyi",
    "https://huey.developers-preview.lexema.fyi.example.com",
  ]) {
    const response = await send(`${origin}${TEST_SIGN_IN}`, post(origin));
    assert.equal(response.status, 404, origin);
    assert.deepEqual(response.headers.getSetCookie(), [], origin);
  }
  assert.equal(count("developer_account"), 0);
  assert.equal(count("developer_session"), 0);
});

test("on a Preview's developer host the test sign-in signs the test developer in to that Preview's APP_DB, then goes to the dashboard", async () => {
  const { send, count, appDb } = worker("preview");

  const first = await send(`${PREVIEW_DEVELOPERS}${TEST_SIGN_IN}`, post(PREVIEW_DEVELOPERS));
  assert.equal(first.status, 303);
  assert.equal(first.headers.get("location"), AFTER_SIGN_IN);
  const session = sessionOf(first);
  for (const attribute of ["httponly", "secure", "samesite=lax", "path=/"]) assert.ok(session.attributes.includes(attribute), attribute);
  assert.ok(!session.attributes.some((attribute) => attribute.startsWith("domain")), "host-only: no Domain");

  const accountId = await signedInAccount(session.cookie, appDb, NOW, PREVIEW_ORIGINS);
  assert.equal(typeof accountId, "number");
  assert.deepEqual(await accountProfile(appDb, accountId ?? 0), {
    email: TEST_DEVELOPER_PROFILE.verifiedEmail,
    name: TEST_DEVELOPER_PROFILE.name,
    providers: ["github"],
  });

  // Again, from the same browser: the same account, and the first session ends.
  const again = await send(`${PREVIEW_DEVELOPERS}${TEST_SIGN_IN}`, post(PREVIEW_DEVELOPERS, session.cookie));
  assert.equal(again.status, 303);
  assert.equal(await signedInAccount(sessionOf(again).cookie, appDb, NOW, PREVIEW_ORIGINS), accountId);
  assert.equal(await signedInAccount(session.cookie, appDb, NOW, PREVIEW_ORIGINS), undefined);
  assert.equal(count("developer_account"), 1);
  assert.equal(count("provider_identity"), 1);
  assert.equal(count("developer_session"), 1);
});

test("the test sign-in takes a POST from its own site only", async () => {
  const { send, count } = worker("preview");
  const url = `${PREVIEW_DEVELOPERS}${TEST_SIGN_IN}`;

  const get = await send(url);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
  for (const origin of ["https://huey-245-test-sign-in.preview.lexema.fyi", "https://other.developers-preview.lexema.fyi", "null"]) {
    assert.equal((await send(url, post(origin))).status, 403, origin);
  }
  assert.equal((await send(url, { method: "POST" })).status, 403, "no Origin");
  assert.equal(count("developer_session"), 0);
});

test("the test sign-in counts against the sign-in limit", () => {
  assert.equal(limitOf(SITE_LIMITS, new URL(`${PREVIEW_DEVELOPERS}/developer-site${TEST_SIGN_IN}`), "POST"), "sign-in");
  assert.equal(limitOf(SITE_LIMITS, new URL(`https://developers.lexema.fyi/developer-site${TEST_SIGN_IN}`), "POST"), undefined);
});

test("the sign-in page shows the test sign-in button on a Preview's developer host only", () => {
  assert.equal(offersTestSignIn("preview", "huey-245-test-sign-in.developers-preview.lexema.fyi"), true);
  for (const stage of ["production", "local"] as const) {
    assert.equal(offersTestSignIn(stage, "huey-245-test-sign-in.developers-preview.lexema.fyi"), false, stage);
  }
  for (const host of ["developers.lexema.fyi", "developers.localhost", "huey.preview.lexema.fyi", "huey.api-preview.lexema.fyi"]) {
    assert.equal(offersTestSignIn("preview", host), false, host);
  }

  const available = { google: true, github: true };
  const offered = renderToStaticMarkup(<SignIn available={available} testSignIn signUp="open" origins={PREVIEW_ORIGINS} />);
  // Base UI's Button, in the providers' own style, submitting a form POST.
  assert.ok(
    offered.includes(
      `<form action="${TEST_SIGN_IN}" method="post"><button type="submit" tabindex="0" class="${SIGN_IN_PROVIDER}">Sign in as test developer</button></form>`,
    ),
  );
  for (const markup of [renderToStaticMarkup(<SignIn available={available} signUp="open" origins={ORIGIN} />), renderToStaticMarkup(<SignIn available={available} testSignIn={false} signUp="open" origins={ORIGIN} />)]) {
    assert.doesNotMatch(markup, /test developer/);
    assert.ok(!markup.includes(TEST_SIGN_IN));
  }
});
