// The settings Plan section's states and the dashboard's period meter (#207,
// board 28i), as the server renders them from a plan state.

import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AccountProfile } from "../../src/accounts/accounts.js";
import { AccountUsage, usageDays } from "../../src/api/usage.js";
import { accountPlanAt } from "../../src/billing/accountPlan.js";
import { NO_PLAN, serving, type Period, type PlanState } from "../../src/billing/plans.js";
import { Dashboard } from "@/components/developers/dashboard/Dashboard";
import { DashboardSettings } from "@/components/developers/dashboard/DashboardSettings";
import { dashboardView, periodUsageOf, planSectionOf, settingsView } from "@/lib/developers/dashboardView.ts";
import { CHECKOUT_ACTION, PORTAL_ACTION } from "@/lib/developers/billingActions.ts";
import { CSRF_FIELD } from "@/lib/developers/dashboardActions.ts";
import { PLAN_BUTTON_OUTLINE, PLAN_BUTTON_PRIMARY, PLAN_WARNING } from "@/components/shared/styles.ts";
import { ORIGIN } from "@/worker/shared/hosts.ts";

const NOW = Date.parse("2026-10-05T12:00:00Z");
const CSRF = "c".repeat(43);
const profile: AccountProfile = { email: "ada@example.com", name: "Ada Lovelace", providers: ["google"] };
const PERIOD: Period = { start: Date.parse("2026-09-29T00:00:00Z"), end: Date.parse("2026-10-29T00:00:00Z") };

/** The Plan card as settings draws it for a state at `now`, as `accountPlan` reads it. */
const planCard = (state: PlanState, now = NOW): string => {
  const html = renderToStaticMarkup(<DashboardSettings view={settingsView(profile, [], accountPlanAt(state, now))} csrf={CSRF} origins={ORIGIN} />);
  const card = /<div[^>]*data-plan-section="[^"]*"[^>]*>.*?(?=<section)/s.exec(html)?.[0];
  assert.ok(card !== undefined, "settings draws a Plan card");
  return card;
};

/** Each form in the card: where it posts, its hidden fields, and its button's label and class. */
const formsOf = (card: string) =>
  [...card.matchAll(/<form action="([^"]+)" method="post">(.*?)<\/form>/gs)].map(([, action, body]) => ({
    action,
    fields: Object.fromEntries([...body.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"\/>/g)].map((m) => [m[1], m[2]])),
    button: /<button[^>]*class="([^"]*)"[^>]*>([^<]+)<\/button>/.exec(body)?.slice(1).reverse(),
  }));

const textOf = (card: string): string[] => [...card.matchAll(/<p[^>]*>([^<]+)<\/p>/g)].map((m) => m[1]);

const CHOOSE = [
  { action: CHECKOUT_ACTION, fields: { plan: "starter", [CSRF_FIELD]: CSRF }, button: ["Choose Starter", PLAN_BUTTON_OUTLINE] },
  { action: CHECKOUT_ACTION, fields: { plan: "pro", [CSRF_FIELD]: CSRF }, button: ["Choose Pro", PLAN_BUTTON_PRIMARY] },
];
const manage = (className: string) => [{ action: PORTAL_ACTION, fields: { [CSRF_FIELD]: CSRF }, button: ["Manage billing", className] }];

test("no plan, and an ended plan, read No plan yet with an outline Choose Starter and an accent Choose Pro, posting to Checkout", () => {
  for (const state of [NO_PLAN, { kind: "ended", plan: { id: "pro" } }] as const satisfies readonly PlanState[]) {
    const card = planCard(state);
    assert.deepEqual(textOf(card), ["No plan yet", "Keys work once a plan is active."], state.kind);
    assert.deepEqual(formsOf(card), CHOOSE, state.kind);
  }
});

test("an active Stripe plan shows its price, allowance and renewal, with an outline Manage billing posting to the portal", () => {
  const card = planCard({ kind: "active", plan: { id: "pro" }, period: PERIOD });
  assert.deepEqual(textOf(card), ["Pro · $49 / month", "5,000,000 calls a month · Renews 29 Oct 2026"]);
  assert.deepEqual(formsOf(card), manage(PLAN_BUTTON_OUTLINE));
  assert.deepEqual(textOf(planCard({ kind: "active", plan: { id: "starter" }, period: PERIOD })), [
    "Starter · $15 / month",
    "1,000,000 calls a month · Renews 29 Oct 2026",
  ]);
});

test("past due serves nothing but keeps the title, says the keys are paused in the warning colour, and fills Manage billing in the accent (#571)", () => {
  const pastDue = { kind: "past-due", plan: { id: "pro" }, period: PERIOD } as const satisfies PlanState;
  assert.equal(serving(pastDue, NOW).serving, false);
  assert.deepEqual(planSectionOf(accountPlanAt(pastDue, NOW)), {
    kind: "manage",
    title: "Pro · $49 / month",
    line: "Payment failed. Your keys are paused until the payment goes through.",
    pastDue: true,
  });
  const card = planCard(pastDue);
  assert.deepEqual(textOf(card), ["Pro · $49 / month", "Payment failed. Your keys are paused until the payment goes through."]);
  assert.ok(card.includes(`<p class="${PLAN_WARNING}">Payment failed.`));
  assert.deepEqual(formsOf(card), manage(PLAN_BUTTON_PRIMARY));
});

test("a cancelled plan says when it ends, with Manage billing", () => {
  const card = planCard({ kind: "cancelling", plan: { id: "pro" }, period: PERIOD, endsAt: PERIOD.end });
  assert.deepEqual(textOf(card), ["Pro · $49 / month", "Cancelled · Ends 29 Oct 2026"]);
  assert.deepEqual(formsOf(card), manage(PLAN_BUTTON_OUTLINE));
});

test("a cancelled plan at and past its end draws as no plan, with Choose Starter and Choose Pro posting to Checkout (#300)", () => {
  const cancelled = { kind: "cancelling", plan: { id: "pro" }, period: PERIOD, endsAt: Date.parse("2026-10-20T00:00:00Z") } as const satisfies PlanState;
  assert.deepEqual(textOf(planCard(cancelled, cancelled.endsAt - 1)), ["Pro · $49 / month", "Cancelled · Ends 20 Oct 2026"]);
  assert.deepEqual(formsOf(planCard(cancelled, cancelled.endsAt - 1)), manage(PLAN_BUTTON_OUTLINE));
  for (const now of [cancelled.endsAt, cancelled.endsAt + 1]) {
    const card = planCard(cancelled, now);
    assert.deepEqual(textOf(card), ["No plan yet", "Keys work once a plan is active."], String(now));
    assert.deepEqual(formsOf(card), CHOOSE, String(now));
  }
});

/** An Enterprise plan as `pnpm run plan enterprise … --until 2026-11-01` sets it: its period ends at the start of that UTC day. */
const ENTERPRISE = {
  kind: "active",
  plan: { id: "enterprise", callsPerPeriod: 20_000_000, callsPerMinute: 1_000 },
  period: { start: Date.parse("2026-10-01T00:00:00Z"), end: Date.parse("2026-11-01T00:00:00Z") },
} as const satisfies PlanState;

test("Enterprise shows its own numbers and the day it ends, and no price and no button", () => {
  for (const now of [NOW, ENTERPRISE.period.end - 1]) {
    const card = planCard(ENTERPRISE, now);
    assert.deepEqual(textOf(card), ["Enterprise", "20,000,000 calls a month · 1,000 calls a minute · Ends 1 Nov 2026"], String(now));
    assert.doesNotMatch(card, /\$|<form|<button/, String(now));
  }
});

test("a lapsed Enterprise plan, at and past its end, draws exactly as an ended plan (#300)", () => {
  const ended = planCard({ kind: "ended", plan: ENTERPRISE.plan });
  for (const now of [ENTERPRISE.period.end, ENTERPRISE.period.end + 1]) {
    const card = planCard(ENTERPRISE, now);
    assert.equal(card, ended, String(now));
    assert.deepEqual(textOf(card), ["No plan yet", "Keys work once a plan is active."], String(now));
    assert.deepEqual(formsOf(card), CHOOSE, String(now));
  }
});

/** The dashboard for a plan state and the meter's count. */
const dashboardFor = (state: PlanState, calls: number): string => {
  const view = dashboardView(profile, [], AccountUsage.of(usageDays(NOW), [], []), periodUsageOf(serving(state, NOW), calls), NOW);
  return renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} made={0} origins={ORIGIN} />);
};

test("with Pro serving, Usage reads This period · 1,240,500 of 5,000,000 calls over a meter at that value, and the chart stays", () => {
  const html = dashboardFor({ kind: "active", plan: { id: "pro" }, period: PERIOD }, 1_240_500);
  assert.match(html, /<p[^>]*id="usage-period"[^>]*>This period · 1,240,500 of 5,000,000 calls<\/p>/);
  const meter = /<div[^>]*role="meter"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(meter, /aria-valuenow="1240500"/);
  assert.match(meter, /aria-valuemax="5000000"/);
  assert.match(meter, /aria-labelledby="usage-period"/);
  // The fill is Base UI's, its width the share of the allowance.
  assert.match(html, /<div[^>]*style="[^"]*width:24\.81%[^"]*"/);
  assert.match(html, /role="img" aria-label="Calls per day, all keys, the last 30 days"/);
});

test("with no serving plan, Usage has no meter and reads the last 30 days", () => {
  for (const state of [NO_PLAN, { kind: "ended", plan: { id: "pro" } }] as const satisfies readonly PlanState[]) {
    const html = dashboardFor(state, 0);
    assert.doesNotMatch(html, /role="meter"|This period/, state.kind);
    assert.match(html, /Last 30 days · 0 calls/, state.kind);
  }
});
