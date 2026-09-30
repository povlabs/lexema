// What the dashboard on developers.lexema.fyi shows (#169, board 28) and its
// settings page (#190, board 28g), worked out from the account's keys, usage
// and profile. Pure, so the pages' words and numbers are tested without a
// Worker; `Dashboard.tsx` and `DashboardSettings.tsx` only lay them out.

import type { AccountProfile } from "@lexema/accounts/accounts.ts";
import { PROVIDER_NAME } from "@lexema/accounts/providers.ts";
import { LIFETIME_LABEL, type EndpointScope } from "@lexema/api/keyAccess.ts";
import type { OwnedKey } from "@lexema/api/ownedKeys.ts";
import type { AccountUsage } from "@lexema/api/usage.ts";
import type { AccountPlan } from "@lexema/billing/accountPlan.ts";
import { PLAN_TERMS, type Serving, type StripePlan } from "@lexema/billing/plans.ts";
import { signedInOf, type SignedIn } from "./signedIn.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An ISO-8601 moment or a `YYYY-MM-DD` day as the boards write a date, in UTC: `27 Sep 2026`. */
export function shortDate(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (count: number, span: string): string => `${count} ${span}${count === 1 ? "" : "s"} ago`;

/** When a key was last used: `never`, `just now`, `2 minutes ago`, … and past 30 days its date. */
export function lastUsed(iso: string | null, now: number): string {
  if (iso === null) return "never";
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return ago(Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return ago(Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 30 * DAY) return ago(Math.floor(elapsed / DAY), "day");
  return shortDate(iso);
}

/** A count of calls with its thousands grouped: `18,240`. */
export const callCount = (count: number): string => count.toLocaleString("en-US");

/** One day's bar: its day, its calls, and its height as a share of the tallest day, 0 to 1. */
export interface UsageBar {
  day: string;
  calls: number;
  share: number;
}

/** The account's usage: 30 days of bars and their total. */
export interface UsageRow {
  bars: readonly UsageBar[];
  total: number;
}

function usageRow(days: readonly string[], perDay: readonly number[]): UsageRow {
  const tallest = Math.max(0, ...perDay);
  return {
    bars: days.map((day, i) => ({ day, calls: perDay[i], share: tallest === 0 ? 0 : perDay[i] / tallest })),
    total: perDay.reduce((sum, count) => sum + count, 0),
  };
}

/** One of the account's live keys as its row shows it. A revoked key has no row (board 28). */
export interface KeyRow {
  keyId: number;
  name: string;
  /** The key's leading characters, then an ellipsis. */
  prefix: string;
  created: string;
  lastUsed: string;
  /** What it may call, as the create-key dialog put it (#187). */
  endpoints: EndpointScope;
  /** When it expires, as the dialog put it: `Never`, else the date. */
  expires: string;
}

/** A key's endpoints as the dialog names them: `All endpoints`, or the ticked ones in the checklist's order. */
export const endpointsText = (scope: EndpointScope): string => (scope.kind === "all" ? "All endpoints" : scope.endpoints.join(", "));

/** A key's expiry as the dialog names it: `Never`, or the day it expires. */
export const expiresText = (expiresAt: string | null): string => (expiresAt === null ? LIFETIME_LABEL.never : shortDate(expiresAt));

/** A live key's row at `now`. */
export const keyRowOf = (key: OwnedKey, now: number): KeyRow => ({
  keyId: key.keyId,
  name: key.name,
  prefix: `${key.displayPrefix}…`,
  created: shortDate(key.createdAt),
  lastUsed: lastUsed(key.lastUsedAt, now),
  endpoints: key.endpoints,
  expires: expiresText(key.expiresAt),
});

/** The account's keys that are not revoked, oldest first. */
const liveKeys = (keys: readonly OwnedKey[]): OwnedKey[] => keys.filter((key) => key.revokedAt === null).sort((a, b) => a.keyId - b.keyId);

/** The calls counted in the current billing period, against the plan's allowance (board 28i). */
export interface PeriodUsage {
  calls: number;
  allowance: number;
  /** `This period · 1,240,500 of 5,000,000 calls`. */
  text: string;
}

/**
 * The period's usage while a plan serves the account, from the account meter's
 * count; with no serving plan, none, and the page draws no meter (#207).
 */
export function periodUsageOf(serving: Serving, calls: number): PeriodUsage | undefined {
  if (!serving.serving) return undefined;
  const allowance = serving.limits.callsPerPeriod;
  return { calls, allowance, text: `This period · ${callCount(calls)} of ${callCount(allowance)} calls` };
}

/** Keys and usage, the dashboard's first tab, as the page lays it out. */
export interface DashboardView {
  signedIn: SignedIn;
  /** The live keys, oldest first. */
  keys: readonly KeyRow[];
  /** Every key's calls added up, revoked keys' too: they were made. */
  usage: UsageRow;
  /** This billing period's calls, while a plan serves the account. */
  period: PeriodUsage | undefined;
}

/** The dashboard for an account's profile, keys, usage and period usage at `now`. */
export function dashboardView(
  profile: AccountProfile,
  keys: readonly OwnedKey[],
  usage: AccountUsage,
  period: PeriodUsage | undefined,
  now: number,
): DashboardView {
  return {
    signedIn: signedInOf(profile),
    keys: liveKeys(keys).map((key) => keyRowOf(key, now)),
    usage: usageRow(usage.days, usage.total),
    period,
  };
}

/**
 * The settings page's Plan section (board 28i), one arm per thing it can do:
 * choose a plan, manage a Stripe plan's billing, or, on Enterprise, nothing.
 */
export type PlanSection =
  | { readonly kind: "choose"; readonly title: string; readonly line: string }
  /** `pastDue`: the line is the payment warning and Manage billing takes the accent. */
  | { readonly kind: "manage"; readonly title: string; readonly line: string; readonly pastDue: boolean }
  | { readonly kind: "enterprise"; readonly title: string; readonly line: string };

const NO_PLAN_SECTION: PlanSection = { kind: "choose", title: "No plan yet", line: "Keys work once a plan is active." };

const dayOfMs = (ms: number): string => shortDate(new Date(ms).toISOString());

/** `Pro · $49 / month`. */
const stripeTitle = (plan: StripePlan): string => `${PLAN_TERMS[plan.id].name} · $${PLAN_TERMS[plan.id].usdPerMonth} / month`;

/**
 * What the Plan section says for an account's plan. A plan that no longer
 * serves reads as no plan, whatever its state: `serving` in
 * src/billing/plans.ts decides that, as it does for the API and the meter, so
 * a lapsed Enterprise plan, or a cancelled one past its end, draws like an
 * ended one (#300). Enterprise shows its own numbers and when it ends, with no
 * price and no Manage billing.
 */
export function planSectionOf({ state, serving }: AccountPlan): PlanSection {
  if (!serving.serving) return NO_PLAN_SECTION;
  switch (state.kind) {
    case "none":
    case "ended":
      return NO_PLAN_SECTION;
    case "active": {
      const { plan } = state;
      if (plan.id === "enterprise") {
        const numbers = `${callCount(plan.callsPerPeriod)} calls a month · ${callCount(plan.callsPerMinute)} calls a minute`;
        return { kind: "enterprise", title: PLAN_TERMS.enterprise.name, line: `${numbers} · Ends ${dayOfMs(state.period.end)}` };
      }
      const calls = callCount(PLAN_TERMS[plan.id].callsPerPeriod);
      return { kind: "manage", title: stripeTitle(plan), line: `${calls} calls a month · Renews ${dayOfMs(state.period.end)}`, pastDue: false };
    }
    case "past-due":
      return { kind: "manage", title: stripeTitle(state.plan), line: "Payment failed. Update your card to keep your keys working.", pastDue: true };
    case "cancelling":
      return { kind: "manage", title: stripeTitle(state.plan), line: `Cancelled · Ends ${dayOfMs(state.endsAt)}`, pastDue: false };
  }
}

/** Settings, the dashboard's second tab (boards 28g and 28i): the plan, and the account with Delete account. */
export interface SettingsView {
  signedIn: SignedIn;
  plan: PlanSection;
  /** `Signed in with Google · ada@example.com`. */
  signedInWith: string;
  /** What the delete confirmation says, with the account's live key count (board 30). */
  deleteWarning: string;
}

/** The settings page for an account's profile, keys and plan, as `accountPlan` read it. */
export function settingsView(profile: AccountProfile, keys: readonly OwnedKey[], plan: AccountPlan): SettingsView {
  return {
    signedIn: signedInOf(profile),
    plan: planSectionOf(plan),
    signedInWith: `Signed in with ${profile.providers.map((provider) => PROVIDER_NAME[provider]).join(" or ")} · ${profile.email}`,
    deleteWarning: deleteWarning(liveKeys(keys).length),
  };
}

/**
 * What the delete confirmation says (#163 R1.4, board 30): "Your N API keys
 * will be revoked right away, and any app using them will stop working. This
 * can't be undone." One key reads in the singular; with none, only the last
 * sentence is true.
 */
export function deleteWarning(liveKeys: number): string {
  const undone = "This can't be undone.";
  if (liveKeys === 0) return undone;
  if (liveKeys === 1) return `Your 1 API key will be revoked right away, and any app using it will stop working. ${undone}`;
  return `Your ${liveKeys} API keys will be revoked right away, and any app using them will stop working. ${undone}`;
}
