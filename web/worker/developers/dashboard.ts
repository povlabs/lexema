// The dashboard's actions on developers.lexema.fyi (#168): make a key, revoke
// one, and delete the account.
//
// The routes, on the developer site's host only, each a form POST:
//
//   POST /dashboard/keys               make a key named by the form's `name`, or,
//                                      when it is absent or blank, `Key 1`,
//                                      `Key 2`, … (#169, #187); limited to the
//                                      ticked `endpoint`s when `endpoints` is
//                                      `some`, and expiring after `expires`
//   POST /dashboard/keys/<id>/revoke   revoke one of the account's keys
//   POST /dashboard/account/delete     delete the account; the form must carry
//                                      `confirm=delete-account`
//
// Every one needs a signed-in session, an `Origin` that is this site, and the
// session's CSRF token in the form's `csrf` field (src/accounts/csrf.ts).
// A request that fails any of those is refused before anything changes. Like
// the sign-in routes (worker/developers/signIn.ts), they sit under the developer-site
// segment that worker/shared/hosts.ts answers with a 404 on every other host.
//
// Every action answers one `ActionAnswer` in JSON (lib/developers/dashboardActions.ts):
// the page sends each with fetch from its dialogs and key rows, and changes in
// place (#187). A new key's secret is in the create answer alone, shown once
// in the create dialog (board 28e), and never stored on the server. A create
// form the server refuses (Only some with nothing ticked, an expiry the dialog
// does not offer, a name too long) is answered 400 with each problem by its
// field, and no key is made.
//
// Deleting the account first cancels every Stripe subscription that may still
// bill it, at once (#209, src/billing/subscriptionCancel.ts). When Stripe fails,
// or billing is off while such a subscription exists, nothing is deleted and
// the developer is asked to try again later; the cause stays in the log.
// The first deletion then emails the person through `EMAIL`, the `send_email`
// binding (#215); a failed email changes nothing.
//
// The dashboard and its settings page (#190) are for a signed-in developer
// only: without a session each answers 303 to sign-in.
//
// A suspended account (#573, src/accounts/suspension.ts) may still delete
// itself here, and every other action is refused 403 before it runs, whatever
// the page shows.

import { deleteAccount } from "@lexema/accounts/accounts.ts";
import { accountSuspension } from "@lexema/accounts/suspension.ts";
import { billingOf, type BillingSetup, type StripeSettings } from "@lexema/accounts/billing.ts";
import { csrfMatches, csrfToken } from "@lexema/accounts/csrf.ts";
import { createAccountKey, listAccountKeys, revokeAccountKey } from "@lexema/api/ownedKeys.ts";
import { appTablesOverD1, type AppTables } from "@lexema/db/app/database.ts";
import { accountMailOf, workerEmailOf, type EmailBinding } from "@lexema/email/send.ts";
import { log } from "@lexema/log/requestLog.ts";
import { accessOf, defaultKeyName, draftOf, readDraft } from "@/lib/developers/createKeyForm.ts";
import { CSRF_FIELD, DASHBOARD, DELETE_CONFIRM_FIELD, DELETE_CONFIRMATION, SETTINGS, SUSPENDED, UNREACHABLE, type ActionAnswer } from "@/lib/developers/dashboardActions.ts";
import { keyRowOf } from "@/lib/developers/dashboardView.ts";
import { DEVELOPERS_SEGMENT, originsOf } from "../shared/hosts.ts";
import type { FetchHandler } from "../shared/fetchHandler.ts";
import { AFTER_SIGN_OUT, clearedCookie, readCookie, SESSION_COOKIE, signedInAccount } from "./signIn.ts";

export { CSRF_FIELD, DASHBOARD, DELETE_CONFIRMATION, SETTINGS } from "@/lib/developers/dashboardActions.ts";
export { defaultKeyName } from "@/lib/developers/createKeyForm.ts";

/** Where a visitor without a session is sent. */
export const SIGN_IN_PAGE = "/sign-in";
/** The signed-in pages, as the App Router sees their paths. */
const SIGNED_IN_PAGES: readonly string[] = [DASHBOARD, SETTINGS].map((path) => `/${DEVELOPERS_SEGMENT}${path}`);
/** Whether a developer-site URL names a signed-in page: the dashboard or its settings. */
const isDashboardPage = (url: URL): boolean => SIGNED_IN_PAGES.includes(url.pathname);

/** A dashboard action, read off the path the App Router would see. */
export type DashboardRoute =
  | { kind: "create-key" }
  | { kind: "revoke-key"; keyId: number }
  | { kind: "delete-account" };

/** Whether a suspended account may take this action: deleting itself, and nothing else. */
const openWhileSuspended = (route: DashboardRoute): boolean => route.kind === "delete-account";

const KEY_ID = /^[1-9][0-9]{0,14}$/;

/** The dashboard action a developer-site URL names, or none. */
export function dashboardRouteOf(url: URL): DashboardRoute | undefined {
  const [segment, dashboard, ...rest] = url.pathname.split("/").slice(1);
  if (segment !== DEVELOPERS_SEGMENT || dashboard !== "dashboard") return undefined;
  const [first, second, third, ...more] = rest;
  if (more.length > 0) return undefined;
  if (first === "keys" && second === undefined) return { kind: "create-key" };
  if (first === "keys" && second !== undefined && KEY_ID.test(second) && third === "revoke") {
    return { kind: "revoke-key", keyId: Number(second) };
  }
  if (first === "account" && second === "delete" && third === undefined) return { kind: "delete-account" };
  return undefined;
}

/** The bindings the actions read: the app database, the Stripe settings and the email binding. */
export interface DashboardBindings extends StripeSettings {
  APP_DB?: D1Database;
  EMAIL?: EmailBinding;
  /** The one address `EMAIL` may send to, on a Preview; empty elsewhere (`workerEmailOf`). */
  EMAIL_ONLY_TO?: string;
}

/** What the actions run against; the Worker's, or a test's. */
export interface DashboardContext {
  /** The app database, where accounts and keys live. */
  appDb: AppTables | undefined;
  /** Stripe, which deleting an account cancels its subscriptions through, or the settings that keep it off. */
  billing: BillingSetup;
  /** Where the account-deleted email goes out; none is sent without it. */
  email?: EmailBinding;
  now: number;
}

/** The context the live Worker runs with. */
export function liveDashboardContext(env: DashboardBindings): DashboardContext {
  return { appDb: env.APP_DB === undefined ? undefined : appTablesOverD1(env.APP_DB), billing: billingOf(env), email: workerEmailOf(env.EMAIL, env.EMAIL_ONLY_TO), now: Date.now() };
}

/** The CSRF token a signed-in page puts in its forms, or `undefined` without a session cookie. */
export function csrfTokenOf(cookieHeader: string | null): Promise<string | undefined> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  return token === undefined ? Promise.resolve(undefined) : csrfToken(token);
}

function text(status: number, body: string, headers: Headers = new Headers()): Response {
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(body, { status, headers });
}

function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store" } });
}

function json(status: number, body: ActionAnswer, cookies: string[] = []): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const value of cookies) headers.append("set-cookie", value);
  return Response.json(body, { status, headers });
}

/** Nothing changed, and why. */
const refuse = (status: number, message: string): Response => json(status, { outcome: "refused", message });

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

/** Answer one dashboard action. */
export async function answerDashboard(request: Request, route: DashboardRoute, context: DashboardContext): Promise<Response> {
  if (request.method !== "POST") return text(405, "POST only.", new Headers({ allow: "POST" }));
  const url = new URL(request.url);
  // A cross-site form would carry the session cookie on no request here
  // (SameSite=Lax), but the check does not lean on that.
  if (request.headers.get("origin") !== url.origin) return refuse(403, "This action must come from this site.");

  try {
    const db = context.appDb;
    if (db === undefined) throw new Error("no D1 binding: this Worker has no APP_DB");
    const cookies = request.headers.get("cookie");
    const session = readCookie(cookies, SESSION_COOKIE);
    const accountId = await signedInAccount(cookies, db, context.now, originsOf(url.hostname));
    if (session === undefined || accountId === undefined) return refuse(401, "Sign in first.");
    const form = await formOf(request);
    if (form === undefined || !(await csrfMatches(session, field(form, CSRF_FIELD)))) {
      return refuse(403, "This form has expired. Reload the page and try again.");
    }
    if (!openWhileSuspended(route) && (await accountSuspension(db, accountId)) !== undefined) return refuse(403, SUSPENDED);

    switch (route.kind) {
      case "create-key": {
        const draft = draftOf(form);
        const reading = readDraft(draft);
        if (!reading.ok) return json(400, { outcome: "refused-form", problems: reading.problems });
        const asked = reading.request;
        const name = asked.name.kind === "typed" ? asked.name.name : defaultKeyName((await listAccountKeys(db, accountId)).length);
        const access = accessOf(asked, context.now);
        const created = await createAccountKey(db, accountId, name, context.now, access);
        if (created.outcome === "refused") return refuse(401, "Sign in first.");
        const key = keyRowOf(
          {
            keyId: created.keyId,
            name,
            displayPrefix: created.displayPrefix,
            createdAt: new Date(context.now).toISOString(),
            lastUsedAt: null,
            revokedAt: null,
            ...access,
          },
          context.now,
        );
        return json(201, { outcome: "created", key, secret: created.key });
      }
      case "revoke-key": {
        const revoked = await revokeAccountKey(db, accountId, route.keyId, context.now);
        if (revoked === "not-yours") return refuse(404, "No such key.");
        return json(200, { outcome: "revoked", keyId: route.keyId });
      }
      case "delete-account": {
        if (field(form, DELETE_CONFIRM_FIELD) !== DELETE_CONFIRMATION) return refuse(400, "Confirm the deletion first.");
        const stripe = context.billing.outcome === "ready" ? context.billing.billing.stripe.subscriptions : undefined;
        const deleted = await deleteAccount(db, accountId, context.now, stripe, accountMailOf(context.email, { developers: url.origin, lexema: originsOf(url.hostname).lexema }));
        if (deleted.outcome === "billing-off") {
          const missing = context.billing.outcome === "missing" ? context.billing.missing : [];
          log.error("account not deleted: billing is off and a subscription may still bill", { accountId, billable: deleted.billable, missing });
          return refuse(503, UNREACHABLE);
        }
        return json(200, { outcome: "signed-out", location: AFTER_SIGN_OUT }, [clearedCookie(SESSION_COOKIE)]);
      }
    }
  } catch (failure) {
    // Stripe's or the database's message stays in the log. Nothing is half
    // done: each action is one statement, and account deletion one
    // transaction after its subscriptions are cancelled.
    log.error("dashboard action failed", { route: route.kind }, failure);
    return refuse(503, UNREACHABLE);
  }
}

/** Open the dashboard or its settings: sign-in without a session. */
export async function openDashboardPage<E>(request: Request, context: DashboardContext, app: FetchHandler<E>, env: E, ctx: ExecutionContext): Promise<Response> {
  let accountId: number | undefined;
  try {
    if (context.appDb === undefined) throw new Error("no D1 binding: this Worker has no APP_DB");
    accountId = await signedInAccount(request.headers.get("cookie"), context.appDb, context.now, originsOf(new URL(request.url).hostname));
  } catch (failure) {
    log.error("dashboard page failed", {}, failure);
    return text(503, "The dashboard could not be opened. Try again later.");
  }
  if (accountId === undefined) return seeOther(SIGN_IN_PAGE);
  const shown = await app(request, env, ctx);
  // A signed-in page carries the session's CSRF token: no cache keeps it.
  const answer = new Headers(shown.headers);
  answer.set("cache-control", "no-store");
  return new Response(shown.body, { status: shown.status, statusText: shown.statusText, headers: answer });
}

/** Answer the dashboard actions and guard its page here, and hand every other request to the app. */
export function withDashboard<E extends DashboardBindings>(
  app: FetchHandler<E>,
  contextOf: (env: E) => DashboardContext = liveDashboardContext,
): FetchHandler<E> {
  return (request, env, ctx) => {
    const url = new URL(request.url);
    const route = dashboardRouteOf(url);
    if (route !== undefined) return answerDashboard(request, route, contextOf(env));
    const page = (request.method === "GET" || request.method === "HEAD") && isDashboardPage(url);
    return page ? openDashboardPage(request, contextOf(env), app, env, ctx) : app(request, env, ctx);
  };
}
