// The chrome every page of developers.lexema.fyi carries (#166): the bar with
// the site's name, Docs, Pricing and Sign in, and the footer. Split out of the
// route group's layout for the reason `SiteFooter.tsx` is — the layout imports
// `globals.css`, which Node cannot load — and because the docs lay the bar and
// footer out edge to edge where the other pages keep them to the column.
//
// Paths here are the developer site's own (`/docs`): worker/hosts.ts serves
// them from the route group, so no link names the group's segment.

import type { ReactNode } from "react";
import { ORIGIN } from "../worker/hosts.ts";
import {
  DEV_BAR,
  DEV_BAR_INNER,
  DEV_BAR_INNER_WIDE,
  DEV_FOOTER,
  DEV_FOOTER_INNER,
  DEV_FOOTER_INNER_WIDE,
  DEV_FOOTER_LINK,
  DEV_FOOTER_LINKS,
  DEV_FOOTER_NAME,
  DEV_NAME,
  DEV_NAME_SITE,
  DEV_NAV,
  DEV_NAV_LINK,
  DEV_SIGN_IN,
} from "./styles.ts";

/** The address the developer site's Contact reaches (#159). */
export const CONTACT_EMAIL = "contact@lexema.fyi";

/** Where signing in starts: the sign-in page (#169). */
export const SIGN_IN_PATH = "/sign-in";

/** The pages the bar names, and which one a page is. */
export type DeveloperSection = "docs" | "pricing";

const NAV: readonly { section: DeveloperSection; label: string; href: string }[] = [
  { section: "docs", label: "Docs", href: "/docs" },
  { section: "pricing", label: "Pricing", href: "/pricing" },
];

/** The footer's links: the dictionary, the two public pages, and the contact address. No Terms until #162. */
export const DEVELOPER_FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: "lexema.fyi", href: ORIGIN.lexema },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: `mailto:${CONTACT_EMAIL}` },
];

function DeveloperHeader({ current, wide }: { current?: DeveloperSection; wide: boolean }) {
  return (
    <header className={DEV_BAR}>
      <div className={wide ? DEV_BAR_INNER_WIDE : DEV_BAR_INNER}>
        <a className={DEV_NAME} href="/">
          Lexema<span className={DEV_NAME_SITE}>Developers</span>
        </a>
        <nav aria-label="Developer site">
          <ul className={DEV_NAV}>
            {NAV.map((item) => (
              <li key={item.section}>
                <a className={DEV_NAV_LINK} href={item.href} aria-current={item.section === current ? "page" : undefined}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a className={DEV_SIGN_IN} href={SIGN_IN_PATH}>
          Sign in
        </a>
      </div>
    </header>
  );
}

export function DeveloperFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className={DEV_FOOTER}>
      <div className={wide ? DEV_FOOTER_INNER_WIDE : DEV_FOOTER_INNER}>
        <a className={DEV_FOOTER_NAME} href="/">
          Lexema Developers
        </a>
        <nav aria-label="Site">
          <ul className={DEV_FOOTER_LINKS}>
            {DEVELOPER_FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                <a className={DEV_FOOTER_LINK} href={link.href}>
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

/** A developer-site page: the bar, the page, the footer. */
export function DeveloperPage({
  current,
  wide = false,
  children,
}: {
  current?: DeveloperSection;
  /** Edge to edge, as the docs are drawn. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <DeveloperHeader current={current} wide={wide} />
      {children}
      <DeveloperFooter wide={wide} />
    </>
  );
}
