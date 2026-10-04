// What the dashboard's pages read (#169, #190): the signed-in account's view
// and the session's CSRF token, or a trip to sign-in. worker/developers/dashboard.ts sends
// a visitor without a session to sign-in before either page runs; the check
// here covers any request that reaches one anyway.
//
// A suspended account (#573) gets neither page's view: both draw only the
// card that says so, with Delete account, and read no plan or usage.
//
// Both pages read the account's plan (#207). While a plan serves, the
// dashboard asks the account meter (worker/api/accountMeterObject.ts) for the
// period's count, which is exact where D1's usage rows are up to a minute behind.
import { env } from "cloudflare:workers";
import { accountProfile, type AccountProfile } from "@lexema/accounts/accounts.ts";
import { accountSuspension } from "@lexema/accounts/suspension.ts";
import { listAccountKeys, type OwnedKey } from "@lexema/api/ownedKeys.ts";
import { accountUsage } from "@lexema/api/usage.ts";
import { accountPlan } from "@lexema/billing/accountPlan.ts";
import type { Serving } from "@lexema/billing/plans.ts";
import { redirect } from "next/navigation";
import { accountMeterOf } from "@/worker/api/metering.ts";
import { csrfTokenOf, SIGN_IN_PAGE } from "@/worker/developers/dashboard.ts";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { signedInAccount } from "@/worker/developers/signIn.ts";
import {
  dashboardView,
  periodUsageOf,
  settingsView,
  suspendedView,
  type DashboardView,
  type PeriodUsage,
  type SettingsView,
  type SuspendedView,
} from "./dashboardView.ts";
import { appDatabase } from "@/lib/shared/database.ts";

/** The signed-in account a dashboard page is for, with every key it owns, revoked ones too. */
async function signedInOwner(cookies: string | null, origins: SiteOrigins) {
  const db = appDatabase();
  const now = Date.now();
  const accountId = await signedInAccount(cookies, db, now, origins);
  const csrf = await csrfTokenOf(cookies);
  const profile: AccountProfile | undefined = accountId === undefined ? undefined : await accountProfile(db, accountId);
  if (accountId === undefined || csrf === undefined || profile === undefined) redirect(SIGN_IN_PAGE);
  const [keys, suspension] = await Promise.all([listAccountKeys(db, accountId), accountSuspension(db, accountId)]);
  return { db, now, accountId, csrf, profile, keys, suspended: suspension !== undefined };
}

/** A suspended account's page, either one: the card and the session's CSRF token for its Delete account. */
export interface LoadedSuspended {
  kind: "suspended";
  view: SuspendedView;
  csrf: string;
}

export interface LoadedDashboard {
  kind: "open";
  view: DashboardView;
  csrf: string;
  /** Every key the account owns, revoked ones too. */
  keys: readonly OwnedKey[];
}

/** The period's usage while a plan serves: the account meter's count for the plan's period. */
async function periodUsage(accountId: number, serving: Serving): Promise<PeriodUsage | undefined> {
  if (!serving.serving) return undefined;
  const meter = accountMeterOf(env.ACCOUNT_METER, accountId);
  return periodUsageOf(serving, await meter.periodCalls(new Date(serving.period.start).toISOString()));
}

export async function loadDashboard(cookies: string | null, origins: SiteOrigins): Promise<LoadedDashboard | LoadedSuspended> {
  const { db, now, accountId, csrf, profile, keys, suspended } = await signedInOwner(cookies, origins);
  if (suspended) return { kind: "suspended", view: suspendedView(profile, keys), csrf };
  const [usage, plan] = await Promise.all([accountUsage(db, accountId, now), accountPlan(db, accountId, now)]);
  const period = await periodUsage(accountId, plan.serving);
  return { kind: "open", view: dashboardView(profile, keys, usage, period, now), csrf, keys };
}

export interface LoadedSettings {
  kind: "open";
  view: SettingsView;
  csrf: string;
}

export async function loadSettings(cookies: string | null, origins: SiteOrigins): Promise<LoadedSettings | LoadedSuspended> {
  const { db, now, accountId, csrf, profile, keys, suspended } = await signedInOwner(cookies, origins);
  if (suspended) return { kind: "suspended", view: suspendedView(profile, keys), csrf };
  const plan = await accountPlan(db, accountId, now);
  return { kind: "open", view: settingsView(profile, keys, plan), csrf };
}
