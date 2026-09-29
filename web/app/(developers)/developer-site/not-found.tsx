// Every 404 on developers.lexema.fyi (#171): an unknown docs slug, and every
// path no page matches, which `[...missing]` catches so the miss stays inside
// this route group. Without it vinext frames a route miss in the `/` route's
// layout, the dictionary's. The wiring only; the markup is
// `@/components/developers/DeveloperNotFound.tsx`. It reads the session, when
// there is one, for the account menu (#190).
import { DeveloperNotFound } from "@/components/developers/DeveloperNotFound";
import { signedInVisitor } from "@/lib/developers/visitor.ts";

export default async function NotFound() {
  return <DeveloperNotFound signedIn={await signedInVisitor()} />;
}
