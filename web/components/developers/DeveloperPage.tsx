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
// While sign-up is closed (#610, worker/developers/signUp.ts), a signed-out bar
// offers no Sign in, and its menu no Sign in or Get an API key: Docs and
// Pricing stay.
//
// Paths here are the developer site's own (`/docs`): worker/shared/hosts.ts serves
// them from the route group, so no link names the group's segment.

import type { ReactNode } from "react";
import { SIGN_IN_PAGE } from "@/worker/developers/dashboard.ts";
import type { SignUp } from "@/worker/developers/signUp.ts";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { CONTACT_EMAIL } from "@/components/shared/contact.ts";
import { AccountMenu } from "./AccountMenu";
import { DASHBOARD, SETTINGS } from "@/lib/developers/dashboardActions.ts";
import { DeveloperMenu, type DeveloperMenuLink } from "./DeveloperMenu";
import type { SignedIn } from "@/lib/developers/signedIn.ts";
import {
  DEV_ACCOUNT,
  DEV_BAR,
  DEV_BAR_END,
  DEV_BAR_INNER,
  DEV_BAR_INNER_WIDE,
  DEV_FOOTER,
  DEV_FOOTER_INNER,
  DEV_FOOTER_INNER_WIDE,
  DEV_FOOTER_LEGAL,
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
  DEV_NAV,
  DEV_NAV_LINK,
  DEV_SIGN_IN,
} from "@/components/shared/styles.ts";

/** The developer site's Terms of service and Privacy policy (#162). */
export const TERMS_PATH = "/terms";
export const PRIVACY_PATH = "/privacy";

/** Where signing in starts: the sign-in page (#169). */
export const SIGN_IN_PATH = SIGN_IN_PAGE;

/** Where signing out is posted (worker/developers/signIn.ts). */
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

/** The legal pages, which the footer names and marks when one is being read (frames 35 and 36). */
export type LegalSection = "terms" | "privacy";

/**
 * A footer link. A legal one names its page, which the footer marks while it
 * is read, and moves to the second row on a phone (frames 35m and 36m).
 */
export type DeveloperFooterLink =
  | { label: string; href: string; legal: false }
  | { label: string; href: string; legal: LegalSection };

/**
 * The footer's links: the dictionary, the two public pages, the Terms of
 * service and Privacy policy (#162), and the contact address. The dictionary
 * is on the host `origins` names (#266).
 */
export const developerFooterLinks = (origins: SiteOrigins): readonly DeveloperFooterLink[] => [
  { label: "Lexema.fyi", href: origins.lexema, legal: false },
  { label: "Docs", href: "/docs", legal: false },
  { label: "Pricing", href: "/pricing", legal: false },
  { label: "Terms", href: TERMS_PATH, legal: "terms" },
  { label: "Privacy", href: PRIVACY_PATH, legal: "privacy" },
  { label: "Contact", href: `mailto:${CONTACT_EMAIL}`, legal: false },
];

function DeveloperName() {
  return (
    <a className={DEV_NAME} href="/">
      Lexema Developers
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

/**
 * Who a page is for: signed in, or signed out on a site whose sign-up is open
 * or closed. A page that may be read signed out must say which, so no page
 * offers a sign-in the site has closed.
 */
export type DeveloperVisitor = { signedIn?: SignedIn; signUp: SignUp } | { signedIn: SignedIn; signUp?: undefined };

/** A signed-out bar's end: Sign in, and the ☰ menu with its Sign in foot, while sign-up is open; the menu alone while it is closed. */
function SignedOutEnd({ signUp, menu }: { signUp: SignUp; menu: readonly DeveloperMenuLink[] }) {
  switch (signUp) {
    case "open":
      return (
        <>
          <a className={DEV_SIGN_IN} href={SIGN_IN_PATH}>
            Sign in
          </a>
          <DeveloperMenu name={<DeveloperName />} links={menu}>
            <SignedOutMenuActions />
          </DeveloperMenu>
        </>
      );
    case "closed":
      return (
        <div className={DEV_BAR_END}>
          <DeveloperMenu name={<DeveloperName />} links={menu}>
            {null}
          </DeveloperMenu>
        </div>
      );
  }
}

/** Who the bar is drawn for: an account, or a signed-out visitor and whether sign-up is open. */
type BarVisitor = { kind: "signed-in"; signedIn: SignedIn } | { kind: "signed-out"; signUp: SignUp };

function barVisitorOf(visitor: DeveloperVisitor): BarVisitor {
  if (visitor.signUp === undefined) return { kind: "signed-in", signedIn: visitor.signedIn };
  return visitor.signedIn === undefined ? { kind: "signed-out", signUp: visitor.signUp } : { kind: "signed-in", signedIn: visitor.signedIn };
}

function DeveloperHeader({ current, wide, visitor }: { current?: DeveloperSection; wide: boolean; visitor: DeveloperVisitor }) {
  const bar = barVisitorOf(visitor);
  const nav = bar.kind === "signed-out" ? NAV : SIGNED_IN_NAV;
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
        {bar.kind === "signed-out" ? (
          <SignedOutEnd signUp={bar.signUp} menu={developerMenuLinks(undefined, current)} />
        ) : (
          <>
            <div className={DEV_ACCOUNT}>
              <form id={SIGN_OUT_FORM} method="post" action={SIGN_OUT_PATH} hidden />
              <AccountMenu signedIn={bar.signedIn} signOutForm={SIGN_OUT_FORM} />
            </div>
            <DeveloperMenu name={<DeveloperName />} links={developerMenuLinks(bar.signedIn, current)}>
              <SignedInMenuActions signedIn={bar.signedIn} />
            </DeveloperMenu>
          </>
        )}
      </div>
    </header>
  );
}

export function DeveloperFooter({ wide = false, legal, origins }: { wide?: boolean; legal?: LegalSection; origins: SiteOrigins }) {
  return (
    <footer className={DEV_FOOTER}>
      <div className={wide ? DEV_FOOTER_INNER_WIDE : DEV_FOOTER_INNER}>
        <a className={DEV_FOOTER_NAME} href="/">
          Lexema Developers
        </a>
        <nav aria-label="Site">
          <ul className={DEV_FOOTER_LINKS}>
            {developerFooterLinks(origins).map((link) => (
              <li key={link.label} className={link.legal === false ? undefined : DEV_FOOTER_LEGAL}>
                <a
                  className={DEV_FOOTER_LINK}
                  href={link.href}
                  aria-current={link.legal !== false && link.legal === legal ? "page" : undefined}
                >
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
  legal,
  wide = false,
  origins,
  children,
  ...visitor
}: DeveloperVisitor & {
  /** The page the bar marks as the one being read. */
  current?: DeveloperSection;
  /** The legal page the footer marks as the one being read. */
  legal?: LegalSection;
  /** Edge to edge, as the docs are drawn. */
  wide?: boolean;
  /** The sites' addresses as this request's host names them: the footer links the dictionary. */
  origins: SiteOrigins;
  children: ReactNode;
}) {
  return (
    <>
      <DeveloperHeader current={current} wide={wide} visitor={visitor} />
      {children}
      <DeveloperFooter wide={wide} legal={legal} origins={origins} />
    </>
  );
}
