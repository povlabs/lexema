// Developer accounts, sessions and the Google and GitHub providers (#165),
// over the real schema. The round trip through the Worker is
// web/test/signIn.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  ACCOUNT_IDENTITIES_SQL,
  accountProfile,
  deleteAccount,
  IDENTITY_BY_EMAIL_SQL,
  REFRESH_IDENTITY_SQL,
  signInAccount,
  verifiedIdentity,
  type VerifiedIdentity,
} from "../src/accounts/accounts.js";
import { githubProvider, googleProvider, type Fetch } from "../src/accounts/providers.js";
import {
  createSession,
  DELETE_SESSION_SQL,
  SESSION_ACCOUNT_SQL,
  SESSION_LIFETIME_MS,
  sessionAccount,
  SWEEP_SESSIONS_SQL,
} from "../src/accounts/sessions.js";
import { readPending, writePending } from "../src/accounts/signIn.js";
import { fromNodeSqlite } from "../src/lookup/database.js";

const SCHEMA = readFileSync(fileURLToPath(new URL("../src/db/schema.sql", import.meta.url)), "utf8");
const NOW = Date.parse("2026-09-28T12:00:00Z");

function schemaDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

const identity = (provider: "google" | "github", subject: string, email: string, name?: string): VerifiedIdentity => {
  const verified = verifiedIdentity(provider, { subject, verifiedEmail: email, name });
  assert.ok(verified !== undefined);
  return verified;
};

test("every account and session read is on a primary key or an index", () => {
  const db = schemaDb();
  const planOf = (sql: string, params: (string | number | null)[]) =>
    (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail).join("\n");
  const at = new Date(NOW).toISOString();
  const cases: [string, (string | number | null)[], RegExp][] = [
    [REFRESH_IDENTITY_SQL, [null, "google", "x"], /SEARCH provider_identity USING INDEX sqlite_autoindex_provider_identity_1/],
    [IDENTITY_BY_EMAIL_SQL, ["a@b.c"], /SEARCH provider_identity USING INDEX provider_identity_by_email/],
    [ACCOUNT_IDENTITIES_SQL, [1], /SEARCH provider_identity USING INDEX provider_identity_by_account/],
    [SESSION_ACCOUNT_SQL, ["0".repeat(64), at], /SEARCH developer_session USING INDEX sqlite_autoindex_developer_session_1/],
    [DELETE_SESSION_SQL, ["0".repeat(64)], /SEARCH developer_session USING (COVERING )?INDEX sqlite_autoindex_developer_session_1/],
    [SWEEP_SESSIONS_SQL, [at], /SEARCH developer_session USING (COVERING )?INDEX developer_session_by_expiry/],
  ];
  for (const [sql, params, expected] of cases) {
    const plan = planOf(sql, params);
    assert.match(plan, expected, `${sql}\n${plan}`);
  }
});

test("an identity signs in to its own account first, then to the account its verified email already reaches", async () => {
  const db = fromNodeSqlite(schemaDb());
  assert.deepEqual(await signInAccount(db, identity("google", "g-1", "Ada@Example.com"), NOW), { accountId: 1, match: "new" });
  assert.deepEqual(await signInAccount(db, identity("github", "7", "ada@example.com"), NOW), { accountId: 1, match: "email" });
  assert.deepEqual(await signInAccount(db, identity("google", "g-1", "ada@example.com"), NOW), { accountId: 1, match: "identity" });
  // The provider's own id wins over a changed email.
  assert.deepEqual(await signInAccount(db, identity("github", "7", "ada@elsewhere.org"), NOW), { accountId: 1, match: "identity" });
  assert.deepEqual(await signInAccount(db, identity("google", "g-2", "bob@example.com"), NOW), { accountId: 2, match: "new" });
});

test("an account's profile is its first email and every provider linked to it, and a deleted account has none", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const { accountId } = await signInAccount(db, identity("github", "7", "ada@example.com"), NOW);
  assert.deepEqual(await accountProfile(db, accountId), { email: "ada@example.com", name: undefined, providers: ["github"] });
  await signInAccount(db, identity("google", "g-1", "ada@example.com", "Ada Lovelace"), NOW);
  assert.deepEqual(await accountProfile(db, accountId), { email: "ada@example.com", name: "Ada Lovelace", providers: ["google", "github"] });
  await deleteAccount(db, accountId, NOW);
  assert.equal(await accountProfile(db, accountId), undefined);
});

test("only a provider-verified email makes an identity, and a blank name is no name", () => {
  assert.equal(verifiedIdentity("github", { subject: "7", verifiedEmail: undefined, name: "Ada" }), undefined);
  assert.equal(verifiedIdentity("github", { subject: "7", verifiedEmail: "not an email", name: undefined }), undefined);
  assert.equal(verifiedIdentity("github", { subject: "", verifiedEmail: "a@b.c", name: undefined }), undefined);
  assert.deepEqual(verifiedIdentity("google", { subject: "g", verifiedEmail: " A@B.C ", name: " Ada " }), {
    provider: "google",
    subject: "g",
    email: "a@b.c",
    name: "Ada",
  });
  assert.equal(verifiedIdentity("google", { subject: "g", verifiedEmail: "a@b.c", name: "  " })?.name, undefined);
});

test("each sign-in refreshes the identity's name, and a name the provider drops is dropped (#190)", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const { accountId } = await signInAccount(db, identity("google", "g-1", "ada@example.com", "Ada"), NOW);
  assert.equal((await accountProfile(db, accountId))?.name, "Ada");
  await signInAccount(db, identity("google", "g-1", "ada@example.com", "Ada Lovelace"), NOW);
  assert.equal((await accountProfile(db, accountId))?.name, "Ada Lovelace");
  await signInAccount(db, identity("google", "g-1", "ada@example.com"), NOW);
  assert.equal((await accountProfile(db, accountId))?.name, undefined);
  // The account holds nothing personal: deleting it takes the names with the identities.
  await signInAccount(db, identity("google", "g-1", "ada@example.com", "Ada"), NOW);
  await deleteAccount(db, accountId, NOW);
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM provider_identity WHERE display_name IS NOT NULL").get() as { n: number }).n, 0);
});

test("a session reads as its account until it expires, and is stored only as a hash", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const { accountId } = await signInAccount(db, identity("google", "g-1", "a@b.c"), NOW);
  const { token, expiresAt } = await createSession(db, accountId, NOW);
  assert.equal(expiresAt, NOW + SESSION_LIFETIME_MS);
  assert.equal(await sessionAccount(db, token, NOW), accountId);
  assert.equal(await sessionAccount(db, token, expiresAt), undefined);
  assert.equal(await sessionAccount(db, `${token.slice(0, -1)}x`, NOW), undefined);
  assert.equal(await sessionAccount(db, "short", NOW), undefined);
  const stored = sqlite.prepare("SELECT session_hash FROM developer_session").all() as { session_hash: string }[];
  assert.ok(stored.every((row) => row.session_hash !== token && /^[0-9a-f]{64}$/.test(row.session_hash)));

  // A new session sweeps the expired ones.
  await createSession(db, accountId, expiresAt + 1);
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM developer_session").get() as { n: number }).n, 1);
});

test("a pending sign-in reads back only as it was written", () => {
  const pending = { provider: "github" as const, state: "s".repeat(43), verifier: "v".repeat(43) };
  assert.deepEqual(readPending(writePending(pending)), pending);
  for (const value of [undefined, "", `apple.${"s".repeat(43)}.${"v".repeat(43)}`, `github.${"s".repeat(43)}`, `${writePending(pending)}.x`]) {
    assert.equal(readPending(value), undefined, String(value));
  }
});

/** A fetch that answers by URL and records what it was sent. */
function fakeFetch(answers: Record<string, () => Response>) {
  const sent: { url: string; init?: RequestInit }[] = [];
  const fetcher: Fetch = async (url, init) => {
    sent.push({ url, init });
    const answer = answers[url];
    if (answer === undefined) throw new Error(`unexpected ${url}`);
    return answer();
  };
  return { fetcher, sent };
}

const REQUEST = { state: "st", codeChallenge: "ch", redirectUri: "https://developers.lexema.fyi/sign-in/x/callback" };
const GRANT = { code: "c0de", codeVerifier: "ver", redirectUri: REQUEST.redirectUri };
const CREDENTIALS = { clientId: "client", clientSecret: "secret" };

test("Google is asked with PKCE S256 and state, and vouches only for an email it marks verified", async () => {
  const url = googleProvider(CREDENTIALS).authorizationUrl(REQUEST);
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: "client",
    redirect_uri: REQUEST.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: "st",
    code_challenge: "ch",
    code_challenge_method: "S256",
  });

  const userinfo = (verified: boolean, extra: Record<string, unknown> = { name: "Ada Lovelace" }) =>
    fakeFetch({
      "https://oauth2.googleapis.com/token": () => Response.json({ access_token: "tok" }),
      "https://openidconnect.googleapis.com/v1/userinfo": () => Response.json({ sub: "g-1", email: "a@b.c", email_verified: verified, ...extra }),
    });
  const verified = userinfo(true);
  assert.deepEqual(await googleProvider(CREDENTIALS, verified.fetcher).exchange(GRANT), {
    outcome: "profile",
    profile: { subject: "g-1", verifiedEmail: "a@b.c", name: "Ada Lovelace" },
  });
  // The `profile` scope is what gives userinfo a name; without one there is none (#190).
  assert.deepEqual(await googleProvider(CREDENTIALS, userinfo(true, {}).fetcher).exchange(GRANT), {
    outcome: "profile",
    profile: { subject: "g-1", verifiedEmail: "a@b.c", name: undefined },
  });
  const form = new URLSearchParams(String(verified.sent[0].init?.body));
  assert.equal(form.get("code_verifier"), "ver");
  assert.equal(form.get("grant_type"), "authorization_code");
  assert.equal(new Headers(verified.sent[1].init?.headers).get("authorization"), "Bearer tok");

  assert.deepEqual(await googleProvider(CREDENTIALS, userinfo(false).fetcher).exchange(GRANT), {
    outcome: "profile",
    profile: { subject: "g-1", verifiedEmail: undefined, name: "Ada Lovelace" },
  });
  // A wrong verifier is Google's 400 invalid_grant.
  const refused = fakeFetch({ "https://oauth2.googleapis.com/token": () => Response.json({ error: "invalid_grant" }, { status: 400 }) });
  assert.deepEqual(await googleProvider(CREDENTIALS, refused.fetcher).exchange(GRANT), { outcome: "refused" });
});

test("GitHub is asked with PKCE S256 and state, and vouches only for a verified primary email", async () => {
  const url = githubProvider(CREDENTIALS).authorizationUrl(REQUEST);
  assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "user:email");

  const github = (emails: unknown, user: Record<string, unknown> = { name: "Ada Lovelace", login: "ada" }) =>
    fakeFetch({
      "https://github.com/login/oauth/access_token": () => Response.json({ access_token: "tok" }),
      "https://api.github.com/user": () => Response.json({ id: 4242, ...user }),
      "https://api.github.com/user/emails": () => Response.json(emails),
    });
  const both = [
    { email: "old@b.c", primary: false, verified: true },
    { email: "a@b.c", primary: true, verified: true },
  ];
  assert.deepEqual(await githubProvider(CREDENTIALS, github(both).fetcher).exchange(GRANT), {
    outcome: "profile",
    profile: { subject: "4242", verifiedEmail: "a@b.c", name: "Ada Lovelace" },
  });
  // GitHub's `name` is null for anyone who never set one: the login stands in (#190).
  assert.deepEqual(await githubProvider(CREDENTIALS, github(both, { name: null, login: "ada" }).fetcher).exchange(GRANT), {
    outcome: "profile",
    profile: { subject: "4242", verifiedEmail: "a@b.c", name: "ada" },
  });
  const unverified = [{ email: "a@b.c", primary: true, verified: false }];
  assert.deepEqual(await githubProvider(CREDENTIALS, github(unverified).fetcher).exchange(GRANT), {
    outcome: "profile",
    profile: { subject: "4242", verifiedEmail: undefined, name: "Ada Lovelace" },
  });
  // GitHub answers a bad code or verifier with a 200 carrying `error`.
  const refused = fakeFetch({
    "https://github.com/login/oauth/access_token": () => Response.json({ error: "bad_verification_code" }),
  });
  assert.deepEqual(await githubProvider(CREDENTIALS, refused.fetcher).exchange(GRANT), { outcome: "refused" });
});
