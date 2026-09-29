// Who is reading a public page of the developer site (#190): the docs and
// pricing show a signed-in visitor the same account menu as the dashboard.
// Without a session cookie nothing is read. A page that cannot read the
// session is still the public page, signed out, with the failure in the log.
import { env } from "cloudflare:workers";
import { accountProfile } from "@lexema/accounts/accounts.ts";
import { headers } from "next/headers";
import { signedInAccount } from "../../../worker/signIn.ts";
import { database } from "../../db";
import { signedInOf, type SignedIn } from "../../signedIn.ts";

export async function signedInVisitor(): Promise<SignedIn | undefined> {
  if (env.DB === undefined) return undefined;
  const cookies = (await headers()).get("cookie");
  try {
    const db = database();
    const accountId = await signedInAccount(cookies, db, Date.now());
    const profile = accountId === undefined ? undefined : await accountProfile(db, accountId);
    return profile === undefined ? undefined : signedInOf(profile);
  } catch (failure) {
    console.error("the visitor's session could not be read", failure);
    return undefined;
  }
}
