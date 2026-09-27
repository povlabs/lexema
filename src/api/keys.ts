// API keys (#150): who may call the API, and with what limits.
//
// A key is shown once, when it is created, and stored only as its SHA-256, so
// the table cannot give a key back. Each key carries its own per-minute
// request limit and daily unit allowance (Huey, #148: the limit is stored on
// the key, and counted in D1 rather than with the Worker's rate-limit binding).
// Keys are created and revoked with the CLI in src/api/keyCli.ts; there is no
// self-serve signup.

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

/** The key named by its hash: the unique index on `key_hash`. */
export const KEY_BY_HASH_SQL = `SELECT key_id, label, per_minute_limit, daily_units, revoked_at
       FROM api_key WHERE key_hash = ?`;

/** The `X-API-Key` a request presented, checked against the stored hashes. */
export async function authenticate(db: LookupDatabase, presented: string | null): Promise<Authentication> {
  const key = presented?.trim() ?? "";
  if (key === "") return { outcome: "refused", refusal: "missing" };
  const [row] = await db.all<{
    key_id: number;
    label: string;
    per_minute_limit: number;
    daily_units: number;
    revoked_at: string | null;
  }>(KEY_BY_HASH_SQL, [await hashApiKey(key)]);
  if (row === undefined) return { outcome: "refused", refusal: "unknown" };
  if (row.revoked_at !== null) return { outcome: "refused", refusal: "revoked" };
  return {
    outcome: "accepted",
    key: { keyId: row.key_id, label: row.label, perMinuteLimit: row.per_minute_limit, dailyUnits: row.daily_units },
  };
}

/** What a new key is given. */
export interface KeyGrant {
  label: string;
  perMinuteLimit: number;
  dailyUnits: number;
}

export const INSERT_KEY_SQL = `INSERT INTO api_key (key_hash, label, per_minute_limit, daily_units, created_at)
     VALUES (?, ?, ?, ?, ?) RETURNING key_id`;

/**
 * Store a new key and return it. The returned `key` is the only time it exists
 * in the clear: the row holds its hash.
 */
export async function createKey(db: LookupDatabase, grant: KeyGrant, now: number): Promise<{ keyId: number; key: string }> {
  const key = generateApiKey();
  const [row] = await db.all<{ key_id: number }>(INSERT_KEY_SQL, [
    await hashApiKey(key),
    grant.label,
    grant.perMinuteLimit,
    grant.dailyUnits,
    new Date(now).toISOString(),
  ]);
  if (row === undefined) throw new Error("the new key was not stored");
  return { keyId: row.key_id, key };
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
