// Each developer account's plan (#161, #260): read it from the account's rows,
// and set or end an Enterprise plan by hand. The Stripe plugin owns the
// `subscription` rows; Lexema owns `enterprise_plan` (src/db/app/schema.ts).
// What a row means is src/billing/plans.ts. No Stripe call is made here.

import { and, eq, isNull, max, sql, type SQLWrapper } from "drizzle-orm";
import type { AppDatabase, AppTables } from "../db/app/database.js";
import { developerAccount, enterprisePlan, subscription } from "../db/app/schema.js";
import {
  holdsPlan,
  NO_PLAN,
  serving,
  stateOfEnterprise,
  stateOfSubscription,
  type EnterprisePlanRow,
  type Period,
  type PlanLimits,
  type PlanState,
  type Serving,
  type SubscriptionRow,
} from "./plans.js";

/**
 * An account's plan state, what it lets the account's keys do at the moment it
 * was read for, and whether the account still holds it then (`holdsPlan`),
 * as `accountPlanAt` reads them from one state.
 */
export interface AccountPlan {
  readonly state: PlanState;
  readonly serving: Serving;
  readonly held: boolean;
}

/** An account's plan in this state at `now`. */
export const accountPlanAt = (state: PlanState, now: number): AccountPlan => ({ state, serving: serving(state, now), held: holdsPlan(state, now) });

/**
 * Where choosing Starter or Pro takes an account (#264): Checkout while it
 * holds no plan, and the billing portal once it does, where a held Stripe plan
 * is switched, renewed or paid rather than bought twice. A past-due plan is
 * held, so its card is fixed in the portal (#571).
 */
export const choiceFor = (plan: AccountPlan): "checkout" | "portal" => (plan.held ? "portal" : "checkout");

/**
 * The state a stored subscription row is in. The table's CHECKs refuse an
 * unknown status and a serving status with no period, so either here is an
 * error, not a state.
 */
function subscriptionState(row: SubscriptionRow): PlanState {
  const reading = stateOfSubscription(row);
  if (reading.outcome === "state") return reading.state;
  throw new Error(`a subscription row the schema should refuse: ${reading.outcome} (${reading.status})`);
}

/** The id of the account's newest subscription row. The plugin names the account as text (`reference_id`). */
const newestSubscriptionId = (db: AppDatabase, accountId: number | SQLWrapper) =>
  db
    .select({ id: max(subscription.id) })
    .from(subscription)
    .where(eq(subscription.referenceId, typeof accountId === "number" ? String(accountId) : sql`CAST(${accountId} AS TEXT)`));

/**
 * The join conditions that read an account's plan rows beside another row:
 * its live Enterprise row, and its newest subscription row. `accountId` is the
 * column that names the account, so the key read (src/api/keys.ts) reads a
 * key's plan in its own statement.
 */
export const planJoins = (db: AppDatabase, accountId: number | SQLWrapper) => ({
  enterprise: and(eq(enterprisePlan.accountId, accountId), isNull(enterprisePlan.endedAt)),
  subscription: eq(subscription.id, sql`(${newestSubscriptionId(db, accountId)})`),
});

/** An account's plan rows as one statement reads them, each absent when the account has none. */
export interface PlanRows {
  readonly enterprise: EnterprisePlanRow | null;
  readonly subscription: SubscriptionRow | null;
}

/** The plan state an account's rows put it in: its live Enterprise plan if it has one, else what its newest subscription says, else none. */
export const stateOfPlanRows = (rows: PlanRows): PlanState =>
  rows.enterprise !== null ? stateOfEnterprise(rows.enterprise) : rows.subscription !== null ? subscriptionState(rows.subscription) : NO_PLAN;

/** The account's live Enterprise row and its newest subscription row, each or both absent, in one statement. */
export const accountPlanQuery = (db: AppDatabase, accountId: number) => {
  const joins = planJoins(db, accountId);
  return db
    .select({ enterprise: enterprisePlan, subscription })
    .from(developerAccount)
    .leftJoin(enterprisePlan, joins.enterprise)
    .leftJoin(subscription, joins.subscription)
    .where(eq(developerAccount.id, accountId));
};

/** An account's plan at `now`. One read. */
export async function accountPlan(db: AppTables, accountId: number, now: number): Promise<AccountPlan> {
  const [row] = await accountPlanQuery(db.app, accountId);
  return accountPlanAt(row === undefined ? NO_PLAN : stateOfPlanRows(row), now);
}

/** The account's newest subscription row alone, as the Enterprise CLI reads it. */
export const newestSubscriptionQuery = (db: AppDatabase, accountId: number) =>
  db
    .select()
    .from(subscription)
    .where(eq(subscription.id, sql`(${newestSubscriptionId(db, accountId)})`));

/** What setting an Enterprise plan did. */
export type EnterpriseSet =
  | { readonly outcome: "set"; readonly state: PlanState }
  /** No account has this id, or it is deleted. */
  | { readonly outcome: "unknown" }
  /** The account still holds a Stripe plan, serving or past due: it is cancelled in Stripe first. */
  | { readonly outcome: "on-stripe"; readonly state: PlanState };

/** Whether the account exists and is not deleted: its primary key. */
export const liveAccountQuery = (db: AppDatabase, accountId: number) =>
  db
    .select({ id: developerAccount.id })
    .from(developerAccount)
    .where(and(eq(developerAccount.id, accountId), isNull(developerAccount.deletedAt)));

/** Write an account's live Enterprise row, replacing the one it had, live or ended. */
export const setEnterpriseQuery = (db: AppDatabase, accountId: number, limits: PlanLimits, period: Period) => {
  const values = { ...limits, periodStart: new Date(period.start), periodEnd: new Date(period.end), endedAt: null };
  return db
    .insert(enterprisePlan)
    .values({ accountId, ...values })
    .onConflictDoUpdate({ target: enterprisePlan.accountId, set: values });
};

/**
 * Put an account on Enterprise with these limits for this period (Huey, by
 * hand). Refused for an account that is unknown or deleted, and for one that
 * still holds a Starter or Pro plan at `now`, serving or past due, which is
 * cancelled in Stripe first.
 */
export async function setEnterprise(db: AppTables, accountId: number, limits: PlanLimits, period: Period, now: number): Promise<EnterpriseSet> {
  const [account] = await liveAccountQuery(db.app, accountId);
  if (account === undefined) return { outcome: "unknown" };
  const [newest] = await newestSubscriptionQuery(db.app, accountId);
  if (newest !== undefined) {
    const current = subscriptionState(newest);
    if (holdsPlan(current, now)) return { outcome: "on-stripe", state: current };
  }
  await setEnterpriseQuery(db.app, accountId, limits, period);
  return { outcome: "set", state: { kind: "active", plan: { id: "enterprise", ...limits }, period } };
}

/** End an account's live Enterprise row. */
export const endEnterpriseQuery = (db: AppDatabase, accountId: number, at: Date) =>
  db
    .update(enterprisePlan)
    .set({ endedAt: at })
    .where(and(eq(enterprisePlan.accountId, accountId), isNull(enterprisePlan.endedAt)))
    .returning({ accountId: enterprisePlan.accountId });

/** The account's Enterprise row, live or ended. */
export const enterpriseRowQuery = (db: AppDatabase, accountId: number) =>
  db.select({ endedAt: enterprisePlan.endedAt }).from(enterprisePlan).where(eq(enterprisePlan.accountId, accountId));

/** End an account's Enterprise plan at `now`. Ending one already ended changes nothing. */
export async function endEnterprise(db: AppTables, accountId: number, now: number): Promise<"ended" | "already-ended" | "none"> {
  const ended = await endEnterpriseQuery(db.app, accountId, new Date(now));
  if (ended.length > 0) return "ended";
  const [row] = await enterpriseRowQuery(db.app, accountId);
  return row === undefined ? "none" : "already-ended";
}
