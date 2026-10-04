// developers.lexema.fyi/privacy (#162): the Privacy policy. The wiring only;
// the markup is `@/components/developers/LegalPage.tsx` and the text
// `@/components/developers/legalDocuments.ts`. It reads the session, when
// there is one, for the account menu (#190), and nothing else from D1.
import { LegalPage } from "@/components/developers/LegalPage";
import { PRIVACY } from "@/components/developers/legalDocuments";
import { signedInVisitor } from "@/lib/developers/visitor.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export const metadata = { title: "Privacy policy — Lexema API" };

export default async function Page() {
  return <LegalPage document={PRIVACY} signedIn={await signedInVisitor()} origins={await siteOrigins()} />;
}
