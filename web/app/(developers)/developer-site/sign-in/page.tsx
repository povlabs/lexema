// developers.lexema.fyi/sign-in (#169): the wiring only; the markup is
// `@/components/developers/SignIn.tsx`. A developer already signed in goes to
// the dashboard. The test sign-in is offered on a Preview's developer host only
// (worker/testSignIn.ts).
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD } from "@/worker/dashboard.ts";
import { availableProviders, signedInAccount } from "@/worker/signIn.ts";
import { parseStage } from "@/worker/stage.ts";
import { offersTestSignIn } from "@/worker/testSignIn.ts";
import { originsOf } from "@/worker/hosts.ts";
import { appDatabase } from "@/lib/shared/database.ts";
import { hostnameOf } from "@/lib/shared/siteOrigins.ts";
import { SignIn } from "@/components/developers/SignIn";

export const metadata = { title: "Sign in — Lexema API" };

export default async function Page() {
  const requestHeaders = await headers();
  const cookies = requestHeaders.get("cookie");
  const hostname = hostnameOf(requestHeaders.get("host"));
  const origins = originsOf(hostname);
  // Without a database nobody can be signed in; the page still offers sign-in.
  const accountId = env.APP_DB === undefined ? undefined : await signedInAccount(cookies, appDatabase(), Date.now(), origins);
  if (accountId !== undefined) redirect(DASHBOARD);
  return <SignIn available={availableProviders(env)} testSignIn={offersTestSignIn(parseStage(env.LEXEMA_STAGE), hostname)} origins={origins} />;
}
