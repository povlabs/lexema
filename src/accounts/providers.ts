// The sign-in providers: Google and GitHub, and nothing else (Huey, #159).
//
// better-auth runs the OAuth flow with each (src/accounts/auth.ts, ADR 0017):
// its own Google and GitHub code builds the consent URL, redeems the code with
// PKCE and reads the person back. What stays here is Lexema's side of that:
// which providers there are, the client each is registered as, and how the
// person a provider describes becomes a `ProviderProfile`, the one shape the
// account rules in ./accounts.ts read.
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

/**
 * The person the provider vouched for: its own stable id for them, their
 * email when the provider says it is verified, and the name they go by there
 * (#190). `undefined` is "no verified email", never an unverified address, and
 * "no name", never a blank one.
 */
export interface ProviderProfile {
  subject: string;
  verifiedEmail: string | undefined;
  name: string | undefined;
}

/** A provider's name field as a name: trimmed, or `undefined` when it is not a string or is blank. */
export function nameOf(value: unknown): string | undefined {
  const name = typeof value === "string" ? value.trim() : "";
  return name === "" ? undefined : name;
}

/**
 * What better-auth's provider code reads back about a person: the user it
 * makes of them, with the email it found and whether the provider verified it,
 * and the provider's own record of them.
 */
export interface ProviderUserInfo {
  user: { email?: string | null; emailVerified: boolean };
  data: object;
}

/**
 * The profile a provider's answer proves. Google's comes from its ID token:
 * `sub`, and `name` for the account menu
 * (https://developers.google.com/identity/openid-connect/openid-connect).
 * GitHub's from `/user`: the numeric `id`, and its `name` or, since GitHub
 * leaves that null for anyone who never set one, its `login` (#190). The email
 * is the one better-auth's provider code chose, and counts only when that code
 * found it verified (GitHub's `/user/emails`, Google's `email_verified`).
 */
export function profileOf(provider: ProviderId, info: ProviderUserInfo): ProviderProfile {
  const data = info.data as Readonly<Record<string, unknown>>;
  const subject = provider === "google" ? data.sub : data.id;
  const name = provider === "google" ? nameOf(data.name) : (nameOf(data.name) ?? nameOf(data.login));
  const email = info.user.email;
  return {
    subject: typeof subject === "string" || typeof subject === "number" ? String(subject) : "",
    verifiedEmail: info.user.emailVerified === true && typeof email === "string" ? email : undefined,
    name,
  };
}

/** A provider's OAuth client, as registered with it. */
export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
  /** Where its consent page is: the provider's own unless set, as a stand-in provider in tests sets it. */
  authorizationEndpoint?: string;
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

/** Each provider's client, or `undefined` for one that is not configured. */
export type ProviderRegistry = Readonly<Record<ProviderId, ProviderCredentials | undefined>>;

/** The configured providers for these settings. */
export function configuredProviders(settings: ProviderSettings): ProviderRegistry {
  return { google: providerCredentials("google", settings), github: providerCredentials("github", settings) };
}
