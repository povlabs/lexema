-- The six app tables exactly as src/db/schema.sql defined them at 4921898,
-- before they moved to Drizzle (#228). test/appSchema.test.ts holds the
-- migrated tables to this shape. A reference only: nothing applies it.

-- ---------------------------------------------------------------------------
-- API keys and usage (#150)
-- ---------------------------------------------------------------------------

-- A key that may call the JSON API at api.lexema.fyi/v1 (src/api/keys.ts). Only the
-- SHA-256 of the key is stored, never the key: it is shown once, when it is
-- created. Its calls are recorded per day in api_key_usage, and its requests a
-- minute are counted in api_key_minute. A revoked key stays, so its usage keeps
-- its owner.
--
-- `per_minute_limit` is an admin key's own limit, set with the CLI. An owned
-- key has none: its rate is its account's (#161), so the table CHECK below makes
-- the limit present exactly when `owner_account_id` is NULL.
--
-- `owner_account_id` is the developer account that made the key in the
-- dashboard (an owned key, src/api/ownedKeys.ts), or NULL for an admin key made
-- with the CLI (src/api/keyCli.ts). `display_prefix` is the key's first
-- characters, stored so a key can be named without its secret (#167).
-- `last_used_at` is stamped each time the key is accepted.
--
-- `endpoints` and `expires_at` are what the key may reach and until when
-- (#187, src/api/keyAccess.ts). `endpoints` is NULL for every endpoint, or a
-- JSON array of the endpoints it may call, never empty. `expires_at` is NULL
-- for a key that never expires; from that moment the key is refused. A key
-- made before #187 has both NULL: every endpoint, never expiring.
CREATE TABLE api_key (
  key_id           INTEGER PRIMARY KEY,
  key_hash         TEXT    NOT NULL UNIQUE CHECK (length(key_hash) = 64),
  label            TEXT    NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  per_minute_limit INTEGER CHECK (per_minute_limit > 0),  -- NULL for an owned key
  created_at       TEXT    NOT NULL,  -- ISO-8601
  revoked_at       TEXT,              -- ISO-8601; NULL while the key is live
  owner_account_id INTEGER REFERENCES developer_account(account_id),
  -- `lx_` and 8 hex digits. Spelled without one long GLOB: local D1 refused
  -- the 59-byte pattern as "LIKE or GLOB pattern too complex" (#167).
  display_prefix   TEXT    NOT NULL CHECK (length(display_prefix) = 11 AND display_prefix GLOB 'lx_*'
                                           AND substr(display_prefix, 4) NOT GLOB '*[^0-9a-f]*'),
  last_used_at     TEXT,              -- ISO-8601; NULL until the key is first accepted
  endpoints        TEXT    CHECK (endpoints IS NULL OR (json_valid(endpoints) AND json_type(endpoints) = 'array'
                                                        AND json_array_length(endpoints) >= 1)),
  expires_at       TEXT,              -- ISO-8601; NULL for a key that never expires
  CHECK ((owner_account_id IS NULL) = (per_minute_limit IS NOT NULL))
) STRICT;

CREATE INDEX api_key_by_owner ON api_key (owner_account_id);

-- A key's requests in one minute, `minute` being whole minutes since the epoch.
-- One upsert counts a request and returns the count (src/api/usage.ts); the
-- key's finished minutes are deleted when its next minute starts.
CREATE TABLE api_key_minute (
  key_id   INTEGER NOT NULL REFERENCES api_key(key_id),
  minute   INTEGER NOT NULL,
  requests INTEGER NOT NULL CHECK (requests > 0),
  PRIMARY KEY (key_id, minute)
) STRICT;

-- A key's calls in one UTC day, counted as src/api/calls.ts counts them.
CREATE TABLE api_key_usage (
  key_id INTEGER NOT NULL REFERENCES api_key(key_id),
  day    TEXT    NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  calls  INTEGER NOT NULL CHECK (calls >= 0),
  PRIMARY KEY (key_id, day)
) STRICT;


-- ---------------------------------------------------------------------------
-- Developer accounts (#159, #165)
-- ---------------------------------------------------------------------------

-- A person signed in to developers.lexema.fyi (src/accounts/accounts.ts). It
-- holds no name and no email of its own: who it is lives in its provider
-- identities, so deleting those leaves a row with nothing personal in it.
-- A deleted account keeps that row, so its revoked keys and their usage keep
-- an owner (#163 R1.4); `deleted_at` marks it, and it can own no new key.
CREATE TABLE developer_account (
  account_id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,     -- ISO-8601
  deleted_at TEXT               -- ISO-8601; NULL while the account is in use
) STRICT;

-- A Google or GitHub account signed in with, linked to one developer account.
-- `provider_user_id` is the provider's own stable id for the person (Google's
-- `sub`, GitHub's numeric user id), so a changed email still signs in to the
-- same account. `email` is the verified address as it was when the identity was
-- linked, lowercased; a second provider's identity with the same email links to
-- the same account. Only verified emails are ever stored. `display_name` is the
-- name the provider gives the person (Google's `name`, GitHub's `name` or else
-- its `login`), refreshed at each sign-in; NULL when it gives none (#190).
CREATE TABLE provider_identity (
  identity_id      INTEGER PRIMARY KEY,
  account_id       INTEGER NOT NULL REFERENCES developer_account(account_id),
  provider         TEXT    NOT NULL CHECK (provider IN ('google', 'github')),
  provider_user_id TEXT    NOT NULL CHECK (length(provider_user_id) > 0),
  email            TEXT    NOT NULL CHECK (email = lower(email) AND email LIKE '%_@_%'),
  display_name     TEXT    CHECK (display_name IS NULL OR length(trim(display_name)) > 0),
  linked_at        TEXT    NOT NULL, -- ISO-8601
  UNIQUE (provider, provider_user_id)
) STRICT;

CREATE INDEX provider_identity_by_email ON provider_identity (email);
CREATE INDEX provider_identity_by_account ON provider_identity (account_id);

-- A signed-in browser. The cookie carries a random id; only its SHA-256 is
-- stored, so the table cannot sign anyone in (src/accounts/sessions.ts).
-- Sign-out deletes the row; expired rows are swept when a session is made.
CREATE TABLE developer_session (
  session_hash TEXT    PRIMARY KEY CHECK (length(session_hash) = 64),
  account_id   INTEGER NOT NULL REFERENCES developer_account(account_id),
  created_at   TEXT    NOT NULL,  -- ISO-8601
  expires_at   TEXT    NOT NULL   -- ISO-8601
) STRICT;

CREATE INDEX developer_session_by_expiry ON developer_session (expires_at);
CREATE INDEX developer_session_by_account ON developer_session (account_id);
