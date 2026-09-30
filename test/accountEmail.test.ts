// Account emails (#215): which plan changes owe which email, what each email
// says in text and HTML, that a plan change is claimed once over the real
// schema, and that deleting an account emails the person once. Every email
// goes to a stub binding; the webhook and dashboard round trips are
// web/test/stripeWebhook.test.ts and web/test/dashboard.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import { deleteAccount, signInAccount, verifiedIdentity } from "../src/accounts/accounts.js";
import { notePlanChange, noticeOf, planEmails, type WrittenSubscription } from "../src/billing/planNotice.js";
import type { PlanState, StripeStatus } from "../src/billing/plans.js";
import { composeEmail, type AccountEmail } from "../src/email/accountEmail.js";
import { accountMailOf, emailAccount, SENDER } from "../src/email/send.js";
import { freshAppDatabase } from "./databases.js";
import { StubEmail } from "./stubEmail.js";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const PERIOD = { start: Date.parse("2026-09-30T00:00:00Z"), end: Date.parse("2026-10-30T00:00:00Z") };
const SETTINGS = "https://developers.lexema.fyi/dashboard/settings";

const active = (plan: "starter" | "pro"): PlanState => ({ kind: "active", plan: { id: plan }, period: PERIOD });
const pastDue = (plan: "starter" | "pro"): PlanState => ({ kind: "past-due", plan: { id: plan }, period: PERIOD });
const cancelling = (plan: "starter" | "pro"): PlanState => ({ kind: "cancelling", plan: { id: plan }, period: PERIOD, endsAt: PERIOD.end });
const ended = (plan: "starter" | "pro"): PlanState => ({ kind: "ended", plan: { id: plan } });
const NONE: PlanState = { kind: "none" };

test("each plan change owes the emails it names, and a move back or no move owes none", () => {
  const cases: [string, PlanState, PlanState, AccountEmail[]][] = [
    ["a first plan", NONE, active("pro"), [{ kind: "plan-started", plan: "pro" }]],
    ["a plan after one ended", ended("starter"), active("pro"), [{ kind: "plan-started", plan: "pro" }]],
    ["Starter to Pro", active("starter"), active("pro"), [{ kind: "plan-changed", from: "starter", to: "pro" }]],
    ["Pro to Starter", active("pro"), active("starter"), [{ kind: "plan-changed", from: "pro", to: "starter" }]],
    ["a failed renewal", active("pro"), pastDue("pro"), [{ kind: "payment-failed", plan: "pro" }]],
    ["a cancellation", active("pro"), cancelling("pro"), [{ kind: "cancellation-confirmed", plan: "pro", endsAt: PERIOD.end }]],
    [
      "a change and a cancellation at once",
      active("pro"),
      cancelling("starter"),
      [
        { kind: "plan-changed", from: "pro", to: "starter" },
        { kind: "cancellation-confirmed", plan: "starter", endsAt: PERIOD.end },
      ],
    ],
    ["a cancelled plan ending", cancelling("pro"), ended("pro"), [{ kind: "plan-ended", plan: "pro" }]],
    ["an unpaid plan ending", pastDue("starter"), ended("starter"), [{ kind: "plan-ended", plan: "starter" }]],
    ["a failed payment paid", pastDue("pro"), active("pro"), []],
    ["a cancellation withdrawn", cancelling("pro"), active("pro"), []],
    ["a renewal", active("pro"), { kind: "active", plan: { id: "pro" }, period: { start: PERIOD.end, end: PERIOD.end + 1 } }, []],
    ["a plan that never served ending", NONE, ended("pro"), []],
    ["a Checkout not yet paid", NONE, NONE, []],
  ];
  for (const [label, before, after, emails] of cases) assert.deepEqual(planEmails(noticeOf(before), after), emails, label);
});

const EVERY_EMAIL: AccountEmail[] = [
  { kind: "plan-started", plan: "pro" },
  { kind: "plan-changed", from: "pro", to: "starter" },
  { kind: "payment-failed", plan: "starter" },
  { kind: "cancellation-confirmed", plan: "pro", endsAt: PERIOD.end },
  { kind: "plan-ended", plan: "pro" },
  { kind: "account-deleted" },
];

test("each email is English plain text and HTML that say the same, with one link to settings", () => {
  const subjects = EVERY_EMAIL.map((email) => composeEmail(email, SETTINGS).subject);
  assert.deepEqual(subjects, [
    "Welcome to Pro",
    "Your plan is now Starter",
    "Your Starter payment failed",
    "Your Pro plan is cancelled",
    "Your Pro plan has ended",
    "Your Lexema account is deleted",
  ]);
  for (const email of EVERY_EMAIL) {
    const { subject, text, html } = composeEmail(email, SETTINGS);
    assert.ok(text.startsWith(`${subject}\n\n`), email.kind);
    assert.equal(text.split(SETTINGS).length, 2, `${email.kind}: one settings link in the text`);
    assert.equal(html.split(`href="${SETTINGS}"`).length, 2, `${email.kind}: one settings link in the HTML`);
    assert.match(html, /<html lang="en">/, email.kind);
    // Every paragraph of the text is in the HTML.
    for (const paragraph of text.split("\n\n").slice(1, -3)) assert.ok(html.includes(paragraph.replace(/'/g, "&#39;")), `${email.kind}: ${paragraph}`);
  }
  const welcome = composeEmail({ kind: "plan-started", plan: "pro" }, SETTINGS).text;
  assert.match(welcome, /Pro gives your keys 5,000,000 calls a month, up to 300 calls a minute\./);
  assert.match(composeEmail({ kind: "cancellation-confirmed", plan: "pro", endsAt: PERIOD.end }, SETTINGS).text, /until 30 October 2026/);
});

test("the HTML paints with the manifest's role tokens in hex and escapes what it is given", () => {
  const { html } = composeEmail({ kind: "plan-started", plan: "starter" }, "https://developers.lexema.fyi/dashboard/settings?a=1&b=<2>");
  for (const token of ["#121110", "#1A1917", "#2C2A26", "#8B8579", "#C4BEB2", "#F4F0E6", "#D2A85C"]) assert.ok(html.includes(token), token);
  assert.doesNotMatch(html, /oklch/);
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
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "incomplete")), []);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "active")), [{ kind: "plan-started", plan: "pro" }]);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "active")), []);

  const both = await Promise.all([notePlanChange(appDb.app, written(accountId, "past_due")), notePlanChange(appDb.app, written(accountId, "past_due"))]);
  assert.deepEqual(both.flat(), [{ kind: "payment-failed", plan: "pro" }]);

  const cancelAt = new Date(PERIOD.end);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "active", "starter", cancelAt)), [
    { kind: "plan-changed", from: "pro", to: "starter" },
    { kind: "cancellation-confirmed", plan: "starter", endsAt: PERIOD.end },
  ]);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "canceled", "starter")), [{ kind: "plan-ended", plan: "starter" }]);
  assert.deepEqual(await notePlanChange(appDb.app, written(accountId, "canceled", "starter")), []);
});

test("emails go to the account's own address from noreply@lexema.fyi; a deleted account, a failed send and no binding send nothing and throw nothing", async () => {
  const { appDb, accountId } = await ada();
  const email = new StubEmail();
  const mail = accountMailOf(email, "https://developers.lexema.fyi");
  assert.deepEqual(await emailAccount(appDb.app, mail, accountId, [{ kind: "plan-started", plan: "pro" }]), ["sent"]);
  const [message] = email.sent;
  assert.equal(message?.to, "ada@example.com");
  assert.deepEqual(message?.from, SENDER);
  assert.equal(SENDER.email, "noreply@lexema.fyi");
  assert.ok(message?.text.includes(SETTINGS));

  email.failing = "E_SENDER_DOMAIN_NOT_AVAILABLE";
  assert.deepEqual(await emailAccount(appDb.app, mail, accountId, [{ kind: "plan-ended", plan: "pro" }]), ["failed"]);
  assert.deepEqual(await emailAccount(appDb.app, undefined, accountId, [{ kind: "plan-ended", plan: "pro" }]), ["mail-off"]);
  assert.equal(email.sent.length, 1);

  email.failing = undefined;
  await deleteAccount(appDb, accountId, NOW, undefined);
  assert.deepEqual(await emailAccount(appDb.app, mail, accountId, [{ kind: "plan-ended", plan: "pro" }]), []);
  assert.equal(email.sent.length, 1);
});

test("deleting an account emails the address it had once; deleting it again sends nothing, and a failed email still deletes it", async () => {
  const { appDb, accountId } = await ada();
  const email = new StubEmail();
  const mail = accountMailOf(email, "https://developers.lexema.fyi");
  assert.deepEqual(await deleteAccount(appDb, accountId, NOW, undefined, mail), { outcome: "deleted", revokedKeys: 0 });
  assert.deepEqual(
    email.sent.map(({ to, subject }) => ({ to, subject })),
    [{ to: "ada@example.com", subject: "Your Lexema account is deleted" }],
  );
  assert.deepEqual(await deleteAccount(appDb, accountId, NOW + 1_000, undefined, mail), { outcome: "deleted", revokedKeys: 0 });
  assert.equal(email.sent.length, 1);

  const other = await ada();
  const failing = new StubEmail();
  failing.failing = "E_DELIVERY_FAILED";
  const deleted = await deleteAccount(other.appDb, other.accountId, NOW, undefined, accountMailOf(failing, "https://developers.lexema.fyi"));
  assert.deepEqual(deleted, { outcome: "deleted", revokedKeys: 0 });
});
