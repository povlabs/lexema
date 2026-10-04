// Plan states read from the Stripe plugin's subscription rows and from
// Enterprise rows, and what each state serves (#260). Reading them from the
// app database is test/accountPlan.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import {
  holdsPlan,
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

test("serving: none, ended, past due and an Enterprise period past its end refuse; active and cancelling before its end serve under the plan's limits", () => {
  const now = Date.parse("2026-09-15T00:00:00Z");
  const endsAt = CANCEL_AT.getTime();
  const starter = { id: "starter" } as const;
  const enterprise = { id: "enterprise", callsPerPeriod: 20_000_000, callsPerMinute: 1000 } as const;
  const starterServes = { serving: true, limits: { callsPerPeriod: 1_000_000, callsPerMinute: 60 }, period };
  const cases: [PlanState, number, unknown][] = [
    [{ kind: "none" }, now, { serving: false }],
    [{ kind: "ended", plan: starter }, now, { serving: false }],
    [{ kind: "active", plan: starter, period }, now, starterServes],
    // A failed payment stops the keys until it goes through (Huey, #571).
    [{ kind: "past-due", plan: starter, period }, now, { serving: false }],
    [{ kind: "cancelling", plan: starter, period, endsAt }, now, starterServes],
    [{ kind: "cancelling", plan: starter, period, endsAt }, endsAt, { serving: false }],
    [{ kind: "active", plan: { id: "pro" }, period }, now, { serving: true, limits: { callsPerPeriod: 5_000_000, callsPerMinute: 300 }, period }],
    [{ kind: "active", plan: enterprise, period }, now, { serving: true, limits: { callsPerPeriod: 20_000_000, callsPerMinute: 1000 }, period }],
    // An Enterprise period stops serving at its end (#222); a Stripe one is moved on by Stripe's renewal.
    [{ kind: "active", plan: enterprise, period }, period.end - 1, { serving: true, limits: { callsPerPeriod: 20_000_000, callsPerMinute: 1000 }, period }],
    [{ kind: "active", plan: enterprise, period }, period.end, { serving: false }],
    [{ kind: "active", plan: starter, period }, period.end, starterServes],
  ];
  for (const [state, at, expected] of cases) assert.deepEqual(serving(state, at), expected, `${state.kind} at ${new Date(at).toISOString()}`);
});

test("holdsPlan: a serving plan and a past-due one are held; none, ended, and a plan past its end are not (#571)", () => {
  const now = Date.parse("2026-09-15T00:00:00Z");
  const endsAt = CANCEL_AT.getTime();
  const starter = { id: "starter" } as const;
  const enterprise = { id: "enterprise", callsPerPeriod: 20_000_000, callsPerMinute: 1000 } as const;
  const cases: [PlanState, number, boolean][] = [
    [{ kind: "none" }, now, false],
    [{ kind: "ended", plan: starter }, now, false],
    [{ kind: "active", plan: starter, period }, now, true],
    [{ kind: "past-due", plan: starter, period }, now, true],
    [{ kind: "past-due", plan: starter, period }, period.end, true],
    [{ kind: "cancelling", plan: starter, period, endsAt }, now, true],
    [{ kind: "cancelling", plan: starter, period, endsAt }, endsAt, false],
    [{ kind: "active", plan: enterprise, period }, now, true],
    [{ kind: "active", plan: enterprise, period }, period.end, false],
  ];
  for (const [state, at, expected] of cases) assert.equal(holdsPlan(state, at), expected, `${state.kind} at ${new Date(at).toISOString()}`);
});
