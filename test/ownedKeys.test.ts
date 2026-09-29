// A developer account's own keys, their 30-day usage and account deletion
// (#167), over the real schema. The same usage read against what the API
// actually charged is in web/test/api.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  DELETE_ACCOUNT_IDENTITIES_SQL,
  DELETE_ACCOUNT_SESSIONS_SQL,
  MARK_ACCOUNT_DELETED_SQL,
  deleteAccount,
  signInAccount,
  verifiedIdentity,
} from "../src/accounts/accounts.js";
import { createSession, sessionAccount } from "../src/accounts/sessions.js";
import { ALL_ENDPOINTS, expiresAt, onlyEndpoints } from "../src/api/keyAccess.js";
import { authenticate, createKey, DEFAULT_KEY_LIMITS, hashApiKey } from "../src/api/keys.js";
import {
  ACCOUNT_KEYS_SQL,
  createAccountKey,
  INSERT_OWNED_KEY_SQL,
  KEY_NAME_MAX,
  keyName,
  listAccountKeys,
  OWNED_KEY_SQL,
  REVOKE_ACCOUNT_KEYS_SQL,
  REVOKE_OWNED_KEY_SQL,
  revokeAccountKey,
  type KeyName,
} from "../src/api/ownedKeys.js";
import { ACCOUNT_USAGE_SQL, accountUsage, chargeUnits, USAGE_WINDOW_DAYS } from "../src/api/usage.js";
import { fromNodeSqlite, type LookupDatabase } from "../src/lookup/database.js";

const SCHEMA = readFileSync(fileURLToPath(new URL("../src/db/schema.sql", import.meta.url)), "utf8");
const NOW = Date.parse("2026-09-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function schemaDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

const name = (text: string): KeyName => {
  const parsed = keyName(text);
  assert.ok(parsed !== undefined, text);
  return parsed;
};

/** A new account signed in under this email. */
async function account(db: LookupDatabase, email: string): Promise<number> {
  const identity = verifiedIdentity("github", { subject: email, verifiedEmail: email, name: undefined });
  assert.ok(identity !== undefined);
  return (await signInAccount(db, identity, NOW)).accountId;
}

async function ownedKey(db: LookupDatabase, accountId: number, label: string, now = NOW) {
  const created = await createAccountKey(db, accountId, name(label), now);
  assert.equal(created.outcome, "created");
  return created;
}

test("every owned-key, usage and deletion statement is on a primary key or an index", () => {
  const db = schemaDb();
  const planOf = (sql: string, params: (string | number)[]) =>
    (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail).join("\n");
  const at = new Date(NOW).toISOString();
  const cases: [string, (string | number)[]][] = [
    [ACCOUNT_KEYS_SQL, [1]],
    [INSERT_OWNED_KEY_SQL, ["0".repeat(64), "k", 1, 1, at, "lx_00000000", "[\"lookup\"]", at, 1]],
    [REVOKE_OWNED_KEY_SQL, [at, 1, 1]],
    [OWNED_KEY_SQL, [1, 1]],
    [REVOKE_ACCOUNT_KEYS_SQL, [at, 1]],
    [ACCOUNT_USAGE_SQL, [1, "2026-08-30", "2026-09-28"]],
    [MARK_ACCOUNT_DELETED_SQL, [at, 1]],
    [DELETE_ACCOUNT_SESSIONS_SQL, [1]],
    [DELETE_ACCOUNT_IDENTITIES_SQL, [1]],
  ];
  for (const [sql, params] of cases) {
    const plan = planOf(sql, params);
    assert.doesNotMatch(plan, /\bSCAN\b/, `${sql}\n${plan}`);
  }
});

test("a key made for an account is stored hashed with its owner, name, display prefix and the default limits; the secret comes back once", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const ada = await account(db, "ada@example.com");

  const created = await ownedKey(db, ada, "  learning app  ");
  assert.equal(created.outcome, "created");
  assert.match(created.key, /^lx_[0-9a-f]{64}$/);
  assert.equal(created.displayPrefix, created.key.slice(0, 11));

  const [row] = sqlite.prepare("SELECT * FROM api_key").all() as Record<string, unknown>[];
  assert.deepEqual(
    { ...row },
    {
      key_id: created.keyId,
      key_hash: await hashApiKey(created.key),
      label: "learning app",
      per_minute_limit: DEFAULT_KEY_LIMITS.perMinuteLimit,
      daily_units: DEFAULT_KEY_LIMITS.dailyUnits,
      created_at: new Date(NOW).toISOString(),
      revoked_at: null,
      owner_account_id: ada,
      display_prefix: created.displayPrefix,
      last_used_at: null,
      endpoints: null,
      expires_at: null,
    },
  );
  assert.deepEqual(DEFAULT_KEY_LIMITS, { perMinuteLimit: 60, dailyUnits: 20_000 });
  assert.equal((await authenticate(db, created.key, NOW)).outcome, "accepted");
});

test("a key name is trimmed and 1 to 200 characters; nothing else is a name", () => {
  assert.equal(keyName("  app "), "app");
  assert.equal(keyName("x".repeat(KEY_NAME_MAX)), "x".repeat(KEY_NAME_MAX));
  for (const text of ["", "   ", "x".repeat(KEY_NAME_MAX + 1)]) assert.equal(keyName(text), undefined, JSON.stringify(text));
});

test("no key is made for an account that does not exist or was deleted", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const ada = await account(db, "ada@example.com");
  await deleteAccount(db, ada, NOW);
  for (const accountId of [ada, 99]) {
    assert.deepEqual(await createAccountKey(db, accountId, name("app"), NOW), { outcome: "refused", refusal: "no-account" });
  }
  assert.equal(sqlite.prepare("SELECT count(*) AS keys FROM api_key").get()?.keys, 0);
});

test("an account lists only its own keys, newest first, with name, display prefix, created, last used and revoked", async () => {
  const db = fromNodeSqlite(schemaDb());
  const ada = await account(db, "ada@example.com");
  const bob = await account(db, "bob@example.com");
  const first = await ownedKey(db, ada, "first");
  await ownedKey(db, bob, "bob's");
  await createKey(db, { label: "admin", perMinuteLimit: 60, dailyUnits: 20_000 }, NOW);
  const second = await ownedKey(db, ada, "second", NOW + 1_000);
  await authenticate(db, first.key, NOW + 5_000);
  await revokeAccountKey(db, ada, second.keyId, NOW + 9_000);

  assert.deepEqual(await listAccountKeys(db, ada), [
    {
      keyId: second.keyId,
      name: "second",
      displayPrefix: second.displayPrefix,
      createdAt: new Date(NOW + 1_000).toISOString(),
      lastUsedAt: null,
      revokedAt: new Date(NOW + 9_000).toISOString(),
      endpoints: ALL_ENDPOINTS,
      expiresAt: null,
    },
    {
      keyId: first.keyId,
      name: "first",
      displayPrefix: first.displayPrefix,
      createdAt: new Date(NOW).toISOString(),
      lastUsedAt: new Date(NOW + 5_000).toISOString(),
      revokedAt: null,
      endpoints: ALL_ENDPOINTS,
      expiresAt: null,
    },
  ]);
  assert.deepEqual(await listAccountKeys(db, 99), []);
});

test("revoking another account's key, an admin key or a missing key through the owned-key path is refused and changes nothing", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const ada = await account(db, "ada@example.com");
  const bob = await account(db, "bob@example.com");
  const adas = await ownedKey(db, ada, "ada's");
  const bobs = await ownedKey(db, bob, "bob's");
  const admin = await createKey(db, { label: "admin", perMinuteLimit: 60, dailyUnits: 20_000 }, NOW);
  const before = sqlite.prepare("SELECT * FROM api_key ORDER BY key_id").all();

  for (const keyId of [bobs.keyId, admin.keyId, 999]) {
    assert.equal(await revokeAccountKey(db, ada, keyId, NOW), "not-yours", `key ${keyId}`);
  }
  assert.deepEqual(sqlite.prepare("SELECT * FROM api_key ORDER BY key_id").all(), before);
  for (const key of [bobs.key, admin.key]) assert.equal((await authenticate(db, key, NOW)).outcome, "accepted");

  assert.equal(await revokeAccountKey(db, ada, adas.keyId, NOW), "revoked");
  assert.equal(await revokeAccountKey(db, ada, adas.keyId, NOW + 1), "already-revoked");
  assert.deepEqual(await authenticate(db, adas.key, NOW), { outcome: "refused", refusal: "revoked" });
});

test("an accepted key's last use is stamped; a refused one is not", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const ada = await account(db, "ada@example.com");
  const live = await ownedKey(db, ada, "live");
  const revoked = await ownedKey(db, ada, "revoked");
  await revokeAccountKey(db, ada, revoked.keyId, NOW);
  const lastUsed = (keyId: number) => sqlite.prepare("SELECT last_used_at FROM api_key WHERE key_id = ?").get(keyId)?.last_used_at;

  await authenticate(db, live.key, NOW + 60_000);
  assert.equal(lastUsed(live.keyId), new Date(NOW + 60_000).toISOString());
  await authenticate(db, live.key, NOW + 120_000);
  assert.equal(lastUsed(live.keyId), new Date(NOW + 120_000).toISOString());
  assert.deepEqual(await authenticate(db, revoked.key, NOW + 60_000), { outcome: "refused", refusal: "revoked" });
  assert.equal(lastUsed(revoked.keyId), null);
});

test("usage covers the last 30 UTC days per key and in total, 0 where a key was not charged", async () => {
  const db = fromNodeSqlite(schemaDb());
  const ada = await account(db, "ada@example.com");
  const bob = await account(db, "bob@example.com");
  const a = await ownedKey(db, ada, "a");
  const b = await ownedKey(db, ada, "b");
  const bobs = await ownedKey(db, bob, "bob's");
  const keyOf = (keyId: number) => ({ keyId, label: "", perMinuteLimit: 60, dailyUnits: 20_000, endpoints: ALL_ENDPOINTS });

  await chargeUnits(db, keyOf(a.keyId), { endpoint: "lookup" }, NOW); // today: 2
  await chargeUnits(db, keyOf(a.keyId), { endpoint: "nearby" }, NOW); // today: 5 more
  await chargeUnits(db, keyOf(b.keyId), { endpoint: "exists" }, NOW - 29 * DAY); // the window's first day: 1
  await chargeUnits(db, keyOf(b.keyId), { endpoint: "suggest" }, NOW - 30 * DAY); // the day before it: outside
  await chargeUnits(db, keyOf(bobs.keyId), { endpoint: "lookup" }, NOW); // another account's
  await revokeAccountKey(db, ada, b.keyId, NOW);

  const usage = await accountUsage(db, ada, NOW);
  assert.equal(usage.days.length, USAGE_WINDOW_DAYS);
  assert.equal(usage.days[0], "2026-08-30");
  assert.equal(usage.days[USAGE_WINDOW_DAYS - 1], "2026-09-28");
  const zeros = Array<number>(USAGE_WINDOW_DAYS).fill(0);
  const on = (i: number, units: number) => zeros.map((zero, day) => (day === i ? units : zero));
  // Newest key first, as the key list orders them; the revoked key keeps its usage.
  assert.deepEqual(usage.keys, [
    { keyId: b.keyId, units: on(0, 1) },
    { keyId: a.keyId, units: on(USAGE_WINDOW_DAYS - 1, 7) },
  ]);
  assert.deepEqual(usage.total, on(0, 1).map((units, i) => units + on(USAGE_WINDOW_DAYS - 1, 7)[i]));

  const empty = await accountUsage(db, await account(db, "cy@example.com"), NOW);
  assert.deepEqual([empty.days.length, empty.keys, empty.total], [USAGE_WINDOW_DAYS, [], zeros]);
});

test("deleting an account revokes its keys, removes its sessions and identities, keeps its key and usage rows, and the next sign-in makes a new account", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const ada = await account(db, "ada@example.com");
  const google = verifiedIdentity("google", { subject: "g-ada", verifiedEmail: "ada@example.com", name: undefined });
  assert.ok(google !== undefined);
  assert.equal((await signInAccount(db, google, NOW)).accountId, ada);
  const bob = await account(db, "bob@example.com");
  const keys = [await ownedKey(db, ada, "one"), await ownedKey(db, ada, "two")];
  const bobs = await ownedKey(db, bob, "bob's");
  await revokeAccountKey(db, ada, keys[1].keyId, NOW - 1_000);
  await chargeUnits(db, { keyId: keys[0].keyId, label: "", perMinuteLimit: 60, dailyUnits: 20_000, endpoints: ALL_ENDPOINTS }, { endpoint: "lookup" }, NOW);
  const session = await createSession(db, ada, NOW);
  const bobSession = await createSession(db, bob, NOW);

  assert.deepEqual(await deleteAccount(db, ada, NOW), { outcome: "deleted", revokedKeys: 1 });

  for (const { key } of keys) assert.deepEqual(await authenticate(db, key, NOW), { outcome: "refused", refusal: "revoked" });
  assert.equal(await sessionAccount(db, session.token, NOW), undefined);
  const count = (sql: string, ...params: number[]) => (sqlite.prepare(sql).get(...params) as { n: number }).n;
  assert.equal(count("SELECT count(*) AS n FROM provider_identity WHERE account_id = ?", ada), 0);
  assert.equal(count("SELECT count(*) AS n FROM developer_session WHERE account_id = ?", ada), 0);
  assert.equal(count("SELECT count(*) AS n FROM api_key WHERE owner_account_id = ?", ada), 2);
  assert.equal(count("SELECT count(*) AS n FROM api_key_usage WHERE key_id = ?", keys[0].keyId), 1);
  assert.deepEqual(
    { ...sqlite.prepare("SELECT account_id, deleted_at FROM developer_account WHERE account_id = ?").get(ada) },
    { account_id: ada, deleted_at: new Date(NOW).toISOString() },
  );
  // The earlier revocation keeps its own time.
  assert.equal((await listAccountKeys(db, ada))[0].revokedAt, new Date(NOW - 1_000).toISOString());
  assert.equal((await accountUsage(db, ada, NOW)).total.at(-1), 2);

  // Nobody else is touched.
  assert.equal((await authenticate(db, bobs.key, NOW)).outcome, "accepted");
  assert.equal(await sessionAccount(db, bobSession.token, NOW), bob);

  // Either provider under the same email now makes a new, empty account.
  const again = await signInAccount(db, google, NOW + DAY);
  assert.equal(again.match, "new");
  assert.notEqual(again.accountId, ada);
  assert.deepEqual(await listAccountKeys(db, again.accountId), []);

  // Running it again finishes nothing new and keeps the first deletion's time.
  assert.deepEqual(await deleteAccount(db, ada, NOW + DAY), { outcome: "deleted", revokedKeys: 0 });
  assert.equal(
    (sqlite.prepare("SELECT deleted_at FROM developer_account WHERE account_id = ?").get(ada) as { deleted_at: string }).deleted_at,
    new Date(NOW).toISOString(),
  );
  assert.deepEqual(await deleteAccount(db, 99, NOW), { outcome: "unknown" });
});

test("a deletion that fails partway changes nothing: the account stays signed in with its keys live, and running it again finishes it", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const ada = await account(db, "ada@example.com");
  const { key } = await ownedKey(db, ada, "one");
  const session = await createSession(db, ada, NOW);
  // The last of the four statements fails, after the other three have run.
  sqlite.exec("CREATE TRIGGER identities_down BEFORE DELETE ON provider_identity BEGIN SELECT RAISE(ABORT, 'D1 is down'); END");

  await assert.rejects(deleteAccount(db, ada, NOW), /D1 is down/);

  assert.equal(await sessionAccount(db, session.token, NOW), ada);
  assert.equal((await authenticate(db, key, NOW)).outcome, "accepted");
  assert.equal((sqlite.prepare("SELECT deleted_at FROM developer_account WHERE account_id = ?").get(ada) as { deleted_at: null }).deleted_at, null);
  assert.equal((await createAccountKey(db, ada, name("two"), NOW)).outcome, "created");

  sqlite.exec("DROP TRIGGER identities_down");
  assert.deepEqual(await deleteAccount(db, ada, NOW), { outcome: "deleted", revokedKeys: 2 });
  assert.equal(await sessionAccount(db, session.token, NOW), undefined);
  assert.deepEqual(await authenticate(db, key, NOW), { outcome: "refused", refusal: "revoked" });
});

test("a key keeps the endpoints and expiry it was made with; a key made before #187 is every endpoint, never expiring", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const ada = await account(db, "ada@example.com");
  const some = onlyEndpoints(["inflect", "lookup"]);
  assert.ok(some !== undefined);
  const limited = await createAccountKey(db, ada, name("limited"), NOW, { endpoints: some, expiresAt: expiresAt("30-days", NOW) });
  const open = await ownedKey(db, ada, "open");
  // A row as #167 wrote it: no endpoints and no expiry.
  const earlier = await ownedKey(db, ada, "earlier");
  assert.ok(limited.outcome === "created" && earlier.outcome === "created");
  sqlite.prepare("UPDATE api_key SET endpoints = NULL, expires_at = NULL WHERE key_id = ?").run(earlier.keyId);

  const stored = (keyId: number) => ({ ...sqlite.prepare("SELECT endpoints, expires_at FROM api_key WHERE key_id = ?").get(keyId) });
  assert.deepEqual(stored(limited.keyId), { endpoints: '["lookup","inflect"]', expires_at: "2026-10-28T12:00:00.000Z" });
  assert.deepEqual(stored(open.keyId), { endpoints: null, expires_at: null });

  const listed = new Map((await listAccountKeys(db, ada)).map((key) => [key.name, [key.endpoints, key.expiresAt]]));
  assert.deepEqual(listed.get("limited"), [{ kind: "only", endpoints: ["lookup", "inflect"] }, "2026-10-28T12:00:00.000Z"]);
  assert.deepEqual(listed.get("open"), [ALL_ENDPOINTS, null]);
  assert.deepEqual(listed.get("earlier"), [ALL_ENDPOINTS, null]);

  const accepted = await authenticate(db, limited.key, NOW);
  assert.ok(accepted.outcome === "accepted");
  assert.deepEqual(accepted.key.endpoints, some);
  const earlierAccepted = await authenticate(db, earlier.key, NOW + 400 * DAY);
  assert.ok(earlierAccepted.outcome === "accepted");
  assert.deepEqual(earlierAccepted.key.endpoints, ALL_ENDPOINTS);

  // The table keeps no empty or malformed endpoint list.
  for (const value of ["[]", "{}", "lookup", "3"]) {
    assert.throws(() => sqlite.prepare("UPDATE api_key SET endpoints = ? WHERE key_id = ?").run(value, open.keyId), /CHECK constraint failed/, value);
  }
});

test("an expired key is refused as expired from its expiry on, and its last use is not stamped; a revoked one reads as revoked", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);
  const ada = await account(db, "ada@example.com");
  const access = { endpoints: ALL_ENDPOINTS, expiresAt: expiresAt("30-days", NOW) };
  const expiring = await createAccountKey(db, ada, name("expiring"), NOW, access);
  const revoked = await createAccountKey(db, ada, name("revoked"), NOW, access);
  assert.ok(expiring.outcome === "created" && revoked.outcome === "created");
  await revokeAccountKey(db, ada, revoked.keyId, NOW);
  const lastUsed = (keyId: number) => sqlite.prepare("SELECT last_used_at FROM api_key WHERE key_id = ?").get(keyId)?.last_used_at;

  const expiry = NOW + 30 * DAY;
  assert.equal((await authenticate(db, expiring.key, expiry - 1)).outcome, "accepted");
  assert.equal(lastUsed(expiring.keyId), new Date(expiry - 1).toISOString());
  for (const at of [expiry, expiry + DAY]) {
    assert.deepEqual(await authenticate(db, expiring.key, at), { outcome: "refused", refusal: "expired" });
  }
  assert.equal(lastUsed(expiring.keyId), new Date(expiry - 1).toISOString());
  assert.deepEqual(await authenticate(db, revoked.key, expiry + DAY), { outcome: "refused", refusal: "revoked" });
});
