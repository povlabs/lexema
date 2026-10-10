// The footer every page carries (frame C2, its links from frame 33), with no
// database and no stylesheet in it.
//
// Split out of `layout.tsx` for the same reason `SearchPage.tsx` is split out
// of `page.tsx`: the layout imports `globals.css`, which Node cannot load, so
// `web/test/page.test.tsx` renders this component instead of the layout.
//
// Four links (#139, #614), in Italian (#791): the Licence page, which carries the credit ADR 0009
// asks for, the Privacy notice, Contact, a mail to the address the developer
// site gives too, and Developers, the one way from the dictionary to the
// developer site (#159). Developers is on the host `origins` names, so a
// Preview's footer stays on that Preview (#266). The link to the page being
// shown is marked `aria-current` and drawn highlighted; only Licence and
// Privacy are pages of this site, so only they can be.

import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { CONTACT_EMAIL } from "@/components/shared/contact.ts";
import { FOOTER } from "@/lib/dictionary/siteText.ts";
import {
  SITE_FOOTER,
  SITE_FOOTER_INNER,
  SITE_FOOTER_LINK,
  SITE_FOOTER_LINKS,
  SITE_FOOTER_NAME,
} from "@/components/shared/styles.ts";

/** The Licence page's path, which every result's Source link leans on (ADR 0009). */
export const LICENCE_PATH = "/licence";
/** The Privacy notice's path. */
export const PRIVACY_PATH = "/privacy";

/** A footer link: a page of this site, which marks itself while shown, or a way out of it, which never does. */
type FooterLink = { kind: "page"; label: string; path: string } | { kind: "away"; label: string; href: string };

/** The one origin the footer links to; the rest of `SiteOrigins` never reaches it (#647). */
export type FooterOrigins = Pick<SiteOrigins, "developers">;

const linksOf = (origins: FooterOrigins): readonly FooterLink[] => [
  { kind: "page", label: FOOTER.licence, path: LICENCE_PATH },
  { kind: "page", label: FOOTER.privacy, path: PRIVACY_PATH },
  { kind: "away", label: FOOTER.contact, href: `mailto:${CONTACT_EMAIL}` },
  { kind: "away", label: FOOTER.developers, href: origins.developers },
];

const hrefOf = (link: FooterLink) => (link.kind === "page" ? link.path : link.href);
const isShown = (link: FooterLink, current: string) => link.kind === "page" && link.path === current;

/** The footer, with `current`, the path of the page being shown, marking its own link. */
export function SiteFooter({ origins, current }: { origins: FooterOrigins; current: string }) {
  return (
    <footer className={SITE_FOOTER}>
      <div className={SITE_FOOTER_INNER}>
        <a className={SITE_FOOTER_NAME} href="/">
          Lexema
        </a>
        <nav aria-label={FOOTER.name}>
          <ul className={SITE_FOOTER_LINKS}>
            {linksOf(origins).map((link) => (
              <li key={link.label}>
                <a className={SITE_FOOTER_LINK} href={hrefOf(link)} aria-current={isShown(link, current) ? "page" : undefined}>
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
