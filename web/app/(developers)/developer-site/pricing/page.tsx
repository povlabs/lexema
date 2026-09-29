// developers.lexema.fyi/pricing (#166): the pricing page. The wiring only; the
// markup is `../../../DeveloperPricing.tsx`. It reads the session, when there
// is one, for the account menu (#190), and nothing else from D1.
import { DeveloperPricing } from "../../../DeveloperPricing";
import { signedInVisitor } from "../visitor.ts";

export const metadata = { title: "Pricing — Lexema API" };

export default async function Page() {
  return <DeveloperPricing signedIn={await signedInVisitor()} />;
}
