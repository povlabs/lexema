// The developer app's own tables (#159, #165, #150): accounts, provider
// identities, sessions, API keys and their usage. They moved here from
// src/db/schema.sql under ADR 0017 (#228); that file keeps the dictionary
// tables. drizzle-kit generates the migrations in ./migrations from this file
// (DEVELOPMENT.md).
//
// The account, identity and session tables, and `verification`, are
// better-auth's (#229): `pnpm dlx auth@1.7.6 generate --adapter drizzle
// --dialect sqlite` wrote their columns, and they are brought in here under
// Lexema's table and column names. Each property is better-auth's field name,
// so better-auth's Drizzle adapter reads and writes them with no field mapping
// (src/accounts/auth.ts); the SQL names are ours, so the raw SQL of the key and
// deletion code reads them as before.
//
// Every table is STRICT, which Drizzle cannot declare: the generated migrations
// are edited by hand to say so, and test/appSchema.test.ts holds each table to
// its shape.

import { sql } from "drizzle-orm";
import { check, customType, index, integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * A moment, stored as ISO-8601 text like every other time in these tables and
 * read back as a `Date`, which is how better-auth hands times over.
 */
const moment = customType<{ data: Date; driverData: string }>({
  dataType: () => "text",
  toDriver: (value) => value.toISOString(),
  fromDriver: (value) => new Date(value),
});

// ---------------------------------------------------------------------------
// Developer accounts, sign-in and sessions (#159, #165, #229)
// ---------------------------------------------------------------------------

/**
 * A person signed in to developers.lexema.fyi: better-auth's user. It carries
 * the verified email it was made with, which a second provider's sign-in links
 * by, and the name the first provider gave. Who the account menu names lives in
 * its provider identities (src/accounts/accounts.ts).
 *
 * A deleted account keeps its row, so its revoked keys and their usage keep an
 * owner (#163 R1.4): `deleted_at` marks it, its email and name are replaced by
 * values that say nothing about the person, and it can own no new key.
 * `image` is better-auth's column for a provider's picture; Lexema keeps none.
 */
export const developerAccount = sqliteTable(
  "developer_account",
  {
    id: integer("account_id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
    image: text("image"),
    createdAt: moment("created_at").notNull(),
    updatedAt: moment("updated_at").notNull(),
    deletedAt: moment("deleted_at"), // NULL while the account is in use
  },
  () => [
    check("developer_account_email", sql`email = lower(email) AND email LIKE '%_@_%'`),
    check("developer_account_email_verified", sql`email_verified = 1`),
    check("developer_account_image", sql`image IS NULL`),
  ],
);

/**
 * A Google or GitHub account signed in with, linked to one developer account:
 * better-auth's account. `provider_user_id` is the provider's own stable id for
 * the person (Google's `sub`, GitHub's numeric user id), so a changed email
 * still signs in to the same account. `email` is the verified address as it was
 * when the identity was linked, lowercased. `display_name` is the name the
 * provider gives the person (Google's `name`, GitHub's `name` or else its
 * `login`), refreshed at each sign-in; NULL when it gives none (#190).
 *
 * better-auth's columns for a provider's tokens and a password stay empty:
 * Lexema calls no provider after sign-in and has no passwords.
 */
export const providerIdentity = sqliteTable(
  "provider_identity",
  {
    id: integer("identity_id").primaryKey(),
    userId: integer("account_id")
      .notNull()
      .references(() => developerAccount.id),
    providerId: text("provider", { enum: ["google", "github"] }).notNull(),
    accountId: text("provider_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    createdAt: moment("linked_at").notNull(),
    updatedAt: moment("updated_at").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: moment("access_token_expires_at"),
    refreshTokenExpiresAt: moment("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
  },
  (table) => [
    unique("provider_identity_provider_user").on(table.providerId, table.accountId),
    index("provider_identity_by_account").on(table.userId),
    check("provider_identity_provider", sql`provider IN ('google', 'github')`),
    check("provider_identity_provider_user_id", sql`length(provider_user_id) > 0`),
    check("provider_identity_email", sql`email = lower(email) AND email LIKE '%_@_%'`),
    check("provider_identity_display_name", sql`display_name IS NULL OR length(trim(display_name)) > 0`),
    check(
      "provider_identity_no_credentials",
      sql`access_token IS NULL AND refresh_token IS NULL AND id_token IS NULL AND access_token_expires_at IS NULL AND refresh_token_expires_at IS NULL AND scope IS NULL AND password IS NULL`,
    ),
  ],
);

/**
 * A signed-in browser: better-auth's session. The cookie carries `token`,
 * signed with `BETTER_AUTH_SECRET`, so the token alone signs nobody in (ADR
 * 0017). Sign-out and account deletion delete the row; expired rows are swept
 * when a sign-in finishes. better-auth's columns for the browser's address and
 * user agent stay empty: a session records neither.
 */
export const developerSession = sqliteTable(
  "developer_session",
  {
    id: integer("session_id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: integer("account_id")
      .notNull()
      .references(() => developerAccount.id),
    expiresAt: moment("expires_at").notNull(),
    createdAt: moment("created_at").notNull(),
    updatedAt: moment("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("developer_session_by_expiry").on(table.expiresAt),
    index("developer_session_by_account").on(table.userId),
    check("developer_session_client", sql`ip_address IS NULL AND user_agent IS NULL`),
  ],
);

/**
 * A sign-in on its way to a provider: better-auth's verification value, keyed
 * by the OAuth `state` and holding the PKCE verifier. The callback deletes it;
 * one that never comes back expires after ten minutes and is swept when a
 * sign-in finishes.
 */
export const verification = sqliteTable(
  "verification",
  {
    id: integer("verification_id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: moment("expires_at").notNull(),
    createdAt: moment("created_at").notNull(),
    updatedAt: moment("updated_at").notNull(),
  },
  (table) => [index("verification_by_identifier").on(table.identifier), index("verification_by_expiry").on(table.expiresAt)],
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
    ownerAccountId: integer("owner_account_id").references(() => developerAccount.id),
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
