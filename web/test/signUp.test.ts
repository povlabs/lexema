// Developer sign-up, open or closed (#610): `DEVELOPER_SIGN_UP` parsed into a
// closed type, set per stage in web/wrangler.jsonc, and the routes that would
// open an account refused while it is closed, through the Worker's own layers
// over a local `node:sqlite` app database, stub providers and a stub Stripe.

import "./stubProvider.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { unstable_readConfig } from "wrangler";
import { csrfToken } from "../../src/accounts/csrf.js";
import { freshAppDatabase } from "../../test/databases.js";
import { CHECKOUT_ACTION, PLAN_FIELD, PORTAL_ACTION } from "@/lib/developers/billingActions.ts";
import { apiNotFound } from "@/worker/api/handler.ts";
import { withBilling } from "@/worker/developers/billing.ts";
import { CHOSEN_PLAN_COOKIE, PENDING_COOKIE, SESSION_COOKIE, withSignIn, type SignInBindings } from "@/worker/developers/signIn.ts";
import { parseSignUp, withSignUp, type SignUp } from "@/worker/developers/signUp.ts";
import { withStripeWebhook } from "@/worker/developers/stripeWebhook.ts";
import { TEST_SIGN_IN, withTestSignIn } from "@/worker/developers/testSignIn.ts";
import type { FetchHandler } from "@/worker/shared/fetchHandler.ts";
import { byHost } from "@/worker/shared/hosts.ts";
import { withRateLimits, type LimitBindings } from "@/worker/shared/rateLimit.ts";
import { SITE_LIMITS } from "./siteLimits.ts";
import { StubProvider } from "./stubProvider.ts";
import { StubStripe } from "./stubStripe.ts";

const NOW = Date.parse("2026-10-05T12:00:00Z");
/** A Preview's developer host, where the test sign-in exists too. */
const DEVELOPERS = "https://huey-610-sign-up.developers-preview.lexema.fyi";

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

test("DEVELOPER_SIGN_UP is open or closed, and anything else refuses", () => {
  assert.equal(parseSignUp("open"), "open");
  assert.equal(parseSignUp("closed"), "closed");
  for (const value of [undefined, "", "Open", " closed", "on", "off", true, 1, null]) {
    assert.throws(() => parseSignUp(value), /DEVELOPER_SIGN_UP must be one of open, closed/, String(value));
  }
});

test("web/wrangler.jsonc closes sign-up on production and Previews, and opens it at the top level", () => {
  const config = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
  const read = (environment?: string) => unstable_readConfig({ config, env: environment }, { hideWarnings: true });
  assert.equal(parseSignUp(read().vars.DEVELOPER_SIGN_UP), "open");
  assert.equal(parseSignUp(read("production").vars.DEVELOPER_SIGN_UP), "closed");
  assert.equal(parseSignUp(read().previews?.vars?.DEVELOPER_SIGN_UP), "closed");
  assert.equal(parseSignUp(read("production").previews?.vars?.DEVELOPER_SIGN_UP), "closed");
});

test("open, sign-up adds nothing: the sign-in and billing routes are the ones on main", () => {
  const app: FetchHandler<object> = async () => new Response("app");
  assert.equal(withSignUp("open", app), app);
});

/**
 * The Worker's layers as worker/index.ts puts them together on the preview
 * stage, with sign-up `signUp`, over a fresh app database. Every request the
 * App Router would answer is recorded in `appSaw`.
 */
function site(signUp: SignUp) {
  const { sqlite, appDb } = freshAppDatabase();
  const google = new StubProvider("google");
  const github = new StubProvider("github");
  const stripe = new StubStripe();
  const billing = stripe.billing();
  const signInContext = () => ({ providers: { google, github }, appDb, now: NOW });
  const appSaw: string[] = [];
  const app: FetchHandler<typeof env> = async (request) => {
    appSaw.push(new URL(request.url).pathname);
    return new Response("page");
  };
  const worker = withStripeWebhook<typeof env>(
    byHost({
      app: withRateLimits(
        SITE_LIMITS,
        withTestSignIn(
          "preview",
          withSignUp(signUp, withSignIn(withBilling(app, () => ({ billing: { outcome: "ready", billing }, appDb, now: NOW })), signInContext)),
          signInContext,
        ),
      ),
      api: async () => Response.json({}),
      apiNotFound,
    }),
    () => ({ billing: { outcome: "ready", billing }, appDb }),
  );
  const send = (path: string, init: RequestInit = {}) => worker(new Request(`${DEVELOPERS}${path}`, init), env, {} as ExecutionContext);
  const post = (path: string, fields: Record<string, string>, cookie?: string) =>
    send(path, {
      method: "POST",
      headers: { origin: DEVELOPERS, ...(cookie === undefined ? {} : { cookie }) },
      body: new URLSearchParams(fields),
    });
  /** Every row of every app table, so a test can tell nothing was written. */
  const rows = () => {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[];
    return Object.fromEntries(tables.map(({ name }) => [name, sqlite.prepare(`SELECT * FROM "${name}"`).all()]));
  };
  return { send, post, rows, stripe, appSaw };
}

/** The 303 to the sign-in page a closed route answers: no cookie set, nothing stored. */
function assertRefused(response: Response, what: string) {
  assert.equal(response.status, 303, what);
  assert.equal(response.headers.get("location"), "/sign-in", what);
  assert.deepEqual(response.headers.getSetCookie(), [], `${what} sets no cookie`);
}

/** The session cookie a response sets, as a `Cookie` header. */
function sessionOf(response: Response): string {
  const [session] = response.headers.getSetCookie().filter((value) => value.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(session !== undefined, "a session cookie");
  return session.split(";")[0];
}

test("closed, Google's and GitHub's start and callback start no OAuth, set no cookie, make no account or session, and answer 303 to the sign-in page", async () => {
  for (const provider of ["google", "github"] as const) {
    // Open, the start goes on to the provider with a pending sign-in.
    const open = await site("open").send(`/sign-in/${provider}`);
    assert.equal(open.status, 303);
    assert.notEqual(open.headers.get("location"), "/sign-in");
    assert.ok(open.headers.getSetCookie().some((value) => value.startsWith(`${PENDING_COOKIE}=`)), `open, ${provider} keeps a pending sign-in`);

    const closed = site("closed");
    const before = closed.rows();
    assertRefused(await closed.send(`/sign-in/${provider}`), `${provider} start`);
    assertRefused(
      await closed.send(`/sign-in/${provider}/callback?code=a-code&state=a-state`, { headers: { cookie: `${PENDING_COOKIE}=a-pending-sign-in` } }),
      `${provider} callback`,
    );
    assert.deepEqual(closed.rows(), before, `${provider}: nothing stored`);
    assert.deepEqual(closed.appSaw, []);
  }
});

test("closed, choosing a plan by POST or GET makes no Stripe call, sets no chosen-plan cookie and answers 303 to the sign-in page, signed out or in", async () => {
  const closed = site("closed");
  assertRefused(await closed.post(CHECKOUT_ACTION, { [PLAN_FIELD]: "pro" }), "signed-out POST");
  assertRefused(await closed.send(CHECKOUT_ACTION, { headers: { cookie: `${CHOSEN_PLAN_COOKIE}=pro` } }), "signed-out GET");

  // The Preview's test developer is signed in, and still cannot start a Checkout.
  const session = sessionOf(await closed.post(TEST_SIGN_IN, {}));
  const csrf = await csrfToken(session.slice(session.indexOf("=") + 1));
  assertRefused(await closed.post(CHECKOUT_ACTION, { [PLAN_FIELD]: "starter", csrf }, session), "signed-in POST");
  assertRefused(await closed.send(CHECKOUT_ACTION, { headers: { cookie: `${session}; ${CHOSEN_PLAN_COOKIE}=starter` } }), "signed-in GET");
  assert.deepEqual(closed.stripe.checkouts, []);
  assert.deepEqual(closed.stripe.portals, []);
  assert.deepEqual(closed.appSaw, []);
});

test("sign-out, the billing portal, Stripe's return and webhook, and the Preview's test sign-in answer the same open and closed", async () => {
  /** What a browser sees of a response: its status, where it goes, and which cookies it sets. */
  const seen = async (response: Response) => ({
    status: response.status,
    location: response.headers.get("location"),
    cookies: response.headers.getSetCookie().map((value) => value.split("=")[0]),
  });
  const journey = async (signUp: SignUp) => {
    const { send, post } = site(signUp);
    const signedIn = await post(TEST_SIGN_IN, {});
    const session = sessionOf(signedIn);
    return [
      await seen(signedIn),
      await seen(await post(PORTAL_ACTION, {})),
      await seen(await send("/auth/subscription/success?callbackURL=%2Fdashboard%2Fsettings")),
      await seen(await send("/auth/stripe/webhook", { method: "POST", body: "{}" })),
      await seen(await post("/sign-out", {}, session)),
    ];
  };
  const open = await journey("open");
  assert.deepEqual(await journey("closed"), open);
  assert.equal(open[0].status, 303, "the test sign-in signs in");
  assert.equal(open[4].location, "/", "sign-out lands on the landing page");
});
