// Developer accounts and the provider identities that sign in to them (#165).
//
// An account is found by the identity signing in: first by the provider's own
// id for the person, then by verified email, so the same person signing in
// with Google and then GitHub under one email reaches one account. The first
// sign-in under an email nobody has used makes the account. Only a verified
// email ever reaches here: `verifiedIdentity` is the one way to build the
// value this module takes.

import type { LookupDatabase } from "../lookup/database.js";
import type { ProviderId, ProviderProfile } from "./providers.js";

/** A person a provider vouched for, with an email it says is verified. */
export interface VerifiedIdentity {
  readonly provider: ProviderId;
  readonly subject: string;
  /** Lowercased, so one address is one account however a provider spells it. */
  readonly email: string;
}

/** The identity a profile proves, or `undefined` when the provider verified no email. */
export function verifiedIdentity(provider: ProviderId, profile: ProviderProfile): VerifiedIdentity | undefined {
  const email = profile.verifiedEmail?.trim().toLowerCase() ?? "";
  if (profile.subject === "" || !/^[^@\s]+@[^@\s]+$/.test(email)) return undefined;
  return { provider, subject: profile.subject, email };
}

export const IDENTITY_BY_SUBJECT_SQL = `SELECT account_id FROM provider_identity
       WHERE provider = ? AND provider_user_id = ?`;
export const IDENTITY_BY_EMAIL_SQL = `SELECT account_id FROM provider_identity
       WHERE email = ? ORDER BY identity_id LIMIT 1`;
export const INSERT_ACCOUNT_SQL = `INSERT INTO developer_account (created_at) VALUES (?) RETURNING account_id`;
export const INSERT_IDENTITY_SQL = `INSERT INTO provider_identity (account_id, provider, provider_user_id, email, linked_at)
     VALUES (?, ?, ?, ?, ?)`;

/** How a sign-in reached its account. */
export type AccountMatch = "identity" | "email" | "new";

/** The account this identity signs in to, linking or creating as needed. */
export async function signInAccount(
  db: LookupDatabase,
  identity: VerifiedIdentity,
  now: number,
): Promise<{ accountId: number; match: AccountMatch }> {
  const [known] = await db.all<{ account_id: number }>(IDENTITY_BY_SUBJECT_SQL, [identity.provider, identity.subject]);
  if (known !== undefined) return { accountId: known.account_id, match: "identity" };

  const at = new Date(now).toISOString();
  const [sameEmail] = await db.all<{ account_id: number }>(IDENTITY_BY_EMAIL_SQL, [identity.email]);
  let accountId: number;
  let match: AccountMatch;
  if (sameEmail !== undefined) {
    accountId = sameEmail.account_id;
    match = "email";
  } else {
    const [created] = await db.all<{ account_id: number }>(INSERT_ACCOUNT_SQL, [at]);
    if (created === undefined) throw new Error("the new account was not stored");
    accountId = created.account_id;
    match = "new";
  }
  await db.all(INSERT_IDENTITY_SQL, [accountId, identity.provider, identity.subject, identity.email, at]);
  return { accountId, match };
}
