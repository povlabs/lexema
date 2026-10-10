// A lexema.fyi address with no page (#791): the site's header and one plain
// line, in the no-entry page's heading so the two misses read alike. No board
// draws it.

import { NOT_FOUND_HEADING, SHELL_TOP } from "@/components/shared/styles.ts";
import { PAGE_NOT_FOUND } from "@/lib/dictionary/siteText.ts";
import { SiteHeader } from "./SiteHeader";

export function PageNotFound() {
  return (
    <>
      <SiteHeader />
      <main className={SHELL_TOP}>
        <h1 className={NOT_FOUND_HEADING}>{PAGE_NOT_FOUND}</h1>
      </main>
    </>
  );
}
