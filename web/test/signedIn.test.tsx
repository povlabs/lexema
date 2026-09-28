// The signed-in side of developers.lexema.fyi (#169): the sign-in page, the
// dashboard, and the two dialogs the server opens over it (the new key's
// secret and the delete confirmation), as the server renders them. The Worker's guard and the actions the forms post to
// are web/test/dashboard.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AccountProfile } from "../../src/accounts/accounts.js";
import type { OwnedKey } from "../../src/api/ownedKeys.js";
import { AccountUsage, usageDays } from "../../src/api/usage.js";
import { CREATE_KEY_ACTION, Dashboard, DELETE_ACCOUNT_ACTION, revokeKeyAction } from "../app/Dashboard";
import { dashboardView, deleteWarning, lastUsed, shortDate } from "../app/dashboardView.ts";
import { SignIn, signInStart } from "../app/SignIn";
import { CONFIRM_DELETE_PAGE, CSRF_FIELD, DASHBOARD, DELETE_CONFIRMATION } from "../worker/dashboard.ts";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const CSRF = "c".repeat(43);

test("the sign-in page offers Google and GitHub, disables one that is not configured, and has no Terms line", () => {
  const both = renderToStaticMarkup(<SignIn available={{ google: true, github: true }} />);
  assert.match(both, /<h1[^>]*>Sign in<\/h1>/);
  assert.ok(both.includes(`href="${signInStart("google")}"`) && both.includes(`href="${signInStart("github")}"`));
  assert.match(both, /Continue with Google/);
  assert.match(both, /Continue with GitHub/);
  assert.doesNotMatch(both, /Terms/);

  const githubOnly = renderToStaticMarkup(<SignIn available={{ google: false, github: true }} />);
  assert.ok(!githubOnly.includes(`href="${signInStart("google")}"`), "an unconfigured provider is not a link");
  assert.match(githubOnly, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Continue with Google<\/button>/);
  assert.ok(githubOnly.includes(`href="${signInStart("github")}"`));
  assert.doesNotMatch(githubOnly, /Terms/);
});

test("dates read as the boards write them, and last use as a time ago, then a date", () => {
  assert.equal(shortDate("2026-09-27T08:00:00.000Z"), "27 Sep 2026");
  assert.equal(shortDate("2026-01-03"), "3 Jan 2026");
  assert.equal(lastUsed(null, NOW), "never");
  assert.equal(lastUsed("2026-09-28T11:59:30Z", NOW), "just now");
  assert.equal(lastUsed("2026-09-28T11:58:00Z", NOW), "2 minutes ago");
  assert.equal(lastUsed("2026-09-28T11:00:00Z", NOW), "1 hour ago");
  assert.equal(lastUsed("2026-09-25T12:00:00Z", NOW), "3 days ago");
  assert.equal(lastUsed("2026-07-01T12:00:00Z", NOW), "1 Jul 2026");
});

test("the delete confirmation says board 30's sentence with the account's live key count", () => {
  assert.equal(
    deleteWarning(2),
    "Your 2 API keys will be revoked right away, and any app using them will stop working. This can't be undone.",
  );
  assert.equal(deleteWarning(1), "Your 1 API key will be revoked right away, and any app using it will stop working. This can't be undone.");
  assert.equal(deleteWarning(0), "This can't be undone.");
});

const profile: AccountProfile = { email: "ada@example.com", providers: ["google"] };
const key = (keyId: number, name: string, extra: Partial<OwnedKey> = {}): OwnedKey => ({
  keyId,
  name,
  displayPrefix: `lx_${String(keyId).repeat(8)}`,
  createdAt: "2026-09-27T08:00:00.000Z",
  lastUsedAt: null,
  revokedAt: null,
  ...extra,
});

/** Two live keys and a revoked one; units on three days of the window. */
function sample() {
  const days = usageDays(NOW);
  const keys = [
    key(3, "Browser extension"),
    key(2, "Learning app", { lastUsedAt: "2026-09-28T11:58:00.000Z" }),
    key(1, "Old", { revokedAt: "2026-09-20T00:00:00.000Z" }),
  ];
  const usage = AccountUsage.of(
    days,
    keys.map((each) => each.keyId),
    [
      { key_id: 2, day: days[29], units: 1200 },
      { key_id: 3, day: days[29], units: 40 },
      { key_id: 2, day: days[10], units: 600 },
      { key_id: 1, day: days[0], units: 17000 },
    ],
  );
  return { days, keys, view: dashboardView(profile, keys, usage, NOW) };
}

test("the dashboard lists each live key, oldest first, with its name, prefix, created, last used and a revoke form", () => {
  const { keys, view } = sample();
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} />);

  const rows = [...html.matchAll(/<tr[^>]*data-key-id="(\d+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(rows, [2, 3], "board 28 lists live keys only, oldest first");
  for (const [name, prefix, used] of [
    ["Learning app", "lx_22222222…", "2 minutes ago"],
    ["Browser extension", "lx_33333333…", "never"],
  ]) {
    // On a phone the created and last-used cells read "Created … · Last used …" (board 28m).
    const row = new RegExp(
      `<tr[^>]*><td[^>]*>${name}</td><td[^>]*>${prefix}</td><td[^>]*><span[^>]*>Created </span>27 Sep 2026</td><td[^>]*><span[^>]*>\u00a0· Last used </span>${used}</td>`,
    );
    assert.match(html, row, name);
  }
  assert.ok(html.includes(`action="${revokeKeyAction(3)}"`) && html.includes(`action="${revokeKeyAction(2)}"`));
  assert.ok(!html.includes(`action="${revokeKeyAction(1)}"`), "a revoked key has no row");
  assert.doesNotMatch(html, /Revoked|>Old</);
  assert.equal(keys.length, 3);

  // The bar names the account, and signing out is a POST.
  assert.match(html, /ada@example\.com/);
  assert.match(html, /<form action="\/sign-out" method="post"><button[^>]*>Sign out<\/button><\/form>/);
  assert.match(html, /<a[^>]*href="\/dashboard"[^>]*aria-current="page"[^>]*>Dashboard<\/a>/);
});

test("the dashboard shows 30 days of units in total, revoked keys' too, today last, and no per-key rows", () => {
  const { days, view } = sample();
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} />);
  assert.match(html, /Last 30 days · 18,840 units/);
  const bars = [...html.matchAll(/data-day="([^"]+)" data-units="(\d+)"/g)].map((match) => [match[1], Number(match[2])]);
  const expected = days.map((day, i) => [day, ({ 0: 17000, 10: 600, 29: 1240 } as Record<number, number>)[i] ?? 0]);
  assert.deepEqual(bars, expected);
  assert.equal([...html.matchAll(/data-usage="/g)].length, 1, "one chart, the account's");
});

test("the plan card offers nothing to buy, and every form posts to a dashboard action with the CSRF token", () => {
  const { view } = sample();
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} />);
  assert.match(html, />No plan yet</);
  assert.match(html, /<button[^>]*type="button" disabled=""[^>]*>Choose a plan — coming soon<\/button>/);

  const forms = [...html.matchAll(/<form[^>]*action="([^"]+)"[^>]*>(.*?)<\/form>/g)];
  const actions = forms.map((form) => form[1]);
  // Sign out twice: in the bar, and in the ☰ menu a phone shows instead.
  assert.deepEqual(actions, ["/sign-out", "/sign-out", CREATE_KEY_ACTION, revokeKeyAction(2), revokeKeyAction(3)]);
  for (const [, action, body] of forms.slice(2)) {
    assert.ok(body.includes(`name="${CSRF_FIELD}" value="${CSRF}"`), action);
  }
  // Board 28's Create key is a lone button: no name field.
  assert.match(forms[2][2], /^<input type="hidden"[^>]*\/><button[^>]*type="submit"[^>]*>Create key<\/button>$/);
  // The account section: who is signed in, and Delete account, a link to the confirmation that works without a script.
  assert.match(html, /Signed in with Google · ada@example\.com/);
  assert.match(html, new RegExp(`<a[^>]*href="${CONFIRM_DELETE_PAGE.replace("?", "\\?")}"[^>]*>Delete account</a>`));
  assert.doesNotMatch(html, /role="dialog"/, "no dialog is open");
  assert.ok(DELETE_ACCOUNT_ACTION.startsWith(DASHBOARD));
});

test("an account with no keys has no key table", () => {
  const view = dashboardView(profile, [], AccountUsage.of(usageDays(NOW), [], []), NOW);
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} />);
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /Last 30 days · 0 units/);
  assert.equal(view.keys.length, 0);
});

test("the key-created dialog sits over the dashboard with the secret, Copy, the once-only note, and the way back", () => {
  const { view } = sample();
  const secret = `lx_${"ab".repeat(32)}`;
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} dialog={{ kind: "key-created", name: "Learning app", secret }} />);
  // The dashboard is behind it, inert, so the keyboard stays in the dialog.
  assert.match(html, /^<div[^>]*inert=""[^>]*>.*<h1[^>]*>Dashboard<\/h1>/);
  const dialog = /<section[^>]*role="dialog"[^>]*aria-modal="true"[^>]*>(.*)<\/section>/.exec(html)?.[1] ?? "";
  assert.match(dialog, /<h2[^>]*id="key-created"[^>]*>Key created<\/h2>/);
  assert.match(dialog, />Learning app</);
  assert.ok(dialog.includes(`>${secret}<`));
  assert.match(dialog, /Copy<\/button>/);
  assert.match(dialog, /Copy it now\. You won(?:'|&#x27;)t be able to see it again\./);
  // × and Done go back to the dashboard.
  assert.equal([...dialog.matchAll(new RegExp(`href="${DASHBOARD}"`, "g"))].length, 2);
});

test("the delete confirmation sits over the dashboard, posts the confirmed deletion, and Cancel goes back", () => {
  const { view } = sample();
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} dialog={{ kind: "confirm-delete" }} />);
  assert.match(html, /^<div[^>]*inert=""/);
  const dialog = /<section[^>]*role="dialog"[^>]*aria-modal="true"[^>]*>(.*)<\/section>/.exec(html)?.[1] ?? "";
  assert.match(dialog, /<h2[^>]*>Delete your account\?<\/h2>/);
  assert.match(dialog, /Your 2 API keys will be revoked right away, and any app using them will stop working\. This can(?:'|&#x27;)t be undone\./);
  const form = new RegExp(`<form[^>]*action="${DELETE_ACCOUNT_ACTION}"[^>]*>(.*?)</form>`).exec(dialog)?.[1] ?? "";
  assert.ok(form.includes(`name="${CSRF_FIELD}" value="${CSRF}"`));
  assert.ok(form.includes(`name="confirm" value="${DELETE_CONFIRMATION}"`));
  assert.match(form, new RegExp(`<a[^>]*href="${DASHBOARD}"[^>]*>Cancel</a><button[^>]*type="submit"[^>]*>Delete account</button>$`));
});
