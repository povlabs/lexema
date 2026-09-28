// The chrome every page of developers.lexema.fyi carries (#166): the bar with
// the site's name, Docs, Pricing and Sign in (signed in, #169: Dashboard too,
// then the account's email and Sign out), and the footer. Split out of the
// route group's layout for the reason `SiteFooter.tsx` is — the layout imports
// `globals.css`, which Node cannot load — and because the docs lay the bar and
// footer out edge to edge where the other pages keep them to the column.
//
// On a phone (below `sm`) the bar keeps the name and Sign in, and Docs and
// Pricing move into the ☰ menu (DeveloperMenu), a `<details>` that works
// without a script. Signed in, the bar keeps only the name, and the menu names
// the dashboard first and ends with the email and Sign out (board `j6UaW`).
//
// Paths here are the developer site's own (`/docs`): worker/hosts.ts serves
// them from the route group, so no link names the group's segment.

import type { ReactNode } from "react";
import { DASHBOARD, SIGN_IN_PAGE } from "../worker/dashboard.ts";
import { ORIGIN } from "../worker/hosts.ts";
import { CloseIcon, MenuIcon } from "./MenuIcons";
import {
  DEV_ACCOUNT,
  DEV_ACCOUNT_EMAIL,
  DEV_BAR,
  DEV_BAR_INNER,
  DEV_BAR_INNER_WIDE,
  DEV_FOOTER,
  DEV_FOOTER_INNER,
  DEV_FOOTER_INNER_WIDE,
  DEV_FOOTER_LINK,
  DEV_FOOTER_LINKS,
  DEV_FOOTER_NAME,
  DEV_MENU,
  DEV_MENU_ACCOUNT,
  DEV_MENU_ACTIONS,
  DEV_MENU_BAR,
  DEV_MENU_CLOSE_ICON,
  DEV_MENU_EMAIL,
  DEV_MENU_FILLED,
  DEV_MENU_LINK,
  DEV_MENU_LINKS,
  DEV_MENU_OPEN_ICON,
  DEV_MENU_OUTLINE,
  DEV_MENU_PANEL,
  DEV_MENU_SIGN_OUT,
  DEV_MENU_TOGGLE,
  DEV_NAME,
  DEV_NAME_SITE,
  DEV_NAV,
  DEV_NAV_LINK,
  DEV_SIGN_IN,
  DEV_SIGN_OUT,
} from "./styles.ts";

/** The address the developer site's Contact reaches (#159). */
export const CONTACT_EMAIL = "contact@lexema.fyi";

/** Where signing in starts: the sign-in page (#169). */
export const SIGN_IN_PATH = SIGN_IN_PAGE;

/** Where signing out is posted (worker/signIn.ts). */
export const SIGN_OUT_PATH = "/sign-out";

/** The pages the bar names, and which one a page is. */
export type DeveloperSection = "dashboard" | "docs" | "pricing";

/** A page the bar and the ☰ menu name. */
export interface DeveloperNavItem {
  section: DeveloperSection;
  label: string;
  href: string;
}

const NAV: readonly DeveloperNavItem[] = [
  { section: "docs", label: "Docs", href: "/docs" },
  { section: "pricing", label: "Pricing", href: "/pricing" },
];

/** A signed-in page's bar also names the dashboard, first (board 28). */
const SIGNED_IN_NAV: readonly DeveloperNavItem[] = [
  { section: "dashboard", label: "Dashboard", href: DASHBOARD },
  ...NAV,
];

/** Who a signed-in page is for, as the bar names them. */
export interface SignedIn {
  email: string;
}

/** The footer's links: the dictionary, the two public pages, and the contact address. No Terms until #162. */
export const DEVELOPER_FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: "lexema.fyi", href: ORIGIN.lexema },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: `mailto:${CONTACT_EMAIL}` },
];

function DeveloperName() {
  return (
    <a className={DEV_NAME} href="/">
      Lexema<span className={DEV_NAME_SITE}>Developers</span>
    </a>
  );
}

/**
 * The ☰ menu, on a phone only (board `VDNSE`): the bar's pages, one a row,
 * then `children`, the menu's foot. Open, it fills the screen under its own
 * copy of the bar, and the ☰ turns to × where it was.
 *
 * `links` and `children` are what a signed-in bar changes (board `j6UaW`):
 * the dashboard first among the links, and the account's email and Sign out
 * as the foot.
 */
export function DeveloperMenu({
  links,
  current,
  children,
}: {
  links: readonly DeveloperNavItem[];
  current?: DeveloperSection;
  children: ReactNode;
}) {
  return (
    <details className={DEV_MENU}>
      <summary className={DEV_MENU_TOGGLE} aria-label="Menu">
        <MenuIcon className={DEV_MENU_OPEN_ICON} />
        <CloseIcon className={DEV_MENU_CLOSE_ICON} />
      </summary>
      <div className={DEV_MENU_PANEL}>
        <div className={DEV_MENU_BAR}>
          <DeveloperName />
        </div>
        <nav aria-label="Menu">
          <ul className={DEV_MENU_LINKS}>
            {links.map((item) => (
              <li key={item.section}>
                <a className={DEV_MENU_LINK} href={item.href} aria-current={item.section === current ? "page" : undefined}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {children}
      </div>
    </details>
  );
}

/** The signed-out menu's foot: Sign in, then Get an API key, which also starts at sign-in. */
function SignedOutMenuActions() {
  return (
    <div className={DEV_MENU_ACTIONS}>
      <a className={DEV_MENU_OUTLINE} href={SIGN_IN_PATH}>
        Sign in
      </a>
      <a className={DEV_MENU_FILLED} href={SIGN_IN_PATH}>
        Get an API key
      </a>
    </div>
  );
}

/** The signed-in menu's foot (board `j6UaW`): the account's email, then Sign out. */
function SignedInMenuActions({ signedIn }: { signedIn: SignedIn }) {
  return (
    <div className={DEV_MENU_ACCOUNT}>
      <span className={DEV_MENU_EMAIL}>{signedIn.email}</span>
      <form method="post" action={SIGN_OUT_PATH}>
        <button className={DEV_MENU_SIGN_OUT} type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}

function DeveloperHeader({ current, wide, signedIn }: { current?: DeveloperSection; wide: boolean; signedIn?: SignedIn }) {
  const nav = signedIn === undefined ? NAV : SIGNED_IN_NAV;
  return (
    <header className={DEV_BAR}>
      <div className={wide ? DEV_BAR_INNER_WIDE : DEV_BAR_INNER}>
        <DeveloperName />
        <nav aria-label="Developer site">
          <ul className={DEV_NAV}>
            {nav.map((item) => (
              <li key={item.section}>
                <a className={DEV_NAV_LINK} href={item.href} aria-current={item.section === current ? "page" : undefined}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {signedIn === undefined ? (
          <>
            <a className={DEV_SIGN_IN} href={SIGN_IN_PATH}>
              Sign in
            </a>
            <DeveloperMenu links={NAV} current={current}>
              <SignedOutMenuActions />
            </DeveloperMenu>
          </>
        ) : (
          <>
            <div className={DEV_ACCOUNT}>
              <span className={DEV_ACCOUNT_EMAIL}>{signedIn.email}</span>
              <form method="post" action={SIGN_OUT_PATH}>
                <button className={DEV_SIGN_OUT} type="submit">
                  Sign out
                </button>
              </form>
            </div>
            <DeveloperMenu links={SIGNED_IN_NAV} current={current}>
              <SignedInMenuActions signedIn={signedIn} />
            </DeveloperMenu>
          </>
        )}
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
  signedIn,
  children,
}: {
  /** The page the bar marks as the one being read. */
  current?: DeveloperSection;
  /** Edge to edge, as the docs are drawn. */
  wide?: boolean;
  /** Signed in: the bar names the dashboard, the account's email and Sign out. */
  signedIn?: SignedIn;
  children: ReactNode;
}) {
  return (
    <>
      <DeveloperHeader current={current} wide={wide} signedIn={signedIn} />
      {children}
      <DeveloperFooter wide={wide} />
    </>
  );
}
