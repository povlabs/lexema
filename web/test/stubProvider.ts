// A sign-in provider for tests (#165, #229): it plays Google or GitHub
// without a network, at the level of `fetch`, so better-auth's own provider
// code runs against it. Importing this file puts a stand-in `fetch` in front
// of the real one: it answers Google's and GitHub's token endpoints and
// GitHub's user endpoints, and hands every other request on.
//
// It checks what the real ones check. A code is issued for one client, one
// challenge and one redirect URI, is redeemed once, and only with the verifier
// whose S256 digest is that challenge (RFC 7636 §4.6). Google answers with an
// ID token, which better-auth reads without a signature check (it came
// straight from the token endpoint), so this one carries none.
//
// The session cookie is signed with `BETTER_AUTH_SECRET`. Tests set it here,
// to a constant that exists nowhere else: CI holds no secret.

import { createHash } from "node:crypto";
import type { ProviderCredentials, ProviderId, ProviderProfile } from "../../src/accounts/providers.js";

process.env.BETTER_AUTH_SECRET = "lexema-tests-only-3f9c2a7e5d1b4c8a9e6f0d2b7a5c3e1f";

interface Issued {
  provider: ProviderId;
  clientId: string;
  challenge: string;
  redirectUri: string;
  profile: ProviderProfile;
}

/** Codes not yet redeemed, and access tokens handed out, across every stub. */
const codes = new Map<string, Issued>();
const tokens = new Map<string, ProviderProfile>();
let next = 0;

/** The address a profile with no verified email still has at the provider, unverified. */
const unverifiedEmail = (profile: ProviderProfile) => profile.verifiedEmail ?? `${profile.subject}@unverified.stub.test`;

const TOKEN_ENDPOINT: Readonly<Record<ProviderId, string>> = {
  google: "https://oauth2.googleapis.com/token",
  github: "https://github.com/login/oauth/access_token",
};

const base64Url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Redeem a code, as a token endpoint does, or refuse it. */
function redeem(provider: ProviderId, form: URLSearchParams, clientSecret: (clientId: string) => string | undefined): Response {
  const issued = codes.get(form.get("code") ?? "");
  codes.delete(form.get("code") ?? "");
  const challenge = createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url");
  const valid =
    issued !== undefined &&
    issued.provider === provider &&
    issued.clientId === form.get("client_id") &&
    clientSecret(issued.clientId) === form.get("client_secret") &&
    issued.redirectUri === form.get("redirect_uri") &&
    issued.challenge === challenge;
  if (!valid) {
    // Google refuses with a 400; GitHub with a 200 whose body says why.
    return provider === "google"
      ? Response.json({ error: "invalid_grant" }, { status: 400 })
      : Response.json({ error: "bad_verification_code" });
  }
  const accessToken = `token-${provider}-${++next}`;
  tokens.set(accessToken, issued.profile);
  if (provider === "github") return Response.json({ access_token: accessToken, token_type: "bearer", scope: "read:user,user:email" });
  const { profile } = issued;
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "https://accounts.google.com",
    aud: issued.clientId,
    sub: profile.subject,
    email: unverifiedEmail(profile),
    email_verified: profile.verifiedEmail !== undefined,
    ...(profile.name === undefined ? {} : { name: profile.name }),
    iat: now,
    exp: now + 3600,
  };
  const idToken = `${base64Url({ alg: "RS256", kid: "stub", typ: "JWT" })}.${base64Url(claims)}.stub`;
  return Response.json({ access_token: accessToken, token_type: "Bearer", expires_in: 3599, id_token: idToken });
}

/** GitHub's `/user` and `/user/emails`, for the person a token was issued to. */
function githubUser(path: string, authorization: string | null): Response {
  const profile = tokens.get(authorization?.replace(/^Bearer /i, "") ?? "");
  if (profile === undefined) return Response.json({ message: "Bad credentials" }, { status: 401 });
  if (path === "/user/emails") {
    return Response.json([{ email: unverifiedEmail(profile), primary: true, verified: profile.verifiedEmail !== undefined }]);
  }
  const id = /^\d+$/.test(profile.subject) ? Number(profile.subject) : profile.subject;
  // A person with no name at GitHub still has a login, which is what better-auth falls back to.
  return Response.json({ id, login: `octo-${profile.subject}`, name: profile.name ?? null, email: null });
}

/** Every stub's client secret, by client id. */
const secrets = new Map<string, string>();

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  for (const provider of ["google", "github"] as const) {
    if (request.method === "POST" && request.url === TOKEN_ENDPOINT[provider]) {
      return redeem(provider, new URLSearchParams(await request.text()), (clientId) => secrets.get(clientId));
    }
  }
  if (url.origin === "https://api.github.com" && (url.pathname === "/user" || url.pathname === "/user/emails")) {
    return githubUser(url.pathname, request.headers.get("authorization"));
  }
  return realFetch(input, init);
};

export class StubProvider implements ProviderCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authorizationEndpoint: string;

  constructor(readonly id: ProviderId) {
    this.clientId = `stub-${id}-client-${++next}`;
    this.clientSecret = `stub-${id}-secret-${next}`;
    this.authorizationEndpoint = `https://${id}.stub.test/authorize`;
    secrets.set(this.clientId, this.clientSecret);
  }

  /** The person consents at `location`: the callback URL the provider sends them to. */
  consent(location: string, profile: ProviderProfile): URL {
    const at = new URL(location);
    const code = `code-${this.id}-${++next}`;
    const redirectUri = at.searchParams.get("redirect_uri") ?? "";
    codes.set(code, {
      provider: this.id,
      clientId: at.searchParams.get("client_id") ?? "",
      challenge: at.searchParams.get("code_challenge") ?? "",
      redirectUri,
      profile,
    });
    const callback = new URL(redirectUri);
    callback.search = new URLSearchParams({ code, state: at.searchParams.get("state") ?? "" }).toString();
    return callback;
  }

  /** The person declines at `location`: the provider sends them back with an error and no code. */
  decline(location: string): URL {
    const at = new URL(location);
    const callback = new URL(at.searchParams.get("redirect_uri") ?? "");
    callback.search = new URLSearchParams({ error: "access_denied", state: at.searchParams.get("state") ?? "" }).toString();
    return callback;
  }
}
