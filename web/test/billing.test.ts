// Checkout and the billing portal on developers.lexema.fyi (#264), through the
// Worker's host routing, sign-in and webhook, with the Stripe plugin over a
// stubbed Stripe (./stubStripe.ts) and a stub sign-in provider
// (./stubProvider.ts), over the real app migrations on `node:sqlite`.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { csrfToken } from "../../src/accounts/csrf.js";
import { billingOf, type Billing } from "../../src/accounts/billing.js";
import { createAccountKey, keyName } from "../../src/api/ownedKeys.js";
import { subscription } from "../../src/db/app/schema.js";
import { seedSql } from "../../src/import/seedSql.js";
import { freshAppDatabase, readOnlyDictionary, subscribe } from "../../test/databases.js";
import { CHECKOUT_ACTION, PORTAL_ACTION, PRICING } from "@/lib/developers/billingActions.ts";
import { SETTINGS } from "@/lib/developers/dashboardActions.ts";
import { apiNotFound, handleApi } from "@/worker/api/handler.ts";
import { withBilling, type BillingContext } from "@/worker/developers/billing.ts";
import { byHost, ORIGIN } from "@/worker/shared/hosts.ts";
import { withRateLimits, type LimitBindings } from "@/worker/shared/rateLimit.ts";
import { SITE_LIMITS } from "./siteLimits.ts";
import { CHOSEN_PLAN_COOKIE, SESSION_COOKIE, signedInAccount, withSignIn, type SignInBindings } from "@/worker/developers/signIn.ts";
import { withStripeWebhook } from "@/worker/developers/stripeWebhook.ts";
import { TestMetering } from "./metering.ts";
import { StubProvider } from "./stubProvider.ts";
import { eventPayload, signatureOf, StubStripe, TEST_SETTINGS } from "./stubStripe.ts";

const DEVELOPERS = "https://developers.lexema.fyi";
const REPO = fileURLToPath(new URL("../..", import.meta.url));
const ada = { subject: "g-100", verifiedEmail: "ada@example.com", name: "Ada Lovelace" };

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

/** Only the `name=value` of a `Set-Cookie`, and whether it removes the cookie. */
function setCookie(header: string) {
  const [pair, ...attributes] = header.split(";").map((part) => part.trim());
  const at = pair.indexOf("=");
  return { name: pair.slice(0, at), value: pair.slice(at + 1), removes: attributes.some((a) => a.toLowerCase() === "max-age=0") };
}

/** The Worker as deployed, over a fresh database and a stubbed Stripe, with a browser's cookie jar. */
function site(billingSetting: (billing: Billing) => BillingContext["billing"] = (billing) => ({ outcome: "ready", billing })) {
  const { sqlite, appDb } = freshAppDatabase();
  const stripe = new StubStripe();
  const google = new StubProvider("google");
  const billing: Billing = stripe.billing();
  const now = () => Date.now();
  const worker = withStripeWebhook<typeof env>(
    byHost({
      app: withRateLimits(
        SITE_LIMITS,
        withSignIn(
          withBilling(async () => new Response("page"), () => ({ billing: billingSetting(billing), appDb, now: now() })),
          () => ({ providers: { google, github: undefined }, appDb, now: now() }),
        ),
      ),
      api: async () => Response.json({}),
      apiNotFound,
    }),
    () => ({ billing: { outcome: "ready", billing }, appDb }),
  );

  const jar = new Map<string, string>();
  const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (jar.size > 0) headers.set("cookie", cookieHeader());
    const response = await worker(new Request(url, { ...init, headers }), env, {} as ExecutionContext);
    for (const header of response.headers.getSetCookie()) {
      const { name, value, removes } = setCookie(header);
      if (removes) jar.delete(name);
      else jar.set(name, value);
    }
    return response;
  }

  /** Sign in with the stub Google, as a browser does: start, consent, come back. Answers the callback's answer. */
  async function signIn(): Promise<Response> {
    const start = await send(`${DEVELOPERS}/sign-in/google`);
    return send(google.consent(start.headers.get("location") ?? "", ada).toString());
  }

  /** Post a billing form from this site, carrying the session's CSRF token unless `fields` says otherwise. */
  async function post(action: string, fields: Record<string, string>, origin = DEVELOPERS): Promise<Response> {
    const session = jar.get(SESSION_COOKIE);
    const csrf: Record<string, string> = session === undefined ? {} : { csrf: await csrfToken(session) };
    return send(`${DEVELOPERS}${action}`, { method: "POST", headers: { origin }, body: new URLSearchParams({ ...csrf, ...fields }) });
  }

  /** A request from Stripe, which carries no browser's cookies. */
  const fromStripe = (url: string, init: RequestInit) => worker(new Request(url, init), env, {} as ExecutionContext);

  const account = async () => {
    const id = await signedInAccount(cookieHeader(), appDb, now(), ORIGIN);
    assert.ok(id !== undefined, "signed in");
    return id;
  };
  const rows = () => sqlite.prepare("SELECT count(*) AS n FROM subscription").get() as { n: number };
  return { appDb, stripe, jar, send, fromStripe, signIn, post, account, rows };
}

const RELEASE = "it-billing-test";

/** The dev seed's dictionary, as the API reads it: its key answers 200 once its account's plan serves. */
async function seededDictionary(): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-billing-"));
  try {
    const archive = join(dir, "dev-seed.jsonl.gz");
    await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/dev-seed.jsonl"))));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: join(REPO, "src/db/schema.sql"),
      releaseId: RELEASE,
      archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
      license: "CC-BY-SA-4.0",
    });
    const dictionary = new DatabaseSync(":memory:");
    for (const part of parts) dictionary.exec(await readFile(part, "utf8"));
    return dictionary;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const location = (response: Response) => response.headers.get("location");

test("signed in, choosing Pro makes a Checkout session for Pro's price with the account as client_reference_id, and answers 303 to it", async () => {
  const { stripe, signIn, post, account } = site();
  await signIn();

  const answer = await post(CHECKOUT_ACTION, { plan: "pro" });

  assert.equal(answer.status, 303);
  const [checkout] = stripe.checkouts;
  assert.equal(stripe.checkouts.length, 1);
  assert.equal(location(answer), `https://checkout.stripe.com/c/pay/${checkout.id}`);
  assert.equal(checkout.price, TEST_SETTINGS.STRIPE_PRICE_PRO);
  assert.equal(checkout.clientReferenceId, String(await account()));
  assert.equal(checkout.cancelUrl, `${DEVELOPERS}${PRICING}`);
  assert.equal(new URL(checkout.successUrl).searchParams.get("callbackURL"), SETTINGS);
});

test("Checkout for Starter and for Pro shows the Terms and business-use line by the subscribe button, with no consent checkbox (#572)", async () => {
  for (const [plan, price] of [["starter", TEST_SETTINGS.STRIPE_PRICE_STARTER], ["pro", TEST_SETTINGS.STRIPE_PRICE_PRO]] as const) {
    const { stripe, signIn, post } = site();
    await signIn();

    assert.equal((await post(CHECKOUT_ACTION, { plan })).status, 303, plan);

    const [checkout] = stripe.checkouts;
    assert.equal(checkout.price, price, plan);
    assert.deepEqual(
      checkout.customText,
      {
        "[submit][message]":
          "By subscribing, you agree to the [Terms of service](https://developers.lexema.fyi/terms) and confirm you are using the API for business purposes.",
      },
      plan,
    );
    assert.deepEqual(checkout.consentCollection, {}, plan);
  }
});

test("a bad CSRF token, a foreign Origin or an unknown plan changes nothing and makes no Checkout session", async () => {
  const refusals: [string, Record<string, string>, string | undefined, number][] = [
    ["bad CSRF token", { plan: "pro", csrf: "A".repeat(43) }, undefined, 403],
    ["no CSRF token", { plan: "pro", csrf: "" }, undefined, 403],
    ["foreign Origin", { plan: "pro" }, "https://evil.example", 403],
    ["unknown plan", { plan: "enterprise" }, undefined, 400],
  ];
  for (const [why, fields, origin, status] of refusals) {
    const { stripe, signIn, post, rows } = site();
    await signIn();
    const answer = await post(CHECKOUT_ACTION, fields, origin);
    assert.equal(answer.status, status, why);
    assert.equal(stripe.checkouts.length, 0, why);
    assert.equal(rows().n, 0, why);
  }
});

test("signed out, choosing Pro goes to sign-in, and the first page after signing in goes on to Checkout for Pro", async () => {
  const { stripe, jar, send, signIn, post, account } = site();

  const chosen = await post(CHECKOUT_ACTION, { plan: "pro" });
  assert.equal(chosen.status, 303);
  assert.equal(location(chosen), "/sign-in");
  assert.equal(stripe.checkouts.length, 0, "no Checkout before sign-in");

  const signedIn = await signIn();
  assert.equal(location(signedIn), CHECKOUT_ACTION);
  const onward = await send(`${DEVELOPERS}${location(signedIn)}`);

  assert.equal(onward.status, 303);
  const [checkout] = stripe.checkouts;
  assert.equal(location(onward), `https://checkout.stripe.com/c/pay/${checkout.id}`);
  assert.equal(checkout.price, TEST_SETTINGS.STRIPE_PRICE_PRO);
  assert.equal(checkout.clientReferenceId, String(await account()));
  assert.ok(!jar.has(CHOSEN_PLAN_COOKIE), "the chosen plan is used once");
  // Signing in again, with no plan chosen, lands on the dashboard.
  assert.equal(location(await signIn()), "/dashboard");
});

test("the portal returns to settings; without a Stripe customer it answers 303 to pricing, and choosing a plan while one serves or is past due goes to the portal", async () => {
  const { appDb, stripe, signIn, post, account } = site();
  await signIn();

  const none = await post(PORTAL_ACTION, {});
  assert.equal(none.status, 303);
  assert.equal(location(none), PRICING);
  assert.equal(stripe.portals.length, 0);

  // The first Checkout makes the account's Stripe customer.
  await post(CHECKOUT_ACTION, { plan: "starter" });
  const portal = await post(PORTAL_ACTION, {});
  assert.equal(portal.status, 303);
  assert.deepEqual(stripe.portals, [{ customer: stripe.checkouts[0].customer, returnUrl: `${DEVELOPERS}${SETTINGS}`, url: location(portal) }]);

  await appDb.app.delete(subscription);
  const month = 30 * 24 * 60 * 60 * 1000;
  await subscribe(appDb, await account(), { plan: "starter", status: "active", periodStart: new Date(Date.now() - month / 2), periodEnd: new Date(Date.now() + month / 2) });
  const serving = await post(CHECKOUT_ACTION, { plan: "pro" });
  assert.equal(location(serving), stripe.portals[1]?.url);
  assert.equal(stripe.checkouts.length, 1, "no second Checkout");

  // A past-due plan serves nothing but is still held: its card is fixed in the portal, not bought twice (#571).
  await appDb.app.update(subscription).set({ status: "past_due" });
  for (const plan of ["starter", "pro"]) {
    const pastDue = await post(CHECKOUT_ACTION, { plan });
    assert.equal(pastDue.status, 303, plan);
    assert.equal(location(pastDue), stripe.portals.at(-1)?.url, plan);
  }
  assert.equal(stripe.portals.length, 4);
  assert.equal(stripe.checkouts.length, 1, "no second Checkout while past due");
});

test("with the price ids set but no Stripe secret, choosing a plan answers 503 and calls nothing", async () => {
  const { stripe, signIn, post } = site(() => billingOf({ STRIPE_PRICE_STARTER: "price_a", STRIPE_PRICE_PRO: "price_b" }));
  await signIn();
  assert.equal((await post(CHECKOUT_ACTION, { plan: "pro" })).status, 503);
  assert.equal((await post(PORTAL_ACTION, {})).status, 503);
  assert.equal(stripe.checkouts.length + stripe.portals.length, 0);
});

test("end to end: choose Pro, pay, Stripe's signed checkout.session.completed, back to settings, and the account's key answers 200", async () => {
  const { appDb, stripe, send, fromStripe, signIn, post, account } = site();
  await signIn();
  const accountId = await account();
  const made = await createAccountKey(appDb, accountId, keyName("Key 1")!, Date.now());
  assert.equal(made.outcome, "created");
  const { key } = made;
  const dictionary = await seededDictionary();
  const callApi = () =>
    handleApi(new Request("https://api.lexema.fyi/v1/exists?q=casa", { headers: { "x-api-key": key } }), {
      db: readOnlyDictionary(dictionary),
      appDb,
      releaseId: RELEASE,
      now: Date.now(),
      metering: new TestMetering(),
    });
  assert.equal((await callApi()).status, 402, "no plan yet");

  await post(CHECKOUT_ACTION, { plan: "pro" });
  const [checkout] = stripe.checkouts;
  const nowSeconds = Math.floor(Date.now() / 1000);
  stripe.pay(checkout, "sub_test_1", { status: "active", price: TEST_SETTINGS.STRIPE_PRICE_PRO, periodStart: nowSeconds - 60, periodEnd: nowSeconds + 30 * 86400 });
  const payload = eventPayload("evt_test_1", "checkout.session.completed", {
    object: "checkout.session",
    id: checkout.id,
    mode: "subscription",
    customer: checkout.customer,
    subscription: "sub_test_1",
    client_reference_id: checkout.clientReferenceId,
    metadata: checkout.metadata,
  }, nowSeconds);
  const webhook = await fromStripe(`${DEVELOPERS}/auth/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": await signatureOf(payload, nowSeconds) },
    body: payload,
  });
  assert.equal(webhook.status, 200);

  const back = await send(checkout.successUrl.replace("{CHECKOUT_SESSION_ID}", checkout.id));
  assert.equal(back.status, 302);
  assert.equal(location(back), `${DEVELOPERS}${SETTINGS}`);

  assert.equal((await callApi()).status, 200);
  const [row] = await appDb.app.select({ plan: subscription.plan, status: subscription.status }).from(subscription).where(eq(subscription.referenceId, String(accountId)));
  assert.deepEqual(row, { plan: "pro", status: "active" });
});
