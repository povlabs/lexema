// API keys (#150): who may call the API, and with what limits.
//
// A key is shown once, when it is created, and stored only as its SHA-256, so
// the table cannot give a key back. An admin key is made and revoked with the
// CLI in src/api/keyCli.ts, has no owner and carries its own per-minute limit
// (Huey, #148). An owned key is made by a developer account in the dashboard
// (src/api/ownedKeys.ts) and carries no limit: its rate is its account's
// (#161). Both are this one kind of row, answered the same way.

import type { LookupDatabase } from "../lookup/database.js";
import { endpointsOfColumn, type EndpointScope } from "./keyAccess.js";

/** Every key starts with this, so a leaked one is recognisable as Lexema's. */
export const API_KEY_PREFIX = "lx_";

/** A new key: the prefix and 32 random bytes as hex. */
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return API_KEY_PREFIX + hex(bytes);
}

/** A key as it is stored: its SHA-256, as hex. */
export async function hashApiKey(key: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))));
}

const hex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/** How many of a key's characters are kept in the clear: the prefix and 8 hex digits. */
export const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 8;

/**
 * A key's first characters, stored so a key can be named without its secret
 * (#163 R1.6): `lx_7f3a9c1d`. 32 of the key's 256 random bits, so it tells keys
 * apart and gives nothing useful toward guessing one.
 */
export const displayPrefix = (key: string): string => key.slice(0, DISPLAY_PREFIX_LENGTH);

/**
 * An owned key's calls a minute until its account's plan sets its rate (#161):
 * 60, the default Huey ruled for an account with no rate of its own.
 */
export const OWNED_KEY_PER_MINUTE = 60;

/**
 * Who holds a key, and so where its per-minute limit comes from: an admin key
 * carries its own, and an owned key takes its account's.
 */
export type KeyHolder = { kind: "admin"; perMinuteLimit: number } | { kind: "owned"; accountId: number };

/** A key that may call the API. */
export interface ApiKey {
  keyId: number;
  label: string;
  holder: KeyHolder;
  /** The endpoints it may call (#187). */
  endpoints: EndpointScope;
}

/** The calls a key may make in one minute. */
export const perMinuteLimit = (key: ApiKey): number =>
  key.holder.kind === "admin" ? key.holder.perMinuteLimit : OWNED_KEY_PER_MINUTE;

interface KeyRow {
  key_id: number;
  label: string;
  per_minute_limit: number | null;
  owner_account_id: number | null;
  endpoints: string | null;
}

/** A stored key's holder. The schema holds `per_minute_limit` exactly when there is no owner. */
function holderOf(row: KeyRow): KeyHolder {
  if (row.owner_account_id !== null) return { kind: "owned", accountId: row.owner_account_id };
  if (row.per_minute_limit === null) throw new Error(`admin key ${row.key_id} has no per-minute limit`);
  return { kind: "admin", perMinuteLimit: row.per_minute_limit };
}

/** Why a request's key was refused. A key both revoked and expired reads as revoked. */
export type KeyRefusal = "missing" | "unknown" | "revoked" | "expired";

export type Authentication = { outcome: "accepted"; key: ApiKey } | { outcome: "refused"; refusal: KeyRefusal };

/**
 * Accept a live key by its hash and stamp when it was used, in one statement
 * through the unique index on `key_hash`. A live key is neither revoked nor
 * expired: its `expires_at`, if it has one, is still ahead of now (#187). No
 * row means unknown, revoked or expired.
 */
export const ACCEPT_KEY_SQL = `UPDATE api_key SET last_used_at = ?
     WHERE key_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
     RETURNING key_id, label, per_minute_limit, owner_account_id, endpoints`;

/** The key named by its hash: the unique index on `key_hash`. */
export const KEY_BY_HASH_SQL = `SELECT revoked_at FROM api_key WHERE key_hash = ?`;

/** The `X-API-Key` a request presented, checked against the stored hashes; an accepted key's `last_used_at` becomes `now`. */
export async function authenticate(db: LookupDatabase, presented: string | null, now: number): Promise<Authentication> {
  const key = presented?.trim() ?? "";
  if (key === "") return { outcome: "refused", refusal: "missing" };
  const hash = await hashApiKey(key);
  const at = new Date(now).toISOString();
  const [row] = await db.all<KeyRow>(ACCEPT_KEY_SQL, [at, hash, at]);
  if (row !== undefined) {
    return {
      outcome: "accepted",
      key: { keyId: row.key_id, label: row.label, holder: holderOf(row), endpoints: endpointsOfColumn(row.endpoints) },
    };
  }
  // Not accepted, yet stored: revoked, or else past its expiry.
  const [stored] = await db.all<{ revoked_at: string | null }>(KEY_BY_HASH_SQL, [hash]);
  if (stored === undefined) return { outcome: "refused", refusal: "unknown" };
  return { outcome: "refused", refusal: stored.revoked_at === null ? "expired" : "revoked" };
}

/** What a new admin key is given. */
export interface KeyGrant {
  label: string;
  perMinuteLimit: number;
}

/** A key just made: the only time `key` exists in the clear. */
export interface NewKey {
  keyId: number;
  key: string;
  displayPrefix: string;
}

export const INSERT_KEY_SQL = `INSERT INTO api_key (key_hash, label, per_minute_limit, created_at, display_prefix)
     VALUES (?, ?, ?, ?, ?) RETURNING key_id`;

/** Store a new admin key, one with no owner, and return it. The row holds its hash. */
export async function createKey(db: LookupDatabase, grant: KeyGrant, now: number): Promise<NewKey> {
  const key = generateApiKey();
  const [row] = await db.all<{ key_id: number }>(INSERT_KEY_SQL, [
    await hashApiKey(key),
    grant.label,
    grant.perMinuteLimit,
    new Date(now).toISOString(),
    displayPrefix(key),
  ]);
  if (row === undefined) throw new Error("the new key was not stored");
  return { keyId: row.key_id, key, displayPrefix: displayPrefix(key) };
}

export const REVOKE_KEY_SQL = `UPDATE api_key SET revoked_at = ? WHERE key_id = ? AND revoked_at IS NULL RETURNING key_id`;
export const KEY_BY_ID_SQL = `SELECT revoked_at FROM api_key WHERE key_id = ?`;

/** Revoke a key by its id. A revoked key stays stored, so its usage keeps its owner. */
export async function revokeKey(db: LookupDatabase, keyId: number, now: number): Promise<"revoked" | "already-revoked" | "unknown"> {
  const revoked = await db.all<{ key_id: number }>(REVOKE_KEY_SQL, [new Date(now).toISOString(), keyId]);
  if (revoked.length > 0) return "revoked";
  const [row] = await db.all<{ revoked_at: string | null }>(KEY_BY_ID_SQL, [keyId]);
  return row === undefined ? "unknown" : "already-revoked";
}
