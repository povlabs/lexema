// developers.lexema.fyi/docs (#166): the docs' introduction, their first page.
// The wiring only; the markup is `../../../DeveloperDocs.tsx`. It reads no
// session and nothing from D1.
import { DeveloperDocs } from "../../../DeveloperDocs";

export const metadata = { title: "Docs — Lexema API" };

export default function Page() {
  return <DeveloperDocs page={{ kind: "guide", guide: "introduction" }} />;
}
