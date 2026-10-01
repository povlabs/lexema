// developers.lexema.fyi/ (#166): the landing page. The wiring only; the markup
// is `@/components/developers/DeveloperLanding.tsx`. It reads no session and
// nothing from D1.
import { DeveloperLanding } from "@/components/developers/DeveloperLanding";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export default async function Page() {
  return <DeveloperLanding origins={await siteOrigins()} />;
}
