// A dictionary legal page, `/licence` or `/privacy` (#139), under the site's
// header. The header, the text and the footer share the one `COLUMN`, so they
// start on one edge: 20 px in on a phone, as frames 33m and 34m draw them
// (#588).

import { LegalPage, type LegalText } from "@/components/shared/LegalPage";
import { SiteHeader } from "./SiteHeader";

export function DictionaryLegalPage(text: LegalText) {
  return (
    <>
      <SiteHeader />
      <LegalPage site="dictionary" {...text} />
    </>
  );
}
