// API keys and the per-key counters (#150, #201), over the real
// schema. The handler that uses them is web/test/api.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { applyAppMigrations } from "../src/db/app/migrations.js";
import { drizzleOverNodeSqlite } from "../src/db/app/nodeSqlite.js";
import { runKeyCommand } from "../src/api/keyCli.js";
import {
  acceptKeyQuery,
  authenticate,
  hashApiKey,
  insertKeyQuery,
  keyByHashQuery,
  keyByIdQuery,
  revokeKeyQuery,
} from "../src/api/keys.js";
import { chargeCallsQuery, countMinuteQuery, sweepMinutesQuery } from "../src/api/usage.js";
import { fromNodeSqlite } from "../src/lookup/database.js";

const SCHEMA = readFileSync(fileURLToPath(new URL("../src/db/schema.sql", import.meta.url)), "utf8");
const NOW = Date.parse("2026-09-27T12:00:00Z");

function schemaDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  applyAppMigrations(db);
  return db;
}

/** A Drizzle statement, as SQL and the values it binds. */
type Built = { toSQL(): { sql: string; params: unknown[] } };

test("every key, minute and usage read or write is on a primary key or an index", () => {
  const db = schemaDb();
  const app = fromNodeSqlite(db).app;
  const at = new Date(NOW).toISOString();
  const planOf = (statement: Built) => {
    const { sql, params } = statement.toSQL();
    return (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(params as (string | number | null)[])) as { detail: string }[]).map(
      (row) => row.detail,
    );
  };

  // Reads and updates: a SEARCH through the key's index, never a SCAN.
  const searches: [Built, RegExp][] = [
    [keyByHashQuery(app, "0".repeat(64)), /SEARCH api_key USING (COVERING )?INDEX sqlite_autoindex_api_key_1 \(key_hash=\?\)/],
    [acceptKeyQuery(app, "0".repeat(64), at), /SEARCH api_key USING INDEX sqlite_autoindex_api_key_1 \(key_hash=\?\)/],
    [keyByIdQuery(app, 1), /SEARCH api_key USING INTEGER PRIMARY KEY \(rowid=\?\)/],
    [revokeKeyQuery(app, 1, at), /SEARCH api_key USING INTEGER PRIMARY KEY \(rowid=\?\)/],
    [sweepMinutesQuery(app, 1, 100), /SEARCH api_key_minute USING (COVERING )?INDEX sqlite_autoindex_api_key_minute_1 \(key_id=\? AND minute<\?\)/],
  ];
  for (const [statement, expected] of searches) {
    const plan = planOf(statement);
    assert.ok(plan.some((step) => expected.test(step)), `${statement.toSQL().sql}\n${plan.join("\n")}`);
    assert.ok(!plan.some((step) => /\bSCAN\b/.test(step)), `${statement.toSQL().sql}\n${plan.join("\n")}`);
  }

  // Inserts and upserts scan nothing: a key's insert checks its counters'
  // foreign keys through their primary keys, and SQLite accepts an upsert's
  // conflict target only when a primary key or unique index backs it.
  for (const statement of [
    insertKeyQuery(app, "0".repeat(64), { label: "k", perMinuteLimit: 1 }, "t", "lx_00000000"),
    countMinuteQuery(app, 1, 100),
    chargeCallsQuery(app, 1, "2026-09-27", 2),
  ]) {
    const plan = planOf(statement);
    assert.ok(!plan.some((step) => /\bSCAN\b/.test(step)), `${statement.toSQL().sql}\n${plan.join("\n")}`);
  }
});

test("a key stored before its reads moved onto Drizzle still authenticates, in the one statement that stamps its use", async () => {
  // The row as the raw INSERT of the slice before stored it: an admin key from
  // before #187, with no endpoints or expiry of its own.
  const sqlite = schemaDb();
  const key = `lx_${"7f3a9c1d".repeat(8)}`;
  sqlite
    .prepare(
      `INSERT INTO api_key (key_hash, label, per_minute_limit, created_at, display_prefix)
       VALUES (?, 'learning app', 60, '2026-09-01T00:00:00.000Z', ?)`,
    )
    .run(await hashApiKey(key), key.slice(0, 11));
  const before = { ...sqlite.prepare("SELECT * FROM api_key").get() };
  // Every statement Drizzle sends, on its way to the database.
  const sent: string[] = [];
  const watched = new Proxy(sqlite, {
    get: (target, property) =>
      property === "prepare" ? (sql: string) => (sent.push(sql), target.prepare(sql)) : Reflect.get(target, property, target),
  });

  assert.deepEqual(await authenticate({ app: drizzleOverNodeSqlite(watched) }, key, NOW), {
    outcome: "accepted",
    key: { keyId: 1, label: "learning app", holder: { kind: "admin", perMinuteLimit: 60 }, endpoints: { kind: "all" } },
  });
  assert.deepEqual({ ...sqlite.prepare("SELECT * FROM api_key").get() }, { ...before, last_used_at: new Date(NOW).toISOString() });
  assert.equal(sent.length, 1, sent.join("\n"));
  assert.match(sent[0], /^update "api_key" set "last_used_at" = \? where .* returning /);
});

test("the key CLI prints a new key once, stores only its hash, and revokes it", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);

  const created = await runKeyCommand(
    ["create", "--label", "learning app", "--per-minute", "60"],
    db,
    NOW,
  );
  assert.equal(created.status, 0);
  const key = created.out.match(/lx_[0-9a-f]{64}/)?.[0];
  assert.ok(key !== undefined, created.out);
  const stored = sqlite.prepare("SELECT * FROM api_key").all() as Record<string, unknown>[];
  assert.equal(stored.length, 1);
  assert.equal(stored[0].key_hash, await hashApiKey(key));
  assert.ok(!Object.values(stored[0]).includes(key));
  // An admin key: no owner, its own limit, and its first characters kept to name it by.
  assert.equal(stored[0].owner_account_id, null);
  assert.equal(stored[0].per_minute_limit, 60);
  assert.equal(stored[0].display_prefix, key.slice(0, 11));
  assert.equal((await authenticate(db, key, NOW)).outcome, "accepted");

  assert.deepEqual(await runKeyCommand(["revoke", "1"], db, NOW), { out: "revoked key 1", status: 0 });
  assert.deepEqual(await authenticate(db, key, NOW), { outcome: "refused", refusal: "revoked" });
  assert.deepEqual(await runKeyCommand(["revoke", "2"], db, NOW), { out: "no key 2", status: 1 });

  const refused = [
    ["create", "--label", "x", "--per-minute", "0"],
    ["create", "--label", "x", "--per-minute", "60", "--daily-units", "5"],
    ["create"],
    ["revoke"],
    ["list"],
  ];
  for (const args of refused) {
    assert.equal((await runKeyCommand(args, db, NOW)).status, 1, args.join(" "));
  }
  assert.equal(sqlite.prepare("SELECT count(*) AS keys FROM api_key").get()?.keys, 1);
});

test("the schema refuses an owned key with a per-minute limit of its own, and an admin key without one", () => {
  const db = schemaDb();
  db.exec(
    "INSERT INTO developer_account (account_id, name, email, email_verified, created_at, updated_at) VALUES (1, 'Ada', 'ada@example.com', 1, '2026-09-27T12:00:00.000Z', '2026-09-27T12:00:00.000Z')",
  );
  let n = 0;
  const insert = (perMinuteLimit: number | null, owner: number | null) =>
    db
      .prepare(
        `INSERT INTO api_key (key_hash, label, per_minute_limit, created_at, display_prefix, owner_account_id)
         VALUES (?, 'k', ?, '2026-09-27T12:00:00.000Z', 'lx_00000000', ?)`,
      )
      .run(String(n++).padStart(64, "0"), perMinuteLimit, owner);

  assert.throws(() => insert(60, 1), /CHECK constraint failed/);
  assert.throws(() => insert(null, null), /CHECK constraint failed/);
  insert(null, 1);
  insert(60, null);
  assert.equal(db.prepare("SELECT count(*) AS keys FROM api_key").get()?.keys, 2);
});
