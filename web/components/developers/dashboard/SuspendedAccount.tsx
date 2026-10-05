// What a suspended account sees on the dashboard and on its settings page
// (#573): one card saying the account is suspended, with Delete account, and
// nothing else. No board draws it; it is the Plan card's parts (board 28i)
// with board 30's confirmation behind Delete account (DeleteAccountDialog.tsx).
// The header and its account menu stay, so the person can sign out. Every
// other action is refused by the Worker whatever this page shows
// (worker/developers/dashboard.ts, worker/developers/billing.ts).

import type { SuspendedView } from "@/lib/developers/dashboardView.ts";
import { CONTACT_EMAIL } from "@/components/shared/contact.ts";
import { DeveloperPage, TERMS_PATH, type DeveloperSection } from "@/components/developers/DeveloperPage";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { DeleteAccountControl } from "./DeleteAccountDialog";
import { BUTTON_DANGER_OUTLINE, DASH_SHELL, LINK, SUSPENDED_CARD, SUSPENDED_LINE, SUSPENDED_TITLE } from "@/components/shared/styles.ts";

/**
 * The card's words are Huey's, ruled on PR #577
 * (https://github.com/povlabs/lexema/pull/577#issuecomment-5984751318): why the
 * account is suspended and what that stops, then whom to write to and what is
 * still open. web/test/dashboard.test.ts holds them word for word.
 */
export const SUSPENDED_HEADING = "Your account is suspended";

export function SuspendedAccount({ view, csrf, current, origins }: { view: SuspendedView; csrf: string; current: DeveloperSection; origins: SiteOrigins }) {
  return (
    <DeveloperPage current={current} signedIn={view.signedIn} origins={origins}>
      <main className={DASH_SHELL}>
        <div className={SUSPENDED_CARD} data-suspended="">
          <div>
            <h1 className={SUSPENDED_TITLE}>{SUSPENDED_HEADING}</h1>
            <p className={SUSPENDED_LINE}>
              We have suspended this account because of activity that may breach our{" "}
              <a className={LINK} href={TERMS_PATH}>
                Terms of service
              </a>
              , such as abuse of usage limits, a payment problem or a risk to the service. While it is suspended, your API keys do not answer,
              and you cannot create keys or choose a plan.
            </p>
            <p className={SUSPENDED_LINE}>
              If you believe this is a mistake, write to{" "}
              <a className={LINK} href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{" "}
              and we will review it. You can still delete your account below.
            </p>
          </div>
          <DeleteAccountControl className={BUTTON_DANGER_OUTLINE} warning={view.deleteWarning} csrf={csrf} />
        </div>
      </main>
    </DeveloperPage>
  );
}
