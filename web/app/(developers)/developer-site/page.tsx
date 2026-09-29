// developers.lexema.fyi/ (#166): the landing page. The wiring only; the markup
// is `../../DeveloperLanding.tsx`. It reads no session and nothing from D1.
import { DeveloperLanding } from "@/components/developers/DeveloperLanding";

export default function Page() {
  return <DeveloperLanding />;
}
