// Plans, plan states and what a state lets an account's keys do (#161, #202).
//
// Three plans (Huey, #183): Starter and Pro are bought through Stripe and their
// numbers are this file's table; Enterprise is agreed per account and set by
// hand (src/billing/planCli.ts), so it carries its own. A plan state says where
// an account stands, each arm carrying only what it needs. It is read from a
// Stripe subscription (`stateOfSubscription`) or set by hand, and stored in
// `account_plan` (src/billing/accountPlan.ts). No Stripe call is made here.

/** A plan bought through Stripe. */
export type StripePlanId = "starter" | "pro";

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
 * - `past-due`: a renewal payment failed. Still serving while Stripe retries (#200 R1.1).
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

/** Whether an account's keys may call now, and if so under which limits and until when its count runs. */
export type Serving =
  | { readonly serving: false }
  | { readonly serving: true; readonly limits: PlanLimits; readonly resetsAt: number };

/** What a plan state lets an account's keys do at `now`. */
export function serving(state: PlanState, now: number): Serving {
  if (state.kind === "none" || state.kind === "ended") return { serving: false };
  if (state.kind === "cancelling" && now >= state.endsAt) return { serving: false };
  return { serving: true, limits: limitsOf(state.plan), resetsAt: state.period.end };
}

// ---------------------------------------------------------------------------
// From a Stripe subscription
// ---------------------------------------------------------------------------

/**
 * The fields of a Stripe subscription a plan state is read from, as Stripe
 * sends them: times in seconds since the epoch, and the period from the
 * subscription's first item (`items.data[0].current_period_start/end`, where
 * API 2025-03-31.basil moved it). `status` is left a string so a status this
 * code does not know is refused rather than guessed.
 */
export interface SubscriptionSnapshot {
  readonly id: string;
  readonly customerId: string;
  readonly status: string;
  readonly cancelAt: number | null;
  readonly priceId: string;
  readonly currentPeriodStart: number;
  readonly currentPeriodEnd: number;
}

/** The Stripe price id of each Stripe plan, from the Worker's vars. */
export type PriceIds = Readonly<Record<StripePlanId, string>>;

/** Every subscription status Stripe sends, and the kind of plan state each one is. */
const STATUS_KIND = {
  active: "active",
  trialing: "active",
  past_due: "past-due",
  canceled: "ended",
  unpaid: "ended",
  incomplete_expired: "ended",
  // A paused subscription (a trial that ended with no payment method) serves
  // nothing until it is resumed, and a resume arrives as a new snapshot.
  paused: "ended",
  incomplete: "none",
} as const satisfies Record<string, "active" | "past-due" | "ended" | "none">;

export type StripeStatus = keyof typeof STATUS_KIND;

export const STRIPE_STATUSES = Object.keys(STATUS_KIND) as StripeStatus[];

const isStripeStatus = (status: string): status is StripeStatus => Object.hasOwn(STATUS_KIND, status);

/** A subscription's plan state, or why it has none: its price or its status is not one this code knows. */
export type SubscriptionReading =
  | { readonly outcome: "state"; readonly state: PlanState }
  | { readonly outcome: "unknown-price"; readonly priceId: string }
  | { readonly outcome: "unknown-status"; readonly status: string };

const seconds = (value: number): number => value * 1000;

/**
 * The plan state a Stripe subscription puts its account in. `active` and
 * `trialing` are active, or cancelling when `cancel_at` is set; `past_due` is
 * past due; `canceled`, `unpaid`, `incomplete_expired` and `paused` are ended;
 * `incomplete` is none. A price that is neither plan's is refused, never guessed.
 */
export function stateOfSubscription(snapshot: SubscriptionSnapshot, prices: PriceIds): SubscriptionReading {
  const planId = (Object.keys(prices) as StripePlanId[]).find((id) => prices[id] === snapshot.priceId);
  if (planId === undefined) return { outcome: "unknown-price", priceId: snapshot.priceId };
  if (!isStripeStatus(snapshot.status)) return { outcome: "unknown-status", status: snapshot.status };
  const plan: StripePlan = { id: planId };
  const period: Period = { start: seconds(snapshot.currentPeriodStart), end: seconds(snapshot.currentPeriodEnd) };
  const kind = STATUS_KIND[snapshot.status];
  const state: PlanState =
    kind === "none"
      ? NO_PLAN
      : kind === "ended"
        ? { kind, plan }
        : kind === "past-due"
          ? { kind, plan, period }
          : snapshot.cancelAt === null
            ? { kind, plan, period }
            : { kind: "cancelling", plan, period, endsAt: seconds(snapshot.cancelAt) };
  return { outcome: "state", state };
}
