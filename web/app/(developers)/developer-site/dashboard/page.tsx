// developers.lexema.fyi/dashboard (#169): the wiring only; the markup is
// `../../../Dashboard.tsx`. `?confirm=delete` opens the delete confirmation
// (board 30) from the server, so Delete account works with no script.
import { headers } from "next/headers";
import { CONFIRM_DELETE_PARAM, CONFIRM_DELETE_VALUE } from "../../../../worker/dashboard.ts";
import { Dashboard } from "../../../Dashboard";
import { loadDashboard } from "./load.ts";

export const metadata = { title: "Dashboard — Lexema API" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { view, csrf } = await loadDashboard((await headers()).get("cookie"));
  const confirming = (await searchParams)[CONFIRM_DELETE_PARAM] === CONFIRM_DELETE_VALUE;
  return <Dashboard view={view} csrf={csrf} dialog={confirming ? { kind: "confirm-delete" } : undefined} />;
}
