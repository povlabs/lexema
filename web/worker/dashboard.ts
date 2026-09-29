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
// session's CSRF token in the form's `csrf` field (src/accounts/sessions.ts).
// A request that fails any of those is refused before anything changes. Like
// the sign-in routes (worker/signIn.ts), they sit under the developer-site
// segment that worker/hosts.ts answers with a 404 on every other host.
//
// Every action answers one `ActionAnswer` in JSON (app/dashboardActions.ts):
// the page sends each with fetch from its dialogs and key rows, and changes in
// place (#187). A new key's secret is in the create answer alone, shown once
// in the create dialog (board 28e), and never stored on the server. A create
// form the server refuses (Only some with nothing ticked, an expiry the dialog
// does not offer, a name too long) is answered 400 with each problem by its
// field, and no key is made.
//
// The dashboard page is for a signed-in developer only: without a session it
// answers 303 to sign-in.

import { deleteAccount } from "@lexema/accounts/accounts.ts";
import { csrfMatches, csrfToken, sessionAccount } from "@lexema/accounts/sessions.ts";
import { createAccountKey, listAccountKeys, revokeAccountKey } from "@lexema/api/ownedKeys.ts";
import { fromD1, type TransactionalDatabase } from "@lexema/lookup/database.ts";
import { accessOf, defaultKeyName, draftOf, readDraft } from "../app/createKeyForm.ts";
import { CSRF_FIELD, DASHBOARD, DELETE_CONFIRM_FIELD, DELETE_CONFIRMATION, UNREACHABLE, type ActionAnswer } from "../app/dashboardActions.ts";
import { keyRowOf } from "../app/dashboardView.ts";
import { DEVELOPERS_SEGMENT } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";
import { AFTER_SIGN_OUT, clearedCookie, readCookie, SESSION_COOKIE, signedInAccount } from "./signIn.ts";

export { CSRF_FIELD, DASHBOARD, DELETE_CONFIRMATION } from "../app/dashboardActions.ts";
export { defaultKeyName } from "../app/createKeyForm.ts";

/** Where a visitor without a session is sent. */
export const SIGN_IN_PAGE = "/sign-in";
/** The signed-in page a developer-site URL names: the dashboard, or none. */
const isDashboardPage = (url: URL): boolean => url.pathname === `/${DEVELOPERS_SEGMENT}${DASHBOARD}`;

/** A dashboard action, read off the path the App Router would see. */
export type DashboardRoute =
  | { kind: "create-key" }
  | { kind: "revoke-key"; keyId: number }
  | { kind: "delete-account" };

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

/** The bindings the actions read: the database. */
export interface DashboardBindings {
  DB?: D1Database;
}

/** What the actions run against; the Worker's, or a test's. */
export interface DashboardContext {
  db: TransactionalDatabase | undefined;
  now: number;
}

/** The context the live Worker runs with. */
export function liveDashboardContext(env: DashboardBindings): DashboardContext {
  return { db: env.DB === undefined ? undefined : fromD1(env.DB), now: Date.now() };
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
    const db = context.db;
    if (db === undefined) throw new Error("no D1 binding: this Worker has no DB");
    const session = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
    const accountId = await sessionAccount(db, session, context.now);
    if (session === undefined || accountId === undefined) return refuse(401, "Sign in first.");
    const form = await formOf(request);
    if (form === undefined || !(await csrfMatches(session, field(form, CSRF_FIELD)))) {
      return refuse(403, "This form has expired. Reload the page and try again.");
    }

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
        await deleteAccount(db, accountId, context.now);
        return json(200, { outcome: "signed-out", location: AFTER_SIGN_OUT }, [clearedCookie(SESSION_COOKIE)]);
      }
    }
  } catch (failure) {
    // The database's message stays in the log. Nothing is half done: each
    // action is one statement, and account deletion one transaction.
    console.error("dashboard action failed", { route: route.kind }, failure);
    return refuse(503, UNREACHABLE);
  }
}

/** Open the dashboard: sign-in without a session. */
export async function openDashboardPage<E>(request: Request, context: DashboardContext, app: FetchHandler<E>, env: E, ctx: ExecutionContext): Promise<Response> {
  let accountId: number | undefined;
  try {
    if (context.db === undefined) throw new Error("no D1 binding: this Worker has no DB");
    accountId = await signedInAccount(request.headers.get("cookie"), context.db, context.now);
  } catch (failure) {
    console.error("dashboard page failed", failure);
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
