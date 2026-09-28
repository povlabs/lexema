// developers.lexema.fyi/pricing (#166): the pricing page. The wiring only; the
// markup is `../../../DeveloperPricing.tsx`. It reads no session and nothing
// from D1.
import { DeveloperPricing } from "../../../DeveloperPricing";

export const metadata = { title: "Pricing — Lexema API" };

export default function Page() {
  return <DeveloperPricing />;
}
