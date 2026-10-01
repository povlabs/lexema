// What the dashboard's pages read (#169, #190): the signed-in account's view
// and the session's CSRF token, or a trip to sign-in. worker/dashboard.ts sends
// a visitor without a session to sign-in before either page runs; the check
// here covers any request that reaches one anyway.
//
// Both pages read the account's plan (#207). While a plan serves, the
// dashboard asks the account meter (worker/api/accountMeterObject.ts) for the
// period's count, which is exact where D1's usage rows are up to a minute behind.
import { env } from "cloudflare:workers";
import { accountProfile, type AccountProfile } from "@lexema/accounts/accounts.ts";
import { listAccountKeys, type OwnedKey } from "@lexema/api/ownedKeys.ts";
import { accountUsage } from "@lexema/api/usage.ts";
import { accountPlan } from "@lexema/billing/accountPlan.ts";
import type { Serving } from "@lexema/billing/plans.ts";
import { redirect } from "next/navigation";
import { accountMeterOf } from "@/worker/api/metering.ts";
import { csrfTokenOf, SIGN_IN_PAGE } from "@/worker/dashboard.ts";
import type { SiteOrigins } from "@/worker/hosts.ts";
import { signedInAccount } from "@/worker/signIn.ts";
import { dashboardView, periodUsageOf, settingsView, type DashboardView, type PeriodUsage, type SettingsView } from "./dashboardView.ts";
import { appDatabase } from "@/lib/shared/database.ts";

/** The signed-in account a dashboard page is for, with every key it owns, revoked ones too. */
async function signedInOwner(cookies: string | null, origins: SiteOrigins) {
  const db = appDatabase();
  const now = Date.now();
  const accountId = await signedInAccount(cookies, db, now, origins);
  const csrf = await csrfTokenOf(cookies);
  const profile: AccountProfile | undefined = accountId === undefined ? undefined : await accountProfile(db, accountId);
  if (accountId === undefined || csrf === undefined || profile === undefined) redirect(SIGN_IN_PAGE);
  return { db, now, accountId, csrf, profile, keys: await listAccountKeys(db, accountId) };
}

export interface LoadedDashboard {
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

export async function loadDashboard(cookies: string | null, origins: SiteOrigins): Promise<LoadedDashboard> {
  const { db, now, accountId, csrf, profile, keys } = await signedInOwner(cookies, origins);
  const [usage, plan] = await Promise.all([accountUsage(db, accountId, now), accountPlan(db, accountId, now)]);
  const period = await periodUsage(accountId, plan.serving);
  return { view: dashboardView(profile, keys, usage, period, now), csrf, keys };
}

export interface LoadedSettings {
  view: SettingsView;
  csrf: string;
}

export async function loadSettings(cookies: string | null, origins: SiteOrigins): Promise<LoadedSettings> {
  const { db, now, accountId, csrf, profile, keys } = await signedInOwner(cookies, origins);
  const plan = await accountPlan(db, accountId, now);
  return { view: settingsView(profile, keys, plan), csrf };
}
