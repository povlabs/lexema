// The footer every page carries (frame C2, its links from frame 33), with no
// database and no stylesheet in it.
//
// Split out of `layout.tsx` for the same reason `SearchPage.tsx` is split out
// of `page.tsx`: the layout imports `globals.css`, which Node cannot load, so
// `web/test/page.test.tsx` renders this component instead of the layout.
//
// Three links (#139): the Licence page, which carries the credit ADR 0009 asks
// for, the Privacy notice, and Developers, the one way from the dictionary to
// the developer site (#159). Developers is on the host `origins` names, so a
// Preview's footer stays on that Preview (#266). The link to the page being
// shown is marked `aria-current` and drawn highlighted.

import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import {
  SITE_FOOTER,
  SITE_FOOTER_INNER,
  SITE_FOOTER_LINK,
  SITE_FOOTER_LINKS,
  SITE_FOOTER_NAME,
  type DictionaryColumn,
} from "@/components/shared/styles.ts";

/** The Licence page's path, which every result's Source link leans on (ADR 0009). */
export const LICENCE_PATH = "/licence";
/** The Privacy notice's path. */
export const PRIVACY_PATH = "/privacy";

/** The column the page at `path` is laid out in: the legal pages have their own (#588). */
export const columnOf = (path: string): DictionaryColumn =>
  path === LICENCE_PATH || path === PRIVACY_PATH ? "legal" : "page";

const linksOf = (origins: SiteOrigins) =>
  [
    { label: "Licence", href: LICENCE_PATH },
    { label: "Privacy", href: PRIVACY_PATH },
    { label: "Developers", href: origins.developers },
  ] as const;

/** The footer, with `current`, the path of the page being shown, marking its own link. */
export function SiteFooter({ origins, current }: { origins: SiteOrigins; current: string }) {
  return (
    <footer className={SITE_FOOTER}>
      <div className={SITE_FOOTER_INNER[columnOf(current)]}>
        <a className={SITE_FOOTER_NAME} href="/">
          Lexema
        </a>
        <nav aria-label="Site">
          <ul className={SITE_FOOTER_LINKS}>
            {linksOf(origins).map((link) => (
              <li key={link.label}>
                <a className={SITE_FOOTER_LINK} href={link.href} aria-current={link.href === current ? "page" : undefined}>
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
