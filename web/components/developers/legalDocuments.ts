// The developer site's Terms of service and Privacy policy (#162): the text
// Huey approved on 2026-10-04, word for word, as data `LegalPage.tsx` lays out
// (boards 35 and 36).
//
// The plans in the terms' section 2 are written from the plan table
// (src/billing/plans.ts), so the terms cannot state a price or a limit billing
// does not charge. The mailboxes are the developer site's own constants.

import { PLAN_TERMS, type StripePlanId } from "@lexema/billing/plans.ts";
import { CONTACT_EMAIL, PRIVACY_EMAIL, type LegalSection } from "./DeveloperPage";

/** A run of text: words, or a mailbox shown as a `mailto:` link. */
export type Inline = string | { readonly mailto: string };

/** What a section holds, in order: paragraphs, and lists lettered (a), (b), (c). */
export type LegalBlock =
  | { readonly kind: "paragraph"; readonly text: readonly Inline[] }
  | { readonly kind: "list"; readonly items: readonly string[] };

export interface LegalPart {
  /** The fragment the Contents links to. */
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  readonly section: LegalSection;
  readonly title: string;
  /** When the text last changed, as the page writes it. */
  readonly effective: string;
  readonly lede: string;
  /** Numbered 1, 2, 3 in this order. */
  readonly parts: readonly LegalPart[];
}

/** When the terms last changed. Huey may move it before they go live. */
export const TERMS_EFFECTIVE = "4 October 2026";

/** When the privacy policy last changed. Huey may move it before it goes live. */
export const PRIVACY_EFFECTIVE = "4 October 2026";

const paragraph = (...text: Inline[]): LegalBlock => ({ kind: "paragraph", text });
const list = (...items: string[]): LegalBlock => ({ kind: "list", items });

const count = (n: number): string => n.toLocaleString("en-US");

/** A Stripe plan as the terms state it: `Starter: US$15 per month, 1,000,000 calls per month and 60 per minute`. */
export const planTermsLine = (plan: StripePlanId): string => {
  const { name, usdPerMonth, callsPerPeriod, callsPerMinute } = PLAN_TERMS[plan];
  return `${name}: US$${usdPerMonth} per month, ${count(callsPerPeriod)} calls per month and ${count(callsPerMinute)} per minute`;
};

export const TERMS: LegalDocument = {
  section: "terms",
  title: "Terms of service",
  effective: TERMS_EFFECTIVE,
  lede: "These terms govern your use of developers.lexema.fyi and the Lexema API at api.lexema.fyi. By creating an account or calling the API, you agree to them.",
  parts: [
    {
      id: "accounts",
      heading: "Accounts",
      blocks: [
        paragraph(
          "The service is offered for business and professional use only. By creating an account you confirm that you are not acting as a consumer. You sign in with a Google or GitHub account that has a verified email address. You are responsible for all activity under your account and for keeping your API keys secret. If a key is exposed, revoke it from your dashboard.",
        ),
      ],
    },
    {
      id: "plans-and-billing",
      heading: "Plans and billing",
      blocks: [
        paragraph("Access to the API requires a paid plan:"),
        list(`${planTermsLine("starter")};`, `${planTermsLine("pro")};`, `${PLAN_TERMS.enterprise.name}: terms agreed in writing.`),
        paragraph("Plans are billed monthly in advance through Stripe. Receipts and invoices are issued by Stripe."),
      ],
    },
    {
      id: "cancellation-and-refunds",
      heading: "Cancellation and refunds",
      blocks: [
        paragraph(
          "You may cancel at any time from the billing portal. Your keys keep working until the end of the paid period and you are not charged again. Fees are not refunded; we may refund a charge made in error, such as a duplicate payment. If a payment fails, your keys stop answering calls until the payment succeeds or you choose a plan again.",
        ),
      ],
    },
    {
      id: "use-limits",
      heading: "Use limits",
      blocks: [
        paragraph(
          "Each plan sets a monthly and a per-minute limit on calls, shared by all keys on the account. Calls beyond a limit are answered with status 429. You may not:",
        ),
        list(
          "circumvent the limits, for example by opening several accounts;",
          "interfere with or disrupt the service or its infrastructure;",
          "use the service in breach of applicable law.",
        ),
      ],
    },
    {
      id: "licence-of-the-content",
      heading: "Licence of the content",
      blocks: [
        paragraph(
          "Content returned by the API is licensed under CC BY-SA 4.0. Every result carries an attribution field naming the source and the licence. When you reuse the content you must credit the source, link to the licence and share adaptations under the same licence. Nothing in these terms restricts the rights that licence grants you.",
        ),
      ],
    },
    {
      id: "availability",
      heading: "Availability",
      blocks: [
        paragraph(
          "The service is provided “as is” and “as available”. We may change, suspend or discontinue features, and we do not guarantee any level of uptime unless agreed in an Enterprise agreement.",
        ),
      ],
    },
    {
      id: "liability",
      heading: "Liability",
      blocks: [
        paragraph(
          "To the extent permitted by law, Lexema is not liable for indirect or consequential loss, and its total liability is limited to the fees you paid in the three months before the claim.",
        ),
      ],
    },
    {
      id: "suspension-and-termination",
      heading: "Suspension and termination",
      blocks: [
        paragraph(
          "We may suspend or close any account at any time, with or without notice, if we suspect a breach of these terms, abuse, fraud or a risk to the service. When an account is suspended, its keys stop answering calls, any subscription is cancelled and no new keys can be created. You can still sign in and delete your account at any time from the dashboard.",
        ),
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        paragraph(
          "We may update these terms. The effective date at the top shows when they last changed. By continuing to use the service after a change, you accept the updated terms.",
        ),
      ],
    },
    {
      id: "governing-law",
      heading: "Governing law",
      blocks: [
        paragraph(
          "These terms are governed by the laws of Italy. Any dispute arising from them falls under the exclusive jurisdiction of the Italian courts.",
        ),
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [paragraph("For any question about these terms, write to:"), paragraph({ mailto: CONTACT_EMAIL })],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  section: "privacy",
  title: "Privacy policy",
  effective: PRIVACY_EFFECTIVE,
  lede: "This policy explains what information Lexema processes when you use developers.lexema.fyi and the Lexema API, why, and for how long.",
  parts: [
    {
      id: "information-we-process",
      heading: "Information we process",
      blocks: [
        list(
          "Account: your name and email address, and the identifier of the Google or GitHub account you sign in with. We keep no profile picture and no sign-in tokens;",
          "Sessions: a session token and its expiry. We do not record your IP address or browser;",
          "API keys: a one-way hash of each key, its label, prefix and dates. The full key is shown to you once and never stored;",
          "Usage: the number of calls each key makes per day;",
          "Billing: your Stripe customer and subscription identifiers, plan and status. Card details are handled by Stripe and never reach us.",
        ),
      ],
    },
    {
      id: "cookies",
      heading: "Cookies",
      blocks: [
        paragraph(
          "We use only the cookies needed to sign you in and keep you signed in, for up to 30 days. We use no analytics or advertising cookies.",
        ),
      ],
    },
    {
      id: "purpose-and-legal-basis",
      heading: "Purpose and legal basis",
      blocks: [
        paragraph(
          "We process account, key, usage and billing information to provide the service you signed up for (Article 6(1)(b) GDPR), keep billing records as tax law requires (Article 6(1)(c)), and limit requests to protect the service (Article 6(1)(f)).",
        ),
      ],
    },
    {
      id: "service-providers",
      heading: "Service providers",
      blocks: [
        paragraph(
          "Cloudflare, Inc. hosts the service and delivers our emails. Stripe, Inc. processes payments. Google and GitHub authenticate your sign-in. We do not sell or share your information with anyone else.",
        ),
      ],
    },
    {
      id: "retention",
      heading: "Retention",
      blocks: [
        paragraph(
          "We keep your account information while your account exists. When you delete your account, your sessions and sign-in identities are deleted, your name and email address are erased, and your keys are revoked. Anonymous usage counts and billing records are kept, the latter for as long as tax law requires.",
        ),
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights",
      blocks: [
        paragraph(
          "You can delete your account at any time from the dashboard. You may also ask us for a copy of your information, or to correct it, by writing to us. You have the right to object to processing and to lodge a complaint with your data protection authority.",
        ),
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [paragraph("We may update this policy. The effective date at the top shows when it last changed.")],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [paragraph("For any question about this policy, write to:"), paragraph({ mailto: PRIVACY_EMAIL })],
    },
  ],
};
