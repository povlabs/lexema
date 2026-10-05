// developers.lexema.fyi/terms (#162): the Terms of service. The wiring only;
// the markup is `@/components/developers/DeveloperLegal.tsx`. It reads the
// session, when there is one, for the account menu, and nothing else from D1.
import { DeveloperTerms } from "@/components/developers/DeveloperLegal";
import { signedInVisitor } from "@/lib/developers/visitor.ts";
import { developerSignUp } from "@/lib/developers/signUp.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export const metadata = { title: "Terms of service — Lexema API" };

export default async function Page() {
  return <DeveloperTerms signedIn={await signedInVisitor()} signUp={developerSignUp()} origins={await siteOrigins()} />;
}
