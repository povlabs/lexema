// API keys (#150): who may call the API, and with what limits.
//
// A key is shown once, when it is created, and stored only as its SHA-256, so
// the table cannot give a key back. An admin key is made and revoked with the
// CLI in src/api/keyCli.ts, has no owner and carries its own per-minute limit
// (Huey, #148). An owned key is made by a developer account in the dashboard
// (src/api/ownedKeys.ts) and carries no limit: its limits are its account's
// plan's (#161), read with the key. Both are this one kind of row. An owned
// key whose account is suspended is refused, and answers again once the
// suspension is lifted (#573, src/accounts/suspension.ts); it is not revoked.

import { and, eq, isNull, lte, or } from "drizzle-orm";
import type { AppDatabase, AppTables } from "../db/app/database.js";
import { apiKey, developerAccount, enterprisePlan, subscription } from "../db/app/schema.js";
import { isSuspended } from "../accounts/suspension.js";
import { planJoins, stateOfPlanRows, type PlanRows } from "../billing/accountPlan.js";
import type { PlanState } from "../billing/plans.js";
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
 * Who holds a key, and so where its limits come from: an admin key carries its
 * own per-minute limit and is outside plans (#200 R1.2), and an owned key takes
 * its account's plan, read with the key (#263).
 */
export type KeyHolder = { kind: "admin"; perMinuteLimit: number } | { kind: "owned"; accountId: number; plan: PlanState };

/** A key that may call the API. */
export interface ApiKey {
  keyId: number;
  label: string;
  holder: KeyHolder;
  /** The endpoints it may call (#187). */
  endpoints: EndpointScope;
}

/** What a presented key is read with. */
const KEY_COLUMNS = {
  keyId: apiKey.keyId,
  label: apiKey.label,
  perMinuteLimit: apiKey.perMinuteLimit,
  ownerAccountId: apiKey.ownerAccountId,
  endpoints: apiKey.endpoints,
  revokedAt: apiKey.revokedAt,
  expiresAt: apiKey.expiresAt,
  lastUsedAt: apiKey.lastUsedAt,
};

interface KeyRow {
  keyId: number;
  label: string;
  perMinuteLimit: number | null;
  ownerAccountId: number | null;
  endpoints: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

/**
 * A stored key's holder. The schema holds `per_minute_limit` exactly when there
 * is no owner, and an admin key's row joins no plan rows.
 */
function holderOf(row: KeyRow & PlanRows): KeyHolder {
  if (row.ownerAccountId !== null) return { kind: "owned", accountId: row.ownerAccountId, plan: stateOfPlanRows(row) };
  if (row.perMinuteLimit === null) throw new Error(`admin key ${row.keyId} has no per-minute limit`);
  return { kind: "admin", perMinuteLimit: row.perMinuteLimit };
}

/**
 * Why a request's key was refused. A key both revoked and expired reads as
 * revoked, and either reads before its account's suspension (#573).
 */
export type KeyRefusal = "missing" | "unknown" | "revoked" | "expired" | "suspended";

export type Authentication = { outcome: "accepted"; key: ApiKey } | { outcome: "refused"; refusal: KeyRefusal };

/**
 * The key a presented one hashes to, through the unique index on `key_hash`,
 * with its owner's plan rows (#263) and suspension (#573) in the same read:
 * none for an admin key.
 */
export const keyByHashQuery = (db: AppDatabase, hash: string) => {
  const joins = planJoins(db, apiKey.ownerAccountId);
  return db
    .select({
      ...KEY_COLUMNS,
      owner: { suspendedAt: developerAccount.suspendedAt, suspensionReason: developerAccount.suspensionReason },
      enterprise: enterprisePlan,
      subscription,
    })
    .from(apiKey)
    .leftJoin(developerAccount, eq(developerAccount.id, apiKey.ownerAccountId))
    .leftJoin(enterprisePlan, joins.enterprise)
    .leftJoin(subscription, joins.subscription)
    .where(eq(apiKey.keyHash, hash));
};

/** The least time between two stamps of a key's `last_used_at`. */
export const LAST_USED_EVERY_MS = 60_000;

/**
 * Stamp a key's last use, unless it was stamped less than a minute ago: the
 * condition is in the statement, so two requests at once stamp it once.
 */
export const stampLastUsedQuery = (db: AppDatabase, keyId: number, at: string, staleBefore: string) =>
  db
    .update(apiKey)
    .set({ lastUsedAt: at })
    .where(and(eq(apiKey.keyId, keyId), or(isNull(apiKey.lastUsedAt), lte(apiKey.lastUsedAt, staleBefore))));

/** Whether a key last used at `lastUsedAt` is stamped again at `now`: at most once a minute. */
export const lastUsedIsStale = (lastUsedAt: string | null, now: number): boolean =>
  lastUsedAt === null || Date.parse(lastUsedAt) <= now - LAST_USED_EVERY_MS;

/**
 * The `X-API-Key` a request presented, checked against the stored hashes in one
 * read, which also reads an owned key's plan state (#263) and whether its
 * account is suspended (#573). A live key is neither revoked nor expired: its
 * `expires_at`, if it has one, is still ahead of now (#187). A live key of a
 * suspended account is refused and its use is not stamped. An accepted key's `last_used_at` becomes
 * `now` when it is more than a minute old, so a key's calls write it at most
 * once a minute (#261).
 */
export async function authenticate(db: AppTables, presented: string | null, now: number): Promise<Authentication> {
  const key = presented?.trim() ?? "";
  if (key === "") return { outcome: "refused", refusal: "missing" };
  const [row] = await keyByHashQuery(db.app, await hashApiKey(key));
  if (row === undefined) return { outcome: "refused", refusal: "unknown" };
  const at = new Date(now).toISOString();
  if (row.revokedAt !== null) return { outcome: "refused", refusal: "revoked" };
  if (row.expiresAt !== null && row.expiresAt <= at) return { outcome: "refused", refusal: "expired" };
  if (row.owner !== null && isSuspended(row.owner)) return { outcome: "refused", refusal: "suspended" };
  if (lastUsedIsStale(row.lastUsedAt, now)) {
    await stampLastUsedQuery(db.app, row.keyId, at, new Date(now - LAST_USED_EVERY_MS).toISOString());
  }
  return {
    outcome: "accepted",
    key: { keyId: row.keyId, label: row.label, holder: holderOf(row), endpoints: endpointsOfColumn(row.endpoints) },
  };
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

/** A new admin key: no owner, and its own per-minute limit. */
export const insertKeyQuery = (db: AppDatabase, hash: string, grant: KeyGrant, at: string, prefix: string) =>
  db
    .insert(apiKey)
    .values({ keyHash: hash, label: grant.label, perMinuteLimit: grant.perMinuteLimit, createdAt: at, displayPrefix: prefix })
    .returning({ keyId: apiKey.keyId });

/** Store a new admin key, one with no owner, and return it. The row holds its hash. */
export async function createKey(db: AppTables, grant: KeyGrant, now: number): Promise<NewKey> {
  const key = generateApiKey();
  const [row] = await insertKeyQuery(db.app, await hashApiKey(key), grant, new Date(now).toISOString(), displayPrefix(key));
  if (row === undefined) throw new Error("the new key was not stored");
  return { keyId: row.keyId, key, displayPrefix: displayPrefix(key) };
}

/** Revoke a live key by its id: its primary key. */
export const revokeKeyQuery = (db: AppDatabase, keyId: number, at: string) =>
  db
    .update(apiKey)
    .set({ revokedAt: at })
    .where(and(eq(apiKey.keyId, keyId), isNull(apiKey.revokedAt)))
    .returning({ keyId: apiKey.keyId });

/** The key with this id: its primary key. */
export const keyByIdQuery = (db: AppDatabase, keyId: number) =>
  db.select({ revokedAt: apiKey.revokedAt }).from(apiKey).where(eq(apiKey.keyId, keyId));

/** Revoke a key by its id. A revoked key stays stored, so its usage keeps its owner. */
export async function revokeKey(db: AppTables, keyId: number, now: number): Promise<"revoked" | "already-revoked" | "unknown"> {
  const revoked = await revokeKeyQuery(db.app, keyId, new Date(now).toISOString());
  if (revoked.length > 0) return "revoked";
  const [row] = await keyByIdQuery(db.app, keyId);
  return row === undefined ? "unknown" : "already-revoked";
}
