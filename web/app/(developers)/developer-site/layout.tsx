// The developer site's layout (#159): every page of developers.lexema.fyi.
//
// Its own root layout, beside `(lexema)/layout.tsx`, so the developer site
// shares the dictionary's face and none of its chrome. worker/hosts.ts
// rewrites `developers.lexema.fyi/…` onto this segment; on any other host the
// segment is a 404, so no dictionary URL reaches it.
import type { ReactNode } from "react";
import "@/app/globals.css";
import { BODY } from "@/components/shared/styles.ts";

export const metadata = { title: "Lexema API" };

export default function DevelopersLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={BODY}>{children}</body>
    </html>
  );
}
