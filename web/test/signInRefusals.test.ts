// Sign-in on better-auth (#229) where it is refused, and what it keeps, end
// to end through the Worker's host routing, with the fetch-level stub
// providers and a local `node:sqlite` database over the real schema. The round
// trips that succeed are web/test/signIn.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProviderProfile, ProviderRegistry } from "../../src/accounts/providers.js";
import { freshAppDatabase } from "../../test/databases.js";
import { apiNotFound } from "@/worker/api/handler.ts";
import { CSRF_FIELD, csrfTokenOf, DELETE_CONFIRMATION, withDashboard } from "@/worker/dashboard.ts";
import { BILLING_OFF } from "./stubStripe.ts";
import { byHost } from "@/worker/hosts.ts";
import { withRateLimits, type LimitBindings } from "@/worker/rateLimit.ts";
import { PENDING_COOKIE, SESSION_COOKIE, signedInAccount, withSignIn, type SignInBindings } from "@/worker/signIn.ts";
import { StubProvider } from "./stubProvider.ts";

const NOW = Date.now();
const DEVELOPERS = "https://developers.lexema.fyi";

const allow: RateLimit = { limit: async () => ({ success: true }) };
const env: LimitBindings & SignInBindings = {
  SEARCH_LIMIT: allow,
  SUGGEST_LIMIT: allow,
  REPORT_LIMIT: allow,
  REPORT_OPEN_LIMIT: allow,
  SIGN_IN_LIMIT: allow,
  KEY_CREATE_LIMIT: allow,
  BILLING_LIMIT: allow,
};

function site(providers?: (stubs: { google: StubProvider; github: StubProvider }) => ProviderRegistry) {
  const { sqlite, appDb: db } = freshAppDatabase();
  const google = new StubProvider("google");
  const github = new StubProvider("github");
  const worker = byHost<typeof env>({
    app: withRateLimits(
      withSignIn(
        withDashboard(async () => new Response("page"), () => ({ appDb: db, billing: BILLING_OFF, now: NOW })),
        () => ({ providers: providers?.({ google, github }) ?? { google, github }, appDb: db, now: NOW }),
      ),
    ),
    api: async () => Response.json({}),
    apiNotFound,
  });

  const jar = new Map<string, string>();
  const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (jar.size > 0) headers.set("cookie", cookieHeader());
    const response = await worker(new Request(url, { ...init, headers }), env, {} as ExecutionContext);
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(";").map((part) => part.trim());
      const at = pair.indexOf("=");
      if (attributes.some((attribute) => attribute.toLowerCase() === "max-age=0")) jar.delete(pair.slice(0, at));
      else jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return response;
  }

  /** Leave for the provider: the consent page's URL. */
  async function start(provider: StubProvider): Promise<string> {
    const started = await send(`${DEVELOPERS}/sign-in/${provider.id}`);
    assert.equal(started.status, 303);
    return started.headers.get("location") ?? "";
  }

  const signIn = async (provider: StubProvider, profile: ProviderProfile) => send(provider.consent(await start(provider), profile).toString());
  const count = (table: string) => (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
  const account = () => signedInAccount(cookieHeader(), db, NOW);
  return { sqlite, db, jar, send, start, signIn, google, github, count, account, cookieHeader };
}

const ada: ProviderProfile = { subject: "g-ada", verifiedEmail: "ada@example.com", name: "Ada Lovelace" };

async function refusal(response: Response) {
  return { status: response.status, body: await response.text(), cookies: response.headers.getSetCookie().map((value) => value.split("=")[0]) };
}

test("a cancelled consent, a refused code and a callback with no pending sign-in answer as before, and store nothing", async () => {
  const cancelled = site();
  const declined = await cancelled.send(cancelled.google.decline(await cancelled.start(cancelled.google)).toString());
  assert.deepEqual(await refusal(declined), { status: 400, body: "Sign-in was cancelled.", cookies: [PENDING_COOKIE] });

  const refused = site();
  const code = refused.google.consent(await refused.start(refused.google), ada);
  code.searchParams.set("code", "not-a-code");
  assert.deepEqual(await refusal(await refused.send(code.toString())), {
    status: 400,
    body: "The provider did not confirm this sign-in. Start again.",
    cookies: [PENDING_COOKIE],
  });

  const unstarted = site();
  const orphan = unstarted.google.consent(await unstarted.start(unstarted.google), ada);
  unstarted.jar.clear();
  assert.deepEqual(await refusal(await unstarted.send(orphan.toString())), {
    status: 400,
    body: "This sign-in has expired or was not started here. Start again.",
    cookies: [PENDING_COOKIE],
  });

  for (const { count } of [cancelled, refused, unstarted]) {
    assert.deepEqual([count("developer_account"), count("provider_identity"), count("developer_session")], [0, 0, 0]);
  }
});

test("the PKCE verifier kept for the callback is the one the code was issued for: another is refused by the provider", async () => {
  const { sqlite, google, start, send, count, jar } = site();
  const callback = google.consent(await start(google), ada);
  // The pending sign-in is better-auth's verification row, keyed by state; its verifier is swapped.
  const row = sqlite.prepare("SELECT verification_id, value FROM verification").get() as { verification_id: number; value: string };
  sqlite.prepare("UPDATE verification SET value = ? WHERE verification_id = ?").run(JSON.stringify({ ...JSON.parse(row.value), codeVerifier: "B".repeat(128) }), row.verification_id);

  const response = await send(callback.toString());
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "The provider did not confirm this sign-in. Start again.");
  assert.ok(!jar.has(SESSION_COOKIE));
  assert.deepEqual([count("developer_account"), count("developer_session")], [0, 0]);
});

test("a GitHub email GitHub has not verified is refused 403, even where a Google account already has it, and stores nothing", async () => {
  const { signIn, google, github, jar, count, sqlite } = site();
  assert.equal((await signIn(google, ada)).status, 303);
  jar.clear();
  const before = sqlite.prepare("SELECT * FROM provider_identity").all().map((row) => ({ ...row }));
  const refused = await signIn(github, { subject: "4242", verifiedEmail: undefined, name: "ada" });
  assert.deepEqual(await refusal(refused), {
    status: 403,
    body: "Sign-in needs an email address the provider has verified.",
    cookies: [PENDING_COOKIE],
  });
  assert.deepEqual(sqlite.prepare("SELECT * FROM provider_identity").all().map((row) => ({ ...row })), before);
  assert.deepEqual([count("developer_account"), count("developer_session")], [1, 1]);
});

test("a sign-in keeps no provider token, no picture and no browser address, and signing in again ends the browser's earlier session", async () => {
  const { signIn, google, sqlite, count, account } = site();
  assert.equal((await signIn(google, ada)).status, 303);
  const first = await account();
  assert.equal(typeof first, "number");
  assert.deepEqual(
    { ...sqlite.prepare("SELECT access_token, refresh_token, id_token, scope, password FROM provider_identity").get() },
    { access_token: null, refresh_token: null, id_token: null, scope: null, password: null },
  );
  assert.deepEqual({ ...sqlite.prepare("SELECT image FROM developer_account").get() }, { image: null });
  assert.deepEqual({ ...sqlite.prepare("SELECT ip_address, user_agent FROM developer_session").get() }, { ip_address: null, user_agent: null });

  // The same browser signs in again: one session, the new one.
  assert.equal((await signIn(google, ada)).status, 303);
  assert.equal(count("developer_session"), 1);
  assert.equal(await account(), first);
});

test("a finished sign-in sweeps the sessions and pending sign-ins that have expired", async () => {
  const { signIn, google, sqlite, count } = site();
  const past = new Date(NOW - 1_000).toISOString();
  assert.equal((await signIn(google, ada)).status, 303);
  sqlite
    .prepare("INSERT INTO developer_session (token, account_id, expires_at, created_at, updated_at) VALUES ('expired', 1, ?, ?, ?)")
    .run(past, past, past);
  sqlite.prepare("INSERT INTO verification (identifier, value, expires_at, created_at, updated_at) VALUES ('abandoned', '{}', ?, ?, ?)").run(past, past, past);
  assert.deepEqual([count("developer_session"), count("verification")], [2, 1]);

  assert.equal((await signIn(google, ada)).status, 303);
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM developer_session WHERE token = 'expired'").get() as { n: number }).n, 0);
  assert.equal(count("verification"), 0);
});

test("a deleted account's email signs in to a new account, and the deleted one stays with nothing personal", async () => {
  const { signIn, send, google, jar, sqlite, account, cookieHeader } = site();
  assert.equal((await signIn(google, ada)).status, 303);
  const deleted = await account();
  const csrf = await csrfTokenOf(cookieHeader());
  const body = new URLSearchParams({ [CSRF_FIELD]: csrf ?? "", confirm: DELETE_CONFIRMATION });
  const answer = await send(`${DEVELOPERS}/dashboard/account/delete`, { method: "POST", headers: { origin: DEVELOPERS }, body });
  assert.equal(answer.status, 200);
  assert.ok(!jar.has(SESSION_COOKIE));

  assert.equal((await signIn(google, ada)).status, 303);
  const fresh = await account();
  assert.ok(fresh !== undefined && fresh !== deleted);
  assert.deepEqual(
    sqlite.prepare("SELECT account_id, email, name FROM developer_account ORDER BY account_id").all().map((row) => ({ ...row })),
    [
      { account_id: deleted, email: `deleted-${deleted}@deleted.invalid`, name: "" },
      { account_id: fresh, email: "ada@example.com", name: "Ada Lovelace" },
    ],
  );
});

test("a session cookie with a forged signature, or one signed under another secret, signs nobody in", async () => {
  const { signIn, google, jar, account, db } = site();
  assert.equal((await signIn(google, ada)).status, 303);
  const value = decodeURIComponent(jar.get(SESSION_COOKIE) ?? "");
  const [token] = value.split(".");
  assert.equal(await signedInAccount(`${SESSION_COOKIE}=${encodeURIComponent(`${token}.forged`)}`, db, NOW), undefined);
  assert.equal(await signedInAccount(`${SESSION_COOKIE}=${token}`, db, NOW), undefined);
  assert.equal(typeof (await account()), "number");

  const secret = process.env.BETTER_AUTH_SECRET;
  try {
    process.env.BETTER_AUTH_SECRET = "another-secret-entirely-0123456789abcdef";
    assert.equal(await account(), undefined);
    delete process.env.BETTER_AUTH_SECRET;
    assert.equal(await account(), undefined);
  } finally {
    process.env.BETTER_AUTH_SECRET = secret;
  }
});

test("a sign-out whose session could not be deleted answers 503 and leaves the browser signed in, not a 303", async () => {
  const { signIn, send, google, jar, sqlite, count, account } = site();
  assert.equal((await signIn(google, ada)).status, 303);
  const signedIn = await account();
  // The database refuses the delete, as a failing D1 would.
  sqlite.exec("CREATE TRIGGER no_delete BEFORE DELETE ON developer_session BEGIN SELECT RAISE(ABORT, 'database unavailable'); END");

  const out = await send(`${DEVELOPERS}/sign-out`, { method: "POST", headers: { origin: DEVELOPERS } });
  assert.deepEqual(await refusal(out), { status: 503, body: "Sign-in could not be finished. Try again later.", cookies: [] });
  assert.ok(jar.has(SESSION_COOKIE));
  assert.equal(count("developer_session"), 1);
  assert.equal(await account(), signedIn);
});

test("a sign-in whose earlier session could not be deleted answers 503 and makes no new session, not a 303", async () => {
  const { signIn, google, jar, sqlite, count, account } = site();
  assert.equal((await signIn(google, ada)).status, 303);
  const signedIn = await account();
  const earlier = jar.get(SESSION_COOKIE);
  // The database refuses the delete, as a failing D1 would.
  sqlite.exec("CREATE TRIGGER no_delete BEFORE DELETE ON developer_session BEGIN SELECT RAISE(ABORT, 'database unavailable'); END");

  const again = await signIn(google, ada);
  assert.equal(again.status, 503);
  assert.equal(await again.text(), "Sign-in could not be finished. Try again later.");
  assert.ok(!again.headers.getSetCookie().some((value) => value.startsWith(`${SESSION_COOKIE}=`)));
  assert.equal(jar.get(SESSION_COOKIE), earlier);
  assert.equal(count("developer_session"), 1);
  assert.equal(await account(), signedIn);
});

test("a callback for a provider that is not available answers 503, with or without a pending sign-in", async () => {
  const { start, send, google, github, jar, count } = site((stubs) => ({ google: undefined, github: stubs.github }));
  const callback = google.consent(`https://accounts.google.com/o/oauth2/v2/auth?state=s&redirect_uri=${encodeURIComponent(`${DEVELOPERS}/sign-in/google/callback`)}`, ada);

  assert.deepEqual(await refusal(await send(callback.toString())), { status: 503, body: "Sign-in with Google is not available.", cookies: [] });
  await start(github);
  assert.ok(jar.has(PENDING_COOKIE));
  assert.deepEqual(await refusal(await send(callback.toString())), { status: 503, body: "Sign-in with Google is not available.", cookies: [] });
  assert.deepEqual([count("developer_account"), count("developer_session")], [0, 0]);
});
