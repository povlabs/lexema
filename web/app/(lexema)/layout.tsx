import type { ReactNode } from "react";
import "../globals.css";
import { SiteFooter } from "../SiteFooter";
import { BODY } from "../styles.ts";

export const metadata = { title: "Lexema" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* The dark scheme, said once: `surface` under the page and `text` on it,
          in the size and the face the manifest has not re-ruled. There is no
          light branch — the manifest rules dark only. */}
      <body className={BODY}>
        {children}
        {/* Every page, including this one's children: the attribution page is
            what makes the small per-reading Source link lawful, so the way to
            it cannot depend on which page a reader landed on (ADR 0009). */}
        <SiteFooter />
      </body>
    </html>
  );
}
