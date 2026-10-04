// developers.lexema.fyi/dashboard (#169): the wiring only; the markup is
// `@/components/developers/dashboard/Dashboard.tsx`, or for a suspended
// account `SuspendedAccount.tsx` (#573).
import { headers } from "next/headers";
import { Dashboard } from "@/components/developers/dashboard/Dashboard";
import { SuspendedAccount } from "@/components/developers/dashboard/SuspendedAccount";
import { loadDashboard } from "@/lib/developers/loadDashboard.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export const metadata = { title: "Dashboard — Lexema API" };

export default async function Page() {
  const request = await headers();
  const origins = await siteOrigins();
  const loaded = await loadDashboard(request.get("cookie"), origins);
  if (loaded.kind === "suspended") return <SuspendedAccount view={loaded.view} csrf={loaded.csrf} current="dashboard" origins={origins} />;
  return <Dashboard view={loaded.view} csrf={loaded.csrf} made={loaded.keys.length} origins={origins} />;
}
