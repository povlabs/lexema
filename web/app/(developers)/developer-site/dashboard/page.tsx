// developers.lexema.fyi/dashboard (#169): the wiring only; the markup is
// `../../../Dashboard.tsx`. `?create=key` opens the create-key dialog (board
// 28b) and `?confirm=delete` the delete confirmation (board 30) from the
// server, so Create key and Delete account work with no script. A create form
// the server refused comes back here with its draft (worker/dashboard.ts), and
// the dialog opens holding it, each problem under its field.
import { headers } from "next/headers";
import { EMPTY_DRAFT } from "../../../createKeyForm.ts";
import { createKeyDraftOf, requestedDialog } from "../../../../worker/dashboard.ts";
import { Dashboard, type DashboardDialog } from "../../../Dashboard";
import { loadDashboard } from "./load.ts";

export const metadata = { title: "Dashboard — Lexema API" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const request = await headers();
  const { view, csrf, keys } = await loadDashboard(request.get("cookie"));
  const requested = requestedDialog(await searchParams);
  const dialog: DashboardDialog | undefined =
    requested === "create-key"
      ? { kind: "create-key", draft: createKeyDraftOf(request) ?? EMPTY_DRAFT }
      : requested === "confirm-delete"
        ? { kind: "confirm-delete" }
        : undefined;
  return <Dashboard view={view} csrf={csrf} made={keys.length} dialog={dialog} />;
}
