// The top bar every page but the empty search carries (frame C1): the name at
// the left, a hairline under it, and nothing else. Split out of `layout.tsx`
// for the reason `SiteFooter.tsx` is — the layout imports `globals.css`, which
// Node cannot load, so the tests render this component on its own.
//
// Before a query the page is the name and the bar alone, centred (frame 00), so
// the search page leaves this out in that state rather than showing the name
// twice.

import { TOP_BAR, TOP_BAR_INNER, TOP_BAR_NAME } from "./styles.ts";

export function SiteHeader() {
  return (
    <header className={TOP_BAR}>
      <div className={TOP_BAR_INNER}>
        <a className={TOP_BAR_NAME} href="/">
          Lexema
        </a>
      </div>
    </header>
  );
}
