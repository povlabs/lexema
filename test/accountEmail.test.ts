// Account emails (#215): which plan changes owe which email, what each email
// says in text and HTML (board M1, #367), that a plan change is claimed once over the real
// schema, and that deleting an account emails the person once. Every email
// goes to a stub binding; the webhook and dashboard round trips are
// web/test/stripeWebhook.test.ts and web/test/dashboard.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import { deleteAccount, signInAccount, verifiedIdentity } from "../src/accounts/accounts.js";
import { notePlanChange, noticeOf, planEmails, type WrittenSubscription } from "../src/billing/planNotice.js";
import type { PlanState, StripeStatus } from "../src/billing/plans.js";
import { composeEmail, type AccountEmail } from "../src/email/accountEmail.js";
import { TEST_DEVELOPER_PROFILE } from "../src/accounts/testDeveloper.js";
import { accountMailOf, emailAccount, SENDER, workerEmailOf } from "../src/email/send.js";
import { freshAppDatabase } from "./databases.js";
import { StubEmail } from "./stubEmail.js";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const PERIOD = { start: Date.parse("2026-09-30T00:00:00Z"), end: Date.parse("2026-10-30T00:00:00Z") };
const SETTINGS = "https://developers.lexema.fyi/dashboard/settings";
/** The one address a Preview's email binding may send to (web/wrangler.jsonc). */
const HUEY = "itshuseyingulec@gmail.com";

const active = (plan: "starter" | "pro"): PlanState => ({ kind: "active", plan: { id: plan }, period: PERIOD });
const pastDue = (plan: "starter" | "pro"): PlanState => ({ kind: "past-due", plan: { id: plan }, period: PERIOD });
const cancelling = (plan: "starter" | "pro"): PlanState => ({ kind: "cancelling", plan: { id: plan }, period: PERIOD, endsAt: PERIOD.end });
const ended = (plan: "starter" | "pro"): PlanState => ({ kind: "ended", plan: { id: plan } });
const NONE: PlanState = { kind: "none" };

test("each plan change owes the emails it names, dated when it is noted, and a move back or no move owes none", () => {
  const on = NOW;
  const renewsOn = PERIOD.end;
  const cases: [string, PlanState, PlanState, AccountEmail[]][] = [
    ["a first plan", NONE, active("pro"), [{ kind: "plan-started", plan: "pro", on, renewsOn }]],
    ["a plan after one ended", ended("starter"), active("pro"), [{ kind: "plan-started", plan: "pro", on, renewsOn }]],
    [
      "a plan that starts past due",
      NONE,
      pastDue("pro"),
      [
        { kind: "plan-started", plan: "pro", on, renewsOn: null },
        { kind: "payment-failed", plan: "pro", on },
      ],
    ],
    ["Starter to Pro", active("starter"), active("pro"), [{ kind: "plan-changed", from: "starter", to: "pro", on, renewsOn }]],
    ["Pro to Starter", active("pro"), active("starter"), [{ kind: "plan-changed", from: "pro", to: "starter", on, renewsOn }]],
    ["a failed renewal", active("pro"), pastDue("pro"), [{ kind: "payment-failed", plan: "pro", on }]],
    ["a cancellation", active("pro"), cancelling("pro"), [{ kind: "cancellation-confirmed", plan: "pro", on, endsAt: PERIOD.end }]],
    [
      "a change and a cancellation at once",
      active("pro"),
      cancelling("starter"),
      [
        { kind: "plan-changed", from: "pro", to: "starter", on, renewsOn: null },
        { kind: "cancellation-confirmed", plan: "starter", on, endsAt: PERIOD.end },
      ],
    ],
    ["a cancelled plan ending", cancelling("pro"), ended("pro"), [{ kind: "plan-ended", plan: "pro", on }]],
    ["an unpaid plan ending", pastDue("starter"), ended("starter"), [{ kind: "plan-ended", plan: "starter", on }]],
    ["a failed payment paid", pastDue("pro"), active("pro"), []],
    ["a cancellation withdrawn", cancelling("pro"), active("pro"), []],
    ["a renewal", active("pro"), { kind: "active", plan: { id: "pro" }, period: { start: PERIOD.end, end: PERIOD.end + 1 } }, []],
    ["a plan that never served ending", NONE, ended("pro"), []],
    ["a Checkout not yet paid", NONE, NONE, []],
  ];
  for (const [label, before, after, emails] of cases) assert.deepEqual(planEmails(noticeOf(before), after, on), emails, label);
});

const ON = Date.parse("2026-10-01T09:30:00Z");

/** Every email, and what its subject, lead, facts, button and note must be (#367). */
const EVERY_EMAIL: { email: AccountEmail; subject: string; lead: string; facts: string[]; button: boolean; note: RegExp }[] = [
  {
    email: { kind: "plan-started", plan: "pro", on: ON, renewsOn: Date.parse("2026-11-01T00:00:00Z") },
    subject: "Your Pro plan is active",
    lead: "Thanks for subscribing. Your Pro plan started on 1 October 2026.",
    facts: ["5,000,000 calls per month", "300 calls per minute", "Renews on 1 November 2026 for $49"],
    button: true,
    note: /change or cancel your plan/,
  },
  {
    email: { kind: "plan-changed", from: "pro", to: "starter", on: ON, renewsOn: Date.parse("2026-10-30T00:00:00Z") },
    subject: "Your plan is now Starter",
    lead: "Your plan changed from Pro to Starter on 1 October 2026.",
    facts: ["1,000,000 calls per month", "60 calls per minute", "$15 a month", "Renews on 30 October 2026"],
    button: true,
    note: /receipts and invoices/,
  },
  {
    email: { kind: "payment-failed", plan: "starter", on: ON },
    subject: "Your Starter payment failed",
    lead: "Stripe could not take the payment for your Starter plan on 1 October 2026.",
    facts: ["Your API keys keep working for now.", "Stripe will try the payment again.", "Starter is $15 a month."],
    button: true,
    note: /Manage billing/,
  },
  {
    email: { kind: "cancellation-confirmed", plan: "pro", on: ON, endsAt: PERIOD.end },
    subject: "Your Pro plan is cancelled",
    lead: "Your Pro plan was cancelled on 1 October 2026.",
    facts: ["Your API keys keep working until 30 October 2026.", "Then the plan ends.", "You won't be charged again."],
    button: true,
    note: /choose a plan again/,
  },
  {
    email: { kind: "plan-ended", plan: "pro", on: ON },
    subject: "Your Pro plan has ended",
    lead: "Your Pro plan ended on 1 October 2026.",
    facts: ["Your API keys no longer answer calls.", "Choosing a plan makes them work again."],
    button: true,
    note: /choose Starter or Pro/,
  },
  {
    email: { kind: "account-deleted", on: ON },
    subject: "Your Lexema account has been deleted",
    lead: "We deleted your Lexema developer account on 1 October 2026, as requested.",
    facts: [
      "All API keys are revoked.",
      "You are signed out on every device.",
      "Any Starter or Pro plan is cancelled. You won't be charged again.",
      "Signing in again with this email makes a new account.",
    ],
    button: false,
    note: /^If you didn't ask for this, contact us through lexema\.fyi\.$/,
  },
];

const FOOTER = ["Lexema · a simple dictionary · lexema.fyi", "You're receiving this because of your Lexema developer account."];

/** Words as the HTML carries them: escaped. */
const inHtml = (words: string): string => words.replace(/'/g, "&#39;");

test("each email says its subject, lead, facts and note in text and HTML alike, with the settings button only when there is something to do", () => {
  for (const { email, subject, lead, facts, button, note } of EVERY_EMAIL) {
    const composed = composeEmail(email, SETTINGS);
    assert.equal(composed.subject, subject, email.kind);
    const [headline = "", textLead, textFacts, ...rest] = composed.text.trimEnd().split("\n\n");
    assert.equal(textLead, lead, email.kind);
    assert.deepEqual(
      textFacts?.split("\n"),
      facts.map((fact) => `- ${fact}`),
      email.kind,
    );
    const textNote = rest.at(-2) ?? "";
    assert.match(textNote, note, email.kind);
    assert.equal(rest.at(-1), `--\n${FOOTER.join("\n")}`, email.kind);
    assert.deepEqual(rest.slice(0, -2), button ? [`Open Settings: ${SETTINGS}`] : [], email.kind);

    // The HTML says each of those, one list item per fact, and links only to settings.
    const { html } = composed;
    for (const words of [headline, lead, ...facts, textNote, ...FOOTER]) assert.ok(html.includes(inHtml(words)), `${email.kind}: ${words}`);
    assert.equal(html.split("<li ").length - 1, facts.length, `${email.kind}: one item per fact`);
    assert.equal(html.split(`href="${SETTINGS}"`).length - 1, button ? 1 : 0, `${email.kind}: the settings button`);
    assert.equal(html.split("href=").length - 1, button ? 1 : 0, `${email.kind}: no other link`);
  }
});

test("no email asks for a reply, since it comes from noreply, and the deleted email links nowhere", () => {
  for (const { email } of EVERY_EMAIL) {
    const { text, html } = composeEmail(email, SETTINGS);
    assert.doesNotMatch(text + html, /reply/i, email.kind);
  }
  const deleted = composeEmail({ kind: "account-deleted", on: ON }, SETTINGS);
  assert.ok(!deleted.text.includes(SETTINGS));
  assert.ok(!deleted.html.includes("<a "));
});

test("a plan that is not set to renew names no renewal day", () => {
  const started = composeEmail({ kind: "plan-started", plan: "starter", on: ON, renewsOn: null }, SETTINGS).text;
  assert.doesNotMatch(started, /Renews/);
  assert.match(started, /\n- 1,000,000 calls per month\n- 60 calls per minute\n\n/);
  assert.doesNotMatch(composeEmail({ kind: "plan-changed", from: "pro", to: "starter", on: ON, renewsOn: null }, SETTINGS).text, /Renews/);
});

test("the HTML is board M1 and email-safe: tables and inline styles, at most 600px wide, no image, and it escapes what it is given", () => {
  for (const { email } of EVERY_EMAIL) {
    const { html } = composeEmail(email, SETTINGS);
    for (const colour of ["#ECEAE6", "#FFFFFF", "#F6F4F0"]) assert.ok(html.includes(colour), `${email.kind}: ${colour}`);
    assert.match(html, /max-width:600px/, email.kind);
    assert.match(html, /border-radius:8px/, email.kind);
    assert.match(html, /<h1 style="[^"]*font-size:22px;font-weight:600;/, email.kind);
    assert.match(html, /<p style="[^"]*font-family:Spectral[^"]*">Lexema<\/p>/, email.kind);
    assert.match(html, /<html lang="en">/, email.kind);
    assert.doesNotMatch(html, /<img|<style|<link|class=|<div/i, email.kind);
  }
  const { html } = composeEmail({ kind: "plan-ended", plan: "starter", on: ON }, "https://developers.lexema.fyi/dashboard/settings?a=1&b=<2>");
  assert.ok(html.includes('href="https://developers.lexema.fyi/dashboard/settings?a=1&amp;b=&lt;2&gt;"'));
});

/** Ada's account, as her first sign-in makes it. */
async function ada() {
  const { appDb } = freshAppDatabase();
  const identity = verifiedIdentity("google", { subject: "g-ada", verifiedEmail: "ada@example.com", name: "Ada" });
  assert.ok(identity !== undefined);
  const { accountId } = await signInAccount(appDb, identity, NOW);
  return { appDb, accountId };
}

const written = (accountId: number, status: StripeStatus, plan: "starter" | "pro" = "pro", cancelAt: Date | null = null): WrittenSubscription => ({
  accountId,
  snapshot: { stripeSubscriptionId: "sub_ada", plan, status, periodStart: new Date(PERIOD.start), periodEnd: new Date(PERIOD.end), cancelAt },
});

test("a plan change is owed once: noting the same state again, or twice at once, owes nothing more", async () => {
  const { appDb, accountId } = await ada();
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "incomplete"), NOW), []);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "active"), NOW), [{ kind: "plan-started", plan: "pro", on: NOW, renewsOn: PERIOD.end }]);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "active"), NOW), []);

  const both = await Promise.all([notePlanChange(appDb.app, written(accountId, "past_due"), NOW), notePlanChange(appDb.app, written(accountId, "past_due"), NOW)]);
  assert.deepEqual(both.flat(), [{ kind: "payment-failed", plan: "pro", on: NOW }]);

  const cancelAt = new Date(PERIOD.end);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "active", "starter", cancelAt), NOW), [
    { kind: "plan-changed", from: "pro", to: "starter", on: NOW, renewsOn: null },
    { kind: "cancellation-confirmed", plan: "starter", on: NOW, endsAt: PERIOD.end },
  ]);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "canceled", "starter"), NOW), [{ kind: "plan-ended", plan: "starter", on: NOW }]);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "canceled", "starter"), NOW), []);
});

test("emails go to the account's own address from noreply@lexema.fyi; a deleted account, a failed send and no binding send nothing and throw nothing", async () => {
  const { appDb, accountId } = await ada();
  const email = new StubEmail();
  const mail = accountMailOf(email, "https://developers.lexema.fyi");
  assert.deepEqual(await emailAccount(appDb.app, mail, accountId, [{ kind: "plan-started", plan: "pro", on: NOW, renewsOn: PERIOD.end }]), ["sent"]);
  const [message] = email.sent;
  assert.equal(message?.to, "ada@example.com");
  assert.deepEqual(message?.from, SENDER);
  assert.equal(SENDER.email, "noreply@lexema.fyi");
  assert.ok(message?.text.includes(SETTINGS));

  email.failing = "E_SENDER_DOMAIN_NOT_AVAILABLE";
  assert.deepEqual(await emailAccount(appDb.app, mail, accountId, [{ kind: "plan-ended", plan: "pro", on: NOW }]), ["failed"]);
  assert.deepEqual(await emailAccount(appDb.app, undefined, accountId, [{ kind: "plan-ended", plan: "pro", on: NOW }]), ["mail-off"]);
  assert.equal(email.sent.length, 1);

  email.failing = undefined;
  await deleteAccount(appDb, accountId, NOW, undefined);
  assert.deepEqual(await emailAccount(appDb.app, mail, accountId, [{ kind: "plan-ended", plan: "pro", on: NOW }]), []);
  assert.equal(email.sent.length, 1);
});

test("deleting an account emails the address it had once; deleting it again sends nothing, and a failed email still deletes it", async () => {
  const { appDb, accountId } = await ada();
  const email = new StubEmail();
  const mail = accountMailOf(email, "https://developers.lexema.fyi");
  assert.deepEqual(await deleteAccount(appDb, accountId, NOW, undefined, mail), { outcome: "deleted", revokedKeys: 0 });
  assert.deepEqual(
    email.sent.map(({ to, subject }) => ({ to, subject })),
    [{ to: "ada@example.com", subject: "Your Lexema account has been deleted" }],
  );
  assert.deepEqual(await deleteAccount(appDb, accountId, NOW + 1_000, undefined, mail), { outcome: "deleted", revokedKeys: 0 });
  assert.equal(email.sent.length, 1);

  const other = await ada();
  const failing = new StubEmail();
  failing.failing = "E_DELIVERY_FAILED";
  const deleted = await deleteAccount(other.appDb, other.accountId, NOW, undefined, accountMailOf(failing, "https://developers.lexema.fyi"));
  assert.deepEqual(deleted, { outcome: "deleted", revokedKeys: 0 });
});

test("on a Preview, deleting the test developer emails the binding's one address; each test sign-in after makes a new account to delete again", async () => {
  const { appDb } = freshAppDatabase();
  const email = new StubEmail();
  const binding = workerEmailOf(email, HUEY);
  assert.ok(binding !== undefined);
  const mail = accountMailOf(binding, "https://preview-branch.developers-preview.lexema.fyi");
  for (const [round, at] of [NOW, NOW + 60_000].entries()) {
    const identity = verifiedIdentity("github", TEST_DEVELOPER_PROFILE);
    assert.ok(identity !== undefined);
    const { accountId } = await signInAccount(appDb, identity, at);
    assert.deepEqual(await deleteAccount(appDb, accountId, at, undefined, mail), { outcome: "deleted", revokedKeys: 0 }, `round ${round}`);
  }
  assert.deepEqual(
    email.sent.map(({ to, subject }) => ({ to, subject })),
    Array(2).fill({ to: HUEY, subject: "Your Lexema account has been deleted" }),
  );
  assert.equal(TEST_DEVELOPER_PROFILE.verifiedEmail, "test-developer@example.com");
});

test("with no one address, the Worker's binding is handed on as it is", () => {
  const email = new StubEmail();
  assert.equal(workerEmailOf(email, ""), email);
  assert.equal(workerEmailOf(email, undefined), email);
  assert.equal(workerEmailOf(undefined, HUEY), undefined);
});
