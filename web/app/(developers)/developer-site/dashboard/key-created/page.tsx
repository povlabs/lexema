// developers.lexema.fyi/dashboard/key-created (#169): the wiring only; the
// markup is `../../../../KeyCreated.tsx`. worker/dashboard.ts hands this page
// the new key once, in a header only it sets; without one, or for a key this
// account does not own, the page goes back to the dashboard.
import { listAccountKeys } from "@lexema/api/ownedKeys.ts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD, newKeyOf } from "../../../../../worker/dashboard.ts";
import { signedInAccount } from "../../../../../worker/signIn.ts";
import { database } from "../../../../db";
import { KeyCreated } from "../../../../KeyCreated";

export const metadata = { title: "Key created — Lexema API" };

export default async function Page() {
  const request = await headers();
  const created = newKeyOf(request);
  const db = database();
  const accountId = await signedInAccount(request.get("cookie"), db, Date.now());
  const key =
    created === undefined || accountId === undefined
      ? undefined
      : (await listAccountKeys(db, accountId)).find((owned) => owned.keyId === created.keyId);
  if (created === undefined || key === undefined) redirect(DASHBOARD);
  return <KeyCreated name={key.name} secret={created.key} />;
}
