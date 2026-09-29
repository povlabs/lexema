// developers.lexema.fyi/dashboard (#169): the wiring only; the markup is
// `../../../Dashboard.tsx`. `?create=key` opens the create-key dialog (board
// 28b) and `?confirm=delete` the delete confirmation (board 30) from the
// server, so Create key and Delete account work with no script.
import { headers } from "next/headers";
import { defaultKeyName, requestedDialog } from "../../../../worker/dashboard.ts";
import { Dashboard, type DashboardDialog } from "../../../Dashboard";
import { loadDashboard } from "./load.ts";

export const metadata = { title: "Dashboard — Lexema API" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { view, csrf, keys } = await loadDashboard((await headers()).get("cookie"));
  const requested = requestedDialog(await searchParams);
  const dialog: DashboardDialog | undefined =
    requested === "create-key"
      ? { kind: "create-key", defaultName: defaultKeyName(keys.length) }
      : requested === "confirm-delete"
        ? { kind: "confirm-delete" }
        : undefined;
  return <Dashboard view={view} csrf={csrf} dialog={dialog} />;
}
