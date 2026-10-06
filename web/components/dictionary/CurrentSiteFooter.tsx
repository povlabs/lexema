"use client";

// The footer as the layout renders it: the layout is shared by every page and
// is not told which one it wraps, so the path of the page being shown is read
// here and handed to `SiteFooter`, which marks that page's link. The path is
// read during the server render too, so the mark is in the HTML. It is handed
// only the origin the footer links to, so nothing else crosses into the
// client payload (#647).

import { usePathname } from "next/navigation";
import { SiteFooter, type FooterOrigins } from "./SiteFooter";

export function CurrentSiteFooter({ origins }: { origins: FooterOrigins }) {
  return <SiteFooter origins={origins} current={usePathname()} />;
}
