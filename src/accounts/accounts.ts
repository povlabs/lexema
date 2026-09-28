// Developer accounts and the provider identities that sign in to them (#165).
//
// An account is found by the identity signing in: first by the provider's own
// id for the person, then by verified email, so the same person signing in
// with Google and then GitHub under one email reaches one account. The first
// sign-in under an email nobody has used makes the account. Only a verified
// email ever reaches here: `verifiedIdentity` is the one way to build the
// value this module takes.

import { revokeAllAccountKeys } from "../api/ownedKeys.js";
import type { LookupDatabase, TransactionalDatabase } from "../lookup/database.js";
import { PROVIDER_IDS, type ProviderId, type ProviderProfile } from "./providers.js";

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

export const ACCOUNT_IDENTITIES_SQL = `SELECT provider, email FROM provider_identity
       WHERE account_id = ? ORDER BY identity_id`;

/** Who an account is, as the dashboard names it: an email and the providers it signs in with. */
export interface AccountProfile {
  /** The email its first linked identity was verified with. */
  readonly email: string;
  /** Each provider linked to the account, once, in `PROVIDER_IDS` order; never empty. */
  readonly providers: readonly [ProviderId, ...ProviderId[]];
}

/** The account's profile, or `undefined` when it has no identity: deleted, or never signed in. */
export async function accountProfile(db: LookupDatabase, accountId: number): Promise<AccountProfile | undefined> {
  const rows = await db.all<{ provider: ProviderId; email: string }>(ACCOUNT_IDENTITIES_SQL, [accountId]);
  const [first] = rows;
  if (first === undefined) return undefined;
  const linked = PROVIDER_IDS.filter((provider) => rows.some((row) => row.provider === provider));
  return { email: first.email, providers: linked as [ProviderId, ...ProviderId[]] };
}

export const MARK_ACCOUNT_DELETED_SQL = `UPDATE developer_account SET deleted_at = coalesce(deleted_at, ?)
     WHERE account_id = ? RETURNING account_id`;
export const DELETE_ACCOUNT_SESSIONS_SQL = `DELETE FROM developer_session WHERE account_id = ?`;
export const DELETE_ACCOUNT_IDENTITIES_SQL = `DELETE FROM provider_identity WHERE account_id = ?`;

/**
 * Delete an account (#163 R1.4): revoke every key it owns, end its sessions
 * and unlink its provider identities. The row stays, marked deleted and with
 * nothing personal in it, so its revoked keys and their usage keep an owner;
 * signing in again with the same email makes a new account.
 *
 * The four statements run as one transaction, so a deletion that fails leaves
 * the account exactly as it was, still signed in and with its keys live, and
 * one that succeeds leaves no session or identity that could reach it. Running
 * it again on a deleted account changes nothing and keeps the first time.
 * Answers the number of keys it revoked, or `unknown` when there is no such
 * account.
 */
export async function deleteAccount(
  db: TransactionalDatabase,
  accountId: number,
  now: number,
): Promise<{ outcome: "deleted"; revokedKeys: number } | { outcome: "unknown" }> {
  const [marked = [], revoked = []] = await db.batch([
    { sql: MARK_ACCOUNT_DELETED_SQL, params: [new Date(now).toISOString(), accountId] },
    revokeAllAccountKeys(accountId, now),
    { sql: DELETE_ACCOUNT_SESSIONS_SQL, params: [accountId] },
    { sql: DELETE_ACCOUNT_IDENTITIES_SQL, params: [accountId] },
  ]);
  if (marked.length === 0) return { outcome: "unknown" };
  return { outcome: "deleted", revokedKeys: revoked.length };
}
