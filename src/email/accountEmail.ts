// The emails Lexema sends a developer about their account (#215), and what
// each one says. Stripe sends receipts, invoices, card-expiring and
// upcoming-renewal emails itself; these six are Lexema's, sent from
// `noreply@lexema.fyi` through Cloudflare Email Service (./send.ts).
//
// Each email is written once, as a letter: a subject, a few paragraphs and one
// link to the dashboard's settings. The plain text and the HTML are both made
// from that letter, so they never say different things. The HTML paints with
// the dark scheme's role tokens as design-system-manifest.md gives them in hex,
// since an email client reads no stylesheet and no oklch.

import { PLAN_TERMS, type StripePlanId } from "../billing/plans.js";

/** One email to an account, carrying only what its words need. */
export type AccountEmail =
  /** A Starter or Pro plan started serving: "Welcome to Pro". */
  | { readonly kind: "plan-started"; readonly plan: StripePlanId }
  /** A serving plan moved between Starter and Pro. */
  | { readonly kind: "plan-changed"; readonly from: StripePlanId; readonly to: StripePlanId }
  /** A renewal payment failed; the plan still serves while Stripe retries. */
  | { readonly kind: "payment-failed"; readonly plan: StripePlanId }
  /** The plan was cancelled and serves until `endsAt`, in milliseconds since the epoch. */
  | { readonly kind: "cancellation-confirmed"; readonly plan: StripePlanId; readonly endsAt: number }
  /** The plan stopped serving. */
  | { readonly kind: "plan-ended"; readonly plan: StripePlanId }
  /** The account was deleted. */
  | { readonly kind: "account-deleted" };

export type AccountEmailKind = AccountEmail["kind"];

/** What an email says, before it is laid out as text or HTML. */
interface Letter {
  readonly subject: string;
  readonly paragraphs: readonly string[];
  /** The words of the one link, which goes to the dashboard's settings. */
  readonly linkLabel: string;
}

/** An email as it is sent: its subject, its plain text and its HTML. */
export interface ComposedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const planName = (plan: StripePlanId): string => PLAN_TERMS[plan].name;

const count = (n: number): string => n.toLocaleString("en-US");

/** A date as the settings page reads one, in UTC: 30 October 2026. */
const dayOf = (at: number): string => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(at);

/** What a plan lets an account's keys do, in one sentence. */
const allowance = (plan: StripePlanId): string =>
  `${planName(plan)} gives your keys ${count(PLAN_TERMS[plan].callsPerPeriod)} calls a month, up to ${count(PLAN_TERMS[plan].callsPerMinute)} calls a minute.`;

const SETTINGS_LABEL = "Open your settings";

function letterOf(email: AccountEmail): Letter {
  switch (email.kind) {
    case "plan-started":
      return {
        subject: `Welcome to ${planName(email.plan)}`,
        paragraphs: [`Your ${planName(email.plan)} plan is active.`, allowance(email.plan), "Stripe emails your receipts and invoices."],
        linkLabel: SETTINGS_LABEL,
      };
    case "plan-changed":
      return {
        subject: `Your plan is now ${planName(email.to)}`,
        paragraphs: [`Your plan changed from ${planName(email.from)} to ${planName(email.to)}.`, allowance(email.to)],
        linkLabel: SETTINGS_LABEL,
      };
    case "payment-failed":
      return {
        subject: `Your ${planName(email.plan)} payment failed`,
        paragraphs: [
          `Stripe could not take the payment for your ${planName(email.plan)} plan. Your keys keep working while Stripe tries again.`,
          "Update your payment method from your settings, with Manage billing.",
        ],
        linkLabel: "Update your payment method",
      };
    case "cancellation-confirmed":
      return {
        subject: `Your ${planName(email.plan)} plan is cancelled`,
        paragraphs: [
          `Your ${planName(email.plan)} plan is cancelled. Your keys keep working until ${dayOf(email.endsAt)}, and then the plan ends.`,
          "You will not be charged again. You can choose a plan again from your settings at any time.",
        ],
        linkLabel: SETTINGS_LABEL,
      };
    case "plan-ended":
      return {
        subject: `Your ${planName(email.plan)} plan has ended`,
        paragraphs: [`Your ${planName(email.plan)} plan has ended, so your keys no longer answer.`, "Choose a plan from your settings to use them again."],
        linkLabel: "Choose a plan",
      };
    case "account-deleted":
      return {
        subject: "Your Lexema account is deleted",
        paragraphs: [
          "Your Lexema developer account is deleted. Its keys are revoked, it is signed out everywhere, and any Starter or Pro plan it had is cancelled.",
          "Signing in again with this email makes a new account.",
        ],
        linkLabel: "Sign in again",
      };
  }
}

/** The dark scheme's role tokens, in the hex of design-system-manifest.md. */
const TOKENS = {
  surface: "#121110",
  surfaceRaised: "#1A1917",
  border: "#2C2A26",
  text: "#C4BEB2",
  textStrong: "#F4F0E6",
  accent: "#D2A85C",
} as const;

/** The manifest's families, with the fallbacks an email client has when it loads no font. */
const SERIF = "Spectral, Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function htmlOf(letter: Letter, settingsUrl: string): string {
  const paragraphs = letter.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${TOKENS.text};">${escapeHtml(paragraph)}</p>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>${escapeHtml(letter.subject)}</title></head>
<body style="margin:0;padding:0;background:${TOKENS.surface};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TOKENS.surface};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${TOKENS.surfaceRaised};border:1px solid ${TOKENS.border};">
<tr><td style="padding:32px;">
<p style="margin:0 0 24px;font-family:${SERIF};font-size:20px;font-weight:700;color:${TOKENS.textStrong};">Lexema</p>
<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:24px;font-weight:600;line-height:1.3;color:${TOKENS.textStrong};">${escapeHtml(letter.subject)}</h1>
${paragraphs}
<p style="margin:24px 0 0;font-family:${SANS};font-size:16px;"><a href="${escapeHtml(settingsUrl)}" style="color:${TOKENS.accent};">${escapeHtml(letter.linkLabel)}</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

function textOf(letter: Letter, settingsUrl: string): string {
  return [letter.subject, ...letter.paragraphs, `${letter.linkLabel}: ${settingsUrl}`].join("\n\n") + "\n";
}

/** An email as it is sent, its one link going to `settingsUrl`: the developer site's /dashboard/settings. */
export function composeEmail(email: AccountEmail, settingsUrl: string): ComposedEmail {
  const letter = letterOf(email);
  return { subject: letter.subject, text: textOf(letter, settingsUrl), html: htmlOf(letter, settingsUrl) };
}
