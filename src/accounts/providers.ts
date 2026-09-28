// The sign-in providers: Google and GitHub, and nothing else (Huey, #159).
//
// Each sits behind `OAuthProvider`, the two steps of the authorization-code
// flow that differ between them: where to send the browser, and how to turn
// the code it comes back with into a person. The flow itself (state, PKCE,
// which account the person is) is src/accounts/signIn.ts and does not know
// which provider it is talking to, so tests run a stub provider and CI needs
// no secrets.
//
// A provider is available only when both its client id and secret are
// configured (`providerCredentials`); the Worker reads them from its vars and
// secrets.

/** The providers a developer can sign in with. */
export const PROVIDER_IDS = ["google", "github"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const isProviderId = (value: string): value is ProviderId => (PROVIDER_IDS as readonly string[]).includes(value);

/** Each provider's name, as a person reads it. */
export const PROVIDER_NAME: Readonly<Record<ProviderId, string>> = { google: "Google", github: "GitHub" };

/** Where the provider sends the browser back, and what it must bind the code to. */
export interface AuthorizationRequest {
  state: string;
  /** The PKCE S256 challenge. */
  codeChallenge: string;
  redirectUri: string;
}

/** A code the provider handed back, with the verifier only this browser holds. */
export interface CodeGrant {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

/**
 * The person the provider vouched for: its own stable id for them, and their
 * email when the provider says it is verified. `undefined` is "no verified
 * email", never an unverified address.
 */
export interface ProviderProfile {
  subject: string;
  verifiedEmail: string | undefined;
}

/** A code exchanged: the person, or the provider's refusal (a bad code or verifier). */
export type Exchange = { outcome: "profile"; profile: ProviderProfile } | { outcome: "refused" };

export interface OAuthProvider {
  readonly id: ProviderId;
  /** The provider's consent page for this request. */
  authorizationUrl(request: AuthorizationRequest): URL;
  /** Redeem a code. Throws only when the provider could not be asked at all. */
  exchange(grant: CodeGrant): Promise<Exchange>;
}

/** A provider's OAuth client, as registered with it. */
export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/** The Worker vars and secrets the providers are configured from. */
export interface ProviderSettings {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

const SETTING: Readonly<Record<ProviderId, { id: keyof ProviderSettings; secret: keyof ProviderSettings }>> = {
  google: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  github: { id: "GITHUB_CLIENT_ID", secret: "GITHUB_CLIENT_SECRET" },
};

/** A provider's client, or `undefined` when its id or secret is unset or blank. */
export function providerCredentials(id: ProviderId, settings: ProviderSettings): ProviderCredentials | undefined {
  const clientId = settings[SETTING[id].id]?.trim() ?? "";
  const clientSecret = settings[SETTING[id].secret]?.trim() ?? "";
  return clientId === "" || clientSecret === "" ? undefined : { clientId, clientSecret };
}

/** `fetch`, or a stand-in for it. */
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

// A wrapper, so `fetch` never runs with a `this` the Workers runtime refuses ("Illegal invocation").
const globalFetch: Fetch = (input, init) => fetch(input, init);

/** The token endpoint's answer: a token, or a refusal it gave in words (a 4xx, or GitHub's 200 with `error`). */
async function accessToken(fetcher: Fetch, url: string, body: Record<string, string>): Promise<string | undefined> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (response.status >= 400 && response.status < 500) return undefined;
  if (!response.ok) throw new Error(`token endpoint answered ${response.status}`);
  const answer = (await response.json()) as { access_token?: unknown };
  return typeof answer.access_token === "string" && answer.access_token !== "" ? answer.access_token : undefined;
}

async function readJson(fetcher: Fetch, url: string, headers: Record<string, string>): Promise<unknown> {
  const response = await fetcher(url, { headers });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/**
 * Google, over OpenID Connect: the `openid email` scopes, then the userinfo
 * endpoint's `sub`, `email` and `email_verified`
 * (https://developers.google.com/identity/openid-connect/openid-connect).
 * The userinfo answer comes straight from Google over TLS with the token just
 * issued, so no ID token signature needs checking.
 */
export function googleProvider(credentials: ProviderCredentials, fetcher: Fetch = globalFetch): OAuthProvider {
  return {
    id: "google",
    authorizationUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();
      return url;
    },
    async exchange({ code, codeVerifier, redirectUri }) {
      const token = await accessToken(fetcher, "https://oauth2.googleapis.com/token", {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
      if (token === undefined) return { outcome: "refused" };
      const user = (await readJson(fetcher, "https://openidconnect.googleapis.com/v1/userinfo", {
        authorization: `Bearer ${token}`,
      })) as { sub?: unknown; email?: unknown; email_verified?: unknown };
      if (typeof user.sub !== "string" || user.sub === "") throw new Error("Google's userinfo carried no sub");
      const verifiedEmail = user.email_verified === true && typeof user.email === "string" ? user.email : undefined;
      return { outcome: "profile", profile: { subject: user.sub, verifiedEmail } };
    },
  };
}

const GITHUB_HEADERS = {
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  // GitHub refuses a REST request without one.
  "user-agent": "lexema",
};

/**
 * GitHub, over OAuth 2.0 with PKCE: the numeric user id from `/user`, and the
 * primary email from `/user/emails` when GitHub marks it verified
 * (https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps,
 * https://docs.github.com/en/rest/users/emails). The `user:email` scope is what
 * lets `/user/emails` answer.
 */
export function githubProvider(credentials: ProviderCredentials, fetcher: Fetch = globalFetch): OAuthProvider {
  return {
    id: "github",
    authorizationUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL("https://github.com/login/oauth/authorize");
      url.search = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: redirectUri,
        scope: "user:email",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();
      return url;
    },
    async exchange({ code, codeVerifier, redirectUri }) {
      const token = await accessToken(fetcher, "https://github.com/login/oauth/access_token", {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      });
      if (token === undefined) return { outcome: "refused" };
      const headers = { ...GITHUB_HEADERS, authorization: `Bearer ${token}` };
      const user = (await readJson(fetcher, "https://api.github.com/user", headers)) as { id?: unknown };
      if (typeof user.id !== "number") throw new Error("GitHub's /user carried no id");
      const emails = (await readJson(fetcher, "https://api.github.com/user/emails", headers)) as unknown;
      const primary = Array.isArray(emails)
        ? (emails as { email?: unknown; primary?: unknown; verified?: unknown }[]).find((entry) => entry.primary === true)
        : undefined;
      const verifiedEmail = primary?.verified === true && typeof primary.email === "string" ? primary.email : undefined;
      return { outcome: "profile", profile: { subject: String(user.id), verifiedEmail } };
    },
  };
}

/** Each provider, or `undefined` for one that is not configured. */
export type ProviderRegistry = Readonly<Record<ProviderId, OAuthProvider | undefined>>;

/** The live providers for these settings. */
export function configuredProviders(settings: ProviderSettings, fetcher: Fetch = globalFetch): ProviderRegistry {
  const google = providerCredentials("google", settings);
  const github = providerCredentials("github", settings);
  return {
    google: google === undefined ? undefined : googleProvider(google, fetcher),
    github: github === undefined ? undefined : githubProvider(github, fetcher),
  };
}
