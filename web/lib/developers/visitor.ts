// Who is reading a public page of the developer site (#190): the docs and
// pricing show a signed-in visitor the same account menu as the dashboard, and
// pricing's Choose forms carry the session's CSRF token (#208). Without a
// session cookie nothing is read. A page that cannot read the session is still
// the public page, signed out, with the failure in the log.
import { env } from "cloudflare:workers";
import { accountProfile } from "@lexema/accounts/accounts.ts";
import { headers } from "next/headers";
import { csrfTokenOf } from "@/worker/dashboard.ts";
import type { SiteOrigins } from "@/worker/hosts.ts";
import { signedInAccount } from "@/worker/signIn.ts";
import { appDatabase } from "@/lib/shared/database.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";
import { signedInOf, type PostingVisitor, type SignedIn } from "./signedIn.ts";

export async function signedInVisitor(): Promise<SignedIn | undefined> {
  return visitorOf((await headers()).get("cookie"), await siteOrigins());
}

/** A signed-in visitor with the session's CSRF token, for a page whose forms post; signed out, `undefined`. */
export async function postingVisitor(): Promise<PostingVisitor | undefined> {
  const cookies = (await headers()).get("cookie");
  const signedIn = await visitorOf(cookies, await siteOrigins());
  const csrf = await csrfTokenOf(cookies);
  return signedIn === undefined || csrf === undefined ? undefined : { signedIn, csrf };
}

async function visitorOf(cookies: string | null, origins: SiteOrigins): Promise<SignedIn | undefined> {
  if (env.APP_DB === undefined) return undefined;
  try {
    const db = appDatabase();
    const accountId = await signedInAccount(cookies, db, Date.now(), origins);
    const profile = accountId === undefined ? undefined : await accountProfile(db, accountId);
    return profile === undefined ? undefined : signedInOf(profile);
  } catch (failure) {
    console.error("the visitor's session could not be read", failure);
    return undefined;
  }
}
