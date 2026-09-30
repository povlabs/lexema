// Sign-in, sessions and provider identities on better-auth (ADR 0017, #229).
//
// better-auth runs the OAuth flow with Google and GitHub (state, PKCE, the
// code exchange), links a second provider to an account by verified email,
// and keeps sessions. It is built per request, over the app tables through
// Drizzle (src/db/app), and web/worker/signIn.ts calls it from Lexema's own
// routes: none of its endpoints is reachable on any host.
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
import { betterAuth, type BetterAuthOptions } from "better-auth";
import type { OAuth2Tokens, OAuth2UserInfo } from "better-auth/oauth2";
import { github, google } from "better-auth/social-providers";
import type { AppDatabase } from "../db/app/database.js";
import { developerAccount, developerSession, providerIdentity, verification } from "../db/app/schema.js";
import { verifiedIdentity, type VerifiedIdentity } from "./accounts.js";
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
/** The path better-auth's endpoints would sit under. Nothing routes there; web/worker/signIn.ts calls them directly. */
export const AUTH_PATH = "/auth";

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
    // The Worker's own limits count sign-in starts (SIGN_IN_LIMIT, web/worker/rateLimit.ts).
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
 */
export function signInAuth(db: AppDatabase, secret: string, origin: string, id: ProviderId, provider: SignInProvider) {
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
      session: {
        create: { before: async (session) => ({ data: { ...session, ipAddress: undefined, userAgent: undefined } }) },
      },
    },
  });
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
