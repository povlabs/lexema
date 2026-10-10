import type { ReactNode } from "react";
import "@/app/globals.css";
import { CurrentSiteFooter } from "@/components/dictionary/CurrentSiteFooter";
import { BODY } from "@/components/shared/styles.ts";
import { SITE_ICON_METADATA } from "@/lib/shared/siteIcons.ts";
import { siteOrigins } from "@/lib/shared/siteOrigins.ts";

export const metadata = { title: "Lexema", ...SITE_ICON_METADATA };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { developers } = await siteOrigins();
  return (
    <html lang="it">
      {/* The dark scheme, said once: `surface` under the page and `text` on it,
          in the size and the face the manifest has not re-ruled. There is no
          light branch — the manifest rules dark only. */}
      <body className={BODY}>
        {children}
        {/* Every page, including this one's children: the Licence page is
            what makes the small per-reading Source link lawful, so the way to
            it cannot depend on which page a reader landed on (ADR 0009). */}
        <CurrentSiteFooter origins={{ developers }} />
      </body>
    </html>
  );
}
