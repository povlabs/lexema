// Sign-in on developers.lexema.fyi (#165), end to end through the Worker's
// host routing, with stub providers standing in for Google and GitHub and a
// local `node:sqlite` database over the real schema.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { configuredProviders, type ProviderProfile, type ProviderRegistry } from "../../src/accounts/providers.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { apiNotFound } from "../worker/api/handler.ts";
import { byHost } from "../worker/hosts.ts";
import { withRateLimits, type LimitBindings } from "../worker/rateLimit.ts";
import {
  AFTER_SIGN_IN,
  availableProviders,
  PENDING_COOKIE,
  SESSION_COOKIE,
  signedInAccount,
  withSignIn,
  type SignInBindings,
} from "../worker/signIn.ts";
import { StubProvider } from "./stubProvider.ts";

const SCHEMA = readFileSync(fileURLToPath(new URL("../../src/db/schema.sql", import.meta.url)), "utf8");
const NOW = Date.parse("2026-09-28T12:00:00Z");
const DEVELOPERS = "https://developers.lexema.fyi";

const allow: RateLimit = { limit: async () => ({ success: true }) };
const env: LimitBindings & SignInBindings = {
  SEARCH_LIMIT: allow,
  SUGGEST_LIMIT: allow,
  REPORT_LIMIT: allow,
  REPORT_OPEN_LIMIT: allow,
  SIGN_IN_LIMIT: allow,
};

/** One `Set-Cookie` value, split into its name, value and attributes. */
function parseSetCookie(header: string) {
  const [pair, ...attributes] = header.split(";").map((part) => part.trim());
  const at = pair.indexOf("=");
  return {
    name: pair.slice(0, at),
    value: pair.slice(at + 1),
    attributes: attributes.map((attribute) => attribute.toLowerCase()),
  };
}

/** The Worker as deployed, over a fresh database, with a browser's cookie jar. */
function site(providers?: ProviderRegistry) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA);
  const db = fromNodeSqlite(sqlite);
  const google = new StubProvider("google");
  const github = new StubProvider("github");
  const appSaw: string[] = [];
  const worker = byHost<typeof env>({
    app: withRateLimits(
      withSignIn(
        async (request) => {
          appSaw.push(new URL(request.url).pathname);
          return new Response("page");
        },
        () => ({ providers: providers ?? { google, github }, db, now: NOW }),
      ),
    ),
    api: async () => Response.json({}),
    apiNotFound,
  });

  const jar = new Map<string, string>();
  const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (jar.size > 0) headers.set("cookie", cookieHeader());
    const response = await worker(new Request(url, { ...init, headers }), env, {} as ExecutionContext);
    for (const header of response.headers.getSetCookie()) {
      const { name, value, attributes } = parseSetCookie(header);
      if (attributes.includes("max-age=0")) jar.delete(name);
      else jar.set(name, value);
    }
    return response;
  }

  /** Start at the sign-in button, consent at the stub, and come back. */
  async function signIn(provider: StubProvider, profile: ProviderProfile, tamper?: (callback: URL) => void): Promise<Response> {
    const start = await send(`${DEVELOPERS}/sign-in/${provider.id}`);
    assert.equal(start.status, 303);
    const callback = provider.consent(start.headers.get("location") ?? "", profile);
    tamper?.(callback);
    return send(callback.toString());
  }

  const count = (table: string) => (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
  const account = () => signedInAccount(cookieHeader(), db, NOW);
  return { sqlite, db, jar, send, signIn, google, github, appSaw, count, account };
}

const ada: ProviderProfile = { subject: "g-100", verifiedEmail: "ada@example.com" };

test("a stub sign-in round trip ends with a host-only session cookie: HttpOnly, Secure, SameSite=Lax, no Domain", async () => {
  const { send, google, jar, account, appSaw } = site();

  const start = await send(`${DEVELOPERS}/sign-in/google`);
  assert.equal(start.status, 303);
  const location = new URL(start.headers.get("location") ?? "");
  assert.equal(location.origin, "https://google.stub.test");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.equal(location.searchParams.get("redirect_uri"), `${DEVELOPERS}/sign-in/google/callback`);
  const [pending] = start.headers.getSetCookie().map(parseSetCookie);
  assert.equal(pending.name, PENDING_COOKIE);
  assert.ok(!pending.value.includes(location.searchParams.get("code_challenge") ?? "-"), "the verifier, never the challenge");

  const back = await send(google.consent(location.toString(), ada).toString());
  assert.equal(back.status, 303);
  assert.equal(back.headers.get("location"), AFTER_SIGN_IN);
  const cookies = back.headers.getSetCookie().map(parseSetCookie);
  const session = cookies.find((cookie) => cookie.name === SESSION_COOKIE);
  assert.ok(session !== undefined && session.value !== "");
  for (const attribute of ["httponly", "secure", "samesite=lax", "path=/"]) assert.ok(session.attributes.includes(attribute), attribute);
  assert.ok(!session.attributes.some((attribute) => attribute.startsWith("domain")), "host-only: no Domain");
  assert.ok(SESSION_COOKIE.startsWith("__Host-"));
  assert.ok(!jar.has(PENDING_COOKIE), "the pending sign-in is cleared");

  assert.equal(typeof (await account()), "number");
  assert.deepEqual(appSaw, [], "the App Router never saw a sign-in route");
});

test("a callback with a wrong state or a wrong PKCE verifier is refused and makes no session", async () => {
  const wrongState = site();
  const refused = await wrongState.signIn(wrongState.google, ada, (callback) => callback.searchParams.set("state", "A".repeat(43)));
  assert.equal(refused.status, 400);
  assert.ok(!wrongState.jar.has(SESSION_COOKIE));
  assert.equal(wrongState.count("developer_session"), 0);
  assert.equal(wrongState.count("developer_account"), 0);

  const wrongVerifier = site();
  const response = await wrongVerifier.signIn(wrongVerifier.google, ada, () => {
    const [provider, state] = (wrongVerifier.jar.get(PENDING_COOKIE) ?? "").split(".");
    wrongVerifier.jar.set(PENDING_COOKIE, `${provider}.${state}.${"B".repeat(43)}`);
  });
  assert.equal(response.status, 400);
  assert.ok(!wrongVerifier.jar.has(SESSION_COOKIE));
  assert.equal(wrongVerifier.count("developer_session"), 0);
  assert.equal(wrongVerifier.count("developer_account"), 0);
});

test("Google then GitHub under one verified email is one account with two identities; an unverified email is refused", async () => {
  const { signIn, google, github, sqlite, jar, count } = site();
  assert.equal((await signIn(google, ada)).status, 303);
  jar.clear();
  assert.equal((await signIn(github, { subject: "4242", verifiedEmail: "Ada@Example.com" })).status, 303);

  const identities = sqlite
    .prepare("SELECT account_id, provider, provider_user_id, email FROM provider_identity ORDER BY identity_id")
    .all()
    .map((row) => ({ ...row }));
  assert.deepEqual(identities, [
    { account_id: 1, provider: "google", provider_user_id: "g-100", email: "ada@example.com" },
    { account_id: 1, provider: "github", provider_user_id: "4242", email: "ada@example.com" },
  ]);
  assert.equal(count("developer_account"), 1);

  jar.clear();
  const unverified = await signIn(github, { subject: "7", verifiedEmail: undefined });
  assert.equal(unverified.status, 403);
  assert.ok(!jar.has(SESSION_COOKIE));
  assert.equal(count("provider_identity"), 2);
  assert.equal(count("developer_account"), 1);
});

test("a provider with its client id or secret unset reads as unavailable, and its start route answers without throwing", async () => {
  const providers = configuredProviders({ GOOGLE_CLIENT_ID: "id-only", GITHUB_CLIENT_SECRET: "secret-only" });
  assert.deepEqual(providers, { google: undefined, github: undefined });
  assert.deepEqual(availableProviders({ GOOGLE_CLIENT_ID: "id-only", GITHUB_CLIENT_SECRET: "secret-only" }), {
    google: false,
    github: false,
  });
  assert.deepEqual(availableProviders({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "  " }).google, false);
  assert.deepEqual(availableProviders({ GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" }), { google: false, github: true });

  const { send, jar } = site(providers);
  for (const provider of ["google", "github"]) {
    const response = await send(`${DEVELOPERS}/sign-in/${provider}`);
    assert.equal(response.status, 503);
    assert.match(await response.text(), /is not available/);
    assert.deepEqual(response.headers.getSetCookie(), []);
  }
  assert.equal(jar.size, 0);
});

test("sign-out deletes the session and clears the cookie; the old cookie no longer reads as signed in", async () => {
  const { signIn, send, google, jar, db, count, account } = site();
  await signIn(google, ada);
  const oldCookie = `${SESSION_COOKIE}=${jar.get(SESSION_COOKIE)}`;
  assert.equal(typeof (await account()), "number");

  // Another site's form cannot sign anyone out.
  const forged = await send(`${DEVELOPERS}/sign-out`, { method: "POST", headers: { origin: "https://evil.example" } });
  assert.equal(forged.status, 403);
  assert.equal(count("developer_session"), 1);

  const out = await send(`${DEVELOPERS}/sign-out`, { method: "POST", headers: { origin: DEVELOPERS } });
  assert.equal(out.status, 303);
  const [cleared] = out.headers.getSetCookie().map(parseSetCookie);
  assert.equal(cleared.name, SESSION_COOKIE);
  assert.ok(cleared.attributes.includes("max-age=0"));
  assert.ok(!jar.has(SESSION_COOKIE));
  assert.equal(count("developer_session"), 0);
  assert.equal(await signedInAccount(oldCookie, db, NOW), undefined);
});

test("the sign-in routes exist on the developer site only, and nothing else sets a cookie", async () => {
  const { send, appSaw } = site();
  for (const url of [
    "https://lexema.fyi/sign-in/google",
    "https://lexema.fyi/developer-site/sign-in/google",
    "https://lexema.fyi/sign-out",
    "https://api.lexema.fyi/sign-in/google",
    `${DEVELOPERS}/sign-in/nobody`,
  ]) {
    const response = await send(url, url.endsWith("sign-out") ? { method: "POST" } : {});
    assert.notEqual(response.status, 303, url);
    assert.deepEqual(response.headers.getSetCookie(), [], url);
  }
  assert.deepEqual(appSaw, ["/sign-in/google", "/sign-out", "/developer-site/sign-in/nobody"]);
});
