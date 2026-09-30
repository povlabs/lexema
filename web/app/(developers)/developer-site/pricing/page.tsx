// developers.lexema.fyi/pricing (#166): the pricing page. The wiring only; the
// markup is `@/components/developers/DeveloperPricing.tsx`. It reads the
// session, when there is one, for the account menu (#190) and the Choose
// forms' CSRF token (#208), and nothing else from D1.
import { DeveloperPricing } from "@/components/developers/DeveloperPricing";
import { postingVisitor } from "@/lib/developers/visitor.ts";

export const metadata = { title: "Pricing — Lexema API" };

export default async function Page() {
  return <DeveloperPricing visitor={await postingVisitor()} />;
}
