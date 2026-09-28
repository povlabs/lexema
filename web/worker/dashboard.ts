// The dashboard's actions on developers.lexema.fyi (#168): make a named key,
// revoke one, and delete the account.
//
// The routes, on the developer site's host only, each a form POST:
//
//   POST /dashboard/keys               make a key named by the form's `name`
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
// A new key's secret is shown once. The request that made it is handed to the
// App Router as a GET for the key-created page, with the secret in a header
// only this module sets; any copy a client sends is removed from every request.
// The secret is not stored, and a later request for that page carries none.

import { deleteAccount } from "@lexema/accounts/accounts.ts";
import { csrfMatches, csrfToken, sessionAccount } from "@lexema/accounts/sessions.ts";
import { createAccountKey, keyName, revokeAccountKey } from "@lexema/api/ownedKeys.ts";
import { fromD1, type TransactionalDatabase } from "@lexema/lookup/database.ts";
import { DEVELOPERS_SEGMENT } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";
import { AFTER_SIGN_OUT, clearedCookie, readCookie, SESSION_COOKIE } from "./signIn.ts";

/** Where the dashboard lives, and where a revocation lands. */
export const DASHBOARD = "/dashboard";
/** The page that shows a new key's secret, once. */
export const KEY_CREATED = "/dashboard/key-created";
/** The form field carrying the session's CSRF token. */
export const CSRF_FIELD = "csrf";
/** What the delete form's `confirm` field must say for the account to be deleted. */
export const DELETE_CONFIRMATION = "delete-account";

/**
 * Set on the key-created page's request, and only by this module:
 * `<key id>.<secret>`. `newKeyOf` reads it back.
 */
export const NEW_KEY_HEADER = "x-lexema-new-key";

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

/** The new key a key-created request carries, or `undefined` on any other request. */
export function newKeyOf(headers: Headers): { keyId: number; key: string } | undefined {
  const match = /^([1-9][0-9]{0,14})\.(lx_[0-9a-f]{64})$/.exec(headers.get(NEW_KEY_HEADER) ?? "");
  return match === null ? undefined : { keyId: Number(match[1]), key: match[2] };
}

function text(status: number, body: string, headers: Headers = new Headers()): Response {
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(body, { status, headers });
}

function seeOther(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const value of cookies) headers.append("set-cookie", value);
  return new Response(null, { status: 303, headers });
}

/** The request without any client-sent copy of `NEW_KEY_HEADER`. */
function withoutNewKey(request: Request): Request {
  if (!request.headers.has(NEW_KEY_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.delete(NEW_KEY_HEADER);
  return new Request(request, { headers });
}

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

/** Answer one dashboard action; `app` renders the key-created page. */
export async function answerDashboard<E>(
  request: Request,
  route: DashboardRoute,
  context: DashboardContext,
  app: FetchHandler<E>,
  env: E,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "POST") return text(405, "POST only.", new Headers({ allow: "POST" }));
  const url = new URL(request.url);
  // A cross-site form would carry the session cookie on no request here
  // (SameSite=Lax), but the check does not lean on that.
  if (request.headers.get("origin") !== url.origin) return text(403, "This action must come from this site.");

  try {
    const db = context.db;
    if (db === undefined) throw new Error("no D1 binding: this Worker has no DB");
    const session = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
    const accountId = await sessionAccount(db, session, context.now);
    if (session === undefined || accountId === undefined) return text(401, "Sign in first.");
    const form = await formOf(request);
    if (form === undefined || !(await csrfMatches(session, field(form, CSRF_FIELD)))) {
      return text(403, "This form has expired. Reload the page and try again.");
    }

    switch (route.kind) {
      case "create-key": {
        const name = keyName(field(form, "name") ?? "");
        if (name === undefined) return text(400, "A key needs a name of 1 to 200 characters.");
        const created = await createAccountKey(db, accountId, name, context.now);
        if (created.outcome === "refused") return text(401, "Sign in first.");
        const headers = new Headers(request.headers);
        headers.set(NEW_KEY_HEADER, `${created.keyId}.${created.key}`);
        headers.delete("content-type");
        headers.delete("content-length");
        const page = await app(
          new Request(new URL(`/${DEVELOPERS_SEGMENT}${KEY_CREATED}`, url), { method: "GET", headers }),
          env,
          ctx,
        );
        // The secret is in this response only: never kept by a cache.
        const answer = new Headers(page.headers);
        answer.set("cache-control", "no-store");
        return new Response(page.body, { status: page.status, statusText: page.statusText, headers: answer });
      }
      case "revoke-key": {
        const revoked = await revokeAccountKey(db, accountId, route.keyId, context.now);
        return revoked === "not-yours" ? text(404, "No such key.") : seeOther(DASHBOARD);
      }
      case "delete-account": {
        if (field(form, "confirm") !== DELETE_CONFIRMATION) return text(400, "Confirm the deletion first.");
        await deleteAccount(db, accountId, context.now);
        return seeOther(AFTER_SIGN_OUT, [clearedCookie(SESSION_COOKIE)]);
      }
    }
  } catch (failure) {
    // The database's message stays in the log. Nothing is half done: each
    // action is one statement, and account deletion one transaction.
    console.error("dashboard action failed", { route: route.kind }, failure);
    return text(503, "That could not be done. Try again later.");
  }
}

/** Answer the dashboard actions here, and hand every other request to the app. */
export function withDashboard<E extends DashboardBindings>(
  app: FetchHandler<E>,
  contextOf: (env: E) => DashboardContext = liveDashboardContext,
): FetchHandler<E> {
  return (request, env, ctx) => {
    const clean = withoutNewKey(request);
    const route = dashboardRouteOf(new URL(clean.url));
    return route === undefined ? app(clean, env, ctx) : answerDashboard(clean, route, contextOf(env), app, env, ctx);
  };
}
