// An account's plan read from the app database, and the Enterprise CLI that
// sets it by hand (#260), over the real migrations. What a row means is
// test/plans.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { accountPlan } from "../src/billing/accountPlan.js";
import { runPlanCommand } from "../src/billing/planCli.js";
import { subscription } from "../src/db/app/schema.js";
import type { AppTables } from "../src/db/app/database.js";
import { freshAppDatabase } from "./databases.js";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const START = new Date("2026-09-01T00:00:00Z");
const END = new Date("2026-10-01T00:00:00Z");
const ENTERPRISE = ["--calls", "20000000", "--per-minute", "1000", "--from", "2026-10-01", "--until", "2026-11-01"];

/** The app database with accounts 1 to `accounts`. */
function withAccounts(accounts: number): { sqlite: DatabaseSync; appDb: AppTables } {
  const { sqlite, appDb } = freshAppDatabase();
  const at = new Date(NOW).toISOString();
  for (let id = 1; id <= accounts; id++) {
    sqlite
      .prepare("INSERT INTO developer_account (account_id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)")
      .run(id, `dev ${id}`, `dev${id}@example.com`, at, at);
  }
  return { sqlite, appDb };
}

const subscribe = (appDb: AppTables, accountId: number, plan: "starter" | "pro", status: "active" | "canceled") =>
  appDb.app.insert(subscription).values({ plan, referenceId: String(accountId), status, periodStart: START, periodEnd: END });

test("accountPlan answers the live Enterprise plan first, else the newest subscription's state, else none", async () => {
  const { appDb } = withAccounts(4);
  const period = { start: START.getTime(), end: END.getTime() };
  // 1: an ended Pro, then an active Starter: the newest is the one read.
  await subscribe(appDb, 1, "pro", "canceled");
  await subscribe(appDb, 1, "starter", "active");
  // 2: Enterprise, over an ended Stripe plan.
  await subscribe(appDb, 2, "pro", "canceled");
  assert.equal((await runPlanCommand(["enterprise", "2", ...ENTERPRISE], appDb, NOW)).status, 0);
  // 3: an Enterprise plan that has ended, over an ended Stripe plan: the subscription is read.
  await subscribe(appDb, 3, "pro", "canceled");
  assert.equal((await runPlanCommand(["enterprise", "3", ...ENTERPRISE], appDb, NOW)).status, 0);
  assert.equal((await runPlanCommand(["end", "3"], appDb, NOW)).status, 0);

  const enterprise = { id: "enterprise", callsPerPeriod: 20_000_000, callsPerMinute: 1000 } as const;
  const enterprisePeriod = { start: Date.parse("2026-10-01T00:00:00Z"), end: Date.parse("2026-11-01T00:00:00Z") };
  assert.deepEqual(await accountPlan(appDb, 1, NOW), {
    state: { kind: "active", plan: { id: "starter" }, period },
    serving: { serving: true, limits: { callsPerPeriod: 1_000_000, callsPerMinute: 60 }, resetsAt: period.end },
  });
  assert.deepEqual(await accountPlan(appDb, 2, NOW), {
    state: { kind: "active", plan: enterprise, period: enterprisePeriod },
    serving: { serving: true, limits: { callsPerPeriod: 20_000_000, callsPerMinute: 1000 }, resetsAt: enterprisePeriod.end },
  });
  assert.deepEqual(await accountPlan(appDb, 3, NOW), { state: { kind: "ended", plan: { id: "pro" } }, serving: { serving: false } });
  assert.deepEqual(await accountPlan(appDb, 4, NOW), { state: { kind: "none" }, serving: { serving: false } });
});

test("pnpm run plan sets account 3 to Enterprise and ends it; bad flags print the usage line and exit 1", async () => {
  const { appDb } = withAccounts(3);
  assert.deepEqual(await runPlanCommand(["enterprise", "3", ...ENTERPRISE], appDb, NOW), {
    out: "account 3 is on Enterprise: 20,000,000 calls from 2026-10-01 until 2026-11-01, 1,000 calls a minute",
    status: 0,
  });
  const enterprise = { id: "enterprise", callsPerPeriod: 20_000_000, callsPerMinute: 1000 };
  assert.deepEqual((await accountPlan(appDb, 3, NOW)).state, {
    kind: "active",
    plan: enterprise,
    period: { start: Date.parse("2026-10-01T00:00:00Z"), end: Date.parse("2026-11-01T00:00:00Z") },
  });

  assert.deepEqual(await runPlanCommand(["end", "3"], appDb, NOW), { out: "ended account 3's Enterprise plan", status: 0 });
  assert.deepEqual((await accountPlan(appDb, 3, NOW)).state, { kind: "none" });
  assert.deepEqual(await runPlanCommand(["end", "3"], appDb, NOW), { out: "account 3's Enterprise plan had already ended", status: 0 });

  const bad: string[][] = [
    [],
    ["enterprise", "3"],
    ["enterprise", "x", ...ENTERPRISE],
    ["enterprise", "3", ...ENTERPRISE, "--extra", "1"],
    ["enterprise", "3", ...ENTERPRISE.map((arg) => (arg === "1000" ? "0" : arg))],
    ["enterprise", "3", ...ENTERPRISE.map((arg) => (arg === "2026-11-01" ? "2026-02-30" : arg))],
    ["enterprise", "3", ...ENTERPRISE.map((arg) => (arg === "2026-11-01" ? "2026-10-01" : arg))],
    ["end"],
    ["end", "3", "4"],
  ];
  for (const args of bad) {
    const { out, status } = await runPlanCommand(args, appDb, NOW);
    assert.equal(status, 1, args.join(" "));
    assert.match(out, /\nusage:\n {2}pnpm run plan enterprise /, args.join(" "));
  }
});

test("pnpm run plan refuses an account whose Stripe plan serves, an unknown account, and ending no Enterprise plan", async () => {
  const { appDb } = withAccounts(2);
  await subscribe(appDb, 1, "starter", "active");
  await subscribe(appDb, 2, "pro", "canceled");
  assert.deepEqual(await runPlanCommand(["enterprise", "1", ...ENTERPRISE], appDb, NOW), {
    out: "account 1 is active on Starter through Stripe; cancel it in Stripe first",
    status: 1,
  });
  // The refusal is the serving plan's: an ended one is not refused.
  assert.equal((await runPlanCommand(["enterprise", "2", ...ENTERPRISE], appDb, NOW)).status, 0);
  assert.deepEqual(await runPlanCommand(["enterprise", "9", ...ENTERPRISE], appDb, NOW), { out: "no account 9", status: 1 });
  assert.deepEqual(await runPlanCommand(["end", "1"], appDb, NOW), { out: "account 1 has no Enterprise plan", status: 1 });
});
