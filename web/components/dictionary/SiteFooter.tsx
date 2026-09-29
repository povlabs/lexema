// The footer every page carries (frame C2), with no database and no stylesheet
// in it.
//
// Split out of `layout.tsx` for the same reason `SearchPage.tsx` is split out
// of `page.tsx`: the layout imports `globals.css`, which Node cannot load, so
// `web/test/page.test.tsx` renders this component instead of the layout.
//
// The frame names four links. Only `/attribution` exists today, and ADR 0009
// puts the credit on that page, so all four reach it until the other three
// pages are written — a link to a page that does not exist would be worse.
// A fifth, Developers, is the one way from the dictionary to the developer
// site (#159): `lexema.fyi/developers` is gone, with no redirect.

import { ORIGIN } from "@/worker/hosts.ts";
import {
  SITE_FOOTER,
  SITE_FOOTER_INNER,
  SITE_FOOTER_LINK,
  SITE_FOOTER_LINKS,
  SITE_FOOTER_NAME,
} from "@/components/shared/styles.ts";

const LINKS = [
  { label: "Attribution", href: "/attribution" },
  { label: "About the data", href: "/attribution#changed" },
  { label: "Licence", href: "/attribution#licence" },
  { label: "Contact", href: "/attribution" },
  { label: "Developers", href: ORIGIN.developers },
] as const;

export function SiteFooter() {
  return (
    <footer className={SITE_FOOTER}>
      <div className={SITE_FOOTER_INNER}>
        <a className={SITE_FOOTER_NAME} href="/">
          Lexema
        </a>
        <nav aria-label="Site">
          <ul className={SITE_FOOTER_LINKS}>
            {LINKS.map((link) => (
              <li key={link.label}>
                <a className={SITE_FOOTER_LINK} href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
