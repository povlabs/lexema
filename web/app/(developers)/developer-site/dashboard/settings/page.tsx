// developers.lexema.fyi/dashboard/settings (#190): the wiring only; the markup
// is `../../../../DashboardSettings.tsx`.
import { headers } from "next/headers";
import { DashboardSettings } from "../../../../DashboardSettings";
import { loadSettings } from "../load.ts";

export const metadata = { title: "Settings — Lexema API" };

export default async function Page() {
  const request = await headers();
  const { view, csrf } = await loadSettings(request.get("cookie"));
  return <DashboardSettings view={view} csrf={csrf} />;
}
