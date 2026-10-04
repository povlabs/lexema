// A dictionary legal page, `/licence` or `/privacy` (#139), under the site's
// header. Both take the legal column here, from one place, so the header name
// and the text start on one edge: 20 px in on a phone, as frames 33m and 34m
// draw them (#588). The footer, drawn by the layout, finds the same column
// from the page's path (`columnOf` in SiteFooter.tsx).

import { LegalPage, type LegalText } from "@/components/shared/LegalPage";
import { SiteHeader } from "./SiteHeader";

export function DictionaryLegalPage(text: LegalText) {
  return (
    <>
      <SiteHeader column="legal" />
      <LegalPage site="dictionary" {...text} />
    </>
  );
}
