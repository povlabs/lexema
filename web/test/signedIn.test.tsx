// The signed-in side of developers.lexema.fyi (#169, #187): the sign-in page,
// the dashboard as the server renders it, and what its dialogs hold (the new
// key's form, then the key in its place, and the revoke and delete
// confirmations). Where the flow goes next, and the toasts it ends in, is
// web/test/keyFlow.test.ts. The Worker's guard and the actions the page sends
// are web/test/dashboard.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AccountProfile } from "../../src/accounts/accounts.js";
import { ALL_ENDPOINTS, onlyEndpoints } from "../../src/api/keyAccess.js";
import type { OwnedKey } from "../../src/api/ownedKeys.js";
import { AccountUsage, usageDays } from "../../src/api/usage.js";
import { CREATE_KEY_ACTION, Dashboard, DELETE_ACCOUNT_ACTION } from "../app/Dashboard";
import { CreateKeyForm, KeyResult } from "../app/CreateKeyDialog";
import { DeleteAccount } from "../app/DeleteAccountDialog";
import { RevokeKey } from "../app/RevokeKeyDialog";
import { dashboardView, deleteWarning, lastUsed, shortDate, type KeyRow } from "../app/dashboardView.ts";
import { SignIn, signInStart } from "../app/SignIn";
import { EMPTY_DRAFT, type CreateKeyDraft } from "../app/createKeyForm.ts";
import { CREATE_KEY_HINT, CREATE_KEY_PROBLEM } from "../app/styles.ts";
import { DASHBOARD } from "../worker/dashboard.ts";

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
  endpoints: ALL_ENDPOINTS,
  expiresAt: null,
  ...extra,
});

/** Two live keys and a revoked one; units on three days of the window. */
function sample() {
  const days = usageDays(NOW);
  const keys = [
    key(3, "Browser extension", { endpoints: onlyEndpoints(["lemmatize", "lookup"]), expiresAt: "2026-12-27T08:00:00.000Z" }),
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

test("the dashboard lists each live key, oldest first, with its name, prefix, endpoints, expiry, created, last used and Revoke", () => {
  const { keys, view } = sample();
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} made={3} />);

  const rows = [...html.matchAll(/<tr[^>]*data-key-id="(\d+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(rows, [2, 3], "board 28 lists live keys only, oldest first");
  for (const [name, prefix, endpoints, expires, used] of [
    // A key made with the dialog's defaults reads as the dialog put them.
    ["Learning app", "lx_22222222…", "All endpoints", "Never", "2 minutes ago"],
    // Only some: the ticked endpoints, in the checklist's order, as the checklist writes them; the expiry is its day.
    ["Browser extension", "lx_33333333…", "<span[^>]*>lookup, lemmatize</span>", "27 Dec 2026", "never"],
  ]) {
    // On a phone the cells read "Created … · Last used …", then the endpoints, then "Expires …" (board 28m, #187).
    const row = new RegExp(
      `<tr[^>]*><td[^>]*>${name}</td><td[^>]*>${prefix}</td><td[^>]*>${endpoints}</td><td[^>]*><span[^>]*>Expires </span>${expires}</td>` +
        `<td[^>]*><span[^>]*>Created </span>27 Sep 2026</td><td[^>]*><span[^>]*>\u00a0· Last used </span>${used}</td>`,
    );
    assert.match(html, row, name);
  }
  // Each Revoke opens its confirmation (board 28d) and revokes nothing itself.
  const revokes = [...html.matchAll(/<button type="button"[^>]*aria-haspopup="dialog"[^>]*aria-label="Revoke ([^"]*)"[^>]*>Revoke<\/button>/g)].map((match) => match[1]);
  assert.deepEqual(revokes, ["Learning app", "Browser extension"], "a revoked key has no row");
  assert.ok(!html.includes("/revoke"), "nothing on the page revokes a key by itself");
  assert.doesNotMatch(html, /Revoked|>Old</);
  assert.equal(keys.length, 3);

  // The bar names the account, and signing out is a POST.
  assert.match(html, /ada@example\.com/);
  assert.match(html, /<form action="\/sign-out" method="post"><button[^>]*>Sign out<\/button><\/form>/);
  assert.match(html, /<a[^>]*href="\/dashboard"[^>]*aria-current="page"[^>]*>Dashboard<\/a>/);
});

test("the dashboard shows 30 days of units in total, revoked keys' too, today last, and no per-key rows", () => {
  const { days, view } = sample();
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} made={3} />);
  assert.match(html, /Last 30 days · 18,840 units/);
  const bars = [...html.matchAll(/data-day="([^"]+)" data-units="(\d+)"/g)].map((match) => [match[1], Number(match[2])]);
  const expected = days.map((day, i) => [day, ({ 0: 17000, 10: 600, 29: 1240 } as Record<number, number>)[i] ?? 0]);
  assert.deepEqual(bars, expected);
  assert.equal([...html.matchAll(/data-usage="/g)].length, 1, "one chart, the account's");
});

test("the plan card offers nothing to buy; Create key and Delete account open their dialogs and make nothing themselves", () => {
  const { view } = sample();
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} made={3} />);
  assert.match(html, />No plan yet</);
  assert.match(html, /<button[^>]*type="button" disabled=""[^>]*>Choose a plan — coming soon<\/button>/);

  // The only forms are Sign out's, in the bar and in the ☰ menu a phone shows instead: every dashboard action is sent from the page.
  assert.deepEqual([...html.matchAll(/<form[^>]*action="([^"]+)"/g)].map((form) => form[1]), ["/sign-out", "/sign-out"]);
  assert.ok(!html.includes(CREATE_KEY_ACTION) && !html.includes(DELETE_ACCOUNT_ACTION), "nothing on the page posts a key or a deletion by itself");
  // Create key and Delete account are buttons that open a dialog (#187); none is open yet.
  assert.match(html, /<button type="button"[^>]*aria-haspopup="dialog"[^>]*>Create key<\/button>/);
  assert.match(html, /Signed in with Google · ada@example\.com/);
  assert.match(html, /<button type="button"[^>]*aria-haspopup="dialog"[^>]*>Delete account<\/button>/);
  assert.doesNotMatch(html, /role="dialog"|Create an API key|Delete your account\?/);
  assert.ok(DELETE_ACCOUNT_ACTION.startsWith(DASHBOARD));
});

test("an account with no keys has no key table", () => {
  const view = dashboardView(profile, [], AccountUsage.of(usageDays(NOW), [], []), NOW);
  const html = renderToStaticMarkup(<Dashboard view={view} csrf={CSRF} made={0} />);
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /Last 30 days · 0 units/);
  assert.equal(view.keys.length, 0);
});

/** What a dialog holds, drawn open inside its Base UI root (ADR 0010), as the page's popup holds it. */
const opened = (content: ReactNode): string => renderToStaticMarkup(<Dialog.Root open>{content}</Dialog.Root>);
/** The same, for a confirmation: Base UI's alert dialog. */
const confirming = (content: ReactNode): string => renderToStaticMarkup(<AlertDialog.Root open>{content}</AlertDialog.Root>);

const LEARNING_APP: KeyRow = {
  keyId: 2,
  name: "Learning app",
  prefix: "lx_7f3a9c21…",
  created: "27 Sep 2026",
  lastUsed: "never",
  endpoints: ALL_ENDPOINTS,
  expires: "Never",
};

test("once the key is made, the create dialog holds it in the form's place: the title, its summary, the secret with Copy, the note and Done", () => {
  const secret = `lx_${"ab".repeat(32)}`;
  const result = opened(<KeyResult keyRow={LEARNING_APP} secret={secret} />);
  // Board 28e, in order, and nothing of the form left.
  assert.match(
    result,
    new RegExp(
      `^<h2[^>]*>Key created</h2><p[^>]*>Learning app · All endpoints · Never expires</p><div[^>]*><p[^>]*data-secret="true">${secret}</p>` +
        `<button[^>]*type="button"[^>]*>.*Copy</button></div><p[^>]*>Copy it now\\. You won(?:'|&#x27;)t be able to see it again\\.</p>` +
        `<div[^>]*><button type="button"[^>]*>Done</button></div>$`,
    ),
  );
  assert.doesNotMatch(result, /<form|<input|aria-label="Close"|href=/);

  // Limited and expiring: how many endpoints, and the day.
  const limited = opened(<KeyResult keyRow={{ ...LEARNING_APP, name: "Browser extension", endpoints: { kind: "only", endpoints: ["lookup", "inflect"] }, expires: "27 Dec 2026" }} secret={secret} />);
  assert.match(limited, />Browser extension · 2 endpoints · Expires 27 Dec 2026</);
});

test("the revoke confirmation names the key and its prefix, then Cancel and Revoke key in warning", () => {
  const dialog = confirming(<RevokeKey keyRow={LEARNING_APP} onConfirm={() => {}} />);
  assert.match(dialog, /^<h2[^>]*>Revoke “Learning app”\?<\/h2>/);
  assert.match(dialog, /<p[^>]*>Any app using lx_7f3a9c21… will stop working right away\. This can(?:'|&#x27;)t be undone\.<\/p>/);
  assert.match(dialog, /<button type="button"[^>]*>Cancel<\/button><button class="([^"]*)" type="button">Revoke key<\/button><\/div>$/);
  assert.match(/>Cancel<\/button><button class="([^"]*)"/.exec(dialog)?.[1] ?? "", /bg-warning/, "Revoke key is filled in warning");
});

test("the delete confirmation says what deleting does, then Cancel and Delete account", () => {
  const dialog = confirming(<DeleteAccount warning={deleteWarning(2)} csrf={CSRF} />);
  assert.match(dialog, /<h2[^>]*>Delete your account\?<\/h2>/);
  assert.match(dialog, /Your 2 API keys will be revoked right away, and any app using them will stop working\. This can(?:'|&#x27;)t be undone\./);
  assert.match(dialog, /<button type="button"[^>]*>Cancel<\/button><button[^>]*type="button"[^>]*>Delete account<\/button><\/div>$/);
  assert.doesNotMatch(dialog, /role="alert"|disabled=""/);
});

/** The create-key dialog's form, opened holding this draft. */
const createForm = (opening: CreateKeyDraft = EMPTY_DRAFT): string =>
  opened(<CreateKeyForm defaultName="Key 4" status={{ kind: "editing" }} onEdit={() => {}} onSend={() => {}} opening={opening} />);

/** Each Base UI control of a role in a form, as its label's text and whether it is checked. */
const controls = (form: string, role: string) =>
  [...form.matchAll(new RegExp(`<span[^>]*role="${role}"[^>]*aria-checked="(true|false)".*?([^>]*)</label>`, "g"))].map((match) => [match[2], match[1] === "true"]);

test("the create-key dialog asks for an optional name, names the default, offers All endpoints or Only some and an expiry, and Cancel", () => {
  const form = createForm();
  assert.match(form, /^<h2[^>]*>Create an API key<\/h2><form/);
  // One Name field, optional, labelled, with the board's placeholder and the hint naming the default.
  assert.match(form, /<label[^>]*for="create-key-name"[^>]*>Name<\/label>/);
  const input = /<input[^>]*id="create-key-name"[^>]*\/>/.exec(form)?.[0] ?? "";
  assert.match(input, /placeholder="What(?:'|&#x27;)s it for\? e\.g\. Learning app"/);
  assert.match(input, /maxLength="200"/);
  assert.doesNotMatch(input, /required/);
  assert.match(form, /<p[^>]*id="create-key-hint"[^>]*>Optional\. Left empty, it(?:'|&#x27;)s called Key 4\.<\/p>/);
  // Endpoints (boards 28b and 28c): Base UI's radio group, All endpoints ticked, then its hint and no checklist.
  assert.match(form, /<div role="radiogroup" aria-labelledby="create-key-endpoints"/);
  assert.deepEqual(controls(form, "radio"), [
    ["All endpoints", true],
    ["Only some", false],
  ]);
  assert.match(form, />All endpoints<\/label>.*>Only some<\/label>/);
  assert.match(form, /<p[^>]*id="create-key-endpoints-hint"[^>]*>Only some: pick the endpoints this key may call\. Anything else answers 403\.<\/p>/);
  assert.doesNotMatch(form, /role="checkbox"/);
  // Expires: Never, 30 days, 90 days and 1 year, Never chosen, and its hint.
  const select = /<select[^>]*id="create-key-expires"[^>]*>(.*?)<\/select>/.exec(form);
  assert.ok(select !== null);
  assert.deepEqual(
    [...select[1].matchAll(/<option value="([^"]*)"( selected="")?>([^<]*)<\/option>/g)].map((option) => [option[1], option[2] !== undefined, option[3]]),
    [
      ["never", true, "Never"],
      ["30-days", false, "30 days"],
      ["90-days", false, "90 days"],
      ["1-year", false, "1 year"],
    ],
  );
  assert.match(form, /<p[^>]*id="create-key-expires-hint"[^>]*>After this date the key answers 401\.<\/p>/);
  // Cancel closes the dialog; Create key is the form's one submit, pressable on the defaults.
  assert.match(form, /<button type="button"[^>]*>Cancel<\/button><button[^>]*type="submit">Create key<\/button><\/div><\/form>$/);
  assert.equal([...form.matchAll(/type="submit"/g)].length, 1);
  assert.doesNotMatch(form, /role="alert"|aria-invalid|disabled=""/);
});

test("while the form is on its way, Cancel and Create key are both disabled, so the dialog waits for its answer", () => {
  const sending = opened(<CreateKeyForm defaultName="Key 4" status={{ kind: "sending" }} onEdit={() => {}} onSend={() => {}} />);
  assert.match(sending, /<button type="button"[^>]*disabled=""[^>]*>Cancel<\/button><button[^>]*type="submit" disabled="">Create key<\/button>/);
});

/** A problem as the dialog says it: in `warning`, at the hint's size. */
const PROBLEM = (id: string, message: string) =>
  `<p class="${CREATE_KEY_PROBLEM}" id="${id}" role="alert">${message.replace(/'/g, "&#x27;")}</p>`;

test("Only some shows the checklist; with nothing ticked, the reason sits right under it in warning at the hint's size, and Create key is disabled", () => {
  assert.match(CREATE_KEY_PROBLEM, /text-warning/);
  assert.ok(CREATE_KEY_PROBLEM.includes("text-[0.78125rem]") && CREATE_KEY_HINT.includes("text-[0.78125rem]"), "the problem is the hint's size");

  const none = createForm({ ...EMPTY_DRAFT, name: "Learning app", scope: "some", expires: "30-days" });
  assert.match(none, /id="create-key-name"[^>]*value="Learning app"/);
  assert.deepEqual(controls(none, "radio"), [
    ["All endpoints", false],
    ["Only some", true],
  ]);
  assert.doesNotMatch(none, /id="create-key-endpoints-hint"/, "the checklist takes the hint's place");
  // Board 28c's checklist: Base UI's checkboxes, the 8 endpoints in order, none ticked.
  assert.deepEqual(
    controls(none, "checkbox"),
    ["lookup", "lemmatize", "exists", "inflect", "suggest", "nearby", "random", "lookup/batch"].map((endpoint) => [endpoint, false]),
  );
  assert.ok(none.includes(`lookup/batch</label></div>${PROBLEM("create-key-endpoints-problem", "Tick at least one endpoint.")}`), none);
  assert.match(none, /role="radiogroup"[^>]*aria-describedby="create-key-endpoints-problem"/);
  assert.equal([...none.matchAll(/role="alert"/g)].length, 1);
  assert.match(none, /<option value="30-days" selected="">/);
  assert.match(none, /<button[^>]*type="submit" disabled="">Create key<\/button>/);

  // One ticked: no problem, and Create key can be pressed.
  const ticked = createForm({ ...EMPTY_DRAFT, scope: "some", ticked: ["lookup", "inflect"] });
  assert.deepEqual(
    controls(ticked, "checkbox").filter(([, checked]) => checked).map(([value]) => value),
    ["lookup", "inflect"],
  );
  assert.doesNotMatch(ticked, /role="alert"|disabled=""/);

  // A name too long to keep: said under the name's hint.
  const named = createForm({ ...EMPTY_DRAFT, name: "x".repeat(201) });
  assert.ok(named.includes(`Left empty, it&#x27;s called Key 4.</p>${PROBLEM("create-key-name-problem", "A key's name can be at most 200 characters.")}`));
  assert.match(named, /id="create-key-name"[^>]*aria-invalid="true" aria-describedby="create-key-hint create-key-name-problem"/);
});
