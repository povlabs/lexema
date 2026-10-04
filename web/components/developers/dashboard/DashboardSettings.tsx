// developers.lexema.fyi/dashboard/settings (#190, boards 28g and 28gm): the
// dashboard's second tab, with the plan card and the account section that
// used to close the dashboard. Delete account opens board 30's confirmation
// (DeleteAccountDialog.tsx), which carries the session's CSRF token. What the
// page says is worked out in `dashboardView.ts`; the wiring that reads the
// session and D1 is `(developers)/developer-site/dashboard/settings/`.
//
// The Plan section is board 28i's (#207): No plan yet with Choose Starter and
// Choose Pro, posting to Checkout; a Stripe plan with Manage billing, posting
// to the billing portal, and its renewal, its end, or the payment warning;
// Enterprise with its numbers, the day it ends, and no button. A plan that no
// longer serves, such as a lapsed Enterprise plan, draws as No plan yet
// (#300). What each says is `planSectionOf`.
//
// On a phone (below `sm`, board 28gm) the plan and account cards stack their
// action under the text.

import { DashboardTabs } from "./DashboardTabs";
import type { PlanSection, SettingsView } from "@/lib/developers/dashboardView.ts";
import { ChoosePlanForm, ManageBillingForm } from "@/components/developers/BillingForms";
import { DeleteAccountControl } from "./DeleteAccountDialog";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { DeveloperPage } from "@/components/developers/DeveloperPage";
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
  PLAN_BUTTON_OUTLINE,
  PLAN_BUTTON_PRIMARY,
  PLAN_BUTTONS,
  PLAN_CARD,
  PLAN_LINE,
  PLAN_TITLE,
  PLAN_WARNING,
} from "@/components/shared/styles.ts";

/** The Plan card for its section: the title and line, then what the account can do. */
function PlanCard({ plan, csrf }: { plan: PlanSection; csrf: string }) {
  const warning = plan.kind === "manage" && plan.pastDue;
  return (
    <div className={PLAN_CARD} data-plan-section={plan.kind}>
      <div>
        <p className={PLAN_TITLE}>{plan.title}</p>
        <p className={warning ? PLAN_WARNING : PLAN_LINE}>{plan.line}</p>
      </div>
      {plan.kind === "choose" && (
        <div className={PLAN_BUTTONS}>
          <ChoosePlanForm plan="starter" csrf={csrf} className={PLAN_BUTTON_OUTLINE} />
          <ChoosePlanForm plan="pro" csrf={csrf} className={PLAN_BUTTON_PRIMARY} />
        </div>
      )}
      {plan.kind === "manage" && <ManageBillingForm csrf={csrf} className={warning ? PLAN_BUTTON_PRIMARY : PLAN_BUTTON_OUTLINE} />}
    </div>
  );
}

export function DashboardSettings({ view, csrf, origins }: { view: SettingsView; csrf: string; origins: SiteOrigins }) {
  return (
    <DeveloperPage current="settings" signedIn={view.signedIn} origins={origins}>
      <main className={DASH_SHELL}>
        <h1 className={DASH_HEADING}>Dashboard</h1>
        <DashboardTabs current="settings" />

        <section className={DASH_FIRST_SECTION} aria-labelledby="plan">
          <h2 className={DASH_SECTION_HEADING} id="plan">
            Plan
          </h2>
          <PlanCard plan={view.plan} csrf={csrf} />
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
