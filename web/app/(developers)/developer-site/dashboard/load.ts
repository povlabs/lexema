// What both dashboard pages read (#169): the signed-in account's view and the
// session's CSRF token, or a trip to sign-in. worker/dashboard.ts sends a
// visitor without a session to sign-in before either page runs; the check
// here covers any request that reaches a page anyway.
import { accountProfile } from "@lexema/accounts/accounts.ts";
import { listAccountKeys, type OwnedKey } from "@lexema/api/ownedKeys.ts";
import { accountUsage } from "@lexema/api/usage.ts";
import { redirect } from "next/navigation";
import { csrfTokenOf, SIGN_IN_PAGE } from "../../../../worker/dashboard.ts";
import { signedInAccount } from "../../../../worker/signIn.ts";
import { dashboardView, type DashboardView } from "../../../dashboardView.ts";
import { database } from "../../../db";

export interface LoadedDashboard {
  view: DashboardView;
  csrf: string;
  /** Every key the account owns, revoked ones too. */
  keys: readonly OwnedKey[];
}

export async function loadDashboard(cookies: string | null): Promise<LoadedDashboard> {
  const db = database();
  const now = Date.now();
  const accountId = await signedInAccount(cookies, db, now);
  const csrf = await csrfTokenOf(cookies);
  const profile = accountId === undefined ? undefined : await accountProfile(db, accountId);
  if (accountId === undefined || csrf === undefined || profile === undefined) redirect(SIGN_IN_PAGE);
  const [keys, usage] = await Promise.all([listAccountKeys(db, accountId), accountUsage(db, accountId, now)]);
  return { view: dashboardView(profile, keys, usage, now), csrf, keys };
}
