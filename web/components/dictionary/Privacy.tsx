// The Privacy notice (#139, frames 34 and 34m).
//
// The words are Huey's, approved on 2026-10-04
// (https://github.com/povlabs/lexema/issues/139#issuecomment-5978972736), and
// are kept exactly. What section 4 says about retention is what the code does
// since #570: a report's visitor code is erased an hour after it is sent
// (worker/dictionary/reportSweep.ts), and its note when it is answered
// (`pnpm run report answer`).

import { LEGAL_ADDRESS, LEGAL_ITEMS, LEGAL_PARAGRAPH, LEGAL_UNBROKEN, LINK } from "@/components/shared/styles.ts";
import { LegalItem } from "@/components/shared/LegalPage";
import { DictionaryLegalPage } from "./DictionaryLegalPage";

/** The mailbox a reader writes to about this notice. */
export const PRIVACY_ADDRESS = "privacy@lexema.fyi";

export function Privacy() {
  return (
    <DictionaryLegalPage
      kicker="LEXEMA · LEGAL"
      title="Privacy"
      effective="2026-10-04"
      lede="This notice explains what information Lexema processes when you use lexema.fyi, why, and for how long."
      sections={[
        {
          id: "information",
          title: "Information we process",
          body: (
            <>
              <p className={LEGAL_PARAGRAPH}>
                Lexema has no user accounts and does not use advertising, analytics or tracking cookies. We process
                only:
              </p>
              <ul className={LEGAL_ITEMS}>
                <LegalItem mark="a">
                  your IP address, transiently, to limit the number of requests a single visitor can make. It is
                  not stored;
                </LegalItem>
                <LegalItem mark="b">
                  when you report a mistake or suggest a correction: the entry, the option you selected, any note
                  you write, and, for one hour, a <span className={LEGAL_UNBROKEN}>one-way</span> code derived from your IP address, used only to limit the
                  number of reports per hour.
                </LegalItem>
              </ul>
            </>
          ),
        },
        {
          id: "purpose",
          title: "Purpose and legal basis",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              We process this information to operate the service, protect it from abuse and review reported errors.
              The legal basis is our legitimate interest in providing a reliable dictionary (Article 6(1)(f) GDPR).
            </p>
          ),
        },
        {
          id: "providers",
          title: "Service providers",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Lexema is hosted by Cloudflare, Inc., which processes requests on our behalf and may keep short-lived
              security logs. Report forms are protected by Cloudflare Turnstile. We do not sell or share information
              with anyone else.
            </p>
          ),
        },
        {
          id: "retention",
          title: "Retention",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Request counts expire within minutes. The code derived from your IP address is erased one hour after a
              report is sent. Reports themselves are kept as a record of corrections to the dictionary; any note you
              wrote is erased as soon as the report is resolved.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Because Lexema does not store your IP address or any account, we generally cannot link stored
              information to you. Until a report is resolved, you may ask us to remove a note you wrote, using the
              address below. You also have the right to lodge a complaint with your data protection authority.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              We may update this notice. The effective date above shows when it last changed.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: (
            <>
              <p className={LEGAL_PARAGRAPH}>For any question about this notice, write to:</p>
              <p className={LEGAL_ADDRESS}>
                <a className={LINK} href={`mailto:${PRIVACY_ADDRESS}`}>
                  {PRIVACY_ADDRESS}
                </a>
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
