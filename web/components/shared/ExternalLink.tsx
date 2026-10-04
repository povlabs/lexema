// A link that leaves Lexema — a Source page on Wiktionary, a review's
// evidence, a credit on /licence — opens in a new tab, so the page stays
// where the reader left it, and says so to a screen reader. `noopener` keeps
// the new page from reaching back into this one; `noreferrer` sends it no
// referrer. Links inside Lexema (`/?q=…`) are plain `<a>`s in the same tab.

import type { ReactNode } from "react";

export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

export function ExternalLink({ className, href, children }: { className?: string; href: string; children: ReactNode }) {
  return (
    <a className={className} href={href} {...NEW_TAB}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
