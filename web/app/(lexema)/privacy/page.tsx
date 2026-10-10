// The `/privacy` route: the Privacy notice for lexema.fyi (#139).
import { Privacy } from "@/components/dictionary/Privacy";
import { SITE_NAME } from "@/lib/dictionary/params.ts";
import { LEGAL_TITLE } from "@/lib/dictionary/siteText.ts";

export const metadata = { title: `${LEGAL_TITLE.privacy} — ${SITE_NAME}` };

export default function Page() {
  return <Privacy />;
}
