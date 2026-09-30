// Drizzle over node:sqlite through drizzle-orm/sqlite-proxy (#228): drizzle-orm
// 0.45.3 has no node:sqlite driver, and this keeps Drizzle queries on
// `node --test` with no native build.

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { eq } from "drizzle-orm";
import { applyAppMigrations } from "../src/db/app/migrations.js";
import { drizzleOverNodeSqlite } from "../src/db/app/nodeSqlite.js";
import { apiKey, developerAccount } from "../src/db/app/schema.js";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  applyAppMigrations(sqlite);
  return { sqlite, db: drizzleOverNodeSqlite(sqlite) };
}

test("a Drizzle insert and select run through the proxy over DatabaseSync", async () => {
  const { sqlite, db } = database();
  const at = new Date("2026-09-30T12:00:00.000Z");
  const [made] = await db
    .insert(developerAccount)
    .values({ name: "Ada", email: "ada@example.com", emailVerified: true, createdAt: at, updatedAt: at })
    .returning();
  assert.deepEqual(made, { id: 1, name: "Ada", email: "ada@example.com", emailVerified: true, image: null, createdAt: at, updatedAt: at, deletedAt: null, stripeCustomerId: null });

  const found = await db.select().from(developerAccount).where(eq(developerAccount.id, made.id)).get();
  assert.deepEqual(found, made);
  // A moment is stored as ISO-8601 text, like every other time in these tables.
  assert.deepEqual(
    { ...sqlite.prepare("SELECT account_id, email_verified, created_at, deleted_at FROM developer_account").get() },
    { account_id: 1, email_verified: 1, created_at: "2026-09-30T12:00:00.000Z", deleted_at: null },
  );
});

test("a write the table refuses is a rejected query, not a silent row", async () => {
  const { db } = database();
  // An owned key carries no per-minute limit; this one carries one and no owner
  // exists, so the foreign key and the table's CHECK both refuse it.
  await assert.rejects(
    db.insert(apiKey).values({
      keyHash: "0".repeat(64),
      label: "x",
      perMinuteLimit: 60,
      createdAt: "2026-09-30T12:00:00.000Z",
      ownerAccountId: 99,
      displayPrefix: "lx_00000000",
    }),
  );
  assert.deepEqual(await db.select().from(apiKey).all(), []);
});

test("a single-row read that finds no row is undefined, not a row of undefined fields", async () => {
  const { db } = database();
  assert.equal(await db.select().from(developerAccount).where(eq(developerAccount.id, 42)).get(), undefined);
  assert.equal(
    await db.query.developerAccount.findFirst({ where: eq(developerAccount.id, 42) }),
    undefined,
  );
});
