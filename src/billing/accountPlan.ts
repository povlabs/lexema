// Each developer account's plan state in D1 (#161, #202): read it, apply a
// Stripe subscription to it, link a Stripe customer, and set or end Enterprise
// by hand. The table is `account_plan` (src/db/schema.sql); what a state means
// is src/billing/plans.ts. No Stripe call is made here: a webhook handler
// hands in the subscription it retrieved.

import type { LookupDatabase, SqlValue, TransactionalDatabase } from "../lookup/database.js";
import {
  NO_PLAN,
  stateOfSubscription,
  type PlanLimits,
  type Period,
  type Plan,
  type PlanState,
  type PriceIds,
  type StripePlan,
  type SubscriptionReading,
  type SubscriptionSnapshot,
} from "./plans.js";

/** An account's plan state and the Stripe ids it is billed under. */
export interface AccountPlan {
  readonly state: PlanState;
  /** `undefined` until Checkout links one (`linkCustomer`), and for an Enterprise set by hand. */
  readonly stripeCustomerId: string | undefined;
  /** The subscription a Starter or Pro state was read from; `undefined` for none and Enterprise. */
  readonly stripeSubscriptionId: string | undefined;
}

/** A Stripe webhook event, by what idempotency and ordering need: its id, its type and its creation time in seconds. */
export interface StripeEventRef {
  readonly id: string;
  readonly type: string;
  readonly created: number;
}

interface PlanRow {
  state: PlanState["kind"];
  plan: Plan["id"] | null;
  calls_per_period: number | null;
  calls_per_minute: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  period_start: string | null;
  period_end: string | null;
  ends_at: string | null;
}

const iso = (ms: number): string => new Date(ms).toISOString();
const ms = (iso: string): number => Date.parse(iso);

/** The columns that hold a state, in `STATE_COLUMNS` order. */
function stateValues(state: PlanState): SqlValue[] {
  const plan = state.kind === "none" ? undefined : state.plan;
  const enterprise = plan?.id === "enterprise" ? plan : undefined;
  const period = state.kind === "none" || state.kind === "ended" ? undefined : state.period;
  return [
    state.kind,
    plan?.id ?? null,
    enterprise?.callsPerPeriod ?? null,
    enterprise?.callsPerMinute ?? null,
    period === undefined ? null : iso(period.start),
    period === undefined ? null : iso(period.end),
    state.kind === "cancelling" ? iso(state.endsAt) : null,
  ];
}

const STATE_COLUMNS = "state, plan, calls_per_period, calls_per_minute, period_start, period_end, ends_at";
const SET_STATE = `state = excluded.state, plan = excluded.plan, calls_per_period = excluded.calls_per_period,
         calls_per_minute = excluded.calls_per_minute, period_start = excluded.period_start,
         period_end = excluded.period_end, ends_at = excluded.ends_at`;

/** The state a row holds. The table's CHECKs make any other shape unstorable, so one here is an error. */
function stateOfRow(row: PlanRow): PlanState {
  if (row.state === "none") return NO_PLAN;
  if (row.plan === null) throw new Error(`an account_plan row in state ${row.state} has no plan`);
  const plan: Plan =
    row.plan === "enterprise"
      ? { id: "enterprise", callsPerPeriod: Number(row.calls_per_period), callsPerMinute: Number(row.calls_per_minute) }
      : { id: row.plan };
  if (row.state === "ended") return { kind: "ended", plan };
  if (row.period_start === null || row.period_end === null) throw new Error(`an account_plan row in state ${row.state} has no period`);
  const period: Period = { start: ms(row.period_start), end: ms(row.period_end) };
  if (row.state === "active") return { kind: "active", plan, period };
  if (plan.id === "enterprise") throw new Error(`an Enterprise account_plan row is ${row.state}`);
  const stripePlan: StripePlan = plan;
  if (row.state === "past-due") return { kind: "past-due", plan: stripePlan, period };
  if (row.ends_at === null) throw new Error("a cancelling account_plan row has no ends_at");
  return { kind: "cancelling", plan: stripePlan, period, endsAt: ms(row.ends_at) };
}

export const ACCOUNT_PLAN_SQL = `SELECT ${STATE_COLUMNS}, stripe_customer_id, stripe_subscription_id
       FROM account_plan WHERE account_id = ?`;

/** An account's plan: `none`, with no Stripe ids, when it has no row. */
export async function accountPlan(db: LookupDatabase, accountId: number): Promise<AccountPlan> {
  const [row] = await db.all<PlanRow>(ACCOUNT_PLAN_SQL, [accountId]);
  return {
    state: row === undefined ? NO_PLAN : stateOfRow(row),
    stripeCustomerId: row?.stripe_customer_id ?? undefined,
    stripeSubscriptionId: row?.stripe_subscription_id ?? undefined,
  };
}

export const EVENT_SEEN_SQL = `SELECT 1 AS seen FROM stripe_event WHERE event_id = ?`;
export const APPLY_SUBSCRIPTION_SQL = `INSERT INTO account_plan (account_id, ${STATE_COLUMNS}, stripe_customer_id, stripe_subscription_id, as_of)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM stripe_event WHERE event_id = ?)
     ON CONFLICT (account_id) DO UPDATE SET ${SET_STATE}, stripe_customer_id = excluded.stripe_customer_id,
         stripe_subscription_id = excluded.stripe_subscription_id, as_of = excluded.as_of
       WHERE account_plan.as_of IS NULL OR excluded.as_of >= account_plan.as_of
     RETURNING account_id`;
export const RECORD_EVENT_SQL = `INSERT INTO stripe_event (event_id, type, received_at) VALUES (?, ?, ?)
     ON CONFLICT (event_id) DO NOTHING`;

/** What applying one event's subscription did. */
export type SubscriptionApplied =
  | { readonly outcome: "applied"; readonly state: PlanState }
  /** The event id was already recorded: nothing changed. */
  | { readonly outcome: "replayed" }
  /** The account's state is as of a later moment than the event: the event is recorded, the state kept. */
  | { readonly outcome: "stale" }
  | Exclude<SubscriptionReading, { outcome: "state" }>;

/**
 * Apply the subscription a Stripe event concerns to an account's plan, and
 * record the event, in one transaction. An event id already recorded changes
 * nothing, and an event created before the moment the account's state is as
 * of is recorded but leaves that state. A subscription with an unknown price
 * or status changes nothing and records nothing, so the event can be applied
 * once the price is configured.
 */
export async function applySubscription(
  db: TransactionalDatabase,
  accountId: number,
  snapshot: SubscriptionSnapshot,
  event: StripeEventRef,
  prices: PriceIds,
  now: number,
): Promise<SubscriptionApplied> {
  const reading = stateOfSubscription(snapshot, prices);
  if (reading.outcome !== "state") return reading;
  const { state } = reading;
  const subscriptionId = state.kind === "none" ? null : snapshot.id;
  const [seen = [], applied = []] = await db.batch([
    { sql: EVENT_SEEN_SQL, params: [event.id] },
    {
      sql: APPLY_SUBSCRIPTION_SQL,
      params: [accountId, ...stateValues(state), snapshot.customerId, subscriptionId, iso(event.created * 1000), event.id],
    },
    { sql: RECORD_EVENT_SQL, params: [event.id, event.type, iso(now)] },
  ]);
  if (seen.length > 0) return { outcome: "replayed" };
  return applied.length > 0 ? { outcome: "applied", state } : { outcome: "stale" };
}

export const LINK_CUSTOMER_SQL = `INSERT INTO account_plan (account_id, state, stripe_customer_id) VALUES (?, 'none', ?)
     ON CONFLICT (account_id) DO UPDATE SET stripe_customer_id = coalesce(account_plan.stripe_customer_id, excluded.stripe_customer_id)
     RETURNING stripe_customer_id`;

/**
 * Link a Stripe customer to an account that has none, and answer the
 * account's customer: this one, or the one already linked, which is kept.
 */
export async function linkCustomer(db: LookupDatabase, accountId: number, customerId: string): Promise<string> {
  const [row] = await db.all<{ stripe_customer_id: string }>(LINK_CUSTOMER_SQL, [accountId, customerId]);
  if (row === undefined) throw new Error(`the customer of account ${accountId} was not stored`);
  return row.stripe_customer_id;
}

/** Whether a state is a Starter or Pro plan Stripe still bills or serves: one only Stripe may change. */
const liveInStripe = (state: PlanState): boolean =>
  state.kind === "active" || state.kind === "past-due" || state.kind === "cancelling" ? state.plan.id !== "enterprise" : false;

export const SET_ENTERPRISE_SQL = `INSERT INTO account_plan (account_id, ${STATE_COLUMNS}, as_of)
     SELECT account_id, ?, ?, ?, ?, ?, ?, ?, ? FROM developer_account WHERE account_id = ? AND deleted_at IS NULL
     ON CONFLICT (account_id) DO UPDATE SET ${SET_STATE}, stripe_subscription_id = NULL, as_of = excluded.as_of
     RETURNING account_id`;

/**
 * Put an account on Enterprise with these limits for this period (Huey, by
 * hand). Refused for an account that is unknown or deleted, and for one on a
 * Starter or Pro plan Stripe still bills, which is cancelled in Stripe first.
 */
export async function setEnterprise(
  db: LookupDatabase,
  accountId: number,
  limits: PlanLimits,
  period: Period,
  now: number,
): Promise<{ outcome: "set"; state: PlanState } | { outcome: "unknown" } | { outcome: "on-stripe"; state: PlanState }> {
  const current = await accountPlan(db, accountId);
  if (liveInStripe(current.state)) return { outcome: "on-stripe", state: current.state };
  const state: PlanState = { kind: "active", plan: { id: "enterprise", ...limits }, period };
  const set = await db.all(SET_ENTERPRISE_SQL, [...stateValues(state), iso(now), accountId]);
  return set.length === 0 ? { outcome: "unknown" } : { outcome: "set", state };
}

export const END_ENTERPRISE_SQL = `UPDATE account_plan SET state = 'ended', period_start = NULL, period_end = NULL, as_of = ?
     WHERE account_id = ? AND plan = 'enterprise' AND state = 'active' RETURNING account_id`;

/** End an account's Enterprise plan. Ending one already ended changes nothing; any other state is not Enterprise's to end. */
export async function endEnterprise(
  db: LookupDatabase,
  accountId: number,
  now: number,
): Promise<{ outcome: "ended" | "already-ended" } | { outcome: "not-enterprise"; state: PlanState }> {
  const { state } = await accountPlan(db, accountId);
  if (state.kind === "ended" && state.plan.id === "enterprise") return { outcome: "already-ended" };
  if (state.kind !== "active" || state.plan.id !== "enterprise") return { outcome: "not-enterprise", state };
  const ended = await db.all(END_ENTERPRISE_SQL, [iso(now), accountId]);
  return ended.length === 0 ? { outcome: "not-enterprise", state } : { outcome: "ended" };
}
