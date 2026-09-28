// developers.lexema.fyi/dashboard (#169): the wiring only; the markup is
// `../../../Dashboard.tsx` and what it shows is `../../../dashboardView.ts`.
// worker/dashboard.ts sends a visitor without a session to sign-in before
// this runs; the check here covers any request that reaches the page anyway.
import { accountProfile } from "@lexema/accounts/accounts.ts";
import { listAccountKeys } from "@lexema/api/ownedKeys.ts";
import { accountUsage } from "@lexema/api/usage.ts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { csrfTokenOf, SIGN_IN_PAGE } from "../../../../worker/dashboard.ts";
import { signedInAccount } from "../../../../worker/signIn.ts";
import { Dashboard } from "../../../Dashboard";
import { dashboardView } from "../../../dashboardView.ts";
import { database } from "../../../db";

export const metadata = { title: "Dashboard — Lexema API" };

export default async function Page() {
  const cookies = (await headers()).get("cookie");
  const db = database();
  const now = Date.now();
  const accountId = await signedInAccount(cookies, db, now);
  const csrf = await csrfTokenOf(cookies);
  const profile = accountId === undefined ? undefined : await accountProfile(db, accountId);
  if (accountId === undefined || csrf === undefined || profile === undefined) redirect(SIGN_IN_PAGE);
  const [keys, usage] = await Promise.all([listAccountKeys(db, accountId), accountUsage(db, accountId, now)]);
  return <Dashboard view={dashboardView(profile, keys, usage, now)} csrf={csrf} />;
}
