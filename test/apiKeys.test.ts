// API keys, unit weights and the per-key counters (#150), over the real
// schema. The handler that uses them is web/test/api.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { runKeyCommand } from "../src/api/keyCli.js";
import {
  INSERT_KEY_SQL,
  KEY_BY_HASH_SQL,
  KEY_BY_ID_SQL,
  REVOKE_KEY_SQL,
  authenticate,
  hashApiKey,
} from "../src/api/keys.js";
import { UNIT_WEIGHT, unitCost } from "../src/api/units.js";
import { CHARGE_UNITS_SQL, COUNT_MINUTE_SQL, SWEEP_MINUTES_SQL } from "../src/api/usage.js";
import { fromNodeSqlite } from "../src/lookup/database.js";

const SCHEMA = readFileSync(fileURLToPath(new URL("../src/db/schema.sql", import.meta.url)), "utf8");
const NOW = Date.parse("2026-09-27T12:00:00Z");

function schemaDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

test("every endpoint in the brief's table has its unit weight, and a batch is charged per word", () => {
  assert.deepEqual(UNIT_WEIGHT, {
    lookup: { per: "request", units: 2 },
    lemmatize: { per: "request", units: 1 },
    exists: { per: "request", units: 1 },
    inflect: { per: "request", units: 2 },
    suggest: { per: "request", units: 3 },
    nearby: { per: "request", units: 5 },
    random: { per: "request", units: 2 },
    "lookup/batch": { per: "word", units: 1 },
  });
  assert.equal(unitCost({ endpoint: "lookup" }), 2);
  assert.equal(unitCost({ endpoint: "lookup/batch", words: 37 }), 37);
});

test("every key, minute and usage read or write is on a primary key or an index", () => {
  const db = schemaDb();
  const planOf = (sql: string, params: (string | number)[]) =>
    (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);

  // Reads and updates: a SEARCH through the key's index, never a SCAN.
  const searches: [string, (string | number)[], RegExp][] = [
    [KEY_BY_HASH_SQL, ["0".repeat(64)], /SEARCH api_key USING (COVERING )?INDEX sqlite_autoindex_api_key_1 \(key_hash=\?\)/],
    [KEY_BY_ID_SQL, [1], /SEARCH api_key USING INTEGER PRIMARY KEY \(rowid=\?\)/],
    [REVOKE_KEY_SQL, [new Date(NOW).toISOString(), 1], /SEARCH api_key USING INTEGER PRIMARY KEY \(rowid=\?\)/],
    [SWEEP_MINUTES_SQL, [1, 100], /SEARCH api_key_minute USING (COVERING )?INDEX sqlite_autoindex_api_key_minute_1 \(key_id=\? AND minute<\?\)/],
  ];
  for (const [sql, params, expected] of searches) {
    const plan = planOf(sql, params);
    assert.ok(plan.some((step) => expected.test(step)), `${sql}\n${plan.join("\n")}`);
    assert.ok(!plan.some((step) => /\bSCAN\b/.test(step)), `${sql}\n${plan.join("\n")}`);
  }

  // Inserts and upserts scan nothing: a key's insert checks its counters'
  // foreign keys through their primary keys, and SQLite accepts an upsert's
  // conflict target only when a primary key or unique index backs it.
  for (const [sql, params] of [
    [INSERT_KEY_SQL, ["0".repeat(64), "k", 1, 1, "t"]],
    [COUNT_MINUTE_SQL, [1, 100]],
    [CHARGE_UNITS_SQL, [1, "2026-09-27", 2]],
  ] as const) {
    const plan = planOf(sql, [...params]);
    assert.ok(!plan.some((step) => /\bSCAN\b/.test(step)), `${sql}\n${plan.join("\n")}`);
  }
});

test("the key CLI prints a new key once, stores only its hash, and revokes it", async () => {
  const sqlite = schemaDb();
  const db = fromNodeSqlite(sqlite);

  const created = await runKeyCommand(
    ["create", "--label", "learning app", "--per-minute", "60", "--daily-units", "20000"],
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
  assert.equal((await authenticate(db, key)).outcome, "accepted");

  assert.deepEqual(await runKeyCommand(["revoke", "1"], db, NOW), { out: "revoked key 1", status: 0 });
  assert.deepEqual(await authenticate(db, key), { outcome: "refused", refusal: "revoked" });
  assert.deepEqual(await runKeyCommand(["revoke", "2"], db, NOW), { out: "no key 2", status: 1 });

  for (const args of [["create", "--label", "x", "--per-minute", "0", "--daily-units", "5"], ["create"], ["revoke"], ["list"]]) {
    assert.equal((await runKeyCommand(args, db, NOW)).status, 1, args.join(" "));
  }
  assert.equal(sqlite.prepare("SELECT count(*) AS keys FROM api_key").get()?.keys, 1);
});
