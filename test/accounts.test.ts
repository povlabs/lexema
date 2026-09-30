// Developer accounts, the rule they follow and the Google and GitHub
// profiles they are read from (#165, #229), over the real schema. The round
// trip through the Worker, on better-auth, is web/test/signIn.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { applyAppMigrations } from "../src/db/app/migrations.js";
import {
  accountByEmailQuery,
  accountIdentitiesQuery,
  accountProfile,
  deleteAccount,
  refreshIdentityQuery,
  signInAccount,
  verifiedIdentity,
  type VerifiedIdentity,
} from "../src/accounts/accounts.js";
import { csrfMatches, csrfToken } from "../src/accounts/csrf.js";
import { profileOf } from "../src/accounts/providers.js";
import { appTablesOverNodeSqlite } from "../src/db/app/nodeSqlite.js";

const NOW = Date.parse("2026-09-28T12:00:00Z");

/** An app database: the app migrations over an empty one, as `APP_DB` is built. */
function appDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  applyAppMigrations(db);
  return db;
}

const identity = (provider: "google" | "github", subject: string, email: string, name?: string): VerifiedIdentity => {
  const verified = verifiedIdentity(provider, { subject, verifiedEmail: email, name });
  assert.ok(verified !== undefined);
  return verified;
};

test("every account read is on a primary key or an index", () => {
  const db = appDb();
  const app = appTablesOverNodeSqlite(db).app;
  const planOf = (sql: string, params: unknown[]) =>
    (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(params as (string | number | null)[])) as { detail: string }[])
      .map((row) => row.detail)
      .join("\n");
  const cases: [{ toSQL(): { sql: string; params: unknown[] } }, RegExp][] = [
    [refreshIdentityQuery(app, identity("google", "x", "a@b.c"), new Date(NOW)), /SEARCH provider_identity USING INDEX provider_identity_provider_user/],
    [accountByEmailQuery(app, "a@b.c"), /SEARCH developer_account USING (COVERING )?INDEX developer_account_email_unique/],
    [accountIdentitiesQuery(app, 1), /SEARCH provider_identity USING INDEX provider_identity_by_account/],
  ];
  for (const [statement, expected] of cases) {
    const { sql, params } = statement.toSQL();
    const plan = planOf(sql, params);
    assert.match(plan, expected, `${sql}\n${plan}`);
  }
});

test("an identity signs in to its own account first, then to the account its verified email already reaches", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  assert.deepEqual(await signInAccount(db, identity("google", "g-1", "Ada@Example.com"), NOW), { accountId: 1, match: "new" });
  assert.deepEqual(await signInAccount(db, identity("github", "7", "ada@example.com"), NOW), { accountId: 1, match: "email" });
  assert.deepEqual(await signInAccount(db, identity("google", "g-1", "ada@example.com"), NOW), { accountId: 1, match: "identity" });
  // The provider's own id wins over a changed email.
  assert.deepEqual(await signInAccount(db, identity("github", "7", "ada@elsewhere.org"), NOW), { accountId: 1, match: "identity" });
  assert.deepEqual(await signInAccount(db, identity("google", "g-2", "bob@example.com"), NOW), { accountId: 2, match: "new" });
});

test("an account's profile is its first email and every provider linked to it, and a deleted account has none", async () => {
  const sqlite = appDb();
  const db = appTablesOverNodeSqlite(sqlite);
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
  const sqlite = appDb();
  const db = appTablesOverNodeSqlite(sqlite);
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

test("an account keeps the email it was made with; deleting it replaces its email and name with nothing personal", async () => {
  const sqlite = appDb();
  const db = appTablesOverNodeSqlite(sqlite);
  const { accountId } = await signInAccount(db, identity("google", "g-1", "Ada@Example.com", "Ada Lovelace"), NOW);
  const account = () => ({ ...sqlite.prepare("SELECT email, name, image, deleted_at FROM developer_account WHERE account_id = ?").get(accountId) });
  assert.deepEqual(account(), { email: "ada@example.com", name: "Ada Lovelace", image: null, deleted_at: null });
  await deleteAccount(db, accountId, NOW);
  assert.deepEqual(account(), { email: `deleted-${accountId}@deleted.invalid`, name: "", image: null, deleted_at: new Date(NOW).toISOString() });
  // The same email is free again, so signing in with it makes a new account.
  assert.deepEqual(await signInAccount(db, identity("google", "g-1", "ada@example.com"), NOW), { accountId: accountId + 1, match: "new" });
});

test("a Google profile is its ID token's sub, name and email, and the email counts only when Google verified it", () => {
  const token = { sub: "g-1", email: "a@b.c", email_verified: true, name: " Ada Lovelace " };
  assert.deepEqual(profileOf("google", { user: { email: "a@b.c", emailVerified: true }, data: token }), {
    subject: "g-1",
    verifiedEmail: "a@b.c",
    name: "Ada Lovelace",
  });
  // The `profile` scope is what gives the token a name; without one there is none (#190).
  assert.deepEqual(profileOf("google", { user: { email: "a@b.c", emailVerified: true }, data: { ...token, name: undefined } }).name, undefined);
  assert.equal(profileOf("google", { user: { email: "a@b.c", emailVerified: false }, data: token }).verifiedEmail, undefined);
});

test("a GitHub profile is its numeric id, its name or else its login, and an email GitHub verified", () => {
  const user = { id: 4242, login: "ada", name: "Ada Lovelace" };
  assert.deepEqual(profileOf("github", { user: { email: "a@b.c", emailVerified: true }, data: user }), {
    subject: "4242",
    verifiedEmail: "a@b.c",
    name: "Ada Lovelace",
  });
  // GitHub's `name` is null for anyone who never set one: the login stands in (#190).
  assert.equal(profileOf("github", { user: { email: "a@b.c", emailVerified: true }, data: { ...user, name: null } }).name, "ada");
  assert.equal(profileOf("github", { user: { email: "a@b.c", emailVerified: true }, data: { ...user, name: "  " } }).name, "ada");
  assert.equal(profileOf("github", { user: { email: "a@b.c", emailVerified: false }, data: user }).verifiedEmail, undefined);
  assert.equal(profileOf("github", { user: { email: null, emailVerified: false }, data: user }).verifiedEmail, undefined);
  // No id is no subject, which `verifiedIdentity` refuses.
  assert.equal(verifiedIdentity("github", profileOf("github", { user: { email: "a@b.c", emailVerified: true }, data: {} })), undefined);
});

test("a session's CSRF token is fixed by its cookie, differs between cookies, and only the exact token matches", async () => {
  const cookie = "tok3n.s1gnature%3D";
  const token = await csrfToken(cookie);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await csrfToken(cookie), token);
  assert.notEqual(await csrfToken("other.cookie"), token);
  assert.equal(await csrfMatches(cookie, token), true);
  for (const submitted of [undefined, "", token.slice(1), `${token}x`, await csrfToken("other.cookie")]) {
    assert.equal(await csrfMatches(cookie, submitted), false, String(submitted));
  }
});
