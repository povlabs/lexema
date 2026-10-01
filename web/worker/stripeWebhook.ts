// Stripe's webhook on developers.lexema.fyi (#262).
//
//   POST /auth/stripe/webhook   a Stripe event, answered by the Stripe plugin
//
// The one better-auth path the Worker routes (src/accounts/auth.ts). It is
// answered in front of the host routing, so it runs outside the per-visitor
// limits, the dashboard's CSRF check and any session: Stripe is the caller,
// and the plugin verifies its `Stripe-Signature` (a missing, bad or stale one
// answers 400). Its handlers and Lexema's sync (src/billing/subscriptionSync.ts)
// then write the account's `subscription` row; a failed sync answers 400, so
// Stripe retries. A plan change the sync writes is then emailed to the account
// through `EMAIL`, the `send_email` binding, once (#215,
// src/billing/planNotice.ts); without the binding nothing is sent. Every other `/auth/*` path, on every host, goes on to the
// host routing like any path, where only the developer site's Checkout return
// (worker/billing.ts) answers one.
//
// Without every Stripe setting (src/accounts/billing.ts), `BETTER_AUTH_SECRET`
// or `APP_DB`, the route answers 503 and logs which is missing.

import { authSecret, billingAuth, STRIPE_WEBHOOK_PATH } from "@lexema/accounts/auth.ts";
import { billingOf, type BillingSetup, type StripeSettings } from "@lexema/accounts/billing.ts";
import { appTablesOverD1, type AppTables } from "@lexema/db/app/database.ts";
import { accountMailOf, workerEmailOf, type EmailBinding } from "@lexema/email/send.ts";
import { isDeveloperSitePath, originsOf } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";
import { text } from "./signIn.ts";

/** The bindings the webhook reads: the app database, the Stripe settings and the email binding. */
export interface StripeWebhookBindings extends StripeSettings {
  APP_DB?: D1Database;
  EMAIL?: EmailBinding;
  /** The one address `EMAIL` may send to, on a Preview; empty elsewhere (`workerEmailOf`). */
  EMAIL_ONLY_TO?: string;
}

/** What the webhook runs against; the Worker's, or a test's. */
export interface StripeWebhookContext {
  billing: BillingSetup;
  appDb: AppTables | undefined;
  /** Where plan emails go out; none are sent without it. */
  email?: EmailBinding;
}

/** The context the live Worker runs with: a Stripe client built from this request's env. */
export function liveWebhookContext(env: StripeWebhookBindings): StripeWebhookContext {
  return { billing: billingOf(env), appDb: env.APP_DB === undefined ? undefined : appTablesOverD1(env.APP_DB), email: workerEmailOf(env.EMAIL, env.EMAIL_ONLY_TO) };
}

/** Answer one request to the webhook path. */
export async function answerStripeWebhook(request: Request, context: StripeWebhookContext): Promise<Response> {
  if (request.method !== "POST") return text(405, "POST only.", new Headers({ allow: "POST" }));
  const secret = authSecret();
  const missing = [
    ...(context.billing.outcome === "missing" ? context.billing.missing : []),
    ...(secret === undefined ? ["BETTER_AUTH_SECRET"] : []),
    ...(context.appDb === undefined ? ["APP_DB"] : []),
  ];
  if (context.billing.outcome === "missing" || secret === undefined || context.appDb === undefined) {
    console.error("stripe webhook is off", { missing });
    return text(503, "Billing is not available.");
  }
  const url = new URL(request.url);
  const origin = url.origin;
  const mail = accountMailOf(context.email, { developers: origin, lexema: originsOf(url.hostname).lexema });
  const auth = billingAuth(context.appDb.app, secret, origin, context.billing.billing, mail);
  return auth.handler(new Request(`${origin}${STRIPE_WEBHOOK_PATH}`, request));
}

/** Answer the webhook here, and hand every other request on. */
export function withStripeWebhook<E extends StripeWebhookBindings>(
  next: FetchHandler<E>,
  contextOf: (env: E) => StripeWebhookContext = liveWebhookContext,
): FetchHandler<E> {
  return (request, env, ctx) =>
    isDeveloperSitePath(new URL(request.url), STRIPE_WEBHOOK_PATH) ? answerStripeWebhook(request, contextOf(env)) : next(request, env, ctx);
}
