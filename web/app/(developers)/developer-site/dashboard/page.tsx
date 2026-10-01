// developers.lexema.fyi/dashboard (#169): the wiring only; the markup is
// `@/components/developers/dashboard/Dashboard.tsx`.
import { headers } from "next/headers";
import { Dashboard } from "@/components/developers/dashboard/Dashboard";
import { loadDashboard } from "@/lib/developers/loadDashboard.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export const metadata = { title: "Dashboard — Lexema API" };

export default async function Page() {
  const request = await headers();
  const origins = await siteOrigins();
  const { view, csrf, keys } = await loadDashboard(request.get("cookie"), origins);
  return <Dashboard view={view} csrf={csrf} made={keys.length} origins={origins} />;
}
