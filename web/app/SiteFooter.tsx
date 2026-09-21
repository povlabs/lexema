// The footer every page carries, with no database and no stylesheet in it.
//
// Split out of `layout.tsx` for the same reason `SearchPage.tsx` is split out
// of `page.tsx`: the layout imports `globals.css`, which Node cannot load, so
// `web/test/page.test.tsx` renders this component instead of the layout.
//
// One small link, and nothing else. ADR 0009 puts the credit itself on the page
// this link reaches, not on the page a reader is looking at.

import { LINK, SITE_FOOTER } from "./styles.ts";

export function SiteFooter() {
  return (
    <footer className={SITE_FOOTER}>
      <a className={LINK} href="/attribution">
        Sources and licences
      </a>
    </footer>
  );
}
