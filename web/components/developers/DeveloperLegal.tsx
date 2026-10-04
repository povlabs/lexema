// The developer site's Terms of service and Privacy policy (#162, frames 35,
// 35m, 36 and 36m), in the developer bar and footer, edge to edge as the
// frames draw them, the footer marking the page being read.
//
// The words are Huey's, approved on 2026-10-04 in #162's amendment
// (https://github.com/povlabs/lexema/issues/162#issuecomment-5979001286), and
// are kept exactly. The Terms' plan prices and limits are read from the one
// table of plan terms, `PLAN_TERMS` in src/billing/plans.ts, so the page
// cannot drift from billing.

import { PLAN_TERMS, type StripePlanId } from "@lexema/billing/plans.ts";
import { LegalItem, LegalPage } from "@/components/shared/LegalPage";
import { LEGAL_ADDRESS, LEGAL_ITEMS, LEGAL_PARAGRAPH, LEGAL_UNBROKEN, LINK } from "@/components/shared/styles.ts";
import type { SignedIn } from "@/lib/developers/signedIn.ts";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { CONTACT_EMAIL, DeveloperPage, PRIVACY_EMAIL } from "./DeveloperPage";

/** The date the Terms of service took effect, `YYYY-MM-DD`; change it when the text changes. */
export const TERMS_EFFECTIVE = "2026-10-04";
/** The date the Privacy policy took effect, `YYYY-MM-DD`; change it when the text changes. */
export const PRIVACY_EFFECTIVE = "2026-10-04";

const KICKER = "LEXEMA DEVELOPERS · LEGAL";

const COUNT = new Intl.NumberFormat("en-US");

/** A Stripe plan's line in Terms section 2: `Starter: US$15 per month, 1,000,000 calls per month and 60 per minute;`. */
export const planTermsLine = (plan: StripePlanId): string => {
  const terms = PLAN_TERMS[plan];
  return `${terms.name}: US$${terms.usdPerMonth} per month, ${COUNT.format(terms.callsPerPeriod)} calls per month and ${COUNT.format(terms.callsPerMinute)} per minute`;
};

/** A mailbox on its own line, as a `mailto:` link. */
function Address({ email }: { email: string }) {
  return (
    <p className={LEGAL_ADDRESS}>
      <a className={LINK} href={`mailto:${email}`}>
        {email}
      </a>
    </p>
  );
}

interface LegalPageProps {
  signedIn?: SignedIn;
  origins: SiteOrigins;
}

export function DeveloperTerms({ signedIn, origins }: LegalPageProps) {
  return (
    <DeveloperPage legal="terms" wide signedIn={signedIn} origins={origins}>
      <LegalPage
        site="developers"
        kicker={KICKER}
        title="Terms of service"
        effective={TERMS_EFFECTIVE}
        lede="These terms govern your use of developers.lexema.fyi and the Lexema API at api.lexema.fyi. By creating an account or calling the API, you agree to them."
        sections={[
          {
            id: "accounts",
            title: "Accounts",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                The service is offered for business and professional use only. By creating an account you confirm that you
                are not acting as a consumer. You sign in with a Google or GitHub account that has a verified email address.
                You are responsible for all activity under your account and for keeping your API keys secret. If a key is
                exposed, revoke it from your dashboard.
              </p>
            ),
          },
          {
            id: "plans",
            title: "Plans and billing",
            body: (
              <>
                <p className={LEGAL_PARAGRAPH}>Access to the API requires a paid plan:</p>
                <ul className={LEGAL_ITEMS}>
                  <LegalItem mark="a">{planTermsLine("starter")};</LegalItem>
                  <LegalItem mark="b">{planTermsLine("pro")};</LegalItem>
                  <LegalItem mark="c">Enterprise: terms agreed in writing.</LegalItem>
                </ul>
                <p className={LEGAL_PARAGRAPH}>
                  Plans are billed monthly in advance through Stripe. Receipts and invoices are issued by Stripe.
                </p>
              </>
            ),
          },
          {
            id: "cancellation",
            title: "Cancellation and refunds",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                You may cancel at any time from the billing portal. Your keys keep working until the end of the paid period
                and you are not charged again. Fees are not refunded; we may refund a charge made in error, such as a
                duplicate payment. If a payment fails, your keys stop answering calls until the payment succeeds or you
                choose a plan again.
              </p>
            ),
          },
          {
            id: "limits",
            title: "Use limits",
            body: (
              <>
                <p className={LEGAL_PARAGRAPH}>
                  Each plan sets a monthly and a per-minute limit on calls, shared by all keys on the account. Calls beyond
                  a limit are answered with status 429. You may not:
                </p>
                <ul className={LEGAL_ITEMS}>
                  <LegalItem mark="a">circumvent the limits, for example by opening several accounts;</LegalItem>
                  <LegalItem mark="b">interfere with or disrupt the service or its infrastructure;</LegalItem>
                  <LegalItem mark="c">use the service in breach of applicable law.</LegalItem>
                </ul>
              </>
            ),
          },
          {
            id: "licence",
            title: "Licence of the content",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                Content returned by the API is licensed under CC BY-SA 4.0. Every result carries an attribution field
                naming the source and the licence. When you reuse the content you must credit the source, link to the
                licence and share adaptations under the same licence. Nothing in these terms restricts the rights that
                licence grants you.
              </p>
            ),
          },
          {
            id: "availability",
            title: "Availability",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                The service is provided “as is” and “as available”. We may change, suspend or discontinue features, and we
                do not guarantee any level of uptime unless agreed in an Enterprise agreement.
              </p>
            ),
          },
          {
            id: "liability",
            title: "Liability",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                To the extent permitted by law, Lexema is not liable for indirect or consequential loss, and its total
                liability is limited to the fees you paid in the three months before the claim.
              </p>
            ),
          },
          {
            id: "suspension",
            title: "Suspension and termination",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                We may suspend or close any account at any time, with or without notice, if we suspect a breach of these
                terms, abuse, fraud or a risk to the service. When an account is suspended, its keys stop answering calls,
                any subscription is cancelled and no new keys can be created. You can still sign in and delete your account
                at any time from the dashboard.
              </p>
            ),
          },
          {
            id: "changes",
            title: "Changes",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                We may update these terms. The effective date at the top shows when they last changed. By continuing to use
                the service after a change, you accept the updated terms.
              </p>
            ),
          },
          {
            id: "law",
            title: "Governing law",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                These terms are governed by the laws of Italy. Any dispute arising from them falls under the exclusive
                jurisdiction of the Italian courts.
              </p>
            ),
          },
          {
            id: "contact",
            title: "Contact",
            body: (
              <>
                <p className={LEGAL_PARAGRAPH}>For any question about these terms, write to:</p>
                <Address email={CONTACT_EMAIL} />
              </>
            ),
          },
        ]}
      />
    </DeveloperPage>
  );
}

export function DeveloperPrivacy({ signedIn, origins }: LegalPageProps) {
  return (
    <DeveloperPage legal="privacy" wide signedIn={signedIn} origins={origins}>
      <LegalPage
        site="developers"
        kicker={KICKER}
        title="Privacy policy"
        effective={PRIVACY_EFFECTIVE}
        lede="This policy explains what information Lexema processes when you use developers.lexema.fyi and the Lexema API, why, and for how long."
        sections={[
          {
            id: "information",
            title: "Information we process",
            body: (
              <ul className={LEGAL_ITEMS}>
                <LegalItem mark="a">
                  Account: your name and email address, and the identifier of the Google or GitHub account you sign in
                  with. We keep no profile picture and no sign-in tokens;
                </LegalItem>
                <LegalItem mark="b">
                  Sessions: a session token and its expiry. We do not record your IP address or browser;
                </LegalItem>
                <LegalItem mark="c">
                  API keys: a <span className={LEGAL_UNBROKEN}>one-way</span> hash of each key, its label, prefix and
                  dates. The full key is shown to you once and never stored;
                </LegalItem>
                <LegalItem mark="d">Usage: the number of calls each key makes per day;</LegalItem>
                <LegalItem mark="e">
                  Billing: your Stripe customer and subscription identifiers, plan and status. Card details are handled
                  by Stripe and never reach us.
                </LegalItem>
              </ul>
            ),
          },
          {
            id: "cookies",
            title: "Cookies",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                We use only the cookies needed to sign you in and keep you signed in, for up to 30 days. We use no
                analytics or advertising cookies.
              </p>
            ),
          },
          {
            id: "purpose",
            title: "Purpose and legal basis",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                We process account, key, usage and billing information to provide the service you signed up for (Article
                6(1)(b) GDPR), keep billing records as tax law requires (Article 6(1)(c)), and limit requests to protect
                the service (Article 6(1)(f)).
              </p>
            ),
          },
          {
            id: "providers",
            title: "Service providers",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                Cloudflare, Inc. hosts the service and delivers our emails. Stripe, Inc. processes payments. Google and
                GitHub authenticate your sign-in. We do not sell or share your information with anyone else.
              </p>
            ),
          },
          {
            id: "retention",
            title: "Retention",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                We keep your account information while your account exists. When you delete your account, your sessions
                and sign-in identities are deleted, your name and email address are erased, and your keys are revoked.
                Anonymous usage counts and billing records are kept, the latter for as long as tax law requires.
              </p>
            ),
          },
          {
            id: "rights",
            title: "Your rights",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                You can delete your account at any time from the dashboard. You may also ask us for a copy of your
                information, or to correct it, by writing to us. You have the right to object to processing and to lodge
                a complaint with your data protection authority.
              </p>
            ),
          },
          {
            id: "changes",
            title: "Changes",
            body: (
              <p className={LEGAL_PARAGRAPH}>
                We may update this policy. The effective date at the top shows when it last changed.
              </p>
            ),
          },
          {
            id: "contact",
            title: "Contact",
            body: (
              <>
                <p className={LEGAL_PARAGRAPH}>For any question about this policy, write to:</p>
                <Address email={PRIVACY_EMAIL} />
              </>
            ),
          },
        ]}
      />
    </DeveloperPage>
  );
}
