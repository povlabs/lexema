// Who a session cookie names, as the developer site's public pages show them
// in the account menu (#190, #193). Apart from visitor.ts, which reaches D1
// through `cloudflare:workers`, so a test can hand it a database: a live
// session names its account, and the session a deleted account had names no one.
import { accountProfile } from "@lexema/accounts/accounts.ts";
import type { AppTables } from "@lexema/db/app/database.ts";
import type { SiteOrigins } from "@/worker/hosts.ts";
import { signedInAccount } from "@/worker/signIn.ts";
import { signedInOf, type SignedIn } from "./signedIn.ts";

/** The visitor a session cookie names, or `undefined` when it names no live session or no account. */
export async function sessionVisitor(cookies: string | null, db: AppTables, now: number, origins: SiteOrigins): Promise<SignedIn | undefined> {
  const accountId = await signedInAccount(cookies, db, now, origins);
  const profile = accountId === undefined ? undefined : await accountProfile(db, accountId);
  return profile === undefined ? undefined : signedInOf(profile);
}
