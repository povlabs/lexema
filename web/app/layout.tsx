import type { ReactNode } from "react";
import "./globals.css";
import { SiteFooter } from "./SiteFooter";

export const metadata = { title: "Lexema" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Every page, including this one's children: the attribution page is
            what makes the small per-reading Source link lawful, so the way to
            it cannot depend on which page a reader landed on (ADR 0009). */}
        <SiteFooter />
      </body>
    </html>
  );
}
