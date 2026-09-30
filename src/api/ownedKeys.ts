// A developer account's own API keys (#167): list them, make a named one, and
// revoke one, for the dashboard on developers.lexema.fyi.
//
// An owned key is an `api_key` row whose `owner_account_id` is the account; an
// admin key, made with the CLI, has none and is never reached from here. Every
// statement names the account, so one account can neither read nor revoke
// another's keys. A dashboard key carries no limit of its own, its rate being
// its account's (#161), and there is no cap on how many an account holds. Its endpoints and expiry are
// the developer's choice (#187, ./keyAccess.ts).

import type { LookupDatabase, Statement } from "../lookup/database.js";
import { endpointsColumn, endpointsOfColumn, OPEN_ACCESS, type EndpointScope, type KeyAccess } from "./keyAccess.js";
import { displayPrefix, generateApiKey, hashApiKey, type NewKey } from "./keys.js";

/** The longest name a key may have: the `label` check in src/db/schema.sql. */
export const KEY_NAME_MAX = 200;

declare const keyNameBrand: unique symbol;
/** A key's name, trimmed and within 1 to `KEY_NAME_MAX` characters. `keyName` is the only way to make one. */
export type KeyName = string & { readonly [keyNameBrand]: true };

/** The name a developer typed, as a key name, or `undefined` when it is blank or too long. */
export function keyName(text: string): KeyName | undefined {
  const name = text.trim();
  return name.length >= 1 && name.length <= KEY_NAME_MAX ? (name as KeyName) : undefined;
}

/** One of an account's keys as the dashboard lists it. Never the secret. */
export interface OwnedKey {
  keyId: number;
  name: string;
  displayPrefix: string;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601; `null` until the key is first accepted. */
  lastUsedAt: string | null;
  /** ISO-8601; `null` while the key is live. */
  revokedAt: string | null;
  /** The endpoints it may call. */
  endpoints: EndpointScope;
  /** ISO-8601; `null` for a key that never expires. */
  expiresAt: string | null;
}

/** An account's keys, newest first, through `api_key_by_owner`. */
export const ACCOUNT_KEYS_SQL = `SELECT key_id, label, display_prefix, created_at, last_used_at, revoked_at, endpoints, expires_at
       FROM api_key WHERE owner_account_id = ? ORDER BY key_id DESC`;

/** Every key the account owns, live and revoked. */
export async function listAccountKeys(db: LookupDatabase, accountId: number): Promise<OwnedKey[]> {
  const rows = await db.all<{
    key_id: number;
    label: string;
    display_prefix: string;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
    endpoints: string | null;
    expires_at: string | null;
  }>(ACCOUNT_KEYS_SQL, [accountId]);
  return rows.map((row) => ({
    keyId: row.key_id,
    name: row.label,
    displayPrefix: row.display_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    endpoints: endpointsOfColumn(row.endpoints),
    expiresAt: row.expires_at,
  }));
}

/**
 * A new key owned by the account, stored only if the account exists and is
 * not deleted: the row comes from the account's own, so no read can go stale
 * between the check and the insert.
 */
export const INSERT_OWNED_KEY_SQL = `INSERT INTO api_key
       (key_hash, label, created_at, display_prefix, endpoints, expires_at, owner_account_id)
     SELECT ?, ?, ?, ?, ?, ?, account_id FROM developer_account WHERE account_id = ? AND deleted_at IS NULL
     RETURNING key_id`;

export type OwnedKeyCreation = ({ outcome: "created" } & NewKey) | { outcome: "refused"; refusal: "no-account" };

/**
 * Make a named key for the account, with no limit of its own and the access
 * asked for: every endpoint and no expiry unless told otherwise. The returned
 * `key` is the only time it exists in the clear.
 */
export async function createAccountKey(
  db: LookupDatabase,
  accountId: number,
  name: KeyName,
  now: number,
  access: KeyAccess = OPEN_ACCESS,
): Promise<OwnedKeyCreation> {
  const key = generateApiKey();
  const [row] = await db.all<{ key_id: number }>(INSERT_OWNED_KEY_SQL, [
    await hashApiKey(key),
    name,
    new Date(now).toISOString(),
    displayPrefix(key),
    endpointsColumn(access.endpoints),
    access.expiresAt,
    accountId,
  ]);
  if (row === undefined) return { outcome: "refused", refusal: "no-account" };
  return { outcome: "created", keyId: row.key_id, key, displayPrefix: displayPrefix(key) };
}

/** Revoke one live key, only when the account owns it. */
export const REVOKE_OWNED_KEY_SQL = `UPDATE api_key SET revoked_at = ?
     WHERE key_id = ? AND owner_account_id = ? AND revoked_at IS NULL RETURNING key_id`;
export const OWNED_KEY_SQL = `SELECT revoked_at FROM api_key WHERE key_id = ? AND owner_account_id = ?`;

/**
 * - `revoked`: the key was live and is revoked now.
 * - `already-revoked`: the account's key was revoked before.
 * - `not-yours`: no key of this account has that id. Another account's key, an
 *   admin key and a key that does not exist read alike, so the answer says
 *   nothing about keys the account does not own.
 */
export type OwnedKeyRevocation = "revoked" | "already-revoked" | "not-yours";

/** Revoke one of the account's own keys. Any other key is refused and left as it was. */
export async function revokeAccountKey(db: LookupDatabase, accountId: number, keyId: number, now: number): Promise<OwnedKeyRevocation> {
  const revoked = await db.all<{ key_id: number }>(REVOKE_OWNED_KEY_SQL, [new Date(now).toISOString(), keyId, accountId]);
  if (revoked.length > 0) return "revoked";
  const [row] = await db.all<{ revoked_at: string | null }>(OWNED_KEY_SQL, [keyId, accountId]);
  return row === undefined ? "not-yours" : "already-revoked";
}

/** Revoke every live key the account owns. */
export const REVOKE_ACCOUNT_KEYS_SQL = `UPDATE api_key SET revoked_at = ?
     WHERE owner_account_id = ? AND revoked_at IS NULL RETURNING key_id`;

/**
 * The statement that revokes all the account's live keys, answering one row
 * per key it revoked. A statement rather than a call, so account deletion
 * (src/accounts/accounts.ts) runs it in the same transaction as the rest.
 */
export function revokeAllAccountKeys(accountId: number, now: number): Statement {
  return { sql: REVOKE_ACCOUNT_KEYS_SQL, params: [new Date(now).toISOString(), accountId] };
}
