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
// That is the plain form's answer, the page with no script. A create form the
// server refuses (Only some with nothing ticked, an expiry the dialog does not
// offer, a name too long) is answered 400 with the whole dashboard, its
// create-key dialog drawn open again with what was sent and the reason under
// the field at fault; the draft reaches the page in another header only this
// module sets. With a script, the page sends the same forms asking for JSON
// (app/dashboardActions.ts) and changes in place: the same session, Origin,
// CSRF and key-creation checks run, and only the answer's shape differs.
//
// The two dashboard pages, `/dashboard` and the key-created page, are for a
// signed-in developer only: without a session, both answer 303 to sign-in.

import { deleteAccount } from "@lexema/accounts/accounts.ts";
import { csrfMatches, csrfToken, sessionAccount } from "@lexema/accounts/sessions.ts";
import { createAccountKey, listAccountKeys, revokeAccountKey } from "@lexema/api/ownedKeys.ts";
import { fromD1, type TransactionalDatabase } from "@lexema/lookup/database.ts";
import { accessOf, defaultKeyName, draftFields, draftOf, readDraft, type CreateKeyDraft } from "../app/createKeyForm.ts";
import {
  CONFIRM_DELETE_PARAM,
  CONFIRM_DELETE_VALUE,
  CREATE_KEY_PAGE,
  CREATE_KEY_PARAM,
  CREATE_KEY_VALUE,
  CSRF_FIELD,
  DASHBOARD,
  DELETE_CONFIRM_FIELD,
  DELETE_CONFIRMATION,
  JSON_ANSWER,
  KEY_CREATED,
  type ActionAnswer,
} from "../app/dashboardActions.ts";
import { keyRowOf } from "../app/dashboardView.ts";
import { DEVELOPERS_SEGMENT } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";
import { AFTER_SIGN_OUT, clearedCookie, cookie, readCookie, SESSION_COOKIE, signedInAccount } from "./signIn.ts";

export {
  CONFIRM_DELETE_PAGE,
  CREATE_KEY_PAGE,
  CSRF_FIELD,
  DASHBOARD,
  DELETE_CONFIRMATION,
  KEY_CREATED,
} from "../app/dashboardActions.ts";
export { defaultKeyName } from "../app/createKeyForm.ts";

/** Where a visitor without a session is sent. */
export const SIGN_IN_PAGE = "/sign-in";
/** The one-shot cookie carrying a new key from its POST to the key-created page: `<key id>.<secret>`. */
export const NEW_KEY_COOKIE = "__Host-lexema-new-key";
/** How long the new key's cookie lives if the page is never opened. */
const NEW_KEY_SECONDS = 60;

/** The dialog a dashboard address asks the server to draw open, if any. */
export type DashboardDialogRequest = "confirm-delete" | "create-key";

/** The dialog `/dashboard`'s query opens: `?confirm=delete` or `?create=key`, else none. */
export function requestedDialog(query: Record<string, string | string[] | undefined>): DashboardDialogRequest | undefined {
  if (query[CONFIRM_DELETE_PARAM] === CONFIRM_DELETE_VALUE) return "confirm-delete";
  if (query[CREATE_KEY_PARAM] === CREATE_KEY_VALUE) return "create-key";
  return undefined;
}

/**
 * Set on the request for the dashboard drawn again under a refused create
 * form, and only by this module: the form's draft as form fields
 * (`draftFields`). `createKeyDraftOf` reads it back.
 */
export const CREATE_KEY_DRAFT_HEADER = "x-lexema-create-key-draft";

/** The refused draft a redrawn dashboard request carries, or `undefined` on any other request. */
export function createKeyDraftOf(headers: Headers): CreateKeyDraft | undefined {
  const fields = headers.get(CREATE_KEY_DRAFT_HEADER);
  return fields === null ? undefined : draftOf(new URLSearchParams(fields));
}

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

function json(status: number, body: ActionAnswer, cookies: string[] = []): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const value of cookies) headers.append("set-cookie", value);
  return Response.json(body, { status, headers });
}

/** How an action is answered: as a page, for a plain form, or with an `ActionAnswer`, for a script that asked for JSON. */
type Answering = "page" | "json";

const answeringOf = (request: Request): Answering => ((request.headers.get("accept") ?? "").includes(JSON_ANSWER) ? "json" : "page");

/** Nothing changed, and why: the sentence alone for a plain form, as a `refused` answer for a script. */
const refuse = (answering: Answering, status: number, message: string): Response =>
  answering === "page" ? text(status, message) : json(status, { outcome: "refused", message });

/** The headers only this module sets, which no client may send. */
const INTERNAL_HEADERS = [NEW_KEY_HEADER, CREATE_KEY_DRAFT_HEADER];

/** The request without any client-sent copy of an internal header. */
function withoutInternalHeaders(request: Request): Request {
  if (!INTERNAL_HEADERS.some((name) => request.headers.has(name))) return request;
  const headers = new Headers(request.headers);
  for (const name of INTERNAL_HEADERS) headers.delete(name);
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

/** Renders a page of the app, for an action whose answer is the dashboard itself. */
export type PageRenderer = (request: Request) => Promise<Response>;

/**
 * A plain create form the server refused: the dashboard with the create-key
 * dialog drawn open again (as at `/dashboard?create=key`), holding what was
 * sent and each problem under its field, answered 400.
 */
async function redrawCreateKey(request: Request, draft: CreateKeyDraft, render: PageRenderer): Promise<Response> {
  const headers = new Headers(request.headers);
  for (const name of ["content-type", "content-length"]) headers.delete(name);
  headers.set(CREATE_KEY_DRAFT_HEADER, draftFields(draft).toString());
  const page = await render(new Request(new URL(`/${DEVELOPERS_SEGMENT}${CREATE_KEY_PAGE}`, request.url), { method: "GET", headers }));
  const answer = new Headers(page.headers);
  answer.set("cache-control", "no-store");
  return new Response(page.body, { status: 400, statusText: "Bad Request", headers: answer });
}

/** Answer one dashboard action; `render` draws the dashboard when a refused create form is answered with it. */
export async function answerDashboard(request: Request, route: DashboardRoute, context: DashboardContext, render: PageRenderer): Promise<Response> {
  if (request.method !== "POST") return text(405, "POST only.", new Headers({ allow: "POST" }));
  const answering = answeringOf(request);
  const url = new URL(request.url);
  // A cross-site form would carry the session cookie on no request here
  // (SameSite=Lax), but the check does not lean on that.
  if (request.headers.get("origin") !== url.origin) return refuse(answering, 403, "This action must come from this site.");

  try {
    const db = context.db;
    if (db === undefined) throw new Error("no D1 binding: this Worker has no DB");
    const session = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
    const accountId = await sessionAccount(db, session, context.now);
    if (session === undefined || accountId === undefined) return refuse(answering, 401, "Sign in first.");
    const form = await formOf(request);
    if (form === undefined || !(await csrfMatches(session, field(form, CSRF_FIELD)))) {
      return refuse(answering, 403, "This form has expired. Reload the page and try again.");
    }

    switch (route.kind) {
      case "create-key": {
        const draft = draftOf(form);
        const reading = readDraft(draft);
        if (!reading.ok) {
          return answering === "json" ? json(400, { outcome: "refused-form", problems: reading.problems }) : redrawCreateKey(request, draft, render);
        }
        const asked = reading.request;
        const name = asked.name.kind === "typed" ? asked.name.name : defaultKeyName((await listAccountKeys(db, accountId)).length);
        const access = accessOf(asked, context.now);
        const created = await createAccountKey(db, accountId, name, context.now, access);
        if (created.outcome === "refused") return refuse(answering, 401, "Sign in first.");
        if (answering === "page") return seeOther(KEY_CREATED, [cookie(NEW_KEY_COOKIE, `${created.keyId}.${created.key}`, NEW_KEY_SECONDS)]);
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
        if (revoked === "not-yours") return refuse(answering, 404, "No such key.");
        return answering === "page" ? seeOther(DASHBOARD) : json(200, { outcome: "revoked", keyId: route.keyId });
      }
      case "delete-account": {
        if (field(form, DELETE_CONFIRM_FIELD) !== DELETE_CONFIRMATION) return refuse(answering, 400, "Confirm the deletion first.");
        await deleteAccount(db, accountId, context.now);
        const signedOut = [clearedCookie(SESSION_COOKIE)];
        return answering === "page" ? seeOther(AFTER_SIGN_OUT, signedOut) : json(200, { outcome: "signed-out", location: AFTER_SIGN_OUT }, signedOut);
      }
    }
  } catch (failure) {
    // The database's message stays in the log. Nothing is half done: each
    // action is one statement, and account deletion one transaction.
    console.error("dashboard action failed", { route: route.kind }, failure);
    return refuse(answering, 503, "That could not be done. Try again later.");
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
    const clean = withoutInternalHeaders(request);
    const url = new URL(clean.url);
    const route = dashboardRouteOf(url);
    if (route !== undefined) return answerDashboard(clean, route, contextOf(env), (page) => app(page, env, ctx));
    const page = clean.method === "GET" || clean.method === "HEAD" ? dashboardPageOf(url) : undefined;
    return page === undefined ? app(clean, env, ctx) : openDashboardPage(clean, page, contextOf(env), app, env, ctx);
  };
}
