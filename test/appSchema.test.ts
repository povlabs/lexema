// The six app tables moved from src/db/schema.sql into Drizzle (#228) with no
// change in shape. The key tables are held to the tables as they stood before
// the move (fixtures/app-tables-before-drizzle.sql), read back through SQLite's
// own pragmas, so what is compared is what the database built, not the SQL text.
// The account, identity and session tables then became better-auth's (#229),
// with its `verification` beside them; each is held to its columns here. The
// reader-report tables moved off the dictionary into the app database (#240,
// ADR 0018), also with no change in shape
// (fixtures/report-tables-before-app-db.sql). The plan tables came with #260:
// the Stripe plugin's `subscription` and Lexema's `enterprise_plan`, and
// `plan_notice` with #215. `reader_report` then gained the reading's source
// line and a person's answer (#12); every column it had stays as it was.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { STRIPE_STATUSES } from "../src/billing/plans.js";
import { appMigrationFiles, applyAppMigrations } from "../src/db/app/migrations.js";

const file = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

/** The key tables, unchanged since the move. */
const KEY_TABLES = ["api_key", "api_key_minute", "api_key_usage"] as const;
/** better-auth's tables, under Lexema's names (#229). */
const AUTH_TABLES = ["developer_account", "provider_identity", "developer_session", "verification"] as const;
/** The reader-report tables, moved in #240; `reader_report` widened by #12. */
const REPORT_TABLES = ["reader_report", "report_opening"] as const;
/** The plan tables (#260), and what each account was last emailed about its plan (#215). */
const PLAN_TABLES = ["subscription", "enterprise_plan", "plan_notice"] as const;
/** The Radar items a suspension added (#573). */
const SUSPENSION_TABLES = ["suspension_card_block"] as const;
const APP_TABLES = [...AUTH_TABLES, ...KEY_TABLES, ...REPORT_TABLES, ...PLAN_TABLES, ...SUSPENSION_TABLES] as const;

type Row = Record<string, unknown>;

const rows = (db: DatabaseSync, sql: string): Row[] => db.prepare(sql).all().map((row) => ({ ...row }));

/**
 * Each CHECK in a table's stored DDL, whitespace and identifier quotes
 * normalised, sorted. Column-level and table-level checks enforce the same
 * thing, so where one is written is not part of the shape.
 */
function checksOf(ddl: string): string[] {
  const text = ddl.replace(/--[^\n]*/g, "");
  const checks: string[] = [];
  const keyword = /\bCHECK\s*\(/gi;
  for (let match = keyword.exec(text); match !== null; match = keyword.exec(text)) {
    let depth = 1;
    let at = keyword.lastIndex;
    let quoted = false;
    for (; depth > 0; at += 1) {
      const char = text[at];
      if (char === "'") quoted = !quoted;
      else if (!quoted && char === "(") depth += 1;
      else if (!quoted && char === ")") depth -= 1;
    }
    checks.push(
      text
        .slice(keyword.lastIndex, at - 1)
        .replace(/[`"]/g, "")
        .replace(/\s+/g, " ")
        .replace(/\( /g, "(")
        .replace(/ \)/g, ")")
        .trim(),
    );
  }
  return checks.sort();
}

/** Everything SQLite reports about one table that a query or a write can tell apart. */
function shape(db: DatabaseSync, table: string) {
  const [ddl] = rows(db, `SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = '${table}'`);
  assert.ok(ddl !== undefined, `${table} exists`);
  return {
    table: rows(db, `PRAGMA table_list(${table})`).map(({ type, ncol, wr, strict }) => ({ type, ncol, wr, strict })),
    // The declared type's spelling (`TEXT` or `text`) is not part of the type.
    columns: rows(db, `PRAGMA table_xinfo(${table})`).map((column) => ({ ...column, type: String(column.type).toUpperCase() })),
    indexes: rows(db, `PRAGMA index_list(${table})`)
      .map(({ name, unique, origin, partial }) => ({
        name,
        unique,
        origin,
        partial,
        columns: rows(db, `PRAGMA index_xinfo(${String(name)})`),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    foreignKeys: rows(db, `PRAGMA foreign_key_list(${table})`),
    checks: checksOf(String(ddl.sql)),
  };
}

function before(reference = "fixtures/app-tables-before-drizzle.sql"): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(file(reference));
  return db;
}

/** The app database as `APP_DB` is built: the migrations over an empty one. */
function migrated(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  applyAppMigrations(db);
  return db;
}

test("src/db/schema.sql defines none of the app tables", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(file("src/db/schema.sql"));
  const present = rows(db, "SELECT name FROM sqlite_schema WHERE type = 'table'").map(({ name }) => name);
  for (const table of APP_TABLES) assert.ok(!present.includes(table), `${table} is still in schema.sql`);
});

test("the migrations build every key table in the shape schema.sql gave it", () => {
  const reference = before();
  const db = migrated();
  for (const table of KEY_TABLES) assert.deepEqual(shape(db, table), shape(reference, table), table);
});

/** The columns #12 added to `reader_report`. */
const REPORT_REVIEW_COLUMNS = ["line_no", "line_sha256", "outcome", "reviewed_at", "reviewed_by"];

test("the migrations build report_opening in the shape schema.sql gave it, and reader_report in that shape plus a source line and an answer", () => {
  const reference = before("fixtures/report-tables-before-app-db.sql");
  const db = migrated();
  assert.deepEqual(shape(db, "report_opening"), shape(reference, "report_opening"));
  const now = shape(db, "reader_report");
  const then = shape(reference, "reader_report");
  const added = (column: Row) => REPORT_REVIEW_COLUMNS.includes(String(column.name));
  const withoutPosition = ({ cid: _cid, ...column }: Row) => column;
  assert.deepEqual(now.columns.filter((column) => !added(column)).map(withoutPosition), then.columns.map(withoutPosition));
  assert.deepEqual(
    now.columns.filter(added).map((column: Row) => `${String(column.name)} ${String(column.type)}${column.notnull ? " NOT NULL" : ""}`),
    ["line_no INTEGER", "line_sha256 TEXT", "outcome TEXT", "reviewed_at TEXT", "reviewed_by TEXT"],
  );
  assert.deepEqual(now.table, then.table.map((table) => ({ ...table, ncol: Number(table.ncol) + REPORT_REVIEW_COLUMNS.length })));
  // An index names its columns by position too, and the new columns moved the later ones along.
  const indexesByName = (indexes: typeof now.indexes) =>
    indexes.map((index) => ({ ...index, columns: index.columns.map(withoutPosition) }));
  assert.deepEqual(indexesByName(now.indexes), indexesByName(then.indexes));
  assert.deepEqual(now.foreignKeys, then.foreignKeys);
  // The old checks stand, the choice widened by `missing` and details made
  // optional for it alone (#441), and three more: a line comes with its
  // reading and digest, an answer comes whole, and a missing word names no
  // reading.
  const OLD_CHOICE = "choice IN ('meaning', 'example', 'form', 'synonym', 'other')";
  const NEW_CHOICE = "choice IN ('meaning', 'example', 'form', 'synonym', 'other', 'missing')";
  const OLD_DETAILS = "length(details) BETWEEN 1 AND 2000";
  const NEW_DETAILS = "length(details) <= 2000 AND (choice = 'missing' OR length(details) >= 1)";
  assert.ok(then.checks.includes(OLD_CHOICE));
  assert.ok(then.checks.includes(OLD_DETAILS));
  const kept = then.checks.filter((check) => check !== OLD_CHOICE && check !== OLD_DETAILS);
  assert.deepEqual(now.checks.filter((check) => kept.includes(check)), kept);
  assert.ok(now.checks.includes(NEW_CHOICE));
  assert.ok(now.checks.includes(NEW_DETAILS));
  assert.ok(now.checks.includes("choice <> 'missing' OR record_id IS NULL"));
  assert.equal(now.checks.length, then.checks.length + 3);
});

test("the migration that adds the missing-word kind keeps every report already stored, and a missing word names no reading", () => {
  const db = new DatabaseSync(":memory:");
  const files = appMigrationFiles();
  const widening = files.findIndex((path) => path.endsWith("_reader_report_missing.sql"));
  assert.ok(widening > 0, "the missing-word migration is in the journal");
  for (const path of files.slice(0, widening)) db.exec(readFileSync(path, "utf8"));
  const insert = "INSERT INTO reader_report (release_id, word, record_id, choice, details, visitor_hash, received_at) VALUES";
  db.exec(`${insert} ('it-0c432803', 'casa', NULL, 'form', 'Before #441.', 'h', '2026-10-01T12:00:00.000Z')`);
  assert.throws(() => db.exec(`${insert} ('it-0c432803', 'xqzt', NULL, 'missing', 'Too soon.', 'h', '2026-10-01T12:01:00.000Z')`), /CHECK constraint failed/);
  for (const path of files.slice(widening)) db.exec(readFileSync(path, "utf8"));
  assert.equal(shape(db, "reader_report").table[0]?.strict, 1);
  db.exec(`${insert} ('it-0c432803', 'xqzt', NULL, 'missing', 'Please add it.', 'h', '2026-10-01T12:02:00.000Z')`);
  assert.throws(() => db.exec(`${insert} ('it-0c432803', 'casa', 7, 'missing', 'A reading.', 'h', '2026-10-01T12:03:00.000Z')`), /CHECK constraint failed/);
  assert.throws(() => db.exec(`${insert} ('it-0c432803', 'casa', NULL, 'spelling', 'Unknown.', 'h', '2026-10-01T12:04:00.000Z')`), /CHECK constraint failed/);
  assert.deepEqual(rows(db, "SELECT report_id, word, record_id, choice, details FROM reader_report ORDER BY report_id"), [
    { report_id: 1, word: "casa", record_id: null, choice: "form", details: "Before #441." },
    { report_id: 2, word: "xqzt", record_id: null, choice: "missing", details: "Please add it." },
  ]);
});

test("the migration that makes a missing word's details optional keeps every report already stored, and every other report still needs details", () => {
  const db = new DatabaseSync(":memory:");
  const files = appMigrationFiles();
  const optional = files.findIndex((path) => path.endsWith("_reader_report_missing_details.sql"));
  assert.ok(optional > 0, "the optional-details migration is in the journal");
  for (const path of files.slice(0, optional)) db.exec(readFileSync(path, "utf8"));
  const insert = "INSERT INTO reader_report (release_id, word, record_id, choice, details, visitor_hash, received_at) VALUES";
  db.exec(`${insert} ('it-0c432803', 'xqzt', NULL, 'missing', 'Please add it.', 'h', '2026-10-03T12:00:00.000Z')`);
  assert.throws(() => db.exec(`${insert} ('it-0c432803', 'abc', NULL, 'missing', '', 'h', '2026-10-03T12:01:00.000Z')`), /CHECK constraint failed/);
  for (const path of files.slice(optional)) db.exec(readFileSync(path, "utf8"));
  assert.equal(shape(db, "reader_report").table[0]?.strict, 1);
  db.exec(`${insert} ('it-0c432803', 'abc', NULL, 'missing', '', 'h', '2026-10-03T12:02:00.000Z')`);
  assert.throws(() => db.exec(`${insert} ('it-0c432803', 'casa', NULL, 'other', '', 'h', '2026-10-03T12:03:00.000Z')`), /CHECK constraint failed/);
  assert.throws(() => db.exec(`${insert} ('it-0c432803', 'abc', NULL, 'missing', '${"x".repeat(2001)}', 'h', '2026-10-03T12:04:00.000Z')`), /CHECK constraint failed/);
  assert.deepEqual(rows(db, "SELECT report_id, word, choice, details FROM reader_report ORDER BY report_id"), [
    { report_id: 1, word: "xqzt", choice: "missing", details: "Please add it." },
    { report_id: 2, word: "abc", choice: "missing", details: "" },
  ]);
});

test("the migration that adds a report's line and answer keeps every report already stored, waiting", () => {
  const db = new DatabaseSync(":memory:");
  const files = appMigrationFiles();
  const widening = files.findIndex((path) => path.endsWith("_reader_report_review.sql"));
  assert.ok(widening > 0, "the widening migration is in the journal");
  for (const path of files.slice(0, widening)) db.exec(readFileSync(path, "utf8"));
  db.exec(`INSERT INTO reader_report (release_id, word, record_id, choice, details, visitor_hash, received_at)
    VALUES ('it-0c432803', 'sale', 21652, 'meaning', 'Sent before #12.', 'h', '2026-09-30T12:00:00.000Z'),
           ('it-0c432803', 'casa', NULL, 'form', 'No reading.', 'h', '2026-09-30T12:01:00.000Z')`);
  for (const path of files.slice(widening)) db.exec(readFileSync(path, "utf8"));
  assert.deepEqual(rows(db, "SELECT report_id, word, record_id, line_no, details, outcome FROM reader_report ORDER BY report_id"), [
    { report_id: 1, word: "sale", record_id: 21652, line_no: null, details: "Sent before #12.", outcome: null },
    { report_id: 2, word: "casa", record_id: null, line_no: null, details: "No reading.", outcome: null },
  ]);
});

test("better-auth's tables are STRICT, keep Lexema's names for the columns other code reads, and are what an owned key's owner is", () => {
  const db = migrated();
  const columns = (table: string) =>
    rows(db, `PRAGMA table_info(${table})`).map(({ name, type, notnull, pk }) => `${String(name)} ${String(type)}${notnull ? " NOT NULL" : ""}${pk ? " PK" : ""}`);
  for (const table of AUTH_TABLES) assert.equal(shape(db, table).table[0]?.strict, 1, table);
  assert.deepEqual(columns("developer_account"), [
    "account_id INTEGER NOT NULL PK",
    "name TEXT NOT NULL",
    "email TEXT NOT NULL",
    "email_verified INTEGER NOT NULL",
    "image TEXT",
    "created_at TEXT NOT NULL",
    "updated_at TEXT NOT NULL",
    "deleted_at TEXT",
    "stripe_customer_id TEXT",
    "suspended_at TEXT",
    "suspension_reason TEXT",
  ]);
  assert.deepEqual(columns("provider_identity"), [
    "identity_id INTEGER NOT NULL PK",
    "account_id INTEGER NOT NULL",
    "provider TEXT NOT NULL",
    "provider_user_id TEXT NOT NULL",
    "email TEXT NOT NULL",
    "display_name TEXT",
    "linked_at TEXT NOT NULL",
    "updated_at TEXT NOT NULL",
    "access_token TEXT",
    "refresh_token TEXT",
    "id_token TEXT",
    "access_token_expires_at TEXT",
    "refresh_token_expires_at TEXT",
    "scope TEXT",
    "password TEXT",
  ]);
  assert.deepEqual(columns("developer_session"), [
    "session_id INTEGER NOT NULL PK",
    "token TEXT NOT NULL",
    "account_id INTEGER NOT NULL",
    "expires_at TEXT NOT NULL",
    "created_at TEXT NOT NULL",
    "updated_at TEXT NOT NULL",
    "ip_address TEXT",
    "user_agent TEXT",
  ]);
  assert.deepEqual(columns("verification"), [
    "verification_id INTEGER NOT NULL PK",
    "identifier TEXT NOT NULL",
    "value TEXT NOT NULL",
    "expires_at TEXT NOT NULL",
    "created_at TEXT NOT NULL",
    "updated_at TEXT NOT NULL",
  ]);
  for (const table of ["api_key", "provider_identity", "developer_session"]) {
    const [reference] = shape(db, table).foreignKeys.filter(({ table: parent }) => parent === "developer_account");
    assert.equal(reference?.to, "account_id", table);
  }
});

test("better-auth's tables refuse what Lexema never keeps: a provider's tokens, a picture, a session's address, an unverified account", () => {
  const db = migrated();
  const at = "2026-09-30T12:00:00.000Z";
  db.prepare("INSERT INTO developer_account (name, email, email_verified, created_at, updated_at) VALUES ('Ada', 'ada@example.com', 1, ?, ?)").run(at, at);
  const refused: [string, string][] = [
    ["an unverified account", "INSERT INTO developer_account (name, email, email_verified, created_at, updated_at) VALUES ('', 'bob@example.com', 0, '', '')"],
    ["a picture", "UPDATE developer_account SET image = 'https://example.com/ada.png'"],
    ["an uppercase email", "UPDATE developer_account SET email = 'Ada@example.com'"],
    [
      "a provider's token",
      "INSERT INTO provider_identity (account_id, provider, provider_user_id, email, linked_at, updated_at, access_token) VALUES (1, 'google', 'g', 'ada@example.com', '', '', 'ya29')",
    ],
    ["a provider Lexema has not", "INSERT INTO provider_identity (account_id, provider, provider_user_id, email, linked_at, updated_at) VALUES (1, 'apple', 'a', 'ada@example.com', '', '')"],
    ["a session's address", "INSERT INTO developer_session (token, account_id, expires_at, created_at, updated_at, ip_address) VALUES ('t', 1, '', '', '', '127.0.0.1')"],
  ];
  for (const [what, sql] of refused) assert.throws(() => db.exec(sql), /CHECK constraint failed/, what);
});

test("the migrations build only the app tables and their indexes", () => {
  const built = rows(migrated(), "SELECT type || ' ' || name AS entry FROM sqlite_schema")
    .map(({ entry }) => String(entry))
    .sort();
  assert.deepEqual(built, [
    "index api_key_by_owner",
    "index developer_account_email_unique",
    "index developer_account_stripe_customer_id_unique",
    "index developer_session_by_account",
    "index developer_session_by_expiry",
    "index developer_session_token_unique",
    "index enterprise_plan_account_id_unique",
    "index provider_identity_by_account",
    "index provider_identity_provider_user",
    "index reader_report_by_visitor",
    "index sqlite_autoindex_api_key_1",
    "index sqlite_autoindex_api_key_minute_1",
    "index sqlite_autoindex_api_key_usage_1",
    "index sqlite_autoindex_plan_notice_1",
    "index sqlite_autoindex_report_opening_1",
    "index sqlite_autoindex_suspension_card_block_1",
    "index subscription_by_reference",
    "index subscription_stripe_subscription_id_unique",
    "index suspension_card_block_by_item",
    "index verification_by_expiry",
    "index verification_by_identifier",
    ...APP_TABLES.map((table) => `table ${table}`).sort(),
  ]);
});

test("the plan tables are STRICT and refuse an unknown plan, status or notice, a zero allowance and a period ending before it starts", () => {
  const db = migrated();
  for (const table of PLAN_TABLES) assert.equal(shape(db, table).table[0]?.strict, 1, table);
  const at = "2026-09-30T12:00:00.000Z";
  db.prepare("INSERT INTO developer_account (name, email, email_verified, created_at, updated_at) VALUES ('Ada', 'ada@example.com', 1, ?, ?)").run(at, at);
  const period = "'2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'";
  const subscription = (plan: string, status: string) =>
    `INSERT INTO subscription (plan, reference_id, status, period_start, period_end) VALUES ('${plan}', '1', '${status}', ${period})`;
  const notice = (plan: string, state: string) =>
    `INSERT INTO plan_notice (stripe_subscription_id, account_id, plan, state) VALUES ('sub_${plan}_${state}', 1, '${plan}', '${state}')`;
  const enterprise = (calls: number, perMinute: number, periodSql: string) =>
    `INSERT INTO enterprise_plan (account_id, calls_per_period, calls_per_minute, period_start, period_end) VALUES (1, ${calls}, ${perMinute}, ${periodSql})`;
  const refused: [string, string][] = [
    ["an unknown plan", subscription("enterprise", "active")],
    ["an unknown status", subscription("pro", "suspended")],
    ["a zero allowance", enterprise(0, 1000, period)],
    ["a zero rate", enterprise(20_000_000, 0, period)],
    ["an end before its start", enterprise(20_000_000, 1000, "'2026-11-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'")],
    ["a notice of an unknown plan", notice("enterprise", "active")],
    ["a notice of a state no email is about", notice("pro", "none")],
  ];
  for (const [what, sql] of refused) assert.throws(() => db.exec(sql), /CHECK constraint failed/, what);
  // Every status the plan code reads is one the table stores, and a valid Enterprise row is stored.
  for (const status of STRIPE_STATUSES) db.exec(subscription("starter", status));
  db.exec(enterprise(20_000_000, 1000, period));
  for (const state of ["active", "past-due", "cancelling", "ended"]) db.exec(notice("starter", state));
});

test("an account's suspension is stored whole or not at all, and the migration that adds it keeps every account as it was", () => {
  const db = new DatabaseSync(":memory:");
  const files = appMigrationFiles();
  const adding = files.findIndex((path) => path.endsWith("_account_suspension.sql"));
  assert.ok(adding > 0, "the suspension migration is in the journal");
  for (const path of files.slice(0, adding)) db.exec(readFileSync(path, "utf8"));
  const at = "2026-10-04T12:00:00.000Z";
  db.prepare("INSERT INTO developer_account (name, email, email_verified, created_at, updated_at) VALUES ('Ada', 'ada@example.com', 1, ?, ?)").run(at, at);
  for (const path of files.slice(adding)) db.exec(readFileSync(path, "utf8"));

  assert.equal(shape(db, "developer_account").table[0]?.strict, 1);
  assert.equal(shape(db, "suspension_card_block").table[0]?.strict, 1);
  assert.deepEqual(rows(db, "SELECT account_id, email, suspended_at, suspension_reason FROM developer_account"), [
    { account_id: 1, email: "ada@example.com", suspended_at: null, suspension_reason: null },
  ]);
  const block = (item: string, fingerprint: string) =>
    `INSERT INTO suspension_card_block (account_id, value_list_item_id, card_fingerprint) VALUES (1, '${item}', '${fingerprint}')`;
  const refused: [string, string][] = [
    ["a time with no reason", `UPDATE developer_account SET suspended_at = '${at}'`],
    ["a reason with no time", "UPDATE developer_account SET suspension_reason = 'Abuse.'"],
    ["an empty reason", `UPDATE developer_account SET suspended_at = '${at}', suspension_reason = ''`],
    ["a reason with spaces round it", `UPDATE developer_account SET suspended_at = '${at}', suspension_reason = ' Abuse.'`],
    ["a reason past 500 characters", `UPDATE developer_account SET suspended_at = '${at}', suspension_reason = '${"x".repeat(501)}'`],
    ["an item that is not a Radar item", block("card_1", "fp")],
    ["an empty fingerprint", block("rsli_1", "")],
  ];
  for (const [what, sql] of refused) assert.throws(() => db.exec(sql), /CHECK constraint failed/, what);
  db.exec(`UPDATE developer_account SET suspended_at = '${at}', suspension_reason = 'Abuse.'`);
  db.exec("UPDATE developer_account SET suspended_at = NULL, suspension_reason = NULL");
  db.exec(block("rsli_1", "fp"));
});
