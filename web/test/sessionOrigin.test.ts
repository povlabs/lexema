// The developer-site address better-auth is given when the Worker reads a
// session (#266): a Preview's own developer host on a Preview, and the live
// one on the live and local hosts. This file swaps `sessionAuth` for a
// stand-in that records the address and finds no session, then opens the
// dashboard through the Worker's host routing.
//
// `mock.module` needs `--experimental-test-module-mocks`, which the `test`
// script passes to every web test, and this file imports the Worker only after
// the swap.

import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { BILLING_OFF } from "./stubStripe.ts";

process.env.BETTER_AUTH_SECRET = "lexema-tests-only-3f9c2a7e5d1b4c8a9e6f0d2b7a5c3e1f";

const AUTH = new URL("../../src/accounts/auth.ts", import.meta.url).href;
const actual = await import(AUTH);
/** Each address `sessionAuth` was given, in order. */
const given: string[] = [];
mock.module(AUTH, {
  exports: {
    ...actual,
    sessionAuth: (_db: unknown, _secret: string, origin: string) => {
      given.push(origin);
      return { api: { getSession: async () => null } };
    },
  },
});

const { apiNotFound } = await import("@/worker/api/handler.ts");
const { withDashboard } = await import("@/worker/dashboard.ts");
const { byHost } = await import("@/worker/hosts.ts");
const { SESSION_COOKIE } = await import("@/worker/signIn.ts");
type AppTables = import("@lexema/db/app/database.ts").AppTables;

const worker = byHost<object>({
  app: withDashboard(
    async () => new Response("page"),
    () => ({ appDb: { app: {} } as unknown as AppTables, billing: BILLING_OFF, now: 0 }),
  ),
  api: async () => Response.json({}),
  apiNotFound,
});

/** The address better-auth was given for one dashboard visit, with a session cookie, on this origin. */
async function baseUrlOn(origin: string): Promise<string> {
  given.length = 0;
  const response = await worker(new Request(`${origin}/dashboard`, { headers: { cookie: `${SESSION_COOKIE}=token` } }), {}, {} as ExecutionContext);
  assert.equal(response.status, 303, origin);
  assert.equal(given.length, 1, origin);
  return given[0];
}

test("on a Preview's developer host, better-auth is given that Preview's developer address", async () => {
  for (const name of ["huey-266-preview-links", "a1b2c3d4-huey-266-preview-links"]) {
    const developers = `https://${name}.developers-preview.lexema.fyi`;
    assert.equal(await baseUrlOn(developers), developers);
  }
});

test("on the live and local developer hosts, better-auth is given the live developer address, as before", async () => {
  assert.equal(await baseUrlOn("https://developers.lexema.fyi"), "https://developers.lexema.fyi");
  assert.equal(await baseUrlOn("http://developers.localhost:8787"), "https://developers.lexema.fyi");
});
