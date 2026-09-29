// The chrome every page of developers.lexema.fyi carries (#166): the bar with
// the site's name, Docs, Pricing and Sign in (signed in, #169: Dashboard too,
// and at the right end the account's avatar and its menu, #190), and the
// footer. Split out of the
// route group's layout for the reason `SiteFooter.tsx` is — the layout imports
// `globals.css`, which Node cannot load — and because the docs lay the bar and
// footer out edge to edge where the other pages keep them to the column.
//
// On a phone (below `sm`) the bar keeps the name and Sign in, and Docs and
// Pricing move into the ☰ menu (DeveloperMenu.tsx), Base UI's dialog. Signed
// in, the bar keeps only the name, and the menu names the dashboard and its
// settings first and ends with the email and Sign out (board `j6UaW`).
//
// Paths here are the developer site's own (`/docs`): worker/hosts.ts serves
// them from the route group, so no link names the group's segment.

import type { ReactNode } from "react";
import { SIGN_IN_PAGE } from "../worker/dashboard.ts";
import { ORIGIN } from "../worker/hosts.ts";
import { AccountMenu } from "./AccountMenu";
import { DASHBOARD, SETTINGS } from "./dashboardActions.ts";
import { DeveloperMenu, type DeveloperMenuLink } from "./DeveloperMenu";
import type { SignedIn } from "./signedIn.ts";
import {
  DEV_ACCOUNT,
  DEV_BAR,
  DEV_BAR_INNER,
  DEV_BAR_INNER_WIDE,
  DEV_FOOTER,
  DEV_FOOTER_INNER,
  DEV_FOOTER_INNER_WIDE,
  DEV_FOOTER_LINK,
  DEV_FOOTER_LINKS,
  DEV_FOOTER_NAME,
  DEV_MENU_ACCOUNT,
  DEV_MENU_ACTIONS,
  DEV_MENU_EMAIL,
  DEV_MENU_FILLED,
  DEV_MENU_OUTLINE,
  DEV_MENU_SIGN_OUT,
  DEV_NAME,
  DEV_NAME_SITE,
  DEV_NAV,
  DEV_NAV_LINK,
  DEV_SIGN_IN,
} from "./styles.ts";

/** The address the developer site's Contact reaches (#159). */
export const CONTACT_EMAIL = "contact@lexema.fyi";

/** Where signing in starts: the sign-in page (#169). */
export const SIGN_IN_PATH = SIGN_IN_PAGE;

/** Where signing out is posted (worker/signIn.ts). */
export const SIGN_OUT_PATH = "/sign-out";

/** The pages the bar names, and which one a page is. */
export type DeveloperSection = "dashboard" | "settings" | "docs" | "pricing";

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

const DASHBOARD_ITEM: DeveloperNavItem = { section: "dashboard", label: "Dashboard", href: DASHBOARD };

/** A signed-in page's bar also names the dashboard, first (board 28). */
const SIGNED_IN_NAV: readonly DeveloperNavItem[] = [DASHBOARD_ITEM, ...NAV];

/** A signed-in ☰ menu names the dashboard's settings under it (board `j6UaW`, #190). */
const SIGNED_IN_MENU: readonly DeveloperNavItem[] = [DASHBOARD_ITEM, { section: "settings", label: "Settings", href: SETTINGS }, ...NAV];

/** The id of the signed-in bar's sign-out form, which the account menu's Sign out submits. */
const SIGN_OUT_FORM = "sign-out";

/** The pages the ☰ menu names, with the one being read marked; signed in, the dashboard and its settings first. */
export const developerMenuLinks = (signedIn: SignedIn | undefined, current: DeveloperSection | undefined): DeveloperMenuLink[] =>
  (signedIn === undefined ? NAV : SIGNED_IN_MENU).map((item) => ({ label: item.label, href: item.href, current: item.section === current }));

/** The bar has no Settings: on the settings page it marks the dashboard, as board 28g draws it. */
const barSection = (current: DeveloperSection | undefined): DeveloperSection | undefined => (current === "settings" ? "dashboard" : current);

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
export function SignedInMenuActions({ signedIn }: { signedIn: SignedIn }) {
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
  const marked = barSection(current);
  return (
    <header className={DEV_BAR}>
      <div className={wide ? DEV_BAR_INNER_WIDE : DEV_BAR_INNER}>
        <DeveloperName />
        <nav aria-label="Developer site">
          <ul className={DEV_NAV}>
            {nav.map((item) => (
              <li key={item.section}>
                <a className={DEV_NAV_LINK} href={item.href} aria-current={item.section === marked ? "page" : undefined}>
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
            <DeveloperMenu name={<DeveloperName />} links={developerMenuLinks(signedIn, current)}>
              <SignedOutMenuActions />
            </DeveloperMenu>
          </>
        ) : (
          <>
            <div className={DEV_ACCOUNT}>
              <form id={SIGN_OUT_FORM} method="post" action={SIGN_OUT_PATH} hidden />
              <AccountMenu signedIn={signedIn} signOutForm={SIGN_OUT_FORM} />
            </div>
            <DeveloperMenu name={<DeveloperName />} links={developerMenuLinks(signedIn, current)}>
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
  /** Signed in: the bar names the dashboard and carries the account menu. */
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
