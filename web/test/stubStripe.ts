// Stripe for tests (#262): a stand-in for api.stripe.com at the level of
// `fetch`, handed to a real stripe-node client, so the Stripe plugin's own
// code and Lexema's sync run against it. It answers only the calls a Checkout,
// its return, the billing portal, a webhook and an account deletion make, and
// refuses any other, so a test can never reach Stripe.
// Webhook payloads are signed with a test secret that exists nowhere else: CI
// holds no Stripe secret.

import Stripe from "stripe";
import { STRIPE_SETTINGS, type BillingSetup, type Billing, type StripeSettings } from "../../src/accounts/billing.js";

export const TEST_SETTINGS = {
  STRIPE_SECRET_KEY: "sk_test_lexema_tests_only",
  STRIPE_WEBHOOK_SECRET: "whsec_lexema_tests_only_7c1e9a4b2d",
  STRIPE_PRICE_STARTER: "price_starter_test",
  STRIPE_PRICE_PRO: "price_pro_test",
} as const satisfies Required<StripeSettings>;

/** Billing off: no Stripe setting is set, as in development. */
export const BILLING_OFF = { outcome: "missing", missing: STRIPE_SETTINGS } as const satisfies BillingSetup;

/** What a test sets a subscription to: Stripe's current state of it. */
export interface SubscriptionState {
  status: Stripe.Subscription.Status;
  price: string;
  periodStart: number;
  periodEnd: number;
  cancelAt?: number | null;
  canceledAt?: number | null;
  endedAt?: number | null;
}

/** A Checkout the plugin started: what it asked Stripe for. */
export interface StartedCheckout {
  id: string;
  customer: string;
  clientReferenceId: string;
  price: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  subscriptionMetadata: Record<string, string>;
  /** Every `custom_text` field sent, by its path under `custom_text`: `[submit][message]` for the line by the subscribe button. */
  customText: Record<string, string>;
  /** Every `consent_collection` field sent, by its path under `consent_collection`. */
  consentCollection: Record<string, string>;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** A billing portal session the plugin asked Stripe for. */
export interface StartedPortal {
  customer: string;
  returnUrl: string;
  url: string;
}

export class StubStripe {
  readonly checkouts: StartedCheckout[] = [];
  readonly portals: StartedPortal[] = [];
  /** Each subscription cancelled at once (`DELETE /v1/subscriptions/<id>`), in order. */
  readonly cancelled: string[] = [];
  /** While set, Stripe answers every call with a server error, as during an outage. */
  down = false;
  /** The subscription each Checkout made once it was paid, by Checkout id: `pay` sets it. */
  private readonly paid = new Map<string, string>();
  private readonly subscriptions = new Map<string, Stripe.Subscription>();
  private customers = 0;

  /** The fetch a Stripe client is built over. */
  readonly fetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.host !== "api.stripe.com") throw new Error(`the Stripe stub was asked for ${url.href}`);
    // `stripe-should-retry: false` stops stripe-node retrying. A retried call
    // never reads this body, so its request timer is never cleared and keeps
    // the test file open for its whole 80 s timeout (#521).
    if (this.down) {
      return Response.json({ error: { type: "api_error", message: "Stripe is down." } }, { status: 500, headers: { "stripe-should-retry": "false" } });
    }
    const form = request.method === "POST" ? new URLSearchParams(await request.text()) : new URLSearchParams();
    const path = url.pathname;
    if (request.method === "GET" && path === "/v1/customers/search") return json({ object: "search_result", data: [], has_more: false, url: path });
    if (request.method === "POST" && path === "/v1/customers") {
      this.customers += 1;
      return json({ object: "customer", id: `cus_test_${this.customers}`, email: form.get("email"), metadata: {} });
    }
    if (request.method === "GET" && path === "/v1/subscriptions") return json({ object: "list", data: [], has_more: false, url: path });
    const price = /^\/v1\/prices\/([^/]+)$/.exec(path);
    if (request.method === "GET" && price !== null) {
      return json({ object: "price", id: price[1], recurring: { interval: "month", usage_type: "licensed" } });
    }
    if (request.method === "POST" && path === "/v1/checkout/sessions") {
      const id = `cs_test_${this.checkouts.length + 1}`;
      const metadataOf = (prefix: string) => {
        const metadata: Record<string, string> = {};
        for (const [key, value] of form) {
          const name = key.startsWith(`${prefix}[`) ? key.slice(prefix.length + 1, -1) : undefined;
          if (name !== undefined && !name.includes("[")) metadata[name] = value;
        }
        return metadata;
      };
      const fieldsUnder = (prefix: string) => {
        const fields: Record<string, string> = {};
        for (const [key, value] of form) if (key.startsWith(`${prefix}[`)) fields[key.slice(prefix.length)] = value;
        return fields;
      };
      this.checkouts.push({
        id,
        customer: form.get("customer") ?? "",
        clientReferenceId: form.get("client_reference_id") ?? "",
        price: form.get("line_items[0][price]") ?? "",
        successUrl: form.get("success_url") ?? "",
        cancelUrl: form.get("cancel_url") ?? "",
        metadata: metadataOf("metadata"),
        subscriptionMetadata: metadataOf("subscription_data[metadata]"),
        customText: fieldsUnder("custom_text"),
        consentCollection: fieldsUnder("consent_collection"),
      });
      return json({ object: "checkout.session", id, url: `https://checkout.stripe.com/c/pay/${id}` });
    }
    const session = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(path);
    const started = this.checkouts.find((checkout) => checkout.id === session?.[1]);
    if (request.method === "GET" && started !== undefined) {
      const subscription = this.paid.get(started.id) ?? null;
      return json({
        object: "checkout.session",
        id: started.id,
        mode: "subscription",
        customer: started.customer,
        client_reference_id: started.clientReferenceId,
        metadata: started.metadata,
        subscription,
        payment_status: subscription === null ? "unpaid" : "paid",
      });
    }
    if (request.method === "POST" && path === "/v1/billing_portal/sessions") {
      const portal = { customer: form.get("customer") ?? "", returnUrl: form.get("return_url") ?? "", url: `https://billing.stripe.com/p/session/test_${this.portals.length + 1}` };
      this.portals.push(portal);
      return json({ object: "billing_portal.session", ...portal, return_url: portal.returnUrl });
    }
    const subscription = /^\/v1\/subscriptions\/([^/]+)$/.exec(path);
    const found = subscription === null ? undefined : this.subscriptions.get(subscription[1]);
    if (subscription !== null && found === undefined) {
      return json({ error: { type: "invalid_request_error", code: "resource_missing", message: `No such subscription: '${subscription[1]}'` } }, 404);
    }
    if (request.method === "GET" && found !== undefined) return json(found);
    if (request.method === "DELETE" && found !== undefined) {
      // A second cancel of one subscription is refused, so a test sees it fail.
      if (found.status === "canceled") return json({ error: { type: "invalid_request_error", message: "This subscription is already canceled." } }, 400);
      this.cancelled.push(found.id);
      const at = Math.floor(Date.now() / 1000);
      const cancelled = { ...found, status: "canceled", canceled_at: at, ended_at: at } as Stripe.Subscription;
      this.subscriptions.set(found.id, cancelled);
      return json(cancelled);
    }
    throw new Error(`the Stripe stub has no answer for ${request.method} ${path}`);
  };

  /** Billing on, over this stub, as the Worker builds it from every setting. */
  billing(): Billing {
    return {
      stripe: this.client(),
      webhookSecret: TEST_SETTINGS.STRIPE_WEBHOOK_SECRET,
      prices: { starter: TEST_SETTINGS.STRIPE_PRICE_STARTER, pro: TEST_SETTINGS.STRIPE_PRICE_PRO },
    };
  }

  /** A Stripe client over this stub, as the Worker builds one. */
  client(): Stripe {
    return new Stripe(TEST_SETTINGS.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient(this.fetch) });
  }

  /** The developer pays Checkout `checkout`: Stripe now holds subscription `id` in `state`, made by that Checkout. */
  pay(checkout: StartedCheckout, id: string, state: SubscriptionState): Stripe.Subscription {
    this.paid.set(checkout.id, id);
    return this.set(id, checkout.customer, checkout.subscriptionMetadata, state);
  }

  /** Set a subscription's current state at Stripe, and answer the object Stripe would send. */
  set(id: string, customer: string, metadata: Record<string, string>, state: SubscriptionState): Stripe.Subscription {
    const object = {
      object: "subscription",
      id,
      customer,
      metadata,
      status: state.status,
      cancel_at: state.cancelAt ?? null,
      cancel_at_period_end: false,
      canceled_at: state.canceledAt ?? null,
      ended_at: state.endedAt ?? null,
      trial_start: null,
      trial_end: null,
      schedule: null,
      items: {
        object: "list",
        data: [
          {
            object: "subscription_item",
            id: `si_${id}`,
            quantity: 1,
            current_period_start: state.periodStart,
            current_period_end: state.periodEnd,
            price: { object: "price", id: state.price, lookup_key: null, recurring: { interval: "month" } },
          },
        ],
      },
    } as unknown as Stripe.Subscription;
    this.subscriptions.set(id, object);
    return object;
  }
}

/** A Stripe event of this type about `object`, as the webhook body carries it. */
export function eventPayload(id: string, type: Stripe.Event.Type, object: object, created: number): string {
  return JSON.stringify({ id, object: "event", type, created, api_version: "2026-08-26.dahlia", data: { object }, livemode: false });
}

/** A `Stripe-Signature` header for `payload`, signed with the test secret, at `timestamp` (seconds). */
export const signatureOf = (payload: string, timestamp: number, secret: string = TEST_SETTINGS.STRIPE_WEBHOOK_SECRET): Promise<string> =>
  new Stripe(TEST_SETTINGS.STRIPE_SECRET_KEY).webhooks.generateTestHeaderStringAsync({ payload, secret, timestamp });
