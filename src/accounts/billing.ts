// Stripe billing on better-auth: the Stripe plugin and what it is configured
// from (#262, #161).
//
// `@better-auth/stripe` 1.7.6 verifies each webhook's signature, runs its own
// event handlers and owns the `subscription` table (src/db/app/schema.ts).
// Lexema adds `syncSubscription` (src/billing/subscriptionSync.ts) as its
// `onEvent`, which reads each subscription back from Stripe so the row ends in
// Stripe's current state whatever order events arrive in (#200 R2.1). Once
// the row is written, the plan change it made is emailed to the account, once
// (#215, src/billing/planNotice.ts).
//
// The plugin is configured only when every setting below is set: the two
// secrets and the two plans' price ids. `billingOf` builds the one value the
// plugin can be mounted with, so there is no half-configured Stripe to mount.

import { stripe as stripePlugin } from "@better-auth/stripe";
import Stripe from "stripe";
import { notePlanChange } from "../billing/planNotice.js";
import { syncSubscription, type PlanPrices } from "../billing/subscriptionSync.js";
import { emailAccount, type AccountMail } from "../email/send.js";

/** The Worker secrets and vars Stripe billing is configured from. */
export interface StripeSettings {
  /** A Worker secret: the API key the plugin calls Stripe with. */
  STRIPE_SECRET_KEY?: string;
  /** A Worker secret: the webhook endpoint's signing secret. */
  STRIPE_WEBHOOK_SECRET?: string;
  /** A var: Starter's price id. */
  STRIPE_PRICE_STARTER?: string;
  /** A var: Pro's price id. */
  STRIPE_PRICE_PRO?: string;
}

export type StripeSetting = keyof StripeSettings;

/** Every setting, in the order a missing one is named. */
export const STRIPE_SETTINGS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_PRO"] as const satisfies readonly StripeSetting[];

/** Everything the Stripe plugin is mounted with. */
export interface Billing {
  readonly stripe: Stripe;
  readonly webhookSecret: string;
  readonly prices: PlanPrices;
}

/** Billing, or which settings keep it off. `missing` is never empty. */
export type BillingSetup =
  | { readonly outcome: "ready"; readonly billing: Billing }
  | { readonly outcome: "missing"; readonly missing: readonly [StripeSetting, ...StripeSetting[]] };

/**
 * The Stripe client over `fetch`, as a Worker calls Stripe, with the API
 * version stripe-node pins (`2026-08-26.dahlia` in 22.6.2). Its `workerd`
 * build verifies signatures with SubtleCrypto (#200 R2.1). Tests hand it a
 * stand-in `fetch`, so no test reaches Stripe.
 */
export const stripeClient = (secretKey: string, fetchFn?: typeof fetch): Stripe =>
  new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient(fetchFn) });

/** Billing from these settings, built per request like better-auth, or the settings it lacks. Blank counts as unset. */
export function billingOf(settings: StripeSettings, fetchFn?: typeof fetch): BillingSetup {
  const value = (name: StripeSetting) => settings[name]?.trim() ?? "";
  const [first, ...rest] = STRIPE_SETTINGS.filter((name) => value(name) === "");
  if (first !== undefined) return { outcome: "missing", missing: [first, ...rest] };
  return {
    outcome: "ready",
    billing: {
      stripe: stripeClient(value("STRIPE_SECRET_KEY"), fetchFn),
      webhookSecret: value("STRIPE_WEBHOOK_SECRET"),
      prices: { starter: value("STRIPE_PRICE_STARTER"), pro: value("STRIPE_PRICE_PRO") },
    },
  };
}

/** The developer site's Terms of service page (#162). */
export const TERMS_PATH = "/terms";

/**
 * The line every Checkout shows beside its subscribe button (#572): by
 * subscribing you agree to the Terms and confirm business use, with no
 * checkbox. Stripe renders a Markdown link in `custom_text.submit.message`,
 * so the link is absolute, on the developer site that made the session.
 */
export const checkoutTermsLine = (developerOrigin: string): string =>
  `By subscribing, you agree to the [Terms of service](${new URL(TERMS_PATH, developerOrigin).href}) and confirm you are using the API for business purposes.`;

/**
 * The Stripe plugin over this database. A customer is made at Checkout, not
 * at sign-up. The plugin's `subscription` model and `user.stripeCustomerId`
 * are the Drizzle table and column of the same field names, so the mapping
 * names only the table. Every Checkout it makes shows `checkoutTermsLine` for
 * `developerOrigin`. `mail` sends the emails a plan change owes; without
 * it they are recorded as owed and sent nowhere (src/email/send.ts).
 */
export function billingPlugin(db: Parameters<typeof syncSubscription>[0], billing: Billing, developerOrigin: string, mail: AccountMail | undefined) {
  return stripePlugin({
    stripeClient: billing.stripe,
    stripeWebhookSecret: billing.webhookSecret,
    createCustomerOnSignUp: false,
    subscription: {
      enabled: true,
      plans: [
        { name: "starter", priceId: billing.prices.starter },
        { name: "pro", priceId: billing.prices.pro },
      ],
      getCheckoutSessionParams: () => ({ params: { custom_text: { submit: { message: checkoutTermsLine(developerOrigin) } } } }),
    },
    schema: { subscription: { modelName: "subscription" } },
    onEvent: async (event) => {
      const synced = await syncSubscription(db, billing.stripe.subscriptions, billing.prices, event);
      // Answered 400, so Stripe keeps the event until this code knows the status.
      if (synced.outcome === "unknown-status") throw new Error(`Stripe subscription ${synced.stripeSubscriptionId} has an unknown status: ${synced.status}`);
      if (synced.outcome === "not-a-plan" || synced.outcome === "no-row") {
        console.warn("stripe event changed no subscription", { event: event.type, ...synced });
      }
      if (synced.outcome === "written") await emailAccount(db, mail, synced.accountId, await notePlanChange(db, synced, Date.now()));
    },
  });
}
