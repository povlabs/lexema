// Stripe's webhook on the developer site (#262): signed events from a stubbed
// Stripe, through the Worker's webhook route, the Stripe plugin and Lexema's
// sync, over the real app migrations on `node:sqlite`. Every account here
// starts its plan the way a developer does: the plugin starts a Checkout for
// Pro, and Stripe then sends its events.

import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { signInAccount, verifiedIdentity } from "../../src/accounts/accounts.js";
import { billingAuth, startSession } from "../../src/accounts/auth.js";
import { billingOf, STRIPE_SETTINGS, type Billing, type StripeSettings } from "../../src/accounts/billing.js";
import { developerAccount, subscription } from "../../src/db/app/schema.js";
import { freshAppDatabase } from "../../test/databases.js";
import { withStripeWebhook, type StripeWebhookContext } from "@/worker/stripeWebhook.ts";
import { eventPayload, signatureOf, StubStripe, TEST_SETTINGS, type SubscriptionState } from "./stubStripe.ts";

// The session secret, a constant that exists nowhere else: CI holds no secret.
process.env.BETTER_AUTH_SECRET = "lexema-tests-only-3f9c2a7e5d1b4c8a9e6f0d2b7a5c3e1f";

const DEVELOPERS = "https://developers.lexema.fyi";
const WEBHOOK = `${DEVELOPERS}/auth/stripe/webhook`;
const SUBSCRIPTION = "sub_test_1";
const seconds = (iso: string) => Date.parse(iso) / 1000;
const SEPTEMBER = { periodStart: seconds("2026-09-30T00:00:00Z"), periodEnd: seconds("2026-10-30T00:00:00Z") };
const OCTOBER = { periodStart: seconds("2026-10-30T00:00:00Z"), periodEnd: seconds("2026-11-30T00:00:00Z") };
const ACTIVE_PRO: SubscriptionState = { status: "active", price: TEST_SETTINGS.STRIPE_PRICE_PRO, ...SEPTEMBER };

/** The `Stripe-Signature` an event's payload is sent with, at `now` in seconds. */
type Signer = (payload: string, now: number) => Promise<string | null>;

/** Everything a request the app would answer gets: the webhook route hands it on. */
const APP_ANSWER = "app";

/** An account that has started a Checkout for Pro through the plugin, and the Worker's webhook over it. */
async function checkoutStarted() {
  const { sqlite, appDb } = freshAppDatabase();
  const stripe = new StubStripe();
  const billing: Billing = stripe.billing();
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const identity = verifiedIdentity("github", { subject: "4242", verifiedEmail: "dev@example.com", name: "Dev" });
  assert.ok(identity);
  const { accountId } = await signInAccount(appDb, identity, Date.now());
  const cookies = await startSession(appDb.app, secret, DEVELOPERS, new Headers(), accountId);
  const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  await billingAuth(appDb.app, secret, DEVELOPERS, billing).api.upgradeSubscription({
    headers: new Headers({ cookie }),
    body: { plan: "pro", successUrl: "/dashboard/settings", cancelUrl: "/pricing", disableRedirect: true },
  });
  const [checkout] = stripe.checkouts;
  assert.ok(checkout, "the plugin started a Checkout");

  const worker = withStripeWebhook<object>(
    async () => new Response(APP_ANSWER, { status: 404 }),
    (): StripeWebhookContext => ({ billing: { outcome: "ready", billing }, appDb }),
  );
  let events = 0;

  /** Set the subscription's state at Stripe, answering the object an event about it carries. */
  const stripeHolds = (state: SubscriptionState) => stripe.set(SUBSCRIPTION, checkout.customer, checkout.subscriptionMetadata, state);

  /** Send an event, signed now with the endpoint's secret unless `sign` says otherwise (`null` for no header). */
  async function send(type: Stripe.Event.Type, object: object, sign: Signer = (payload, now) => signatureOf(payload, now)): Promise<Response> {
    events += 1;
    const now = Math.floor(Date.now() / 1000);
    const payload = eventPayload(`evt_test_${events}`, type, object, now);
    const header = await sign(payload, now);
    const headers = new Headers({ "content-type": "application/json" });
    if (header !== null) headers.set("stripe-signature", header);
    return worker(new Request(WEBHOOK, { method: "POST", headers, body: payload }), {}, {} as ExecutionContext);
  }

  /** The Checkout Session Stripe sends once the developer has paid. */
  const completedCheckout = () => ({
    object: "checkout.session",
    id: checkout.id,
    mode: "subscription",
    customer: checkout.customer,
    subscription: SUBSCRIPTION,
    client_reference_id: checkout.clientReferenceId,
    metadata: checkout.metadata,
  });

  /** The account's subscription row, in the fields Stripe's state decides. */
  async function row() {
    const rows = await appDb.app
      .select({
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        plan: subscription.plan,
        status: subscription.status,
        periodStart: subscription.periodStart,
        periodEnd: subscription.periodEnd,
        cancelAt: subscription.cancelAt,
        canceledAt: subscription.canceledAt,
        endedAt: subscription.endedAt,
      })
      .from(subscription)
      .where(eq(subscription.referenceId, String(accountId)));
    assert.equal(rows.length, 1, "the account has one subscription row");
    return rows[0];
  }

  const customerOf = async () =>
    (await appDb.app.select({ id: developerAccount.stripeCustomerId }).from(developerAccount).where(eq(developerAccount.id, accountId)))[0]?.id;

  return { sqlite, worker, stripeHolds, send, completedCheckout, row, customerOf, checkout };
}

const date = (at: number | null | undefined) => (at == null ? null : new Date(at * 1000));

/** The row a subscription in this state is kept as. */
const rowOf = (state: SubscriptionState) => ({
  stripeSubscriptionId: SUBSCRIPTION,
  plan: state.price === TEST_SETTINGS.STRIPE_PRICE_PRO ? "pro" : "starter",
  status: state.status,
  periodStart: new Date(state.periodStart * 1000),
  periodEnd: new Date(state.periodEnd * 1000),
  cancelAt: date(state.cancelAt),
  canceledAt: date(state.canceledAt),
  endedAt: date(state.endedAt),
});

/** An invoice Stripe sends for the subscription, which names it under `parent`. */
const invoice = () => ({
  object: "invoice",
  id: "in_test_1",
  parent: { type: "subscription_details", quote_details: null, subscription_details: { subscription: SUBSCRIPTION, metadata: null } },
});

test("checkout.session.completed for a Checkout the plugin started links the Stripe customer and makes the row active", async () => {
  const site = await checkoutStarted();
  site.stripeHolds(ACTIVE_PRO);

  const answer = await site.send("checkout.session.completed", site.completedCheckout());

  assert.equal(answer.status, 200);
  assert.deepEqual(await site.row(), rowOf(ACTIVE_PRO));
  assert.equal(await site.customerOf(), site.checkout.customer);
});

test("each of the six events leaves the row in the state Stripe holds when it arrives", async () => {
  const site = await checkoutStarted();
  const cancelling: SubscriptionState = { ...ACTIVE_PRO, cancelAt: OCTOBER.periodStart, canceledAt: seconds("2026-10-05T00:00:00Z") };
  const steps: { type: Stripe.Event.Type; state: SubscriptionState; object: (sent: Stripe.Subscription) => object }[] = [
    { type: "checkout.session.completed", state: ACTIVE_PRO, object: () => site.completedCheckout() },
    { type: "customer.subscription.created", state: ACTIVE_PRO, object: (sent) => sent },
    { type: "invoice.payment_failed", state: { ...ACTIVE_PRO, status: "past_due", ...OCTOBER }, object: invoice },
    { type: "invoice.paid", state: { ...ACTIVE_PRO, ...OCTOBER }, object: invoice },
    { type: "customer.subscription.updated", state: { ...cancelling, ...OCTOBER }, object: (sent) => sent },
    {
      type: "customer.subscription.deleted",
      state: { ...cancelling, ...OCTOBER, status: "canceled", endedAt: OCTOBER.periodEnd },
      object: (sent) => sent,
    },
  ];
  for (const { type, state, object } of steps) {
    const sent = site.stripeHolds(state);
    const answer = await site.send(type, object(sent));
    assert.equal(answer.status, 200, type);
    assert.deepEqual(await site.row(), rowOf(state), type);
  }
});

test("a replayed event and an older update arriving after a newer one both end in Stripe's current state", async () => {
  const site = await checkoutStarted();
  site.stripeHolds(ACTIVE_PRO);
  await site.send("checkout.session.completed", site.completedCheckout());

  const older = site.stripeHolds({ ...ACTIVE_PRO, status: "past_due" });
  const current: SubscriptionState = { ...ACTIVE_PRO, ...OCTOBER };
  const newer = site.stripeHolds(current);
  assert.equal((await site.send("customer.subscription.updated", newer)).status, 200);
  assert.equal((await site.send("customer.subscription.updated", newer)).status, 200);
  assert.deepEqual(await site.row(), rowOf(current));

  // The older event carries `past_due`; the plugin's own handler writes it, then the sync reads Stripe back.
  assert.equal((await site.send("customer.subscription.updated", older)).status, 200);
  assert.deepEqual(await site.row(), rowOf(current));
});

test("a missing, wrongly signed or stale signature answers 400 and changes nothing", async () => {
  const site = await checkoutStarted();
  site.stripeHolds(ACTIVE_PRO);
  const before = await site.row();
  const refused: Record<string, Signer> = {
    missing: async () => null,
    "another secret": (payload, now) => signatureOf(payload, now, "whsec_not_the_endpoints_secret"),
    // Stripe's default tolerance is five minutes.
    stale: (payload, now) => signatureOf(payload, now - 10 * 60),
  };
  for (const [why, sign] of Object.entries(refused)) {
    const answer = await site.send("checkout.session.completed", site.completedCheckout(), sign);
    assert.equal(answer.status, 400, why);
    assert.deepEqual(await site.row(), before, why);
    assert.equal(await site.customerOf(), site.checkout.customer, why);
  }
  assert.equal(before.status, "incomplete");
});

test("a sync whose write fails answers 400, and Stripe's retry then applies the event", async () => {
  const site = await checkoutStarted();
  site.stripeHolds(ACTIVE_PRO);
  site.sqlite.exec("CREATE TRIGGER refuse_sync BEFORE UPDATE ON subscription BEGIN SELECT RAISE(ABORT, 'the write failed'); END");

  assert.equal((await site.send("checkout.session.completed", site.completedCheckout())).status, 400);
  assert.equal((await site.row()).status, "incomplete");

  site.sqlite.exec("DROP TRIGGER refuse_sync");
  assert.equal((await site.send("checkout.session.completed", site.completedCheckout())).status, 200);
  assert.deepEqual(await site.row(), rowOf(ACTIVE_PRO));
});

test("without every Stripe setting the webhook answers 503, and no other /auth path is the plugin's on any host", async () => {
  const { appDb } = freshAppDatabase();
  const handed: string[] = [];
  const worker = (settings: StripeSettings) =>
    withStripeWebhook<object>(
      async (request) => {
        handed.push(request.url);
        return new Response(APP_ANSWER, { status: 404 });
      },
      () => ({ billing: billingOf(settings, new StubStripe().fetch), appDb }),
    );
  const post = (settings: StripeSettings, url: string) =>
    worker(settings)(new Request(url, { method: "POST", body: "{}" }), {}, {} as ExecutionContext);

  for (const unset of STRIPE_SETTINGS) {
    const answer = await post({ ...TEST_SETTINGS, [unset]: "" }, WEBHOOK);
    assert.equal(answer.status, 503, unset);
  }
  assert.deepEqual(handed, []);

  const elsewhere = [
    `${DEVELOPERS}/auth/subscription/upgrade`,
    `${DEVELOPERS}/auth/subscription/billing-portal`,
    `${DEVELOPERS}/auth/stripe/webhook/`,
    "https://lexema.fyi/auth/stripe/webhook",
    "https://api.lexema.fyi/auth/stripe/webhook",
  ];
  for (const url of elsewhere) {
    const answer = await post(TEST_SETTINGS, url);
    assert.equal(await answer.text(), APP_ANSWER, url);
  }
  assert.deepEqual(handed, elsewhere);
});
