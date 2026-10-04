// developers.lexema.fyi/privacy (#162): the Privacy policy. The wiring only;
// the markup is `@/components/developers/DeveloperLegal.tsx`. It reads the
// session, when there is one, for the account menu, and nothing else from D1.
import { DeveloperPrivacy } from "@/components/developers/DeveloperLegal";
import { signedInVisitor } from "@/lib/developers/visitor.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export const metadata = { title: "Privacy policy — Lexema API" };

export default async function Page() {
  return <DeveloperPrivacy signedIn={await signedInVisitor()} origins={await siteOrigins()} />;
}
