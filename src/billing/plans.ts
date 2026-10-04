// Plans, plan states and what a state lets an account's keys do (#161, #260).
//
// Three plans (Huey, #183): Starter and Pro are bought through Stripe and their
// numbers are this file's table; Enterprise is agreed per account and set by
// hand (src/billing/planCli.ts), so it carries its own. A plan state says where
// an account stands, each arm carrying only what it needs. It is read from the
// Stripe plugin's `subscription` row (`stateOfSubscription`) or from an
// `enterprise_plan` row (`stateOfEnterprise`); src/billing/accountPlan.ts picks
// the row. No Stripe call is made here.

/** A plan bought through Stripe. */
export type StripePlanId = "starter" | "pro";

/** The plan a form names, or `undefined` for anything else: Checkout sells Starter and Pro only (#264). */
export const stripePlanOf = (text: string | undefined): StripePlanId | undefined => (text === "starter" || text === "pro" ? text : undefined);

/** Every plan. There is no free plan (Huey, #161). */
export type PlanId = StripePlanId | "enterprise";

/** What a plan allows: its allowance, the calls in one billing period, and its rate, the calls a minute. */
export interface PlanLimits {
  readonly callsPerPeriod: number;
  readonly callsPerMinute: number;
}

/**
 * The one table of plan terms (Huey, #183). Nothing else states a plan's
 * numbers. Enterprise's calls and price are by agreement, so it has none here.
 */
export const PLAN_TERMS = {
  starter: { name: "Starter", callsPerPeriod: 1_000_000, callsPerMinute: 60, usdPerMonth: 15, featured: false },
  pro: { name: "Pro", callsPerPeriod: 5_000_000, callsPerMinute: 300, usdPerMonth: 49, featured: true },
  enterprise: { name: "Enterprise", featured: false },
} as const satisfies Record<StripePlanId, PlanLimits & { name: string; usdPerMonth: number; featured: boolean }> &
  Record<"enterprise", { name: string; featured: boolean }>;

/** Starter or Pro: its limits are the table's. */
export interface StripePlan {
  readonly id: StripePlanId;
}

/** Enterprise, with the limits agreed for its account. */
export interface EnterprisePlan extends PlanLimits {
  readonly id: "enterprise";
}

export type Plan = StripePlan | EnterprisePlan;

/** A plan's limits: the table's for Starter and Pro, its own for Enterprise. */
export const limitsOf = (plan: Plan): PlanLimits =>
  plan.id === "enterprise"
    ? { callsPerPeriod: plan.callsPerPeriod, callsPerMinute: plan.callsPerMinute }
    : { callsPerPeriod: PLAN_TERMS[plan.id].callsPerPeriod, callsPerMinute: PLAN_TERMS[plan.id].callsPerMinute };

/**
 * A billing period, in milliseconds since the epoch, from `start` up to but not
 * including `end`: the Stripe subscription item's current period, or the dates
 * Huey set for Enterprise.
 */
export interface Period {
  readonly start: number;
  readonly end: number;
}

/**
 * Where an account stands. Only Starter and Pro can be past due or cancelling:
 * those come from Stripe, and Enterprise is set by hand.
 *
 * - `none`: never had a plan, or its first payment has not gone through.
 * - `active`: serving; a Stripe plan renews at `period.end`, and an Enterprise
 *   period ends there until Huey sets the next one.
 * - `past-due`: a renewal payment failed. Not serving until the payment goes
 *   through, while Stripe retries; the account still holds the plan (#571).
 * - `cancelling`: cancelled, serving until `endsAt` (Stripe's `cancel_at`).
 * - `ended`: no longer serving; `plan` is the one it had.
 */
export type PlanState =
  | { readonly kind: "none" }
  | { readonly kind: "active"; readonly plan: Plan; readonly period: Period }
  | { readonly kind: "past-due"; readonly plan: StripePlan; readonly period: Period }
  | { readonly kind: "cancelling"; readonly plan: StripePlan; readonly period: Period; readonly endsAt: number }
  | { readonly kind: "ended"; readonly plan: Plan };

export const NO_PLAN: PlanState = { kind: "none" };

/**
 * Whether an account's keys may call now, and if so under which limits and in
 * which billing period their calls count: the allowance resets at `period.end`.
 */
export type Serving =
  | { readonly serving: false }
  | { readonly serving: true; readonly limits: PlanLimits; readonly period: Period };

/**
 * What a plan state lets an account's keys do at `now`. Past due does not
 * serve: a failed payment stops the keys until it goes through (Huey, #571).
 * A cancelling plan serves until `endsAt`. An Enterprise period is renewed by
 * nothing, so it stops serving at its end until Huey sets the next one (Huey,
 * #222); a Stripe period is moved on by Stripe's renewal.
 */
export function serving(state: PlanState, now: number): Serving {
  if (state.kind === "none" || state.kind === "ended" || state.kind === "past-due") return { serving: false };
  if (state.kind === "cancelling" && now >= state.endsAt) return { serving: false };
  if (state.plan.id === "enterprise" && now >= state.period.end) return { serving: false };
  return { serving: true, limits: limitsOf(state.plan), period: state.period };
}

/**
 * Whether an account still holds a plan at `now`: one that serves, or a past
 * due one, which serves nothing but Stripe still retries and which serves again
 * once paid (#571). A held plan is managed in the billing portal rather than
 * bought a second time, and Enterprise is not set over a held Stripe plan.
 */
export const holdsPlan = (state: PlanState, now: number): boolean => state.kind === "past-due" || serving(state, now).serving;

// ---------------------------------------------------------------------------
// From a Stripe subscription row
// ---------------------------------------------------------------------------

/**
 * The fields of a `subscription` row (src/db/app/schema.ts) a plan state is
 * read from, as the Stripe plugin writes them: the period is the subscription
 * item's (#200 R1.3), and `cancelAt` is Stripe's `cancel_at`. `status` is
 * read as any string, so a status this code does not know is refused rather
 * than guessed.
 */
export interface SubscriptionRow {
  readonly plan: StripePlanId;
  readonly status: string;
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
  readonly cancelAt: Date | null;
}

/** Every subscription status Stripe sends, and the kind of plan state each one is (#200 R1.1). */
const STATUS_KIND = {
  active: "active",
  trialing: "active",
  past_due: "past-due",
  canceled: "ended",
  unpaid: "ended",
  incomplete_expired: "ended",
  // A paused subscription (a trial that ended with no payment method) serves
  // nothing until it is resumed, and a resume arrives as a new row state.
  paused: "ended",
  incomplete: "none",
} as const satisfies Record<string, "active" | "past-due" | "ended" | "none">;

export type StripeStatus = keyof typeof STATUS_KIND;

export const STRIPE_STATUSES = Object.keys(STATUS_KIND) as StripeStatus[];

const isStripeStatus = (status: string): status is StripeStatus => Object.hasOwn(STATUS_KIND, status);

/**
 * The statuses after which Stripe never bills a subscription again (#209):
 * cancelled, or expired before its first payment. Every other status can
 * still bill, even one that serves nothing: an unpaid or paused subscription
 * can be paid or resumed.
 */
export const FINAL_STATUSES = ["canceled", "incomplete_expired"] as const satisfies readonly StripeStatus[];

/** Whether Stripe will never bill a subscription in this status again. */
export const isFinalStatus = (status: string): boolean => (FINAL_STATUSES as readonly string[]).includes(status);

/**
 * A subscription row's plan state, or why it has none: a status this code
 * does not know, or a serving status with no period, which the plugin writes
 * only once Checkout has completed.
 */
export type SubscriptionReading =
  | { readonly outcome: "state"; readonly state: PlanState }
  | { readonly outcome: "unknown-status"; readonly status: string }
  | { readonly outcome: "no-period"; readonly status: StripeStatus };

/**
 * The plan state a subscription row puts its account in. `active` and
 * `trialing` are active, or cancelling when `cancelAt` is set; `past_due` is
 * past due; `canceled`, `unpaid`, `incomplete_expired` and `paused` are ended;
 * `incomplete` is none. An unknown status is refused, never guessed.
 */
export function stateOfSubscription(row: SubscriptionRow): SubscriptionReading {
  if (!isStripeStatus(row.status)) return { outcome: "unknown-status", status: row.status };
  const plan: StripePlan = { id: row.plan };
  const kind = STATUS_KIND[row.status];
  if (kind === "none") return { outcome: "state", state: NO_PLAN };
  if (kind === "ended") return { outcome: "state", state: { kind, plan } };
  if (row.periodStart === null || row.periodEnd === null) return { outcome: "no-period", status: row.status };
  const period: Period = { start: row.periodStart.getTime(), end: row.periodEnd.getTime() };
  if (kind === "past-due") return { outcome: "state", state: { kind, plan, period } };
  return {
    outcome: "state",
    state: row.cancelAt === null ? { kind, plan, period } : { kind: "cancelling", plan, period, endsAt: row.cancelAt.getTime() },
  };
}

// ---------------------------------------------------------------------------
// From an Enterprise plan row
// ---------------------------------------------------------------------------

/** The fields of an `enterprise_plan` row (src/db/app/schema.ts) a plan state is read from. */
export interface EnterprisePlanRow extends PlanLimits {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly endedAt: Date | null;
}

/**
 * The plan state an Enterprise row puts its account in: active over its period
 * while `endedAt` is unset, ended once it is. The period is read as stored,
 * and `serving` stops it at its end (#222).
 */
export function stateOfEnterprise(row: EnterprisePlanRow): PlanState {
  const plan: EnterprisePlan = { id: "enterprise", callsPerPeriod: row.callsPerPeriod, callsPerMinute: row.callsPerMinute };
  if (row.endedAt !== null) return { kind: "ended", plan };
  return { kind: "active", plan, period: { start: row.periodStart.getTime(), end: row.periodEnd.getTime() } };
}
