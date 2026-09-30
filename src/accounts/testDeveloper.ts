// The test developer: the one account a Preview's test sign-in reaches (#245,
// ADR 0018). A reviewer's capture signs in as it with one click and no
// credential, in that Preview's own `APP_DB`; web/worker/testSignIn.ts is the
// route, and only a Preview's developer host has it.
//
// It is an ordinary account under the ordinary account rule (./accounts.ts):
// a GitHub identity with a verified email. Its subject is not a number, and
// GitHub's user ids are, so no real GitHub sign-in can reach it; its email is
// on `example.com`, which nobody can verify an address at (RFC 2606), so no
// real sign-in links to it by email either.

import type { AppTables } from "../db/app/database.js";
import { signInAccount, verifiedIdentity, type VerifiedIdentity } from "./accounts.js";
import { startSession } from "./auth.js";

/** Who the test developer is, as its provider would describe it. */
export const TEST_DEVELOPER_PROFILE = {
  subject: "lexema-preview-test-developer",
  verifiedEmail: "test-developer@example.com",
  name: "Test Developer",
} as const;

function testDeveloper(): VerifiedIdentity {
  const identity = verifiedIdentity("github", TEST_DEVELOPER_PROFILE);
  if (identity === undefined) throw new Error("the test developer's profile carries no verified email");
  return identity;
}

/**
 * Sign the test developer in: make its account on first use, then start a
 * session for it. Answers the `Set-Cookie` values that carry the session.
 */
export async function signInTestDeveloper(db: AppTables, secret: string, origin: string, headers: Headers, now: number): Promise<string[]> {
  const { accountId } = await signInAccount(db, testDeveloper(), now);
  return startSession(db.app, secret, origin, headers, accountId);
}
