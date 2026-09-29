// Plan states read from Stripe subscriptions, and what each state serves (#202).
// Storing them is test/accountPlan.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import {
  serving,
  stateOfSubscription,
  STRIPE_STATUSES,
  type PlanState,
  type StripeStatus,
  type SubscriptionSnapshot,
} from "../src/billing/plans.js";

const PRICES = { starter: "price_starter", pro: "price_pro" } as const;
const START = Date.parse("2026-09-01T00:00:00Z") / 1000;
const END = Date.parse("2026-10-01T00:00:00Z") / 1000;
const CANCEL_AT = END;
const period = { start: START * 1000, end: END * 1000 };

const snapshot = (status: string, cancelAt: number | null, priceId: string = PRICES.pro): SubscriptionSnapshot => ({
  id: "sub_1",
  customerId: "cus_1",
  status,
  cancelAt,
  priceId,
  currentPeriodStart: START,
  currentPeriodEnd: END,
});

test("every Stripe status, with and without cancel_at, is one plan state", () => {
  const pro = { id: "pro" } as const;
  const active: PlanState = { kind: "active", plan: pro, period };
  const cancelling: PlanState = { kind: "cancelling", plan: pro, period, endsAt: CANCEL_AT * 1000 };
  const pastDue: PlanState = { kind: "past-due", plan: pro, period };
  const ended: PlanState = { kind: "ended", plan: pro };
  const expected: Record<StripeStatus, [withoutCancel: PlanState, withCancel: PlanState]> = {
    active: [active, cancelling],
    trialing: [active, cancelling],
    past_due: [pastDue, pastDue],
    canceled: [ended, ended],
    unpaid: [ended, ended],
    incomplete_expired: [ended, ended],
    paused: [ended, ended],
    incomplete: [{ kind: "none" }, { kind: "none" }],
  };
  assert.deepEqual(Object.keys(expected).sort(), [...STRIPE_STATUSES].sort());
  for (const status of STRIPE_STATUSES) {
    const [withoutCancel, withCancel] = expected[status];
    assert.deepEqual(stateOfSubscription(snapshot(status, null), PRICES), { outcome: "state", state: withoutCancel }, status);
    assert.deepEqual(stateOfSubscription(snapshot(status, CANCEL_AT), PRICES), { outcome: "state", state: withCancel }, `${status} + cancel_at`);
  }
  assert.deepEqual(stateOfSubscription(snapshot("active", null, PRICES.starter), PRICES), {
    outcome: "state",
    state: { kind: "active", plan: { id: "starter" }, period },
  });
});

test("an unknown price or status is refused, not guessed", () => {
  assert.deepEqual(stateOfSubscription(snapshot("active", null, "price_other"), PRICES), { outcome: "unknown-price", priceId: "price_other" });
  assert.deepEqual(stateOfSubscription(snapshot("suspended", null), PRICES), { outcome: "unknown-status", status: "suspended" });
});

test("serving: none and ended refuse; active, past due and cancelling before its end serve under the plan's limits", () => {
  const now = Date.parse("2026-09-15T00:00:00Z");
  const endsAt = Date.parse("2026-09-20T00:00:00Z");
  const starter = { id: "starter" } as const;
  const enterprise = { id: "enterprise", callsPerPeriod: 20_000_000, callsPerMinute: 1000 } as const;
  const starterServes = { serving: true, limits: { callsPerPeriod: 1_000_000, callsPerMinute: 60 }, resetsAt: period.end };
  const cases: [PlanState, number, unknown][] = [
    [{ kind: "none" }, now, { serving: false }],
    [{ kind: "ended", plan: starter }, now, { serving: false }],
    [{ kind: "active", plan: starter, period }, now, starterServes],
    [{ kind: "past-due", plan: starter, period }, now, starterServes],
    [{ kind: "cancelling", plan: starter, period, endsAt }, now, starterServes],
    [{ kind: "cancelling", plan: starter, period, endsAt }, endsAt, { serving: false }],
    [
      { kind: "active", plan: { id: "pro" }, period },
      now,
      { serving: true, limits: { callsPerPeriod: 5_000_000, callsPerMinute: 300 }, resetsAt: period.end },
    ],
    [
      { kind: "active", plan: enterprise, period },
      now,
      { serving: true, limits: { callsPerPeriod: 20_000_000, callsPerMinute: 1000 }, resetsAt: period.end },
    ],
  ];
  for (const [state, at, expected] of cases) assert.deepEqual(serving(state, at), expected, `${state.kind} at ${new Date(at).toISOString()}`);
});
