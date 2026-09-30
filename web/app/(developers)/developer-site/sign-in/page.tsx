// developers.lexema.fyi/sign-in (#169): the wiring only; the markup is
// `@/components/developers/SignIn.tsx`. A developer already signed in goes to
// the dashboard.
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD } from "@/worker/dashboard.ts";
import { availableProviders, signedInAccount } from "@/worker/signIn.ts";
import { appDatabase } from "@/lib/shared/database.ts";
import { SignIn } from "@/components/developers/SignIn";

export const metadata = { title: "Sign in — Lexema API" };

export default async function Page() {
  const cookies = (await headers()).get("cookie");
  // Without a database nobody can be signed in; the page still offers sign-in.
  const accountId = env.APP_DB === undefined ? undefined : await signedInAccount(cookies, appDatabase(), Date.now());
  if (accountId !== undefined) redirect(DASHBOARD);
  return <SignIn available={availableProviders(env)} />;
}
