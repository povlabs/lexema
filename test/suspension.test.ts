// Suspending a developer account and lifting it (#573), over the real schema
// and a fake Stripe client: its keys, its subscriptions, its cards on the Radar
// block list, and `pnpm run account`. The dashboard and billing refusals are
// web/test/dashboard.test.ts and web/test/billing.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { deleteAccount, signInAccount, verifiedIdentity } from "../src/accounts/accounts.js";
import { runAccountCommand } from "../src/accounts/accountCli.js";
import {
  accountCardBlocksQuery,
  accountSuspension,
  accountSuspensionQuery,
  anyHolderQuery,
  holdItemQuery,
  liftQuery,
  liftSuspension,
  otherHoldersQuery,
  releaseItemQuery,
  suspendAccount,
  suspendQuery,
  suspensionReasonOf,
  type SuspensionReach,
  type SuspensionReason,
  type SuspensionStripe,
} from "../src/accounts/suspension.js";
import { authenticate, createKey, keyByHashQuery, revokeKey } from "../src/api/keys.js";
import { createAccountKey, keyName } from "../src/api/ownedKeys.js";
import type { AppTables } from "../src/db/app/database.js";
import { applyAppMigrations } from "../src/db/app/migrations.js";
import { appTablesOverNodeSqlite } from "../src/db/app/nodeSqlite.js";
import { developerAccount, subscription } from "../src/db/app/schema.js";
import { subscribe } from "./databases.js";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const LIST = "rsl_test_blocked_cards";

function appDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  applyAppMigrations(db);
  return db;
}

const reasonOf = (text: string): SuspensionReason => {
  const reason = suspensionReasonOf(text);
  assert.ok(reason !== undefined);
  return reason;
};
const ABUSE = reasonOf("Resold the API.");

async function account(db: AppTables, subject: string, customer?: string): Promise<number> {
  const identity = verifiedIdentity("github", { subject, verifiedEmail: `${subject}@example.com`, name: undefined });
  assert.ok(identity !== undefined);
  const { accountId } = await signInAccount(db, identity, NOW);
  if (customer !== undefined) await db.app.update(developerAccount).set({ stripeCustomerId: customer }).where(eq(developerAccount.id, accountId));
  return accountId;
}

async function ownedKey(db: AppTables, accountId: number): Promise<{ keyId: number; key: string }> {
  const name = keyName("app");
  assert.ok(name !== undefined);
  const created = await createAccountKey(db, accountId, name, NOW);
  assert.ok(created.outcome === "created");
  return { keyId: created.keyId, key: created.key };
}

/**
 * A fake Stripe client: the subscriptions, cards and Radar items a suspension
 * reaches, held in memory. Every call is recorded, so a test sees what reached
 * Stripe.
 */
class FakeStripe implements SuspensionStripe {
  readonly calls: string[] = [];
  readonly items = new Map<string, { id: string; value: string; value_list: string }>();
  private readonly subscriptionsById = new Map<string, Stripe.Subscription>();
  private readonly cards = new Map<string, string[]>();
  private nextItem = 1;
  /** While set, every Radar call fails, as during an outage. */
  radarDown = false;

  constructor() {
    const fake = this;
    this.subscriptions = {
      async retrieve(id) {
        fake.calls.push(`retrieve ${id}`);
        const found = fake.subscriptionsById.get(id);
        if (found === undefined) throw new Error(`no subscription ${id}`);
        return found;
      },
      async cancel(id) {
        fake.calls.push(`cancel ${id}`);
        const found = fake.subscriptionsById.get(id);
        if (found === undefined) throw new Error(`no subscription ${id}`);
        const ended = { ...found, status: "canceled", canceled_at: NOW / 1000, ended_at: NOW / 1000 } as Stripe.Subscription;
        fake.subscriptionsById.set(id, ended);
        return ended;
      },
    };
    this.customers = {
      async *listPaymentMethods(customer) {
        fake.calls.push(`cards ${customer}`);
        for (const fingerprint of fake.cards.get(customer) ?? []) yield { card: { fingerprint } };
      },
    };
    const radar = () => {
      if (fake.radarDown) throw new Error("Stripe is down.");
    };
    this.radar = {
      valueListItems: {
        async list({ value_list, value }) {
          radar();
          // Stripe matches `value` loosely: a longer value that contains it is listed too.
          return { data: [...fake.items.values()].filter((item) => item.value_list === value_list && item.value.includes(value)) };
        },
        async create({ value_list, value }) {
          radar();
          fake.calls.push(`block ${value}`);
          const item = { id: `rsli_${fake.nextItem++}`, value, value_list };
          fake.items.set(item.id, item);
          return item;
        },
        async del(id) {
          radar();
          fake.calls.push(`unblock ${id}`);
          fake.items.delete(id);
          return { id, deleted: true };
        },
      },
    };
  }

  readonly subscriptions: SuspensionStripe["subscriptions"];
  readonly customers: SuspensionStripe["customers"];
  readonly radar: SuspensionStripe["radar"];

  /** A subscription Stripe holds in `status`. */
  subscription(id: string, status: Stripe.Subscription.Status): void {
    this.subscriptionsById.set(id, { id, status, cancel_at_period_end: false, cancel_at: null, canceled_at: null, ended_at: null } as unknown as Stripe.Subscription);
  }

  /** The customer's cards, by fingerprint. */
  card(customer: string, ...fingerprints: string[]): void {
    this.cards.set(customer, [...(this.cards.get(customer) ?? []), ...fingerprints]);
  }

  /** The values on the block list. */
  listed(): string[] {
    return [...this.items.values()].map((item) => item.value).sort();
  }
}

/** Stripe as `stripe` gives it, with the block list configured. */
const reach = (stripe: FakeStripe | undefined): SuspensionReach => ({ stripe, blockList: LIST });
/** Stripe as `stripe` gives it, with no block list configured. */
const noList = (stripe: FakeStripe | undefined): SuspensionReach => ({ stripe, blockList: undefined });

test("every suspension statement is on a primary key or an index", () => {
  const sqlite = appDb();
  const app = appTablesOverNodeSqlite(sqlite).app;
  const planOf = (sql: string, params: unknown[]) =>
    (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(params as (string | number | null)[])) as { detail: string }[])
      .map((row) => row.detail)
      .join("\n");
  const statements = [
    keyByHashQuery(app, "0".repeat(64)),
    accountSuspensionQuery(app, 1),
    suspendQuery(app, 1, { since: new Date(NOW), reason: ABUSE }),
    liftQuery(app, 1),
    accountCardBlocksQuery(app, 1),
    otherHoldersQuery(app, "rsli_1", 1),
    anyHolderQuery(app, "rsli_1"),
    holdItemQuery(app, 1, "rsli_1", "fp"),
    releaseItemQuery(app, 1, "rsli_1"),
  ];
  for (const statement of statements) {
    const { sql, params } = statement.toSQL();
    const plan = planOf(sql, params);
    assert.doesNotMatch(plan, /\bSCAN\b/, `${sql}\n${plan}`);
  }
});

test("a suspension's reason is trimmed and 1 to 500 characters; nothing else is a reason", () => {
  assert.equal(suspensionReasonOf("  Resold the API. "), "Resold the API.");
  assert.equal(suspensionReasonOf("x".repeat(500)), "x".repeat(500));
  for (const text of ["", "   ", "x".repeat(501)]) assert.equal(suspensionReasonOf(text), undefined, JSON.stringify(text));
});

test("a suspended account's key is refused as suspended and answers again once lifted; an admin key is unaffected", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada");
  const { key } = await ownedKey(db, ada);
  const admin = await createKey(db, { label: "admin", perMinuteLimit: 60 }, NOW);
  assert.equal((await authenticate(db, key, NOW)).outcome, "accepted");

  const suspended = await suspendAccount(db, ada, ABUSE, NOW, noList(undefined));
  assert.equal(suspended.outcome, "suspended");
  assert.deepEqual(await authenticate(db, key, NOW + 1), { outcome: "refused", refusal: "suspended" });
  assert.equal((await authenticate(db, admin.key, NOW + 1)).outcome, "accepted");
  assert.deepEqual(await accountSuspension(db, ada), { since: new Date(NOW), reason: ABUSE });

  assert.equal((await liftSuspension(db, ada, undefined)).outcome, "lifted");
  const back = await authenticate(db, key, NOW + 2);
  assert.ok(back.outcome === "accepted");
  assert.deepEqual(back.key.holder.kind, "owned");
  assert.equal(await accountSuspension(db, ada), undefined);
});

test("a revoked key of a suspended account still reads as revoked", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada");
  const { keyId, key } = await ownedKey(db, ada);
  await suspendAccount(db, ada, ABUSE, NOW, noList(undefined));
  await revokeKey(db, keyId, NOW);
  assert.deepEqual(await authenticate(db, key, NOW), { outcome: "refused", refusal: "revoked" });
});

test("suspending cancels at once every subscription that may still bill, through deletion's own path, and leaves ended ones alone", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada", "cus_ada");
  const stripe = new FakeStripe();
  const period = { periodStart: new Date("2026-09-10"), periodEnd: new Date("2026-10-10") };
  await subscribe(db, ada, { plan: "starter", status: "active", stripeSubscriptionId: "sub_active", ...period });
  await subscribe(db, ada, { plan: "pro", status: "past_due", stripeSubscriptionId: "sub_past_due", ...period });
  await subscribe(db, ada, { plan: "pro", status: "canceled", stripeSubscriptionId: "sub_done", periodStart: null, periodEnd: null });
  stripe.subscription("sub_active", "active");
  stripe.subscription("sub_past_due", "past_due");

  const done = await suspendAccount(db, ada, ABUSE, NOW, reach(stripe));
  assert.ok(done.outcome === "suspended");
  assert.deepEqual(done.subscriptions, { outcome: "stopped" });
  assert.deepEqual(
    stripe.calls.filter((call) => call.startsWith("cancel")),
    ["cancel sub_active", "cancel sub_past_due"],
  );
  const statuses = await db.app.select({ stripeSubscriptionId: subscription.stripeSubscriptionId, status: subscription.status }).from(subscription);
  assert.deepEqual(
    statuses.map((row) => `${row.stripeSubscriptionId} ${row.status}`).sort(),
    ["sub_active canceled", "sub_done canceled", "sub_past_due canceled"],
  );

  // A second run finds nothing left to cancel and keeps the first suspension.
  const again = await suspendAccount(db, ada, reasonOf("Another reason."), NOW + 60_000, reach(stripe));
  assert.ok(again.outcome === "suspended");
  assert.equal(again.already, true);
  assert.deepEqual(again.suspension, { since: new Date(NOW), reason: ABUSE });
  assert.equal(stripe.calls.filter((call) => call.startsWith("cancel")).length, 2);
});

test("with billing off, a subscription that may still bill is named and the account is suspended all the same", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada");
  const { key } = await ownedKey(db, ada);
  await subscribe(db, ada, { plan: "starter", status: "active", stripeSubscriptionId: "sub_active", periodStart: new Date("2026-09-10"), periodEnd: new Date("2026-10-10") });
  const done = await suspendAccount(db, ada, ABUSE, NOW, reach(undefined));
  assert.ok(done.outcome === "suspended");
  assert.deepEqual(done.subscriptions, { outcome: "billing-off", billable: ["sub_active"] });
  assert.deepEqual(done.cards, { kind: "skipped", why: "billing-off" });
  assert.deepEqual(await authenticate(db, key, NOW), { outcome: "refused", refusal: "suspended" });
});

test("suspending puts each card of the account on the block list, and lifting takes off exactly what it put there", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada", "cus_ada");
  const stripe = new FakeStripe();
  stripe.card("cus_ada", "fp_visa", "fp_amex", "fp_visa");
  // Someone blocked this card by hand; a suspension that finds it there does not own it.
  stripe.items.set("rsli_manual", { id: "rsli_manual", value: "fp_amex", value_list: LIST });
  // A card whose fingerprint contains another's, which Stripe's loose match lists too.
  stripe.items.set("rsli_other", { id: "rsli_other", value: "fp_visa_other", value_list: LIST });

  const done = await suspendAccount(db, ada, ABUSE, NOW, reach(stripe));
  assert.ok(done.outcome === "suspended");
  assert.deepEqual(done.cards, { kind: "blocked", cards: 2 });
  assert.deepEqual(stripe.listed(), ["fp_amex", "fp_visa", "fp_visa_other"]);
  assert.deepEqual(await accountCardBlocksQuery(db.app, ada), [{ valueListItemId: "rsli_1", cardFingerprint: "fp_visa" }]);

  // Again: nothing more is added.
  await suspendAccount(db, ada, ABUSE, NOW, reach(stripe));
  assert.equal(stripe.calls.filter((call) => call.startsWith("block")).length, 1);

  const lifted = await liftSuspension(db, ada, stripe);
  assert.deepEqual(lifted, { outcome: "lifted", already: false, cards: { kind: "unblocked", removed: 1, shared: 0 } });
  assert.deepEqual(stripe.listed(), ["fp_amex", "fp_visa_other"]);
  assert.deepEqual(await accountCardBlocksQuery(db.app, ada), []);

  // Again: nothing more is removed.
  assert.deepEqual(await liftSuspension(db, ada, stripe), { outcome: "lifted", already: true, cards: { kind: "unblocked", removed: 0, shared: 0 } });
});

test("a card two suspended accounts paid with leaves the list only when the second is lifted", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada", "cus_ada");
  const bob = await account(db, "bob", "cus_bob");
  const stripe = new FakeStripe();
  stripe.card("cus_ada", "fp_shared");
  stripe.card("cus_bob", "fp_shared");
  await suspendAccount(db, ada, ABUSE, NOW, reach(stripe));
  await suspendAccount(db, bob, ABUSE, NOW, reach(stripe));
  assert.deepEqual(stripe.listed(), ["fp_shared"]);

  assert.deepEqual(await liftSuspension(db, ada, stripe), { outcome: "lifted", already: false, cards: { kind: "unblocked", removed: 0, shared: 1 } });
  assert.deepEqual(stripe.listed(), ["fp_shared"]);
  assert.deepEqual(await liftSuspension(db, bob, stripe), { outcome: "lifted", already: false, cards: { kind: "unblocked", removed: 1, shared: 0 } });
  assert.deepEqual(stripe.listed(), []);
});

test("with no block list configured, the Radar step is skipped, and an account with no Stripe customer blocks no card", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada", "cus_ada");
  const bob = await account(db, "bob");
  const stripe = new FakeStripe();
  stripe.card("cus_ada", "fp_visa");
  const skipped = await suspendAccount(db, ada, ABUSE, NOW, noList(stripe));
  assert.ok(skipped.outcome === "suspended");
  assert.deepEqual(skipped.cards, { kind: "skipped", why: "no-block-list" });
  const none = await suspendAccount(db, bob, ABUSE, NOW, reach(stripe));
  assert.ok(none.outcome === "suspended");
  assert.deepEqual(none.cards, { kind: "blocked", cards: 0 });
  assert.deepEqual(stripe.listed(), []);
});

test("a Radar failure leaves the account suspended, and a second run finishes the step", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada", "cus_ada");
  const { key } = await ownedKey(db, ada);
  const stripe = new FakeStripe();
  stripe.card("cus_ada", "fp_visa");
  stripe.radarDown = true;
  await assert.rejects(suspendAccount(db, ada, ABUSE, NOW, reach(stripe)), /Stripe is down/);
  assert.deepEqual(await authenticate(db, key, NOW), { outcome: "refused", refusal: "suspended" });
  stripe.radarDown = false;
  const done = await suspendAccount(db, ada, ABUSE, NOW, reach(stripe));
  assert.ok(done.outcome === "suspended");
  assert.equal(done.already, true);
  assert.deepEqual(stripe.listed(), ["fp_visa"]);
});

test("an unknown account is neither suspended nor lifted, and a deleted one is not suspended", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada");
  await deleteAccount(db, ada, NOW, undefined);
  assert.deepEqual(await suspendAccount(db, 99, ABUSE, NOW, reach(undefined)), { outcome: "unknown" });
  assert.deepEqual(await liftSuspension(db, 99, undefined), { outcome: "unknown" });
  assert.deepEqual(await suspendAccount(db, ada, ABUSE, NOW, reach(undefined)), { outcome: "deleted" });
});

test("a suspended account is deleted through the existing deletion path", async () => {
  const sqlite = appDb();
  const db = appTablesOverNodeSqlite(sqlite);
  const ada = await account(db, "ada");
  await ownedKey(db, ada);
  await suspendAccount(db, ada, ABUSE, NOW, noList(undefined));
  assert.deepEqual(await deleteAccount(db, ada, NOW + 1, undefined), { outcome: "deleted", revokedKeys: 1 });
  const row = sqlite.prepare("SELECT email, deleted_at FROM developer_account WHERE account_id = ?").get(ada);
  assert.deepEqual({ ...row }, { email: `deleted-${ada}@deleted.invalid`, deleted_at: new Date(NOW + 1).toISOString() });
});

test("`pnpm run account` suspends and lifts, says when the Radar step was skipped, and can be run again", async () => {
  const db = appTablesOverNodeSqlite(appDb());
  const ada = await account(db, "ada", "cus_ada");
  const stripe = new FakeStripe();
  stripe.card("cus_ada", "fp_visa");
  const run = (args: string[], over: SuspensionReach = reach(stripe)) => runAccountCommand(args, db, NOW, over);

  assert.deepEqual(await run(["suspend", String(ada), "--reason", " Resold the API. "], noList(stripe)), {
    out: [`suspended account ${ada}: Resold the API.`, "Stripe: no subscription can bill the account", "Radar step skipped: STRIPE_RADAR_BLOCK_LIST is not set"].join("\n"),
    status: 0,
  });
  assert.deepEqual(await run(["suspend", String(ada), "--reason", "Something else."]), {
    out: [
      `account ${ada} was already suspended on ${new Date(NOW).toISOString()}: Resold the API.`,
      "Stripe: no subscription can bill the account",
      "Radar: 1 card is on the block list",
    ].join("\n"),
    status: 0,
  });
  assert.deepEqual(await run(["lift", String(ada)]), {
    out: [`lifted account ${ada}'s suspension; its keys answer again`, "Radar: 1 item taken off the block list"].join("\n"),
    status: 0,
  });
  assert.deepEqual(await run(["lift", String(ada)]), { out: [`account ${ada} was not suspended`, "Radar: 0 items taken off the block list"].join("\n"), status: 0 });

  assert.deepEqual(await run(["suspend", "99", "--reason", "x"]), { out: "no account 99", status: 1 });
  assert.equal((await run(["suspend", String(ada)])).status, 1);
  assert.match((await run(["suspend", String(ada), "--reason", "   "])).out, /^suspend needs --reason, 1 to 500 characters\nusage:/);
  assert.match((await run(["lift"])).out, /^lift needs one account id\nusage:/);
  assert.match((await run(["pause", String(ada)])).out, /^unknown command pause\nusage:/);
  stripe.radarDown = true;
  assert.deepEqual(await run(["suspend", String(ada), "--reason", "Again."]), {
    out: "suspend stopped part way: Stripe is down.\nWhat is done stays done; run the same command again to finish.",
    status: 1,
  });
});
