// Checkout and the billing portal on developers.lexema.fyi (#264): thin
// wrappers over the Stripe plugin's endpoints (#262, src/accounts/billing.ts).
//
// The routes, on the developer site's host only:
//
//   POST /billing/checkout             choose `plan` (starter or pro): 303 to
//                                      Stripe Checkout for it, or to the
//                                      billing portal when a plan already
//                                      serves the account. Signed out: 303 to
//                                      sign-in, keeping the plan
//   GET  /billing/checkout             where a sign-in that kept a plan lands:
//                                      on to Checkout for it
//   POST /billing/portal               303 to the billing portal, or to
//                                      /pricing for an account Stripe has
//                                      no customer for
//   GET  /auth/subscription/success    where Stripe returns a paid Checkout:
//                                      the plugin's, then /dashboard/settings
//
// The POSTs need an `Origin` that is this site, and, signed in, the session's
// CSRF token in the form's `csrf` field, like the dashboard actions
// (worker/dashboard.ts). A signed-out choice has no session to carry a token
// for: it changes nothing but its own short-lived cookie, and only a signed-in
// GET that holds that cookie goes on to Checkout. A refused request changes
// nothing and starts no Checkout.
//
// The plugin makes the Checkout session with the account as its
// `client_reference_id` and the account's Stripe customer, making one on the
// first Checkout. Without every Stripe setting, `BETTER_AUTH_SECRET` or
// `APP_DB`, every route answers 503 and logs which is missing, as the webhook
// does (worker/stripeWebhook.ts).

import { authSecret, billingAuth, CHECKOUT_RETURN_PATH } from "@lexema/accounts/auth.ts";
import { billingOf, type Billing, type BillingSetup, type StripeSettings } from "@lexema/accounts/billing.ts";
import { csrfMatches } from "@lexema/accounts/csrf.ts";
import { accountPlan, choiceFor } from "@lexema/billing/accountPlan.ts";
import { stripePlanOf, type StripePlanId } from "@lexema/billing/plans.ts";
import { appTablesOverD1, type AppTables } from "@lexema/db/app/database.ts";
import { log } from "@lexema/log/requestLog.ts";
import { CHECKOUT_ACTION, PLAN_FIELD, PORTAL_ACTION, PRICING } from "@/lib/developers/billingActions.ts";
import { CSRF_FIELD, SETTINGS } from "@/lib/developers/dashboardActions.ts";
import { DEVELOPERS_SEGMENT, originsOf } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";
import {
  CHOSEN_PLAN_COOKIE,
  CHOSEN_PLAN_SECONDS,
  clearedCookie,
  cookie,
  readCookie,
  redirect,
  SESSION_COOKIE,
  signedInAccount,
  text,
} from "./signIn.ts";

/** Where a visitor choosing a plan signed out is sent. */
const SIGN_IN_PAGE = "/sign-in";

/** A billing route, read off the path the App Router would see. */
export type BillingRoute = { kind: "checkout" } | { kind: "portal" } | { kind: "checkout-return" };

const ROUTES: Readonly<Record<string, BillingRoute>> = {
  [`/${DEVELOPERS_SEGMENT}${CHECKOUT_ACTION}`]: { kind: "checkout" },
  [`/${DEVELOPERS_SEGMENT}${PORTAL_ACTION}`]: { kind: "portal" },
  [`/${DEVELOPERS_SEGMENT}${CHECKOUT_RETURN_PATH}`]: { kind: "checkout-return" },
};

/** The billing route a developer-site URL names, or none. */
export const billingRouteOf = (url: URL): BillingRoute | undefined => (Object.hasOwn(ROUTES, url.pathname) ? ROUTES[url.pathname] : undefined);

/** The bindings billing reads: the app database and the Stripe settings. */
export interface BillingBindings extends StripeSettings {
  APP_DB?: D1Database;
}

/** What the billing routes run against; the Worker's, or a test's. */
export interface BillingContext {
  billing: BillingSetup;
  appDb: AppTables | undefined;
  now: number;
}

/** The context the live Worker runs with: a Stripe client built from this request's env. */
export function liveBillingContext(env: BillingBindings): BillingContext {
  return { billing: billingOf(env), appDb: env.APP_DB === undefined ? undefined : appTablesOverD1(env.APP_DB), now: Date.now() };
}

/** Everything a billing route runs with once billing is on. */
interface Ready {
  readonly billing: Billing;
  readonly appDb: AppTables;
  readonly secret: string;
  readonly now: number;
}

/** The context with every setting billing needs, or the names of those it lacks. */
function readyOf(context: BillingContext): Ready | readonly string[] {
  const secret = authSecret();
  if (context.billing.outcome === "ready" && secret !== undefined && context.appDb !== undefined) {
    return { billing: context.billing.billing, appDb: context.appDb, secret, now: context.now };
  }
  return [
    ...(context.billing.outcome === "missing" ? context.billing.missing : []),
    ...(secret === undefined ? ["BETTER_AUTH_SECRET"] : []),
    ...(context.appDb === undefined ? ["APP_DB"] : []),
  ];
}

const seeOther = (location: string, cookies: readonly string[] = []): Response => redirect(location, cookies);

/** A form's fields, or `undefined` when the body is not a form. */
async function formOf(request: Request): Promise<FormData | undefined> {
  try {
    return await request.formData();
  } catch {
    return undefined;
  }
}

const field = (form: FormData, name: string): string | undefined => {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
};

/** A signed-in request: its account, and the headers that carry its session to better-auth. */
interface Session {
  readonly accountId: number;
  readonly headers: Headers;
  readonly cookie: string;
}

async function sessionOf(request: Request, ready: Ready): Promise<Session | undefined> {
  const cookies = request.headers.get("cookie");
  const cookie = readCookie(cookies, SESSION_COOKIE);
  const accountId = await signedInAccount(cookies, ready.appDb, ready.now, originsOf(new URL(request.url).hostname));
  if (cookie === undefined || accountId === undefined) return undefined;
  return { accountId, cookie, headers: new Headers({ cookie: cookies ?? "" }) };
}

/** better-auth with the Stripe plugin, for this request's site. */
const authFor = (url: URL, ready: Ready) => billingAuth(ready.appDb.app, ready.secret, url.origin, ready.billing);

/** 303 to the billing portal, returning to settings; to pricing when Stripe has no customer for the account. */
async function toPortal(url: URL, ready: Ready, session: Session, cookies: readonly string[] = []): Promise<Response> {
  const answer = await authFor(url, ready).api.createBillingPortal({
    headers: session.headers,
    body: { returnUrl: SETTINGS, disableRedirect: true },
    asResponse: true,
  });
  const { url: location, code } = (await answer.json()) as { url?: unknown; code?: unknown };
  if (answer.status === 404 && code === "CUSTOMER_NOT_FOUND") return seeOther(PRICING, cookies);
  if (!answer.ok || typeof location !== "string") throw new Error(`the Stripe plugin answered ${answer.status} to a billing portal`);
  return seeOther(location, cookies);
}

/** 303 to Checkout for `plan`, or to the portal when a plan already serves the account. */
async function toCheckout(url: URL, ready: Ready, session: Session, plan: StripePlanId, cookies: readonly string[] = []): Promise<Response> {
  if (choiceFor(await accountPlan(ready.appDb, session.accountId, ready.now)) === "portal") return toPortal(url, ready, session, cookies);
  const started = await authFor(url, ready).api.upgradeSubscription({
    headers: session.headers,
    body: { plan, successUrl: SETTINGS, cancelUrl: PRICING, disableRedirect: true },
    asResponse: true,
  });
  const { url: location } = (await started.json()) as { url?: unknown };
  if (!started.ok || typeof location !== "string") throw new Error(`the Stripe plugin answered ${started.status} to a Checkout`);
  return seeOther(location, cookies);
}

/** Answer one billing route. */
export async function answerBilling(request: Request, route: BillingRoute, context: BillingContext): Promise<Response> {
  const url = new URL(request.url);
  const methods = route.kind === "checkout" ? ["GET", "POST"] : route.kind === "portal" ? ["POST"] : ["GET"];
  if (!methods.includes(request.method)) return text(405, `${methods.join(" or ")} only.`, new Headers({ allow: methods.join(", ") }));
  if (request.method === "POST" && request.headers.get("origin") !== url.origin) return text(403, "This form must come from this site.");

  const ready = readyOf(context);
  if (!("billing" in ready)) {
    log.error("billing is off", { route: route.kind, missing: ready });
    return text(503, "Billing is not available.");
  }

  try {
    if (route.kind === "checkout-return") {
      const back = `${url.origin}${CHECKOUT_RETURN_PATH}${url.search}`;
      return await authFor(url, ready).handler(new Request(back, { headers: request.headers }));
    }
    const session = await sessionOf(request, ready);

    if (route.kind === "checkout" && request.method === "GET") {
      // The first page after a sign-in that kept a plan. Signed out, the plan
      // waits for the sign-in; signed in, it is used once, whatever happens next.
      if (session === undefined) return seeOther(SIGN_IN_PAGE);
      const cleared = [clearedCookie(CHOSEN_PLAN_COOKIE)];
      const plan = stripePlanOf(readCookie(request.headers.get("cookie"), CHOSEN_PLAN_COOKIE));
      if (plan === undefined) return seeOther(PRICING, cleared);
      return await toCheckout(url, ready, session, plan, cleared);
    }

    const form = await formOf(request);
    if (form === undefined) return text(400, "This form could not be read.");
    const expired = async (signedIn: Session) => !(await csrfMatches(signedIn.cookie, field(form, CSRF_FIELD)));
    const EXPIRED = "This form has expired. Reload the page and try again.";

    if (route.kind === "portal") {
      if (session === undefined) return seeOther(SIGN_IN_PAGE);
      if (await expired(session)) return text(403, EXPIRED);
      return await toPortal(url, ready, session);
    }
    const plan = stripePlanOf(field(form, PLAN_FIELD));
    if (plan === undefined) return text(400, "Choose Starter or Pro.");
    if (session === undefined) return seeOther(SIGN_IN_PAGE, [cookie(CHOSEN_PLAN_COOKIE, plan, CHOSEN_PLAN_SECONDS)]);
    if (await expired(session)) return text(403, EXPIRED);
    return await toCheckout(url, ready, session, plan);
  } catch (failure) {
    // Stripe's, the plugin's or the database's message stays in the log.
    log.error("billing failed", { route: route.kind }, failure);
    return text(503, "Billing could not be reached. Try again later.");
  }
}

/** Answer the billing routes here, and hand every other request to the app. */
export function withBilling<E extends BillingBindings>(
  app: FetchHandler<E>,
  contextOf: (env: E) => BillingContext = liveBillingContext,
): FetchHandler<E> {
  return (request, env, ctx) => {
    const route = billingRouteOf(new URL(request.url));
    return route === undefined ? app(request, env, ctx) : answerBilling(request, route, contextOf(env));
  };
}
