// developers.lexema.fyi/dashboard/settings (#190): the wiring only; the markup
// is `@/components/developers/dashboard/DashboardSettings.tsx`, or for a
// suspended account `SuspendedAccount.tsx` (#573).
import { headers } from "next/headers";
import { DashboardSettings } from "@/components/developers/dashboard/DashboardSettings";
import { SuspendedAccount } from "@/components/developers/dashboard/SuspendedAccount";
import { loadSettings } from "@/lib/developers/loadDashboard.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export const metadata = { title: "Settings — Lexema API" };

export default async function Page() {
  const request = await headers();
  const origins = await siteOrigins();
  const loaded = await loadSettings(request.get("cookie"), origins);
  if (loaded.kind === "suspended") return <SuspendedAccount view={loaded.view} csrf={loaded.csrf} current="settings" origins={origins} />;
  return <DashboardSettings view={loaded.view} csrf={loaded.csrf} origins={origins} />;
}
