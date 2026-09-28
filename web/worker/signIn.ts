// Sign-in, sign-out and the session cookie on developers.lexema.fyi (#165).
//
// The routes, on the developer site's host only:
//
//   GET  /sign-in/<provider>           start: to the provider, with a pending-sign-in cookie
//   GET  /sign-in/<provider>/callback  finish: a session cookie, then /dashboard
//   POST /sign-out                     end the session and clear its cookie
//
// worker/hosts.ts rewrites the developer site onto `/developer-site/…` and
// answers that segment with a 404 on every other host, so these routes and
// their cookies never exist on `lexema.fyi` or `api.lexema.fyi`. Each cookie
// is `__Host-` prefixed: the browser then refuses it unless it is Secure, on
// path `/` and carries no `Domain`, so it is bound to this one host.
//
// The flow and the account it reaches are src/accounts/; this file is the
// wiring to requests, cookies and the Worker's bindings. The sign-in pages
// read `availableProviders` and `signedInAccount`.

import { signInAccount } from "@lexema/accounts/accounts.ts";
import {
  configuredProviders,
  isProviderId,
  PROVIDER_NAME,
  type ProviderId,
  type ProviderRegistry,
  type ProviderSettings,
} from "@lexema/accounts/providers.ts";
import { createSession, endSession, SESSION_LIFETIME_MS, sessionAccount } from "@lexema/accounts/sessions.ts";
import { beginSignIn, finishSignIn, readPending, writePending, type SignInRefusal } from "@lexema/accounts/signIn.ts";
import { fromD1, type LookupDatabase } from "@lexema/lookup/database.ts";
import { DEVELOPERS_SEGMENT } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";

/** The session cookie: the session's token. */
export const SESSION_COOKIE = "__Host-lexema-session";
/** The pending sign-in, between leaving for the provider and coming back. */
export const PENDING_COOKIE = "__Host-lexema-sign-in";
/** How long a pending sign-in may take: ten minutes at the provider. */
const PENDING_SECONDS = 10 * 60;

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

/** The bindings sign-in reads: the database, and the providers' vars and secrets. */
export interface SignInBindings extends ProviderSettings {
  DB?: D1Database;
}

/** Which providers can be signed in with: those whose client id and secret are both set. */
export function availableProviders(settings: ProviderSettings): Readonly<Record<ProviderId, boolean>> {
  const providers = configuredProviders(settings);
  return { google: providers.google !== undefined, github: providers.github !== undefined };
}

/** A `Cookie` header's value for one name. */
export function readCookie(header: string | null, name: string): string | undefined {
  for (const pair of header?.split(";") ?? []) {
    const at = pair.indexOf("=");
    if (at !== -1 && pair.slice(0, at).trim() === name) return pair.slice(at + 1).trim();
  }
  return undefined;
}

/** The account a request's session cookie is signed in to, or `undefined`. */
export function signedInAccount(cookieHeader: string | null, db: LookupDatabase, now: number): Promise<number | undefined> {
  return sessionAccount(db, readCookie(cookieHeader, SESSION_COOKIE), now);
}

/** A host-only cookie: HttpOnly, Secure, SameSite=Lax, path `/`, no `Domain`. */
function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
const cleared = (name: string): string => cookie(name, "", 0);

function text(status: number, body: string, headers: Headers = new Headers()): Response {
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(body, { status, headers });
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const value of cookies) headers.append("set-cookie", value);
  return new Response(null, { status: 303, headers });
}

/** What a refused callback says, and with which status. */
const REFUSAL: Readonly<Record<SignInRefusal, { status: number; body: string }>> = {
  "no-pending": { status: 400, body: "This sign-in has expired or was not started here. Start again." },
  state: { status: 400, body: "This sign-in could not be checked. Start again." },
  cancelled: { status: 400, body: "Sign-in was cancelled." },
  refused: { status: 400, body: "The provider did not confirm this sign-in. Start again." },
  "unverified-email": { status: 403, body: "Sign-in needs an email address the provider has verified." },
};

const unavailable = (provider: ProviderId): Response =>
  text(503, `Sign-in with ${PROVIDER_NAME[provider]} is not available.`);

/** What sign-in runs against; the Worker's, or a test's. */
export interface SignInContext {
  providers: ProviderRegistry;
  db: LookupDatabase | undefined;
  now: number;
}

/** The context the live Worker runs with. */
export function liveContext(env: SignInBindings): SignInContext {
  return { providers: configuredProviders(env), db: env.DB === undefined ? undefined : fromD1(env.DB), now: Date.now() };
}

/** The public URL the provider sends the browser back to. */
const callbackUri = (url: URL, provider: ProviderId): string => `${url.origin}/sign-in/${provider}/callback`;

/** Answer one sign-in route. */
export async function answerSignIn(request: Request, route: SignInRoute, context: SignInContext): Promise<Response> {
  const url = new URL(request.url);
  const method = route.kind === "sign-out" ? "POST" : "GET";
  if (request.method !== method) return text(405, `${method} only.`, new Headers({ allow: method }));

  try {
    switch (route.kind) {
      case "start": {
        const provider = context.providers[route.provider];
        if (provider === undefined) return unavailable(route.provider);
        const { pending, location } = await beginSignIn(provider, callbackUri(url, route.provider));
        return redirect(location.toString(), [cookie(PENDING_COOKIE, writePending(pending), PENDING_SECONDS)]);
      }
      case "callback": {
        const provider = context.providers[route.provider];
        if (provider === undefined) return unavailable(route.provider);
        const cookies = request.headers.get("cookie");
        const outcome = await finishSignIn(
          provider,
          readPending(readCookie(cookies, PENDING_COOKIE)),
          url.searchParams,
          callbackUri(url, route.provider),
        );
        if (outcome.outcome === "refused") {
          const { status, body } = REFUSAL[outcome.refusal];
          return text(status, body, new Headers({ "set-cookie": cleared(PENDING_COOKIE) }));
        }
        const db = requireDatabase(context);
        await endSession(db, readCookie(cookies, SESSION_COOKIE));
        const { accountId } = await signInAccount(db, outcome.identity, context.now);
        const session = await createSession(db, accountId, context.now);
        return redirect(AFTER_SIGN_IN, [
          cleared(PENDING_COOKIE),
          cookie(SESSION_COOKIE, session.token, SESSION_LIFETIME_MS / 1000),
        ]);
      }
      case "sign-out": {
        // A cross-site form could otherwise clear the cookie, even though
        // SameSite=Lax keeps the cookie itself from being sent with it.
        const origin = request.headers.get("origin");
        if (origin !== null && origin !== url.origin) return text(403, "Sign-out must come from this site.");
        await endSession(requireDatabase(context), readCookie(request.headers.get("cookie"), SESSION_COOKIE));
        return redirect(AFTER_SIGN_OUT, [cleared(SESSION_COOKIE)]);
      }
    }
  } catch (failure) {
    // A provider's or the database's message stays in the log.
    console.error("sign-in failed", { route: route.kind }, failure);
    return text(503, "Sign-in could not be finished. Try again later.");
  }
}

function requireDatabase(context: SignInContext): LookupDatabase {
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
