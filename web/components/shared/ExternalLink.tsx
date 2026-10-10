// A link that leaves Lexema — a Source page on Wiktionary, a review's
// evidence, a credit on /licence — opens in a new tab, so the page stays
// where the reader left it, and says so to a screen reader, in the language of
// the page it sits on: the dictionary's Italian (#791) or the developer site's
// English. `noopener` keeps the new page from reaching back into this one;
// `noreferrer` sends it no referrer. Links inside Lexema (`/?q=…`) are plain
// `<a>`s in the same tab.

import type { ReactNode } from "react";

export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/** What a screen reader hears after the link's text, by the page's language. */
export const NEW_TAB_NOTE = { it: " (si apre in una nuova scheda)", en: " (opens in a new tab)" } as const;

export function ExternalLink({
  language,
  className,
  href,
  children,
}: {
  language: keyof typeof NEW_TAB_NOTE;
  className?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <a className={className} href={href} {...NEW_TAB}>
      {children}
      <span className="sr-only">{NEW_TAB_NOTE[language]}</span>
    </a>
  );
}
