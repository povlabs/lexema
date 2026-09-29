// developers.lexema.fyi/docs (#166): the docs' introduction, their first page.
// The wiring only; the markup is `../../../DeveloperDocs.tsx`. It reads the
// session, when there is one, for the account menu (#190), and nothing else
// from D1.
import { DeveloperDocs } from "../../../DeveloperDocs";
import { signedInVisitor } from "../visitor.ts";

export const metadata = { title: "Docs — Lexema API" };

export default async function Page() {
  return <DeveloperDocs page={{ kind: "guide", guide: "introduction" }} signedIn={await signedInVisitor()} />;
}
