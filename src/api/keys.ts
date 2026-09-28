// API keys (#150): who may call the API, and with what limits.
//
// A key is shown once, when it is created, and stored only as its SHA-256, so
// the table cannot give a key back. Each key carries its own per-minute
// request limit and daily unit allowance (Huey, #148: the limit is stored on
// the key, and counted in D1 rather than with the Worker's rate-limit binding).
// An admin key is made and revoked with the CLI in src/api/keyCli.ts and has
// no owner; an owned key is made by a developer account in the dashboard
// (src/api/ownedKeys.ts). Both are this one kind of row, answered the same way.

import type { LookupDatabase } from "../lookup/database.js";

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
 * The limits every key gets unless it is given its own: 60 requests a minute
 * and 20,000 units a day, the values the CLI is documented with (#163 R1.1).
 * A dashboard key always has these.
 */
export const DEFAULT_KEY_LIMITS = { perMinuteLimit: 60, dailyUnits: 20_000 } as const;

/** A key that may call the API, and its limits. */
export interface ApiKey {
  keyId: number;
  label: string;
  /** Requests it may make in one minute. */
  perMinuteLimit: number;
  /** Units it may use in one day. Stored for plans; nothing enforces it yet. */
  dailyUnits: number;
}

/** Why a request's key was refused. */
export type KeyRefusal = "missing" | "unknown" | "revoked";

export type Authentication = { outcome: "accepted"; key: ApiKey } | { outcome: "refused"; refusal: KeyRefusal };

/**
 * Accept a live key by its hash and stamp when it was used, in one statement
 * through the unique index on `key_hash`. No row means unknown or revoked.
 */
export const ACCEPT_KEY_SQL = `UPDATE api_key SET last_used_at = ? WHERE key_hash = ? AND revoked_at IS NULL
     RETURNING key_id, label, per_minute_limit, daily_units`;

/** The key named by its hash: the unique index on `key_hash`. */
export const KEY_BY_HASH_SQL = `SELECT key_id FROM api_key WHERE key_hash = ?`;

/** The `X-API-Key` a request presented, checked against the stored hashes; an accepted key's `last_used_at` becomes `now`. */
export async function authenticate(db: LookupDatabase, presented: string | null, now: number): Promise<Authentication> {
  const key = presented?.trim() ?? "";
  if (key === "") return { outcome: "refused", refusal: "missing" };
  const hash = await hashApiKey(key);
  const [row] = await db.all<{ key_id: number; label: string; per_minute_limit: number; daily_units: number }>(ACCEPT_KEY_SQL, [
    new Date(now).toISOString(),
    hash,
  ]);
  if (row !== undefined) {
    return {
      outcome: "accepted",
      key: { keyId: row.key_id, label: row.label, perMinuteLimit: row.per_minute_limit, dailyUnits: row.daily_units },
    };
  }
  const [stored] = await db.all<{ key_id: number }>(KEY_BY_HASH_SQL, [hash]);
  return { outcome: "refused", refusal: stored === undefined ? "unknown" : "revoked" };
}

/** What a new key is given. */
export interface KeyGrant {
  label: string;
  perMinuteLimit: number;
  dailyUnits: number;
}

/** A key just made: the only time `key` exists in the clear. */
export interface NewKey {
  keyId: number;
  key: string;
  displayPrefix: string;
}

export const INSERT_KEY_SQL = `INSERT INTO api_key (key_hash, label, per_minute_limit, daily_units, created_at, display_prefix)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING key_id`;

/** Store a new admin key, one with no owner, and return it. The row holds its hash. */
export async function createKey(db: LookupDatabase, grant: KeyGrant, now: number): Promise<NewKey> {
  const key = generateApiKey();
  const [row] = await db.all<{ key_id: number }>(INSERT_KEY_SQL, [
    await hashApiKey(key),
    grant.label,
    grant.perMinuteLimit,
    grant.dailyUnits,
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
