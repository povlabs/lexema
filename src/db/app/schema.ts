// The developer app's own tables (#159, #165, #150): accounts, provider
// identities, sessions, API keys and their usage. They moved here from
// src/db/schema.sql under ADR 0017 (#228), unchanged; that file keeps the
// dictionary tables. drizzle-kit generates the migrations in ./migrations from
// this file (DEVELOPMENT.md).
//
// Every table is STRICT, which Drizzle cannot declare: the generated migration
// is edited by hand to say so, and test/appSchema.test.ts holds each table to
// the shape schema.sql gave it.

import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Developer accounts (#159, #165)
// ---------------------------------------------------------------------------

/**
 * A person signed in to developers.lexema.fyi (src/accounts/accounts.ts). It
 * holds no name and no email of its own: who it is lives in its provider
 * identities, so deleting those leaves a row with nothing personal in it.
 * A deleted account keeps that row, so its revoked keys and their usage keep
 * an owner (#163 R1.4); `deleted_at` marks it, and it can own no new key.
 */
export const developerAccount = sqliteTable("developer_account", {
  accountId: integer("account_id").primaryKey(),
  createdAt: text("created_at").notNull(), // ISO-8601
  deletedAt: text("deleted_at"), // ISO-8601; NULL while the account is in use
});

/**
 * A Google or GitHub account signed in with, linked to one developer account.
 * `provider_user_id` is the provider's own stable id for the person (Google's
 * `sub`, GitHub's numeric user id), so a changed email still signs in to the
 * same account. `email` is the verified address as it was when the identity was
 * linked, lowercased; a second provider's identity with the same email links to
 * the same account. Only verified emails are ever stored. `display_name` is the
 * name the provider gives the person (Google's `name`, GitHub's `name` or else
 * its `login`), refreshed at each sign-in; NULL when it gives none (#190).
 */
export const providerIdentity = sqliteTable(
  "provider_identity",
  {
    identityId: integer("identity_id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => developerAccount.accountId),
    provider: text("provider", { enum: ["google", "github"] }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    linkedAt: text("linked_at").notNull(), // ISO-8601
  },
  (table) => [
    unique("provider_identity_provider_user").on(table.provider, table.providerUserId),
    index("provider_identity_by_email").on(table.email),
    index("provider_identity_by_account").on(table.accountId),
    check("provider_identity_provider", sql`provider IN ('google', 'github')`),
    check("provider_identity_provider_user_id", sql`length(provider_user_id) > 0`),
    check("provider_identity_email", sql`email = lower(email) AND email LIKE '%_@_%'`),
    check("provider_identity_display_name", sql`display_name IS NULL OR length(trim(display_name)) > 0`),
  ],
);

/**
 * A signed-in browser. The cookie carries a random id; only its SHA-256 is
 * stored, so the table cannot sign anyone in (src/accounts/sessions.ts).
 * Sign-out deletes the row; expired rows are swept when a session is made.
 */
export const developerSession = sqliteTable(
  "developer_session",
  {
    sessionHash: text("session_hash").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => developerAccount.accountId),
    createdAt: text("created_at").notNull(), // ISO-8601
    expiresAt: text("expires_at").notNull(), // ISO-8601
  },
  (table) => [
    index("developer_session_by_expiry").on(table.expiresAt),
    index("developer_session_by_account").on(table.accountId),
    check("developer_session_hash", sql`length(session_hash) = 64`),
  ],
);

// ---------------------------------------------------------------------------
// API keys and usage (#150)
// ---------------------------------------------------------------------------

/**
 * A key that may call the JSON API at api.lexema.fyi/v1 (src/api/keys.ts). Only
 * the SHA-256 of the key is stored, never the key: it is shown once, when it is
 * created. Its calls are recorded per day in api_key_usage, and its requests a
 * minute are counted in api_key_minute. A revoked key stays, so its usage keeps
 * its owner.
 *
 * `per_minute_limit` is an admin key's own limit, set with the CLI. An owned
 * key has none: its rate is its account's (#161), so the table CHECK below makes
 * the limit present exactly when `owner_account_id` is NULL.
 *
 * `owner_account_id` is the developer account that made the key in the
 * dashboard (an owned key, src/api/ownedKeys.ts), or NULL for an admin key made
 * with the CLI (src/api/keyCli.ts). `display_prefix` is the key's first
 * characters, stored so a key can be named without its secret (#167).
 * `last_used_at` is stamped each time the key is accepted.
 *
 * `endpoints` and `expires_at` are what the key may reach and until when
 * (#187, src/api/keyAccess.ts). `endpoints` is NULL for every endpoint, or a
 * JSON array of the endpoints it may call, never empty. `expires_at` is NULL
 * for a key that never expires; from that moment the key is refused. A key
 * made before #187 has both NULL: every endpoint, never expiring.
 */
export const apiKey = sqliteTable(
  "api_key",
  {
    keyId: integer("key_id").primaryKey(),
    keyHash: text("key_hash").notNull().unique(),
    label: text("label").notNull(),
    perMinuteLimit: integer("per_minute_limit"), // NULL for an owned key
    createdAt: text("created_at").notNull(), // ISO-8601
    revokedAt: text("revoked_at"), // ISO-8601; NULL while the key is live
    ownerAccountId: integer("owner_account_id").references(() => developerAccount.accountId),
    displayPrefix: text("display_prefix").notNull(),
    lastUsedAt: text("last_used_at"), // ISO-8601; NULL until the key is first accepted
    endpoints: text("endpoints"),
    expiresAt: text("expires_at"), // ISO-8601; NULL for a key that never expires
  },
  (table) => [
    index("api_key_by_owner").on(table.ownerAccountId),
    check("api_key_hash", sql`length(key_hash) = 64`),
    check("api_key_label", sql`length(label) BETWEEN 1 AND 200`),
    check("api_key_per_minute_limit", sql`per_minute_limit > 0`),
    // `lx_` and 8 hex digits. Spelled without one long GLOB: local D1 refused
    // the 59-byte pattern as "LIKE or GLOB pattern too complex" (#167).
    check(
      "api_key_display_prefix",
      sql`length(display_prefix) = 11 AND display_prefix GLOB 'lx_*' AND substr(display_prefix, 4) NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "api_key_endpoints",
      sql`endpoints IS NULL OR (json_valid(endpoints) AND json_type(endpoints) = 'array' AND json_array_length(endpoints) >= 1)`,
    ),
    check("api_key_owned_or_limited", sql`(owner_account_id IS NULL) = (per_minute_limit IS NOT NULL)`),
  ],
);

/**
 * A key's requests in one minute, `minute` being whole minutes since the epoch.
 * One upsert counts a request and returns the count (src/api/usage.ts); the
 * key's finished minutes are deleted when its next minute starts.
 */
export const apiKeyMinute = sqliteTable(
  "api_key_minute",
  {
    keyId: integer("key_id")
      .notNull()
      .references(() => apiKey.keyId),
    minute: integer("minute").notNull(),
    requests: integer("requests").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyId, table.minute] }),
    check("api_key_minute_requests", sql`requests > 0`),
  ],
);

/** A key's calls in one UTC day, counted as src/api/calls.ts counts them. */
export const apiKeyUsage = sqliteTable(
  "api_key_usage",
  {
    keyId: integer("key_id")
      .notNull()
      .references(() => apiKey.keyId),
    day: text("day").notNull(),
    calls: integer("calls").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyId, table.day] }),
    check("api_key_usage_day", sql`day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
    check("api_key_usage_calls", sql`calls >= 0`),
  ],
);
