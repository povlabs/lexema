// A developer account's own API keys (#167): list them, make a named one, and
// revoke one, for the dashboard on developers.lexema.fyi.
//
// An owned key is an `api_key` row whose `owner_account_id` is the account; an
// admin key, made with the CLI, has none and is never reached from here. Every
// statement names the account, so one account can neither read nor revoke
// another's keys. A dashboard key carries no limit of its own, its rate being
// its account's (#161), and there is no cap on how many an account holds. Its endpoints and expiry are
// the developer's choice (#187, ./keyAccess.ts).

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase, AppTables } from "../db/app/database.js";
import { apiKey, developerAccount } from "../db/app/schema.js";
import { endpointsColumn, endpointsOfColumn, OPEN_ACCESS, type EndpointScope, type KeyAccess } from "./keyAccess.js";
import { displayPrefix, generateApiKey, hashApiKey, type NewKey } from "./keys.js";

/** The longest name a key may have: the `label` check in src/db/app/schema.ts. */
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
export const accountKeysQuery = (db: AppDatabase, accountId: number) =>
  db
    .select({
      keyId: apiKey.keyId,
      name: apiKey.label,
      displayPrefix: apiKey.displayPrefix,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
      revokedAt: apiKey.revokedAt,
      endpoints: apiKey.endpoints,
      expiresAt: apiKey.expiresAt,
    })
    .from(apiKey)
    .where(eq(apiKey.ownerAccountId, accountId))
    .orderBy(desc(apiKey.keyId));

/** Every key the account owns, live and revoked. */
export async function listAccountKeys(db: AppTables, accountId: number): Promise<OwnedKey[]> {
  const rows = await accountKeysQuery(db.app, accountId);
  return rows.map((row) => ({ ...row, endpoints: endpointsOfColumn(row.endpoints) }));
}

/** What a new owned key is stored with, beside its owner. */
interface OwnedKeyRow {
  hash: string;
  name: KeyName;
  createdAt: string;
  displayPrefix: string;
  access: KeyAccess;
}

/**
 * A new key owned by the account, stored only if the account exists and is
 * not deleted: the row comes from the account's own, so no read can go stale
 * between the check and the insert. Drizzle's insert-select names every
 * column, in the table's order.
 */
export const insertOwnedKeyQuery = (db: AppDatabase, accountId: number, row: OwnedKeyRow) =>
  db
    .insert(apiKey)
    .select(
      db
        .select({
          keyId: sql<number | null>`null`.as("key_id"),
          keyHash: sql<string>`${row.hash}`.as("key_hash"),
          label: sql<string>`${row.name}`.as("label"),
          perMinuteLimit: sql<number | null>`null`.as("per_minute_limit"),
          createdAt: sql<string>`${row.createdAt}`.as("created_at"),
          revokedAt: sql<string | null>`null`.as("revoked_at"),
          ownerAccountId: developerAccount.id,
          displayPrefix: sql<string>`${row.displayPrefix}`.as("display_prefix"),
          lastUsedAt: sql<string | null>`null`.as("last_used_at"),
          endpoints: sql<string | null>`${endpointsColumn(row.access.endpoints)}`.as("endpoints"),
          expiresAt: sql<string | null>`${row.access.expiresAt}`.as("expires_at"),
        })
        .from(developerAccount)
        .where(and(eq(developerAccount.id, accountId), isNull(developerAccount.deletedAt))),
    )
    .returning({ keyId: apiKey.keyId });

export type OwnedKeyCreation = ({ outcome: "created" } & NewKey) | { outcome: "refused"; refusal: "no-account" };

/**
 * Make a named key for the account, with no limit of its own and the access
 * asked for: every endpoint and no expiry unless told otherwise. The returned
 * `key` is the only time it exists in the clear.
 */
export async function createAccountKey(
  db: AppTables,
  accountId: number,
  name: KeyName,
  now: number,
  access: KeyAccess = OPEN_ACCESS,
): Promise<OwnedKeyCreation> {
  const key = generateApiKey();
  const [row] = await insertOwnedKeyQuery(db.app, accountId, {
    hash: await hashApiKey(key),
    name,
    createdAt: new Date(now).toISOString(),
    displayPrefix: displayPrefix(key),
    access,
  });
  if (row === undefined) return { outcome: "refused", refusal: "no-account" };
  return { outcome: "created", keyId: row.keyId, key, displayPrefix: displayPrefix(key) };
}

/** Revoke one live key, only when the account owns it. */
export const revokeOwnedKeyQuery = (db: AppDatabase, accountId: number, keyId: number, at: string) =>
  db
    .update(apiKey)
    .set({ revokedAt: at })
    .where(and(eq(apiKey.keyId, keyId), eq(apiKey.ownerAccountId, accountId), isNull(apiKey.revokedAt)))
    .returning({ keyId: apiKey.keyId });

/** The account's key with this id, if it owns one. */
export const ownedKeyQuery = (db: AppDatabase, accountId: number, keyId: number) =>
  db
    .select({ revokedAt: apiKey.revokedAt })
    .from(apiKey)
    .where(and(eq(apiKey.keyId, keyId), eq(apiKey.ownerAccountId, accountId)));

/**
 * - `revoked`: the key was live and is revoked now.
 * - `already-revoked`: the account's key was revoked before.
 * - `not-yours`: no key of this account has that id. Another account's key, an
 *   admin key and a key that does not exist read alike, so the answer says
 *   nothing about keys the account does not own.
 */
export type OwnedKeyRevocation = "revoked" | "already-revoked" | "not-yours";

/** Revoke one of the account's own keys. Any other key is refused and left as it was. */
export async function revokeAccountKey(db: AppTables, accountId: number, keyId: number, now: number): Promise<OwnedKeyRevocation> {
  const revoked = await revokeOwnedKeyQuery(db.app, accountId, keyId, new Date(now).toISOString());
  if (revoked.length > 0) return "revoked";
  const [row] = await ownedKeyQuery(db.app, accountId, keyId);
  return row === undefined ? "not-yours" : "already-revoked";
}

/**
 * The statement that revokes every live key the account owns, answering one
 * row per key it revoked. A statement rather than a call, so account deletion
 * (src/accounts/accounts.ts) runs it in the same batch as the rest.
 */
export const revokeAllAccountKeys = (db: AppDatabase, accountId: number, now: number) =>
  db
    .update(apiKey)
    .set({ revokedAt: new Date(now).toISOString() })
    .where(and(eq(apiKey.ownerAccountId, accountId), isNull(apiKey.revokedAt)))
    .returning({ keyId: apiKey.keyId });
