"use client";

// The footer as the layout renders it: the layout is shared by every page and
// is not told which one it wraps, so the path of the page being shown is read
// here and handed to `SiteFooter`, which marks that page's link. The path is
// read during the server render too, so the mark is in the HTML.

import { usePathname } from "next/navigation";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { SiteFooter } from "./SiteFooter";

export function CurrentSiteFooter({ origins }: { origins: SiteOrigins }) {
  return <SiteFooter origins={origins} current={usePathname()} />;
}
