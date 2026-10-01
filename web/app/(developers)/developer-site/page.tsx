// developers.lexema.fyi/ (#166): the landing page. The wiring only; the markup
// is `@/components/developers/DeveloperLanding.tsx`. It reads the session, when
// there is one, for the account menu (#193), and nothing else from D1.
import { DeveloperLanding } from "@/components/developers/DeveloperLanding";
import { signedInVisitor } from "@/lib/developers/visitor.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export default async function Page() {
  return <DeveloperLanding signedIn={await signedInVisitor()} origins={await siteOrigins()} />;
}
