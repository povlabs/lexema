// What the dashboard's pages read (#169, #190): the signed-in account's view
// and the session's CSRF token, or a trip to sign-in. worker/dashboard.ts sends
// a visitor without a session to sign-in before either page runs; the check
// here covers any request that reaches one anyway.
import { accountProfile, type AccountProfile } from "@lexema/accounts/accounts.ts";
import { listAccountKeys, type OwnedKey } from "@lexema/api/ownedKeys.ts";
import { accountUsage } from "@lexema/api/usage.ts";
import { redirect } from "next/navigation";
import { csrfTokenOf, SIGN_IN_PAGE } from "../../../../worker/dashboard.ts";
import { signedInAccount } from "../../../../worker/signIn.ts";
import { dashboardView, settingsView, type DashboardView, type SettingsView } from "../../../dashboardView.ts";
import { database } from "../../../db";

/** The signed-in account a dashboard page is for, with every key it owns, revoked ones too. */
async function signedInOwner(cookies: string | null) {
  const db = database();
  const now = Date.now();
  const accountId = await signedInAccount(cookies, db, now);
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

export async function loadDashboard(cookies: string | null): Promise<LoadedDashboard> {
  const { db, now, accountId, csrf, profile, keys } = await signedInOwner(cookies);
  const usage = await accountUsage(db, accountId, now);
  return { view: dashboardView(profile, keys, usage, now), csrf, keys };
}

export interface LoadedSettings {
  view: SettingsView;
  csrf: string;
}

export async function loadSettings(cookies: string | null): Promise<LoadedSettings> {
  const { csrf, profile, keys } = await signedInOwner(cookies);
  return { view: settingsView(profile, keys), csrf };
}
