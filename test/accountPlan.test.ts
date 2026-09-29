// An account's plan state in D1 and the Enterprise CLI (#202), over the real
// schema. What a state means is test/plans.test.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { accountPlan, applySubscription, linkCustomer, type StripeEventRef } from "../src/billing/accountPlan.js";
import { runPlanCommand } from "../src/billing/planCli.js";
import type { SubscriptionSnapshot } from "../src/billing/plans.js";
import { fromNodeSqlite, type TransactionalDatabase } from "../src/lookup/database.js";

const SCHEMA = readFileSync(fileURLToPath(new URL("../src/db/schema.sql", import.meta.url)), "utf8");
const NOW = Date.parse("2026-09-29T12:00:00Z");
const PRICES = { starter: "price_starter", pro: "price_pro" } as const;
const START = Date.parse("2026-09-01T00:00:00Z") / 1000;
const END = Date.parse("2026-10-01T00:00:00Z") / 1000;

/** A database over the schema with accounts 1 to `accounts`. */
function schemaDb(accounts = 1): { raw: DatabaseSync; db: TransactionalDatabase } {
  const raw = new DatabaseSync(":memory:");
  raw.exec(SCHEMA);
  for (let i = 0; i < accounts; i++) raw.prepare("INSERT INTO developer_account (created_at) VALUES (?)").run(new Date(NOW).toISOString());
  return { raw, db: fromNodeSqlite(raw) };
}

const subscription = (status: string, priceId: string = PRICES.starter): SubscriptionSnapshot => ({
  id: "sub_1",
  customerId: "cus_1",
  status,
  cancelAt: null,
  priceId,
  currentPeriodStart: START,
  currentPeriodEnd: END,
});

const event = (id: string, created: number): StripeEventRef => ({ id, type: "customer.subscription.updated", created });

const planRows = (raw: DatabaseSync) => raw.prepare("SELECT * FROM account_plan ORDER BY account_id").all();

test("applying the same event id twice leaves account_plan as after the first", async () => {
  const { raw, db } = schemaDb();
  assert.equal((await applySubscription(db, 1, subscription("active"), event("evt_1", START), PRICES, NOW)).outcome, "applied");
  const afterFirst = planRows(raw);
  // The same event again, even carrying a different snapshot, changes nothing.
  assert.deepEqual(await applySubscription(db, 1, subscription("canceled"), event("evt_1", START), PRICES, NOW + 1000), { outcome: "replayed" });
  assert.deepEqual(planRows(raw), afterFirst);
  assert.deepEqual(await accountPlan(db, 1), {
    state: { kind: "active", plan: { id: "starter" }, period: { start: START * 1000, end: END * 1000 } },
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
  });
  assert.equal(raw.prepare("SELECT count(*) AS n FROM stripe_event").get()?.n, 1);
});

test("an older snapshot applied after a newer one leaves the newer state", async () => {
  const { db } = schemaDb();
  await applySubscription(db, 1, subscription("past_due", PRICES.pro), event("evt_new", START + 60), PRICES, NOW);
  assert.deepEqual(await applySubscription(db, 1, subscription("active"), event("evt_old", START), PRICES, NOW), { outcome: "stale" });
  assert.deepEqual((await accountPlan(db, 1)).state, {
    kind: "past-due",
    plan: { id: "pro" },
    period: { start: START * 1000, end: END * 1000 },
  });
});

test("a snapshot with an unknown price changes nothing and records no event", async () => {
  const { raw, db } = schemaDb();
  assert.deepEqual(await applySubscription(db, 1, subscription("active", "price_other"), event("evt_1", START), PRICES, NOW), {
    outcome: "unknown-price",
    priceId: "price_other",
  });
  assert.deepEqual(planRows(raw), []);
  assert.equal(raw.prepare("SELECT count(*) AS n FROM stripe_event").get()?.n, 0);
});

test("a linked customer is kept: a second link answers the first, and a subscription applies beside it", async () => {
  const { db } = schemaDb();
  assert.equal(await linkCustomer(db, 1, "cus_1"), "cus_1");
  assert.equal(await linkCustomer(db, 1, "cus_2"), "cus_1");
  assert.deepEqual(await accountPlan(db, 1), { state: { kind: "none" }, stripeCustomerId: "cus_1", stripeSubscriptionId: undefined });
  await applySubscription(db, 1, subscription("active"), event("evt_1", START), PRICES, NOW);
  assert.equal((await accountPlan(db, 1)).state.kind, "active");
});

test("a row cannot hold a state its arm forbids", () => {
  const { raw } = schemaDb();
  const insert = (columns: string, values: string) =>
    () => raw.exec(`INSERT INTO account_plan (account_id, ${columns}) VALUES (1, ${values})`);
  const period = "'2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'";
  const refused: [string, () => void][] = [
    ["none with a plan", insert("state, plan", "'none', 'pro'")],
    ["ended with a period", insert("state, plan, stripe_subscription_id, period_start, period_end, as_of", `'ended', 'pro', 'sub_1', ${period}, 'x'`)],
    ["active without a period", insert("state, plan, stripe_subscription_id, as_of", "'active', 'pro', 'sub_1', 'x'")],
    ["active with an end date", insert("state, plan, stripe_subscription_id, period_start, period_end, ends_at, as_of", `'active', 'pro', 'sub_1', ${period}, 'y', 'x'`)],
    ["cancelling without an end date", insert("state, plan, stripe_subscription_id, period_start, period_end, as_of", `'cancelling', 'pro', 'sub_1', ${period}, 'x'`)],
    ["Starter without a subscription", insert("state, plan, period_start, period_end, as_of", `'active', 'starter', ${period}, 'x'`)],
    ["Pro with its own allowance", insert("state, plan, stripe_subscription_id, calls_per_period, calls_per_minute, period_start, period_end, as_of", `'active', 'pro', 'sub_1', 5, 5, ${period}, 'x'`)],
    ["Enterprise without an allowance", insert("state, plan, period_start, period_end, as_of", `'active', 'enterprise', ${period}, 'x'`)],
    ["Enterprise past due", insert("state, plan, calls_per_period, calls_per_minute, period_start, period_end, as_of", `'past-due', 'enterprise', 5, 5, ${period}, 'x'`)],
    ["a period ending before it starts", insert("state, plan, stripe_subscription_id, period_start, period_end, as_of", "'active', 'pro', 'sub_1', '2026-10-01', '2026-09-01', 'x'")],
  ];
  for (const [what, write] of refused) assert.throws(write, /CHECK constraint failed/, what);
  // The same columns holding what their arm carries are stored, so each refusal above is the arm's.
  insert("state, plan, stripe_subscription_id, period_start, period_end, ends_at, as_of", `'cancelling', 'pro', 'sub_1', ${period}, 'y', 'x'`)();
});

test("pnpm run plan sets account 3 to Enterprise and ends it; bad flags print the usage line and exit 1", async () => {
  const { db } = schemaDb(3);
  const set = await runPlanCommand(
    ["enterprise", "3", "--calls", "20000000", "--per-minute", "1000", "--from", "2026-10-01", "--until", "2026-11-01"],
    db,
    NOW,
  );
  assert.deepEqual(set, {
    out: "account 3 is on Enterprise: 20,000,000 calls from 2026-10-01 until 2026-11-01, 1,000 calls a minute",
    status: 0,
  });
  const enterprise = { id: "enterprise", callsPerPeriod: 20_000_000, callsPerMinute: 1000 };
  assert.deepEqual((await accountPlan(db, 3)).state, {
    kind: "active",
    plan: enterprise,
    period: { start: Date.parse("2026-10-01T00:00:00Z"), end: Date.parse("2026-11-01T00:00:00Z") },
  });

  assert.deepEqual(await runPlanCommand(["end", "3"], db, NOW), { out: "ended account 3's Enterprise plan", status: 0 });
  assert.deepEqual((await accountPlan(db, 3)).state, { kind: "ended", plan: enterprise });

  const good = ["--calls", "20000000", "--per-minute", "1000", "--from", "2026-10-01", "--until", "2026-11-01"];
  const bad: string[][] = [
    [],
    ["enterprise", "3"],
    ["enterprise", "x", ...good],
    ["enterprise", "3", ...good, "--extra", "1"],
    ["enterprise", "3", ...good.map((arg) => (arg === "1000" ? "0" : arg))],
    ["enterprise", "3", ...good.map((arg) => (arg === "2026-11-01" ? "2026-02-30" : arg))],
    ["enterprise", "3", ...good.map((arg) => (arg === "2026-11-01" ? "2026-10-01" : arg))],
    ["end"],
    ["end", "3", "4"],
  ];
  for (const args of bad) {
    const { out, status } = await runPlanCommand(args, db, NOW);
    assert.equal(status, 1, args.join(" "));
    assert.match(out, /\nusage:\n {2}pnpm run plan enterprise /, args.join(" "));
  }
});

test("pnpm run plan refuses an account Stripe still bills, and ending a plan that is not Enterprise", async () => {
  const { db } = schemaDb();
  await applySubscription(db, 1, subscription("active"), event("evt_1", START), PRICES, NOW);
  const args = ["enterprise", "1", "--calls", "10", "--per-minute", "1", "--from", "2026-10-01", "--until", "2026-11-01"];
  assert.deepEqual(await runPlanCommand(args, db, NOW), {
    out: "account 1 is active on Starter through Stripe; cancel it in Stripe first",
    status: 1,
  });
  assert.deepEqual(await runPlanCommand(["end", "1"], db, NOW), { out: "account 1 is active on Starter, not an Enterprise plan", status: 1 });
  assert.deepEqual(await runPlanCommand(["end", "2"], db, NOW), { out: "account 2 has no plan, not an Enterprise plan", status: 1 });
  assert.deepEqual(await runPlanCommand([...args.slice(0, 1), "2", ...args.slice(2)], db, NOW), { out: "no account 2", status: 1 });
});
