// developers.lexema.fyi/dashboard/settings (#190, boards 28g and 28gm): the
// dashboard's second tab, with the plan card and the account section that
// used to close the dashboard. Delete account opens board 30's confirmation
// (DeleteAccountDialog.tsx), which carries the session's CSRF token. What the
// page says is worked out in `dashboardView.ts`; the wiring that reads the
// session and D1 is `(developers)/developer-site/dashboard/settings/`.
//
// On a phone (below `sm`, board 28gm) the plan and account cards stack their
// action under the text.

import { DashboardTabs } from "./DashboardTabs";
import type { SettingsView } from "./dashboardView.ts";
import { DeleteAccountControl } from "./DeleteAccountDialog";
import { DeveloperPage } from "./DeveloperPage";
import {
  ACCOUNT_DETAIL,
  ACCOUNT_TEXT,
  ACCOUNT_TITLE,
  BUTTON_DANGER_OUTLINE,
  DASH_FIRST_SECTION,
  DASH_HEADING,
  DASH_ROW_CARD,
  DASH_SECTION,
  DASH_SECTION_HEADING,
  DASH_SHELL,
  PLAN_CARD,
  PLAN_NONE,
  PLAN_SOON,
} from "./styles.ts";

export function DashboardSettings({ view, csrf }: { view: SettingsView; csrf: string }) {
  return (
    <DeveloperPage current="settings" signedIn={view.signedIn}>
      <main className={DASH_SHELL}>
        <h1 className={DASH_HEADING}>Dashboard</h1>
        <DashboardTabs current="settings" />

        <section className={DASH_FIRST_SECTION} aria-labelledby="plan">
          <h2 className={DASH_SECTION_HEADING} id="plan">
            Plan
          </h2>
          <div className={PLAN_CARD}>
            <p className={PLAN_NONE}>No plan yet</p>
            <button className={PLAN_SOON} type="button" disabled>
              Choose a plan — coming soon
            </button>
          </div>
        </section>

        <section className={DASH_SECTION} aria-labelledby="account">
          <h2 className={DASH_SECTION_HEADING} id="account">
            Account
          </h2>
          <div className={DASH_ROW_CARD}>
            <div className={ACCOUNT_TEXT}>
              <p className={ACCOUNT_TITLE}>Delete account</p>
              <p className={ACCOUNT_DETAIL}>{view.signedInWith}</p>
            </div>
            <DeleteAccountControl className={BUTTON_DANGER_OUTLINE} warning={view.deleteWarning} csrf={csrf} />
          </div>
        </section>
      </main>
    </DeveloperPage>
  );
}
