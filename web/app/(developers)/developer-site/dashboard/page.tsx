// developers.lexema.fyi/dashboard (#169): the wiring only; the markup is
// `../../../Dashboard.tsx`.
import { headers } from "next/headers";
import { Dashboard } from "@/components/developers/dashboard/Dashboard";
import { loadDashboard } from "@/lib/developers/loadDashboard.ts";

export const metadata = { title: "Dashboard — Lexema API" };

export default async function Page() {
  const request = await headers();
  const { view, csrf, keys } = await loadDashboard(request.get("cookie"));
  return <Dashboard view={view} csrf={csrf} made={keys.length} />;
}
