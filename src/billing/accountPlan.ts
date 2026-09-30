// Each developer account's plan (#161, #260): read it from the account's rows,
// and set or end an Enterprise plan by hand. The Stripe plugin owns the
// `subscription` rows; Lexema owns `enterprise_plan` (src/db/app/schema.ts).
// What a row means is src/billing/plans.ts. No Stripe call is made here.

import { and, eq, isNull, max, sql } from "drizzle-orm";
import type { AppDatabase, AppTables } from "../db/app/database.js";
import { developerAccount, enterprisePlan, subscription } from "../db/app/schema.js";
import {
  NO_PLAN,
  serving,
  stateOfEnterprise,
  stateOfSubscription,
  type Period,
  type PlanLimits,
  type PlanState,
  type Serving,
  type SubscriptionRow,
} from "./plans.js";

/** An account's plan state, and what it lets the account's keys do at the moment it was read for. */
export interface AccountPlan {
  readonly state: PlanState;
  readonly serving: Serving;
}

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
const newestSubscriptionId = (db: AppDatabase, accountId: number) =>
  db
    .select({ id: max(subscription.id) })
    .from(subscription)
    .where(eq(subscription.referenceId, String(accountId)));

/** The account's live Enterprise row and its newest subscription row, each or both absent, in one statement. */
export const accountPlanQuery = (db: AppDatabase, accountId: number) =>
  db
    .select({ enterprise: enterprisePlan, subscription })
    .from(developerAccount)
    .leftJoin(enterprisePlan, and(eq(enterprisePlan.accountId, developerAccount.id), isNull(enterprisePlan.endedAt)))
    .leftJoin(subscription, eq(subscription.id, sql`(${newestSubscriptionId(db, accountId)})`))
    .where(eq(developerAccount.id, accountId));

/**
 * An account's plan at `now`: its live Enterprise plan if it has one, else what
 * its newest subscription says, else none. One read.
 */
export async function accountPlan(db: AppTables, accountId: number, now: number): Promise<AccountPlan> {
  const [row] = await accountPlanQuery(db.app, accountId);
  const state =
    row?.enterprise != null ? stateOfEnterprise(row.enterprise) : row?.subscription != null ? subscriptionState(row.subscription) : NO_PLAN;
  return { state, serving: serving(state, now) };
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
  /** The account's Stripe plan still serves: it is cancelled in Stripe first. */
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
 * hand). Refused for an account that is unknown or deleted, and for one whose
 * Starter or Pro plan still serves at `now`, which is cancelled in Stripe first.
 */
export async function setEnterprise(db: AppTables, accountId: number, limits: PlanLimits, period: Period, now: number): Promise<EnterpriseSet> {
  const [account] = await liveAccountQuery(db.app, accountId);
  if (account === undefined) return { outcome: "unknown" };
  const [newest] = await newestSubscriptionQuery(db.app, accountId);
  if (newest !== undefined) {
    const current = subscriptionState(newest);
    if (serving(current, now).serving) return { outcome: "on-stripe", state: current };
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
