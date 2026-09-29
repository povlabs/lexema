// The docs' pages in their groups (board 31): the sidebar's list on a wide
// screen, and the list the contents bar opens on a phone (board 31m). The
// page being read is marked `aria-current` and drawn active.

import {
  DOCS_NAV_ENDPOINT,
  DOCS_NAV_GROUP,
  DOCS_NAV_LABEL,
  DOCS_NAV_LINK,
  DOCS_NAV_LIST,
  DOCS_NAV_METHOD,
} from "@/components/shared/styles.ts";

export interface DocsLink {
  href: string;
  label: string;
  /** An endpoint's method, drawn before its name. */
  method?: string;
  /** The page being read. */
  current: boolean;
}

export interface DocsGroup {
  label: string;
  links: readonly DocsLink[];
}

export function DocsLinks({ groups }: { groups: readonly DocsGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.label} className={DOCS_NAV_GROUP}>
          <h2 className={DOCS_NAV_LABEL}>{group.label}</h2>
          <ul className={DOCS_NAV_LIST}>
            {group.links.map((link) => (
              <li key={link.href}>
                <a className={DOCS_NAV_LINK} href={link.href} aria-current={link.current ? "page" : undefined}>
                  {link.method === undefined ? (
                    link.label
                  ) : (
                    <>
                      <span className={DOCS_NAV_METHOD}>{link.method}</span>
                      <span className={DOCS_NAV_ENDPOINT}>{link.label}</span>
                    </>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
