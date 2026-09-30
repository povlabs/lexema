// Sign-in, sign-out and the session cookie on developers.lexema.fyi (#165),
// on better-auth (ADR 0017, #229).
//
// The routes, on the developer site's host only:
//
//   GET  /sign-in/<provider>           start: to the provider, with a pending-sign-in cookie
//   GET  /sign-in/<provider>/callback  finish: a session cookie, then /dashboard
//   POST /sign-out                     end the session and clear its cookie
//
// worker/hosts.ts rewrites the developer site onto `/developer-site/…` and
// answers that segment with a 404 on every other host, so these routes and
// their cookies never exist on `lexema.fyi` or `api.lexema.fyi`. better-auth
// is reached from here alone, through `auth.api` and `auth.handler`, never
// mounted on a path of its own. Its cookies are `__Secure-` prefixed and carry
// no `Domain`, so they are bound to this one host (src/accounts/auth.ts).
//
// The flow and the account it reaches are better-auth's, held to Lexema's
// rules in src/accounts/; this file is the wiring to requests, cookies and the
// Worker's bindings, and it answers each refusal as it did before better-auth.
// The sign-in pages read `availableProviders` and `signedInAccount`.

import {
  AUTH_PATH,
  authSecret,
  endSession,
  PENDING_COOKIE,
  SESSION_COOKIE,
  sessionAuth,
  signInAuth,
  sweepExpired,
  type SignInProvider,
} from "@lexema/accounts/auth.ts";
import {
  configuredProviders,
  isProviderId,
  PROVIDER_NAME,
  type ProviderId,
  type ProviderRegistry,
  type ProviderSettings,
} from "@lexema/accounts/providers.ts";
import { fromD1, type TransactionalDatabase } from "@lexema/lookup/database.ts";
import { DEVELOPERS_SEGMENT, googleCallbackUri, ORIGIN } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";

export { PENDING_COOKIE, SESSION_COOKIE } from "@lexema/accounts/auth.ts";

/** Where a finished sign-in lands. */
export const AFTER_SIGN_IN = "/dashboard";
/** Where a sign-out lands. */
export const AFTER_SIGN_OUT = "/";

/** A sign-in route, read off the path the App Router would see. */
export type SignInRoute =
  | { kind: "start"; provider: ProviderId }
  | { kind: "callback"; provider: ProviderId }
  | { kind: "sign-out" };

/** The sign-in route a developer-site URL names, or none. */
export function signInRouteOf(url: URL): SignInRoute | undefined {
  const [segment, action, provider, callback, ...rest] = url.pathname.split("/").slice(1);
  if (segment !== DEVELOPERS_SEGMENT || rest.length > 0) return undefined;
  if (action === "sign-out" && provider === undefined) return { kind: "sign-out" };
  if (action !== "sign-in" || provider === undefined || !isProviderId(provider)) return undefined;
  if (callback === undefined) return { kind: "start", provider };
  return callback === "callback" ? { kind: "callback", provider } : undefined;
}

/**
 * The bindings sign-in reads: the database and the providers' vars and
 * secrets. `BETTER_AUTH_SECRET` is a Worker secret too, read where the session
 * is (src/accounts/auth.ts).
 */
export interface SignInBindings extends ProviderSettings {
  DB?: D1Database;
}

/**
 * Which providers can be signed in with: those whose client id and secret are
 * both set, while `BETTER_AUTH_SECRET` is, since without it no session could
 * be signed.
 */
export function availableProviders(settings: ProviderSettings): Readonly<Record<ProviderId, boolean>> {
  const providers = configuredProviders(settings);
  const signs = authSecret() !== undefined;
  return { google: signs && providers.google !== undefined, github: signs && providers.github !== undefined };
}

/** A `Cookie` header's value for one name. */
export function readCookie(header: string | null, name: string): string | undefined {
  for (const pair of header?.split(";") ?? []) {
    const at = pair.indexOf("=");
    if (at !== -1 && pair.slice(0, at).trim() === name) return pair.slice(at + 1).trim();
  }
  return undefined;
}

/**
 * The account a request's session cookie is signed in to, or `undefined`: no
 * cookie, one better-auth did not sign or has no live session for, one that
 * has expired by `now`, or a deleted account.
 */
export async function signedInAccount(cookieHeader: string | null, db: TransactionalDatabase, now: number): Promise<number | undefined> {
  const secret = authSecret();
  if (secret === undefined || readCookie(cookieHeader, SESSION_COOKIE) === undefined) return undefined;
  const auth = sessionAuth(db.app, secret, ORIGIN.developers);
  const found = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader ?? "" }) });
  if (found === null || found.session.expiresAt.getTime() <= now || found.user.deletedAt) return undefined;
  return Number(found.user.id);
}

/** A host-only cookie: HttpOnly, Secure, SameSite=Lax, path `/`, no `Domain`. */
export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
/** A `Set-Cookie` value that removes the named cookie. */
export const clearedCookie = (name: string): string => cookie(name, "", 0);

function text(status: number, body: string, headers: Headers = new Headers()): Response {
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(body, { status, headers });
}

function redirect(location: string, cookies: readonly string[]): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const value of cookies) headers.append("set-cookie", value);
  return new Response(null, { status: 303, headers });
}

/**
 * Why a callback signs nobody in.
 *
 * - `no-pending`: the browser holds no pending sign-in (it expired, or the
 *   callback was not started here).
 * - `state`: the callback's `state` is not the pending one.
 * - `cancelled`: the provider sent back an error, such as the person declining.
 * - `refused`: the provider would not redeem the code, as for a wrong verifier.
 * - `unverified-email`: the provider vouches for no verified email.
 */
export type SignInRefusal = "no-pending" | "state" | "cancelled" | "refused" | "unverified-email";

/** What a refused callback says, and with which status. */
const REFUSAL: Readonly<Record<SignInRefusal, { status: number; body: string }>> = {
  "no-pending": { status: 400, body: "This sign-in has expired or was not started here. Start again." },
  state: { status: 400, body: "This sign-in could not be checked. Start again." },
  cancelled: { status: 400, body: "Sign-in was cancelled." },
  refused: { status: 400, body: "The provider did not confirm this sign-in. Start again." },
  "unverified-email": { status: 403, body: "Sign-in needs an email address the provider has verified." },
};

/**
 * The refusal an error from better-auth's callback is, or `undefined` for one
 * that is not a refusal but a failure (the database, or a provider that could
 * not be read), answered as one. better-auth checks the state, then the
 * provider's own `error`, then redeems the code, then reads the person, as the
 * flow before it did.
 */
function refusalOf(error: string, callback: URLSearchParams): SignInRefusal | undefined {
  if (error.startsWith("state_")) return "state";
  if (error === callback.get("error") || error === "no_code") return "cancelled";
  if (error === "invalid_code") return "refused";
  if (error === "email_not_found") return "unverified-email";
  return undefined;
}

const unavailable = (provider: ProviderId): Response =>
  text(503, `Sign-in with ${PROVIDER_NAME[provider]} is not available.`);

/** What sign-in runs against; the Worker's, or a test's. */
export interface SignInContext {
  providers: ProviderRegistry;
  db: TransactionalDatabase | undefined;
  now: number;
}

/** The context the live Worker runs with. */
export function liveContext(env: SignInBindings): SignInContext {
  return { providers: configuredProviders(env), db: env.DB === undefined ? undefined : fromD1(env.DB), now: Date.now() };
}

/** The public URL the provider sends the browser back to. Google's differs locally (worker/hosts.ts). */
const callbackUri = (url: URL, provider: ProviderId): string =>
  provider === "google" ? googleCallbackUri(url) : `${url.origin}/sign-in/${provider}/callback`;

/** A sign-in that can run: the provider's client and the secret that signs its session. */
interface Signing {
  readonly provider: SignInProvider;
  readonly secret: string;
}

/** What a sign-in with this provider from this URL runs with, or `undefined` when the provider cannot be signed in with. */
function signingFor(url: URL, id: ProviderId, context: SignInContext): Signing | undefined {
  const client = context.providers[id];
  const secret = authSecret();
  if (client === undefined || secret === undefined) return undefined;
  return { provider: { client, redirectURI: callbackUri(url, id) }, secret };
}

/** better-auth for one sign-in that can run. */
const signInAuthFor = (url: URL, id: ProviderId, signing: Signing, context: SignInContext) =>
  signInAuth(requireDatabase(context).app, signing.secret, url.origin, id, signing.provider);

/** Answer one sign-in route. */
export async function answerSignIn(request: Request, route: SignInRoute, context: SignInContext): Promise<Response> {
  const url = new URL(request.url);
  const method = route.kind === "sign-out" ? "POST" : "GET";
  if (request.method !== method) return text(405, `${method} only.`, new Headers({ allow: method }));

  try {
    switch (route.kind) {
      case "start": {
        const signing = signingFor(url, route.provider, context);
        if (signing === undefined) return unavailable(route.provider);
        const auth = signInAuthFor(url, route.provider, signing, context);
        const started = await auth.api.signInSocial({
          body: { provider: route.provider, callbackURL: AFTER_SIGN_IN, disableRedirect: true },
          asResponse: true,
        });
        const { url: location } = (await started.json()) as { url?: unknown };
        if (!started.ok || typeof location !== "string") throw new Error(`better-auth answered ${started.status} to a sign-in start`);
        return redirect(location, started.headers.getSetCookie());
      }
      case "callback": {
        const signing = signingFor(url, route.provider, context);
        if (signing === undefined) return unavailable(route.provider);
        const cookies = request.headers.get("cookie");
        const refuse = (refusal: SignInRefusal): Response => {
          const { status, body } = REFUSAL[refusal];
          return text(status, body, new Headers({ "set-cookie": clearedCookie(PENDING_COOKIE) }));
        };
        if (readCookie(cookies, PENDING_COOKIE) === undefined) return refuse("no-pending");
        const auth = signInAuthFor(url, route.provider, signing, context);
        const finished = await auth.handler(new Request(`${url.origin}${AUTH_PATH}/callback/${route.provider}${url.search}`, { headers: request.headers }));
        const location = finished.headers.get("location");
        if (location === null) throw new Error(`better-auth answered ${finished.status} to a callback, with no redirect`);
        const error = new URL(location, url).searchParams.get("error");
        if (error !== null) {
          const refusal = refusalOf(error, url.searchParams);
          if (refusal === undefined) throw new Error(`better-auth could not finish a callback: ${error}`);
          return refuse(refusal);
        }
        const session = finished.headers.getSetCookie().filter((value) => value.startsWith(`${SESSION_COOKIE}=`));
        if (session.length !== 1) throw new Error("better-auth finished a callback with no session cookie");
        // The browser's earlier session, if it had one, ends with this sign-in.
        if (readCookie(cookies, SESSION_COOKIE) !== undefined) await auth.api.signOut({ headers: request.headers });
        await sweepExpired(requireDatabase(context).app, context.now);
        return redirect(AFTER_SIGN_IN, [clearedCookie(PENDING_COOKIE), ...session]);
      }
      case "sign-out": {
        // A cross-site form could otherwise clear the cookie, even though
        // SameSite=Lax keeps the cookie itself from being sent with it.
        const origin = request.headers.get("origin");
        if (origin !== null && origin !== url.origin) return text(403, "Sign-out must come from this site.");
        const db = requireDatabase(context);
        const secret = authSecret();
        if (secret !== undefined && readCookie(request.headers.get("cookie"), SESSION_COOKIE) !== undefined) {
          await endSession(db.app, secret, url.origin, request.headers);
        }
        return redirect(AFTER_SIGN_OUT, [clearedCookie(SESSION_COOKIE)]);
      }
    }
  } catch (failure) {
    // A provider's, better-auth's or the database's message stays in the log.
    console.error("sign-in failed", { route: route.kind }, failure);
    return text(503, "Sign-in could not be finished. Try again later.");
  }
}

function requireDatabase(context: SignInContext): TransactionalDatabase {
  if (context.db === undefined) throw new Error("no D1 binding: this Worker has no DB");
  return context.db;
}

/** Answer the sign-in routes here, and hand every other request to the app. */
export function withSignIn<E extends SignInBindings>(
  app: FetchHandler<E>,
  contextOf: (env: E) => SignInContext = liveContext,
): FetchHandler<E> {
  return (request, env, ctx) => {
    const route = signInRouteOf(new URL(request.url));
    return route === undefined ? app(request, env, ctx) : answerSignIn(request, route, contextOf(env));
  };
}
