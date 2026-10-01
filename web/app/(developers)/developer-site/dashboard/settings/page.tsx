// developers.lexema.fyi/dashboard/settings (#190): the wiring only; the markup
// is `@/components/developers/dashboard/DashboardSettings.tsx`.
import { headers } from "next/headers";
import { DashboardSettings } from "@/components/developers/dashboard/DashboardSettings";
import { loadSettings } from "@/lib/developers/loadDashboard.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export const metadata = { title: "Settings — Lexema API" };

export default async function Page() {
  const request = await headers();
  const origins = await siteOrigins();
  const { view, csrf } = await loadSettings(request.get("cookie"), origins);
  return <DashboardSettings view={view} csrf={csrf} origins={origins} />;
}
