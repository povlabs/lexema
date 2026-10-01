// The emails Lexema sends a developer about their account (#215), and what
// each one says. Stripe sends receipts, invoices, card-expiring and
// upcoming-renewal emails itself; these six are Lexema's, sent from
// `noreply@lexema.fyi` through Cloudflare Email Service (./send.ts).
//
// Each email is written once, as a letter: a headline, one lead sentence with
// the day it happened, two to four short facts, a button to the dashboard's
// settings when there is something to do there, and a short note. The plain
// text and the HTML are both made from that letter, so they never say
// different things. The HTML is Pencil board M1 (`QDY3h` in lexema-design.pen,
// #367): a white card on a light grey page, laid out in tables with inline
// styles, since an email client reads no stylesheet. Its one image is the site
// icon left of the "Lexema" wordmark (#383), loaded from the dictionary's site;
// with images off the wordmark still reads, since it is text.

import { PLAN_TERMS, type StripePlanId } from "../billing/plans.js";

/**
 * One email to an account, carrying only what its words need. Every day is in
 * milliseconds since the epoch: `on` is the day the email is about, the day
 * Lexema learnt of the change or deleted the account.
 */
export type AccountEmail =
  /** A Starter or Pro plan started serving. `renewsOn` is the day it renews, or `null` when it is not set to renew. */
  | { readonly kind: "plan-started"; readonly plan: StripePlanId; readonly on: number; readonly renewsOn: number | null }
  /** A serving plan moved between Starter and Pro. `renewsOn` as for a plan started. */
  | { readonly kind: "plan-changed"; readonly from: StripePlanId; readonly to: StripePlanId; readonly on: number; readonly renewsOn: number | null }
  /** A renewal payment failed; the plan still serves while Stripe retries. */
  | { readonly kind: "payment-failed"; readonly plan: StripePlanId; readonly on: number }
  /** The plan was cancelled and serves until `endsAt`. */
  | { readonly kind: "cancellation-confirmed"; readonly plan: StripePlanId; readonly on: number; readonly endsAt: number }
  /** The plan stopped serving. */
  | { readonly kind: "plan-ended"; readonly plan: StripePlanId; readonly on: number }
  /** The account was deleted. */
  | { readonly kind: "account-deleted"; readonly on: number };

export type AccountEmailKind = AccountEmail["kind"];

/** Two to four short facts: the most the fact box holds, and the least worth a box. */
type Facts = readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string];

/** What an email says, before it is laid out as text or HTML. */
interface Letter {
  readonly subject: string;
  readonly headline: string;
  /** One plain sentence saying what happened and on which day. */
  readonly lead: string;
  readonly facts: Facts;
  /** Whether there is something to do in settings, so the email carries the Open Settings button. */
  readonly button: boolean;
  readonly note: string;
}

/** The two absolute URLs an email carries. */
export interface EmailLinks {
  /** The developer site's /dashboard/settings, which the Open Settings button opens. */
  readonly settings: string;
  /** The site icon the card's header shows, an https URL on the dictionary's site. */
  readonly icon: string;
}

/** An email as it is sent: its subject, its plain text and its HTML. */
export interface ComposedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const planName = (plan: StripePlanId): string => PLAN_TERMS[plan].name;

const count = (n: number): string => n.toLocaleString("en-US");

/** A day as the settings page reads one, in UTC: 30 October 2026. */
const dayOf = (at: number): string => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(at);

const price = (plan: StripePlanId): string => `$${PLAN_TERMS[plan].usdPerMonth}`;

const callsPerMonth = (plan: StripePlanId): string => `${count(PLAN_TERMS[plan].callsPerPeriod)} calls per month`;

const callsPerMinute = (plan: StripePlanId): string => `${count(PLAN_TERMS[plan].callsPerMinute)} calls per minute`;

const BUTTON_LABEL = "Open Settings";

const FOOTER = ["Lexema · a simple dictionary · lexema.fyi", "You're receiving this because of your Lexema developer account."] as const;

function letterOf(email: AccountEmail): Letter {
  switch (email.kind) {
    case "plan-started": {
      const name = planName(email.plan);
      const limits = [callsPerMonth(email.plan), callsPerMinute(email.plan)] as const;
      return {
        subject: `Your ${name} plan is active`,
        headline: `Your ${name} plan is active`,
        lead: `Thanks for subscribing. Your ${name} plan started on ${dayOf(email.on)}.`,
        facts: email.renewsOn === null ? limits : [...limits, `Renews on ${dayOf(email.renewsOn)} for ${price(email.plan)}`],
        button: true,
        note: "You can change or cancel your plan at any time in Settings.",
      };
    }
    case "plan-changed": {
      const limits = [callsPerMonth(email.to), callsPerMinute(email.to), `${price(email.to)} a month`] as const;
      return {
        subject: `Your plan is now ${planName(email.to)}`,
        headline: `Your plan is now ${planName(email.to)}`,
        lead: `Your plan changed from ${planName(email.from)} to ${planName(email.to)} on ${dayOf(email.on)}.`,
        facts: email.renewsOn === null ? limits : [...limits, `Renews on ${dayOf(email.renewsOn)}`],
        button: true,
        note: "Stripe emails your receipts and invoices.",
      };
    }
    case "payment-failed":
      return {
        subject: `Your ${planName(email.plan)} payment failed`,
        headline: "Your payment failed",
        lead: `Stripe could not take the payment for your ${planName(email.plan)} plan on ${dayOf(email.on)}.`,
        facts: ["Your API keys keep working for now.", "Stripe will try the payment again.", `${planName(email.plan)} is ${price(email.plan)} a month.`],
        button: true,
        note: "To update your payment method, open Settings and choose Manage billing.",
      };
    case "cancellation-confirmed":
      return {
        subject: `Your ${planName(email.plan)} plan is cancelled`,
        headline: `Your ${planName(email.plan)} plan is cancelled`,
        lead: `Your ${planName(email.plan)} plan was cancelled on ${dayOf(email.on)}.`,
        facts: [`Your API keys keep working until ${dayOf(email.endsAt)}.`, "Then the plan ends.", "You won't be charged again."],
        button: true,
        note: "You can choose a plan again in Settings at any time.",
      };
    case "plan-ended":
      return {
        subject: `Your ${planName(email.plan)} plan has ended`,
        headline: `Your ${planName(email.plan)} plan has ended`,
        lead: `Your ${planName(email.plan)} plan ended on ${dayOf(email.on)}.`,
        facts: ["Your API keys no longer answer calls.", "Choosing a plan makes them work again."],
        button: true,
        note: "You can choose Starter or Pro in Settings at any time.",
      };
    case "account-deleted":
      return {
        subject: "Your Lexema account has been deleted",
        headline: "Your account has been deleted",
        lead: `We deleted your Lexema developer account on ${dayOf(email.on)}, as requested.`,
        facts: [
          "All API keys are revoked.",
          "You are signed out on every device.",
          "Any Starter or Pro plan is cancelled. You won't be charged again.",
          "Signing in again with this email makes a new account.",
        ],
        button: false,
        note: "If you didn't ask for this, contact us through lexema.fyi.",
      };
  }
}

/** Board M1's colours. The page and fact box are #367's; the rest are read off the board. */
const COLOURS = {
  page: "#ECEAE6",
  card: "#FFFFFF",
  factBox: "#F6F4F0",
  rule: "#E4E1DB",
  textStrong: "#141312",
  text: "#2E2C29",
  textMuted: "#6E6A62",
  footer: "#8B8579",
  button: "#141312",
  buttonText: "#FFFFFF",
} as const;

/** The manifest's families, with the fallbacks an email client has when it loads no font. */
const SERIF = "Spectral, Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function buttonHtml(settingsUrl: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
<td style="background:${COLOURS.button};border-radius:6px;"><a href="${escapeHtml(settingsUrl)}" style="display:inline-block;padding:11px 20px;font-family:${SANS};font-size:14px;font-weight:600;line-height:18px;color:${COLOURS.buttonText};text-decoration:none;border-radius:6px;">${BUTTON_LABEL}</a></td>
</tr></table>`;
}

/** The icon's size in the header, in CSS pixels, beside the 22px wordmark. */
const ICON_SIZE = 32;

/** The card's header: the site icon, then the wordmark as text. */
function headerHtml(iconUrl: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
<td style="padding:0 10px 0 0;vertical-align:middle;"><img src="${escapeHtml(iconUrl)}" alt="Lexema" width="${ICON_SIZE}" height="${ICON_SIZE}" style="display:block;width:${ICON_SIZE}px;height:${ICON_SIZE}px;border:0;outline:none;text-decoration:none;"></td>
<td style="vertical-align:middle;"><p style="margin:0;font-family:${SERIF};font-size:22px;font-weight:400;line-height:28px;color:${COLOURS.textStrong};">Lexema</p></td>
</tr></table>`;
}

function htmlOf(letter: Letter, links: EmailLinks): string {
  const facts = letter.facts
    .map((fact) => `<li style="margin:0 0 6px;padding:0;font-family:${SANS};font-size:14px;line-height:20px;color:${COLOURS.text};">${escapeHtml(fact)}</li>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${escapeHtml(letter.subject)}</title></head>
<body style="margin:0;padding:0;background:${COLOURS.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOURS.page};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:${COLOURS.card};border-radius:8px;padding:40px 44px;">
${headerHtml(links.icon)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${COLOURS.rule};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>
<h1 style="margin:24px 0 16px;font-family:${SANS};font-size:22px;font-weight:600;line-height:28px;color:${COLOURS.textStrong};">${escapeHtml(letter.headline)}</h1>
<p style="margin:0 0 20px;font-family:${SANS};font-size:15px;line-height:22px;color:${COLOURS.text};">${escapeHtml(letter.lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:${COLOURS.factBox};border-radius:6px;padding:16px 20px 10px;">
<ul style="margin:0;padding:0 0 0 18px;">
${facts}
</ul>
</td></tr></table>
${letter.button ? buttonHtml(links.settings) : ""}
<p style="margin:0;font-family:${SANS};font-size:14px;line-height:20px;color:${COLOURS.textMuted};">${escapeHtml(letter.note)}</p>
</td></tr>
<tr><td style="padding:20px 44px 0;">
<p style="margin:0 0 4px;font-family:${SANS};font-size:12px;line-height:18px;color:${COLOURS.footer};">${escapeHtml(FOOTER[0])}</p>
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:18px;color:${COLOURS.footer};">${escapeHtml(FOOTER[1])}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

function textOf(letter: Letter, settingsUrl: string): string {
  return (
    [
      letter.headline,
      letter.lead,
      letter.facts.map((fact) => `- ${fact}`).join("\n"),
      ...(letter.button ? [`${BUTTON_LABEL}: ${settingsUrl}`] : []),
      letter.note,
      `--\n${FOOTER.join("\n")}`,
    ].join("\n\n") + "\n"
  );
}

/** An email as it is sent, its button going to `links.settings` and its header showing `links.icon`. */
export function composeEmail(email: AccountEmail, links: EmailLinks): ComposedEmail {
  const letter = letterOf(email);
  return { subject: letter.subject, text: textOf(letter, links.settings), html: htmlOf(letter, links) };
}
