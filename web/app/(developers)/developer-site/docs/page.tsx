// developers.lexema.fyi/docs (#166): the API docs. The wiring only; the markup
// is `../../../DeveloperDocs.tsx`. It reads no session and nothing from D1.
import { DeveloperDocs } from "../../../DeveloperDocs";

export const metadata = { title: "Docs — Lexema API" };

export default function Page() {
  return <DeveloperDocs />;
}
