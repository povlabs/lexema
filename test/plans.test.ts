// Plan states read from the Stripe plugin's subscription rows and from
// Enterprise rows, and what each state serves (#260). Reading them from the
// app database is test/accountPlan.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import {
  serving,
  stateOfEnterprise,
  stateOfSubscription,
  STRIPE_STATUSES,
  type PlanState,
  type StripeStatus,
  type SubscriptionRow,
} from "../src/billing/plans.js";

const START = new Date("2026-09-01T00:00:00Z");
const END = new Date("2026-10-01T00:00:00Z");
const CANCEL_AT = new Date("2026-09-20T00:00:00Z");
const period = { start: START.getTime(), end: END.getTime() };

const row = (status: string, cancelAt: Date | null): SubscriptionRow => ({ plan: "pro", status, periodStart: START, periodEnd: END, cancelAt });

test("every Stripe status, with and without cancelAt, is one plan state", () => {
  const pro = { id: "pro" } as const;
  const active: PlanState = { kind: "active", plan: pro, period };
  const cancelling: PlanState = { kind: "cancelling", plan: pro, period, endsAt: CANCEL_AT.getTime() };
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
  assert.deepEqual([...STRIPE_STATUSES].sort(), Object.keys(expected).sort());
  for (const status of STRIPE_STATUSES) {
    const [withoutCancel, withCancel] = expected[status];
    assert.deepEqual(stateOfSubscription(row(status, null)), { outcome: "state", state: withoutCancel }, status);
    assert.deepEqual(stateOfSubscription(row(status, CANCEL_AT)), { outcome: "state", state: withCancel }, `${status} + cancelAt`);
  }
});

test("an unknown status is refused, not guessed", () => {
  assert.deepEqual(stateOfSubscription(row("suspended", null)), { outcome: "unknown-status", status: "suspended" });
});

test("an Enterprise row is active over its period until it is ended", () => {
  const plan = { id: "enterprise", callsPerPeriod: 20_000_000, callsPerMinute: 1000 } as const;
  const enterprise = { callsPerPeriod: 20_000_000, callsPerMinute: 1000, periodStart: START, periodEnd: END };
  assert.deepEqual(stateOfEnterprise({ ...enterprise, endedAt: null }), { kind: "active", plan, period });
  assert.deepEqual(stateOfEnterprise({ ...enterprise, endedAt: CANCEL_AT }), { kind: "ended", plan });
});

test("serving: none and ended refuse; active, past due and cancelling before its end serve under the plan's limits", () => {
  const now = Date.parse("2026-09-15T00:00:00Z");
  const endsAt = CANCEL_AT.getTime();
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
    [{ kind: "active", plan: { id: "pro" }, period }, now, { serving: true, limits: { callsPerPeriod: 5_000_000, callsPerMinute: 300 }, resetsAt: period.end }],
    [{ kind: "active", plan: enterprise, period }, now, { serving: true, limits: { callsPerPeriod: 20_000_000, callsPerMinute: 1000 }, resetsAt: period.end }],
  ];
  for (const [state, at, expected] of cases) assert.deepEqual(serving(state, at), expected, `${state.kind} at ${new Date(at).toISOString()}`);
});
