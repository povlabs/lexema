// The dashboard's two pages under one heading (#190, boards 28 and 28g): Keys
// and usage, and Settings. Each tab is a link to its own page, the current one
// marked with `aria-current` and underlined in the accent, so the tabs are
// page navigation and not a widget.

import { DASHBOARD, SETTINGS } from "./dashboardActions.ts";
import { DASH_TAB, DASH_TABS, DASH_TABS_LIST } from "./styles.ts";

/** Which of the dashboard's pages this is. */
export type DashboardTab = "keys" | "settings";

const TABS: readonly { tab: DashboardTab; label: string; href: string }[] = [
  { tab: "keys", label: "Keys and usage", href: DASHBOARD },
  { tab: "settings", label: "Settings", href: SETTINGS },
];

export function DashboardTabs({ current }: { current: DashboardTab }) {
  return (
    <nav className={DASH_TABS} aria-label="Dashboard">
      <ul className={DASH_TABS_LIST}>
        {TABS.map((item) => (
          <li key={item.tab}>
            <a className={DASH_TAB} href={item.href} aria-current={item.tab === current ? "page" : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
