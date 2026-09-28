// The dashboard's actions on developers.lexema.fyi (#168): make a key, revoke
// one, and delete the account.
//
// The routes, on the developer site's host only, each a form POST:
//
//   POST /dashboard/keys               make a key named by the form's `name`, or
//                                      without one `Key 1`, `Key 2`, … (#169)
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
// A new key's secret is shown once (#169). The POST that made it answers 303
// to the key-created page (the dashboard with board 29's dialog over it), with
// the secret in a one-shot cookie that lives a
// minute. The GET that follows moves the secret into a header only this module
// sets, hands the page to the App Router, and clears the cookie in the same
// response; any copy of that header a client sends is removed from every
// request. Reloading the page then finds no secret and lands on the dashboard,
// and reloading never posts the form again, so it never makes a second key.
// The secret is never stored on the server.
//
// The two dashboard pages, `/dashboard` and the key-created page, are for a
// signed-in developer only: without a session, both answer 303 to sign-in.

import { deleteAccount } from "@lexema/accounts/accounts.ts";
import { csrfMatches, csrfToken, sessionAccount } from "@lexema/accounts/sessions.ts";
import { createAccountKey, keyName, listAccountKeys, revokeAccountKey, type KeyName } from "@lexema/api/ownedKeys.ts";
import { fromD1, type TransactionalDatabase } from "@lexema/lookup/database.ts";
import { DEVELOPERS_SEGMENT } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";
import { AFTER_SIGN_OUT, clearedCookie, cookie, readCookie, SESSION_COOKIE, signedInAccount } from "./signIn.ts";

/** Where the dashboard lives, and where a revocation lands. */
export const DASHBOARD = "/dashboard";
/** The page that shows a new key's secret, once. */
export const KEY_CREATED = "/dashboard/key-created";
/** Where a visitor without a session is sent. */
export const SIGN_IN_PAGE = "/sign-in";
/** The one-shot cookie carrying a new key from its POST to the key-created page: `<key id>.<secret>`. */
export const NEW_KEY_COOKIE = "__Host-lexema-new-key";
/** How long the new key's cookie lives if the page is never opened. */
const NEW_KEY_SECONDS = 60;
/** What `/dashboard?confirm=` says to open the delete confirmation (board 30) without a script. */
export const CONFIRM_DELETE_PARAM = "confirm";
export const CONFIRM_DELETE_VALUE = "delete";
/** The dashboard with the delete confirmation open. */
export const CONFIRM_DELETE_PAGE = `${DASHBOARD}?${CONFIRM_DELETE_PARAM}=${CONFIRM_DELETE_VALUE}`;

/**
 * The name a key made from board 28's lone Create key button gets: `Key 1`,
 * then `Key 2`, counting every key the account has made, revoked ones too, so
 * a name is never handed out twice.
 */
export function defaultKeyName(made: number): KeyName {
  const name = keyName(`Key ${made + 1}`);
  if (name === undefined) throw new Error("a default key name is always a valid name");
  return name;
}

/** The form field carrying the session's CSRF token. */
export const CSRF_FIELD = "csrf";
/** What the delete form's `confirm` field must say for the account to be deleted. */
export const DELETE_CONFIRMATION = "delete-account";

/**
 * Set on the key-created page's request, and only by this module:
 * `<key id>.<secret>`. `newKeyOf` reads it back.
 */
export const NEW_KEY_HEADER = "x-lexema-new-key";

/** A signed-in page, read off the path the App Router would see. */
export type DashboardPage = "dashboard" | "key-created";

/** The signed-in page a developer-site URL names, or none. */
export function dashboardPageOf(url: URL): DashboardPage | undefined {
  switch (url.pathname) {
    case `/${DEVELOPERS_SEGMENT}${DASHBOARD}`:
      return "dashboard";
    case `/${DEVELOPERS_SEGMENT}${KEY_CREATED}`:
      return "key-created";
    default:
      return undefined;
  }
}

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

const NEW_KEY = /^([1-9][0-9]{0,14})\.(lx_[0-9a-f]{64})$/;

/** A new key as `NEW_KEY_HEADER` and `NEW_KEY_COOKIE` carry it, or `undefined`. */
function parseNewKey(value: string | null | undefined): { keyId: number; key: string } | undefined {
  const match = NEW_KEY.exec(value ?? "");
  return match === null ? undefined : { keyId: Number(match[1]), key: match[2] };
}

/** The new key a key-created request carries, or `undefined` on any other request. */
export function newKeyOf(headers: Headers): { keyId: number; key: string } | undefined {
  return parseNewKey(headers.get(NEW_KEY_HEADER));
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

/** Answer one dashboard action. */
export async function answerDashboard(request: Request, route: DashboardRoute, context: DashboardContext): Promise<Response> {
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
        const given = field(form, "name");
        const name = given === undefined ? defaultKeyName((await listAccountKeys(db, accountId)).length) : keyName(given);
        if (name === undefined) return text(400, "A key needs a name of 1 to 200 characters.");
        const created = await createAccountKey(db, accountId, name, context.now);
        if (created.outcome === "refused") return text(401, "Sign in first.");
        return seeOther(KEY_CREATED, [cookie(NEW_KEY_COOKIE, `${created.keyId}.${created.key}`, NEW_KEY_SECONDS)]);
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

/**
 * Open a signed-in page: sign-in without a session; the key-created page only
 * with the key its cookie carries, which is handed on once and cleared.
 */
export async function openDashboardPage<E>(
  request: Request,
  page: DashboardPage,
  context: DashboardContext,
  app: FetchHandler<E>,
  env: E,
  ctx: ExecutionContext,
): Promise<Response> {
  const cookies = request.headers.get("cookie");
  let accountId: number | undefined;
  try {
    if (context.db === undefined) throw new Error("no D1 binding: this Worker has no DB");
    accountId = await signedInAccount(cookies, context.db, context.now);
  } catch (failure) {
    console.error("dashboard page failed", { page }, failure);
    return text(503, "The dashboard could not be opened. Try again later.");
  }
  if (accountId === undefined) return seeOther(SIGN_IN_PAGE);

  let handed = request;
  if (page === "key-created") {
    const created = parseNewKey(readCookie(cookies, NEW_KEY_COOKIE));
    if (created === undefined) return seeOther(DASHBOARD);
    const headers = new Headers(request.headers);
    headers.set(NEW_KEY_HEADER, `${created.keyId}.${created.key}`);
    handed = new Request(request, { headers });
  }
  const shown = await app(handed, env, ctx);
  // A signed-in page carries the session's CSRF token, and the key-created
  // page the secret: neither is kept by a cache, and the secret's cookie goes.
  const answer = new Headers(shown.headers);
  answer.set("cache-control", "no-store");
  if (page === "key-created") answer.append("set-cookie", clearedCookie(NEW_KEY_COOKIE));
  return new Response(shown.body, { status: shown.status, statusText: shown.statusText, headers: answer });
}

/** Answer the dashboard actions and guard its pages here, and hand every other request to the app. */
export function withDashboard<E extends DashboardBindings>(
  app: FetchHandler<E>,
  contextOf: (env: E) => DashboardContext = liveDashboardContext,
): FetchHandler<E> {
  return (request, env, ctx) => {
    const clean = withoutNewKey(request);
    const url = new URL(clean.url);
    const route = dashboardRouteOf(url);
    if (route !== undefined) return answerDashboard(clean, route, contextOf(env));
    const page = clean.method === "GET" || clean.method === "HEAD" ? dashboardPageOf(url) : undefined;
    return page === undefined ? app(clean, env, ctx) : openDashboardPage(clean, page, contextOf(env), app, env, ctx);
  };
}
