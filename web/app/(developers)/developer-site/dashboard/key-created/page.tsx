// developers.lexema.fyi/dashboard/key-created (#169): the dashboard with the
// new key's dialog over it (board 29); the markup is `../../../../Dashboard.tsx`.
// worker/dashboard.ts hands this page the new key once, in a header only it
// sets; without one, or for a key this account does not own, the page goes
// back to the dashboard.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD, newKeyOf } from "../../../../../worker/dashboard.ts";
import { Dashboard } from "../../../../Dashboard";
import { loadDashboard } from "../load.ts";

export const metadata = { title: "Key created — Lexema API" };

export default async function Page() {
  const request = await headers();
  const created = newKeyOf(request);
  if (created === undefined) redirect(DASHBOARD);
  const { view, csrf, keys } = await loadDashboard(request.get("cookie"));
  const key = keys.find((owned) => owned.keyId === created.keyId && owned.revokedAt === null);
  if (key === undefined) redirect(DASHBOARD);
  return <Dashboard view={view} csrf={csrf} made={keys.length} dialog={{ kind: "key-created", name: key.name, secret: created.key }} />;
}
