// Sign-in, sessions and provider identities on better-auth (ADR 0017, #229).
//
// better-auth runs the OAuth flow with Google and GitHub (state, PKCE, the
// code exchange), links a second provider to an account by verified email,
// and keeps sessions. It is built per request, over the app tables through
// Drizzle (src/db/app), and web/worker/developers/signIn.ts calls it from Lexema's own
// routes. Two of its endpoints are reachable, both the Stripe plugin's
// (./billing.ts) and on the developer site only: its webhook
// (web/worker/developers/stripeWebhook.ts) and the page Checkout returns to
// (web/worker/developers/billing.ts).
//
// What stays Lexema's is the account rule in ./accounts.ts: only a verified
// email reaches an account, and each identity keeps the email it was linked
// with and the name its provider gives now. `signInAuth` holds better-auth to
// it by reading every provider's answer through `verifiedIdentity` and writing
// what that gives onto the identity. Account deletion, the dashboard's CSRF
// token and the per-visitor limits stay Lexema's too (ADR 0017).
//
// Nothing a provider hands over after sign-in is kept: no token, no picture,
// and no address or user agent on a session. The tables' CHECKs refuse them.

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { lte } from "drizzle-orm";
import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { OAuth2Tokens, OAuth2UserInfo } from "better-auth/oauth2";
import { github, google } from "better-auth/social-providers";
import type { AppDatabase } from "../db/app/database.js";
import { developerAccount, developerSession, providerIdentity, subscription, verification } from "../db/app/schema.js";
import type { AccountMail } from "../email/send.js";
import { verifiedIdentity, type VerifiedIdentity } from "./accounts.js";
import { billingPlugin, type Billing } from "./billing.js";
import { profileOf, type ProviderCredentials, type ProviderId } from "./providers.js";

const COOKIE_PREFIX = "lexema";
/**
 * The session cookie. `__Secure-` makes the browser refuse it unless it is
 * Secure; it carries no `Domain`, so it stays on the one host that set it.
 */
export const SESSION_COOKIE = `__Secure-${COOKIE_PREFIX}.session_token`;
/** The pending sign-in: the OAuth `state`, signed, between leaving for the provider and coming back. */
export const PENDING_COOKIE = `__Secure-${COOKIE_PREFIX}.state`;
/** How long a sign-in lasts: 30 days, as it did before better-auth. */
export const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
/**
 * The path better-auth's endpoints sit under. Two are routed, both the Stripe
 * plugin's: `STRIPE_WEBHOOK_PATH` and `CHECKOUT_RETURN_PATH`. web/worker/developers/signIn.ts
 * and web/worker/developers/billing.ts call the rest directly.
 */
export const AUTH_PATH = "/auth";
/** The Stripe plugin's webhook, on the developer site (#262). */
export const STRIPE_WEBHOOK_PATH = `${AUTH_PATH}/stripe/webhook`;
/**
 * Where Stripe sends the browser after a paid Checkout (#264). The plugin
 * makes this Checkout's success URL itself, whatever it is asked for, then
 * reads the subscription back from Stripe and redirects on to the URL it was
 * asked for (web/worker/developers/billing.ts).
 */
export const CHECKOUT_RETURN_PATH = `${AUTH_PATH}/subscription/success`;

/**
 * `BETTER_AUTH_SECRET`, which signs the session cookie, or `undefined` when it
 * is unset. It is a Worker secret, and the Workers runtime puts a Worker's
 * vars and secrets on `process.env` too (`nodejs_compat` from compatibility
 * date 2025-04-01, web/wrangler.jsonc), so the session is read the same way in
 * the Worker, in its pages and under Node's tests.
 */
export function authSecret(): string | undefined {
  const secret = process.env.BETTER_AUTH_SECRET?.trim() ?? "";
  return secret === "" ? undefined : secret;
}

/** Lexema's tables, under the model names better-auth is told below. */
const TABLES = {
  developer_account: developerAccount,
  provider_identity: providerIdentity,
  developer_session: developerSession,
  verification,
  subscription,
};

/** Everything better-auth is told whatever the request: where its data lives and how its cookies and sessions behave. */
function baseOptions(db: AppDatabase, secret: string, origin: string) {
  return {
    secret,
    baseURL: origin,
    basePath: AUTH_PATH,
    database: drizzleAdapter(db, { provider: "sqlite", schema: TABLES }),
    user: {
      modelName: "developer_account",
      additionalFields: { deletedAt: { type: "date", required: false, input: false } },
    },
    account: {
      modelName: "provider_identity",
      additionalFields: {
        email: { type: "string", required: true, input: false },
        displayName: { type: "string", required: false, input: false },
      },
      // Google then GitHub under one verified email is one account (#165).
      accountLinking: { enabled: true },
      updateAccountOnSignIn: true,
    },
    session: {
      modelName: "developer_session",
      expiresIn: SESSION_LIFETIME_SECONDS,
      // A session ends when it was always going to: reading it never writes.
      disableSessionRefresh: true,
    },
    // The Worker's own limits count sign-in starts (SIGN_IN_LIMIT, web/worker/shared/rateLimit.ts).
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    advanced: {
      database: { generateId: "serial" },
      cookiePrefix: COOKIE_PREFIX,
      // `__Secure-` and Secure on `http://developers.localhost` too, as before.
      useSecureCookies: true,
      // Host-only: `lexema.fyi` and `api.lexema.fyi` never get a session cookie.
      crossSubDomainCookies: { enabled: false },
      ipAddress: { disableIpTracking: true },
    },
  } satisfies BetterAuthOptions;
}

/** better-auth over this database for reading and ending sessions: no provider, no sign-in. */
export function sessionAuth(db: AppDatabase, secret: string, origin: string) {
  return betterAuth(baseOptions(db, secret, origin));
}

/**
 * better-auth over this database with the Stripe plugin added to the base
 * options: its verified webhook, and the Checkout and billing-portal endpoints
 * the billing routes call through `auth.api`. `billing` exists only once every
 * Stripe setting is set (./billing.ts). `origin` is the developer site, which
 * Checkout's Terms link points at (#572). `mail` is where the webhook's plan
 * emails go (#215); only the webhook sends any.
 */
export function billingAuth(db: AppDatabase, secret: string, origin: string, billing: Billing, mail?: AccountMail) {
  return betterAuth({ ...baseOptions(db, secret, origin), plugins: [billingPlugin(db, billing, origin, mail)] });
}

/**
 * End the session a request's signed session cookie names, or do nothing when
 * it names no live one. It throws when the session could not be read or its
 * row could not be deleted: better-auth's own sign-out logs a failed delete
 * and goes on, which would clear the cookie and leave the session live.
 */
export async function endSession(db: AppDatabase, secret: string, origin: string, headers: Headers): Promise<void> {
  const auth = sessionAuth(db, secret, origin);
  const found = await auth.api.getSession({ headers });
  if (found === null) return;
  await auth.api.revokeSession({ headers, body: { token: found.session.token } });
}

/** A provider's client, and the callback URL it is registered with. */
export interface SignInProvider {
  readonly client: ProviderCredentials;
  readonly redirectURI: string;
}

/** Credentials better-auth writes onto an identity: Lexema keeps none of them. */
const NO_CREDENTIALS = {
  accessToken: undefined,
  refreshToken: undefined,
  idToken: undefined,
  accessTokenExpiresAt: undefined,
  refreshTokenExpiresAt: undefined,
  scope: undefined,
  password: undefined,
};

/**
 * better-auth over this database for one sign-in with one provider: starting
 * it, or finishing it at the callback.
 *
 * The provider's answer is read by better-auth's own Google or GitHub code,
 * then through `verifiedIdentity`. Without a verified email better-auth is
 * handed none, so it refuses (`email_not_found`) before it stores anything.
 * With one, that identity is what the hooks write: the lowercased email on the
 * account and identity it makes, the provider's name on the identity at every
 * sign-in, and nothing else.
 *
 * The session the request's cookie names, if any, ends before the new one is
 * made, through `endSession`: when it cannot be ended the sign-in fails and
 * makes no new session, rather than leave both live.
 */
export function signInAuth(db: AppDatabase, secret: string, origin: string, id: ProviderId, provider: SignInProvider, headers: Headers) {
  let vouched: VerifiedIdentity | undefined;
  const options = {
    clientId: provider.client.clientId,
    clientSecret: provider.client.clientSecret,
    redirectURI: provider.redirectURI,
    ...(provider.client.authorizationEndpoint === undefined ? {} : { authorizationEndpoint: provider.client.authorizationEndpoint }),
  };
  /** The provider's answer, as better-auth's own code read it, held to the account rule. */
  function hear<Info extends { user: OAuth2UserInfo & Record<string, unknown>; data: object }>(info: Info | null): Info | null {
    if (info === null) return null;
    vouched = verifiedIdentity(id, profileOf(id, info));
    if (vouched === undefined) return { ...info, user: { ...info.user, email: "", emailVerified: false } };
    return { ...info, user: { ...info.user, email: vouched.email, emailVerified: true, name: vouched.name ?? "" } };
  }
  const socialProviders =
    id === "google"
      ? { google: { ...options, getUserInfo: async (token: OAuth2Tokens) => hear(await google(options).getUserInfo(token)) } }
      : { github: { ...options, getUserInfo: async (token: OAuth2Tokens) => hear(await github(options).getUserInfo(token)) } };
  const base = baseOptions(db, secret, origin);
  return betterAuth({
    ...base,
    socialProviders,
    databaseHooks: {
      user: {
        create: {
          before: async (user) => (vouched === undefined ? false : { data: { ...user, email: vouched.email, emailVerified: true, image: undefined } }),
        },
      },
      account: {
        create: {
          before: async (account) =>
            vouched === undefined ? false : { data: { ...account, ...NO_CREDENTIALS, email: vouched.email, displayName: vouched.name ?? null } },
        },
        update: {
          before: async (account) => ({ data: { ...account, ...NO_CREDENTIALS, ...(vouched === undefined ? {} : { displayName: vouched.name ?? null }) } }),
        },
      },
      session: sessionHooks(db, secret, origin, headers),
    },
  });
}

/**
 * What better-auth does as it makes a session: end the one the request's
 * cookie names first, so a new sign-in never leaves both live, and record
 * neither the browser's address nor its user agent, which the table refuses.
 */
function sessionHooks(db: AppDatabase, secret: string, origin: string, headers: Headers) {
  return {
    create: {
      before: async (session: Record<string, unknown>) => {
        await endSession(db, secret, origin, headers);
        return { data: { ...session, ipAddress: undefined, userAgent: undefined } };
      },
    },
  };
}

/**
 * Start a session for an account that is already signed in by other means,
 * and answer the `Set-Cookie` values that carry it. better-auth's own code
 * makes the session and its signed cookie, through an endpoint of its own
 * that no router ever mounts (`serverOnly`), so the cookie is the one a
 * provider's sign-in sets. The session the request's cookie names, if any,
 * ends first, as it does for `signInAuth`.
 */
export async function startSession(db: AppDatabase, secret: string, origin: string, headers: Headers, accountId: number): Promise<string[]> {
  const startFor = {
    id: "lexema-start-session",
    endpoints: {
      startSession: createAuthEndpoint.serverOnly({ method: "POST" }, async (ctx) => {
        const user = await ctx.context.internalAdapter.findUserById(String(accountId));
        if (user === null) throw new Error(`no account ${accountId} to start a session for`);
        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ started: true });
      }),
    },
  } satisfies BetterAuthPlugin;
  const auth = betterAuth({ ...baseOptions(db, secret, origin), plugins: [startFor], databaseHooks: { session: sessionHooks(db, secret, origin, headers) } });
  const started = await auth.api.startSession({ headers, asResponse: true });
  if (!started.ok) throw new Error(`better-auth answered ${started.status} to starting a session`);
  return started.headers.getSetCookie();
}

/**
 * Delete the sessions and pending sign-ins that have expired by `now`.
 * better-auth deletes each as it meets it; one nobody comes back to would
 * otherwise stay, so a finished sign-in sweeps them, as sign-in did before.
 */
export async function sweepExpired(db: AppDatabase, now: number): Promise<void> {
  const at = new Date(now);
  await db.delete(developerSession).where(lte(developerSession.expiresAt, at));
  await db.delete(verification).where(lte(verification.expiresAt, at));
}
