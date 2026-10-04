// What a suspended account sees on the dashboard and on its settings page
// (#573): one card saying the account is suspended, with Delete account, and
// nothing else. No board draws it; it is the Plan card's parts (board 28i)
// with board 30's confirmation behind Delete account (DeleteAccountDialog.tsx).
// The header and its account menu stay, so the person can sign out. Every
// other action is refused by the Worker whatever this page shows
// (worker/developers/dashboard.ts, worker/developers/billing.ts).

import type { SuspendedView } from "@/lib/developers/dashboardView.ts";
import { DeveloperPage, type DeveloperSection } from "@/components/developers/DeveloperPage";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { DeleteAccountControl } from "./DeleteAccountDialog";
import { BUTTON_DANGER_OUTLINE, DASH_SHELL, SUSPENDED_CARD, SUSPENDED_LINE, SUSPENDED_TITLE } from "@/components/shared/styles.ts";

/** The card's words: what happened, then what the person can still do. */
export const SUSPENDED_HEADING = "Your account is suspended";
export const SUSPENDED_TEXT = "Your API keys do not answer, and you cannot make keys or choose a plan. You can still delete the account.";

export function SuspendedAccount({ view, csrf, current, origins }: { view: SuspendedView; csrf: string; current: DeveloperSection; origins: SiteOrigins }) {
  return (
    <DeveloperPage current={current} signedIn={view.signedIn} origins={origins}>
      <main className={DASH_SHELL}>
        <div className={SUSPENDED_CARD} data-suspended="">
          <div>
            <h1 className={SUSPENDED_TITLE}>{SUSPENDED_HEADING}</h1>
            <p className={SUSPENDED_LINE}>{SUSPENDED_TEXT}</p>
          </div>
          <DeleteAccountControl className={BUTTON_DANGER_OUTLINE} warning={view.deleteWarning} csrf={csrf} />
        </div>
      </main>
    </DeveloperPage>
  );
}
