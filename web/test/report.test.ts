// The report store (#51), over a dictionary seeded the way the page test seeds
// one and a fresh app database, so the tables and the release it checks
// against are the real schema's. The dictionary is read-only, as the Worker's
// `DB` is (ADR 0018): a report that wrote to it would fail here.
//
// The Worker's per-minute binding is web/test/rateLimit.test.ts; this file is
// everything after it: what a report must carry, the honeypot, the timing
// check, the hourly allowance, the Turnstile hook, what is stored, and the
// cron sweep that erases a report's visitor code after an hour (#570). The
// two report routes run here too, outside workerd, to show what a Worker
// missing one of the box's secrets answers and logs (#621).

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { registerHooks } from "node:module";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { unstable_readConfig } from "wrangler";
import { seedSql } from "../../src/import/seedSql.js";
import { appTablesOverNodeSqlite } from "../../src/db/app/nodeSqlite.js";
import { freshAppDatabase, readOnlyDictionary } from "../../test/databases.js";
import {
  REPORT_CHOICES,
  REPORT_DETAILS_HINT,
  REPORT_DETAILS_LIMIT,
  REPORT_MIN_OPEN_MS,
  REPORTS_PER_HOUR,
  afterAnswer,
  forgetVisitors,
  OPENING_TROUBLE,
  openReport,
  requestOpening,
  readSubmission,
  receiveReport,
  reportKeys,
  turnstileConfig,
  verifyTurnstile,
  visitorHash,
  VisitorCodeKey,
  type ReportAnswer,
  type ReportContext,
  type ReportSubmission,
} from "@/lib/dictionary/report.ts";
import { FIXTURE_LINES } from "./fixture.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-report-test";
const NOW = Date.parse("2026-09-27T12:00:00Z");

/** The visitor code key `secret` names, which must be set. */
async function keyOf(secret: string): Promise<VisitorCodeKey> {
  const key = await VisitorCodeKey.of(secret);
  assert.ok(key !== "missing", "a set secret is a key");
  return key;
}

/** The tests' own `REPORT_VISITOR_KEY`, as docs/RUN_THE_SITE.md says tests set one. */
const TEST_VISITOR_SECRET = "lexema-tests-only-visitor-key-7d41c0e2";
const KEY = await keyOf(TEST_VISITOR_SECRET);

/** The two databases a report touches: the dictionary it reads, and the app database it writes. */
interface Databases {
  dictionary: DatabaseSync;
  app: DatabaseSync;
}

async function withDatabase(run: (db: Databases) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-report-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${FIXTURE_LINES.join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: join(REPO, "src/db/schema.sql"),
      releaseId: RELEASE,
      archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
      license: "CC-BY-SA-4.0",
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const dictionary = new DatabaseSync(":memory:");
    for (const part of parts) dictionary.exec(await readFile(part, "utf8"));
    readOnlyDictionary(dictionary);
    const { sqlite: app } = freshAppDatabase();
    await run({ dictionary, app });
    dictionary.close();
    app.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const submission = (openToken: string, overrides: Partial<ReportSubmission> = {}): ReportSubmission => ({
  word: "casa",
  choice: "form",
  recordId: undefined,
  details: "The plural should be case.",
  openToken,
  website: "",
  challenge: undefined,
  ...overrides,
});

/** A box opened on the server's clock at `at`. */
const opened = (db: Databases, at = NOW - 10_000): Promise<string> => openReport(appTablesOverNodeSqlite(db.app), at);

const context = (db: Databases, overrides: Partial<ReportContext> = {}): ReportContext => ({
  db: readOnlyDictionary(db.dictionary),
  appDb: appTablesOverNodeSqlite(db.app),
  release: RELEASE,
  now: NOW,
  visitor: "v4:203.0.113.7",
  visitorCodeKey: KEY,
  verifyChallenge: undefined,
  ...overrides,
});

const stored = (db: Databases) =>
  db.app
    .prepare(
      "SELECT release_id, word, record_id, line_no, line_sha256, choice, details, visitor_hash, received_at, outcome FROM reader_report ORDER BY report_id",
    )
    .all() as {
    release_id: string;
    word: string;
    record_id: number | null;
    line_no: number | null;
    line_sha256: string | null;
    choice: string;
    outcome: string | null;
    details: string | null;
    visitor_hash: string | null;
    received_at: string;
  }[];

test("a report needs a choice and details, within the length limit; the reading is optional", () => {
  const body = { word: "casa", choice: "form", details: "wrong plural", openToken: "token" };
  assert.deepEqual(readSubmission({ ...body, choice: undefined }), { reason: "choice" });
  assert.deepEqual(readSubmission({ ...body, choice: "spelling" }), { reason: "choice" });
  assert.deepEqual(readSubmission({ ...body, details: "   " }), { reason: "details" });
  assert.deepEqual(readSubmission({ ...body, details: "x".repeat(REPORT_DETAILS_LIMIT + 1) }), { reason: "details-too-long" });
  assert.deepEqual(readSubmission({ ...body, recordId: "2" }), { reason: "reading" });
  assert.deepEqual(readSubmission({ ...body, word: "" }), { reason: "malformed" });
  assert.deepEqual(readSubmission({ ...body, openToken: undefined }), { reason: "malformed" });
  assert.deepEqual(readSubmission("not an object"), { reason: "malformed" });
  const read = readSubmission({ ...body, details: "  wrong plural  ", recordId: null });
  assert.ok(!("reason" in read));
  assert.equal(read.details, "wrong plural");
  assert.equal(read.recordId, undefined);
  assert.equal(read.website, "");
});

test("a valid report is stored for review, with the served release, the reading's source line and a hash in place of the address", async () => {
  await withDatabase(async (db) => {
    const [casa] = db.dictionary
      .prepare("SELECT record_id, line_no, line_sha256 FROM source_record WHERE word = 'casa' AND release_id = ?")
      .all(RELEASE) as { record_id: number; line_no: number; line_sha256: string }[];
    assert.deepEqual(await receiveReport(submission(await opened(db), { recordId: casa.record_id }), context(db)), {
      outcome: "sent",
    });
    const [row] = stored(db);
    assert.equal(row.release_id, RELEASE);
    assert.equal(row.record_id, casa.record_id);
    // The line, not the build's record number, is what a review follows after a re-seed (#12).
    assert.equal(row.line_no, casa.line_no);
    assert.equal(row.line_sha256, casa.line_sha256);
    assert.equal(row.outcome, null, "a report arrives waiting");
    assert.equal(row.choice, "form");
    assert.equal(row.details, "The plural should be case.");
    assert.equal(row.received_at, new Date(NOW).toISOString());
    assert.equal(row.visitor_hash, await visitorHash("v4:203.0.113.7", KEY));
    assert.doesNotMatch(row.visitor_hash ?? "", /203\.0\.113/);
  });
});

test("a missing word is a sixth kind that names no reading; a word page's five are unchanged", () => {
  const body = { word: "xqzt", choice: "missing", details: "Please add it.", openToken: "token" };
  const read = readSubmission(body);
  assert.ok(!("reason" in read));
  assert.equal(read.choice, "missing");
  assert.equal(read.recordId, undefined);
  assert.deepEqual(readSubmission({ ...body, recordId: 7 }), { reason: "reading" });
  assert.deepEqual(REPORT_CHOICES, ["meaning", "example", "form", "synonym", "other"]);
});

test("a report from a search that found nothing stores the query as its word, with no reading, in the served release", async () => {
  await withDatabase(async (db) => {
    const missing = submission(await opened(db), { word: "xqzt", choice: "missing", recordId: undefined, details: "Please add this word." });
    assert.deepEqual(await receiveReport(missing, context(db)), { outcome: "sent" });
    const [row] = stored(db);
    assert.equal(row.word, "xqzt");
    assert.equal(row.choice, "missing");
    assert.equal(row.record_id, null);
    assert.equal(row.line_no, null);
    assert.equal(row.line_sha256, null);
    assert.equal(row.release_id, RELEASE);
    assert.equal(row.details, "Please add this word.");
  });
});

test("a missing word's details are optional, and its box says so; every other report still needs details", async () => {
  assert.equal(REPORT_DETAILS_HINT.missing, "Qualcosa da aggiungere? (facoltativo)");
  assert.equal(REPORT_DETAILS_HINT.mistake, "Cosa dovrebbe dire invece?");
  const read = readSubmission({ word: "xqzt", choice: "missing", details: "   ", openToken: "token" });
  assert.ok(!("reason" in read));
  assert.equal(read.details, "");
  assert.deepEqual(readSubmission({ word: "casa", choice: "other", details: "   ", openToken: "token" }), { reason: "details" });
  await withDatabase(async (db) => {
    const missing = submission(await opened(db), { word: "xqzt", choice: "missing", recordId: undefined, details: "" });
    assert.deepEqual(await receiveReport(missing, context(db)), { outcome: "sent" });
    const [row] = stored(db);
    assert.equal(row.choice, "missing");
    assert.equal(row.details, "");
  });
});

test("a filled honeypot or a box sent too fast, on the server's clock, is answered as sent and stores nothing", async () => {
  await withDatabase(async (db) => {
    assert.deepEqual(await receiveReport(submission(await opened(db), { website: "http://spam.example" }), context(db)), {
      outcome: "sent",
    });
    // The box opened 2.999 s ago by the server's own clock; the report carries
    // no time of the reader's, so their clock cannot move the check.
    const tooFast = await opened(db, NOW - (REPORT_MIN_OPEN_MS - 1));
    assert.deepEqual(await receiveReport(submission(tooFast), context(db)), { outcome: "sent" });
    assert.equal(stored(db).length, 0);
    await receiveReport(submission(await opened(db, NOW - REPORT_MIN_OPEN_MS)), context(db));
    assert.equal(stored(db).length, 1);
  });
});

test("a report needs a token the server issued; each token stores one report", async () => {
  await withDatabase(async (db) => {
    assert.deepEqual(await receiveReport(submission("made-up"), context(db)), { outcome: "rejected", reason: "expired" });
    const token = await opened(db);
    assert.deepEqual(await receiveReport(submission(token), context(db)), { outcome: "sent" });
    assert.deepEqual(await receiveReport(submission(token), context(db)), { outcome: "rejected", reason: "expired" });
    assert.equal(stored(db).length, 1);
    // A day-old opening is swept when the next box opens.
    await opened(db, NOW - 2 * 24 * 60 * 60_000);
    await opened(db, NOW);
    assert.equal((db.app.prepare("SELECT count(*) AS n FROM report_opening").get() as { n: number }).n, 1);
  });
});

test("a visitor may send five reports an hour; the sixth is limited, and others and the next hour are not", async () => {
  await withDatabase(async (db) => {
    for (let i = 0; i < REPORTS_PER_HOUR; i++) {
      const token = await opened(db, NOW + i * 60_000 - 10_000);
      assert.deepEqual(await receiveReport(submission(token), context(db, { now: NOW + i * 60_000 })), { outcome: "sent" });
    }
    const later = NOW + REPORTS_PER_HOUR * 60_000;
    assert.deepEqual(await receiveReport(submission(await opened(db, later - 10_000)), context(db, { now: later })), {
      outcome: "limited",
    });
    assert.equal(stored(db).length, REPORTS_PER_HOUR);
    assert.deepEqual(
      await receiveReport(submission(await opened(db, later - 10_000)), context(db, { now: later, visitor: "v4:198.51.100.9" })),
      { outcome: "sent" },
    );
    const nextHour = NOW + 61 * 60_000 + REPORTS_PER_HOUR * 60_000;
    assert.deepEqual(await receiveReport(submission(await opened(db, nextHour - 10_000)), context(db, { now: nextHour })), {
      outcome: "sent",
    });
  });
});

const HOUR_MS = 60 * 60_000;

/** A waiting report from one visitor, received at `at`, written straight to the table. */
function storeAt(app: DatabaseSync, at: number, visitor: string): void {
  app
    .prepare("INSERT INTO reader_report (release_id, word, choice, details, visitor_hash, received_at) VALUES (?, 'casa', 'form', 'A note.', ?, ?)")
    .run(RELEASE, visitor, new Date(at).toISOString());
}

const visitorCodes = (app: DatabaseSync) =>
  app
    .prepare("SELECT received_at, visitor_hash, details FROM reader_report ORDER BY received_at")
    .all()
    .map((row) => ({ ...row }));

test("the sweep erases the visitor code of every report received an hour ago or earlier, and leaves younger ones and the reports", async () => {
  const { sqlite, appDb } = freshAppDatabase();
  const code = await visitorHash("v4:203.0.113.7", KEY);
  const times = [NOW - HOUR_MS - 1, NOW - HOUR_MS, NOW - HOUR_MS + 1, NOW];
  for (const at of times) storeAt(sqlite, at, code);
  await forgetVisitors(appDb, NOW);
  assert.deepEqual(visitorCodes(sqlite), [
    { received_at: new Date(NOW - HOUR_MS - 1).toISOString(), visitor_hash: null, details: "A note." },
    { received_at: new Date(NOW - HOUR_MS).toISOString(), visitor_hash: null, details: "A note." },
    { received_at: new Date(NOW - HOUR_MS + 1).toISOString(), visitor_hash: code, details: "A note." },
    { received_at: new Date(NOW).toISOString(), visitor_hash: code, details: "A note." },
  ]);
  // The clock moves on: the next sweep takes the next one, and still deletes nothing.
  await forgetVisitors(appDb, NOW + 1);
  assert.deepEqual(
    visitorCodes(sqlite).map(({ visitor_hash }) => visitor_hash),
    [null, null, null, code],
  );
});

test("after the sweep the hourly allowance still holds: a visitor at the limit inside the hour is still refused", async () => {
  await withDatabase(async (db) => {
    for (let i = 0; i < REPORTS_PER_HOUR; i++) {
      const token = await opened(db, NOW + i * 60_000 - 10_000);
      assert.deepEqual(await receiveReport(submission(token), context(db, { now: NOW + i * 60_000 })), { outcome: "sent" });
    }
    const later = NOW + REPORTS_PER_HOUR * 60_000;
    await forgetVisitors(appTablesOverNodeSqlite(db.app), later);
    assert.deepEqual(await receiveReport(submission(await opened(db, later - 10_000)), context(db, { now: later })), {
      outcome: "limited",
    });
    assert.equal(stored(db).length, REPORTS_PER_HOUR);
  });
});

/** D1's shape over a `node:sqlite` database, as far as Drizzle's D1 driver reaches it. */
function d1Over(over: DatabaseSync): D1Database {
  const bound = (sql: string, params: (string | number | null)[]) => ({
    all: async () => ({ results: over.prepare(sql).all(...params) }),
    raw: async () => {
      const statement = over.prepare(sql);
      statement.setReturnArrays(true);
      return statement.all(...params);
    },
    run: async () => (over.prepare(sql).run(...params), { success: true }),
    ranInBatch: () => (over.prepare(sql).run(...params), { success: true, results: [] }),
  });
  return {
    prepare: (sql: string) => ({ ...bound(sql, []), bind: (...params: (string | number | null)[]) => bound(sql, params) }),
    batch: async (statements: ReturnType<typeof bound>[]) => {
      over.exec("BEGIN");
      const results = statements.map((statement) => statement.ranInBatch());
      over.exec("COMMIT");
      return results;
    },
  } as unknown as D1Database;
}

/** A D1 binding that records every statement and runs none, to show nothing was asked of it. */
function untouchedD1(): { d1: D1Database; asked: string[] } {
  const asked: string[] = [];
  const refuse = (sql: string) => {
    asked.push(sql);
    throw new Error("this test's database must not be reached");
  };
  return { d1: { prepare: refuse, batch: async () => refuse("batch") } as unknown as D1Database, asked };
}

/**
 * The Worker's `env` as `cloudflare:workers` hands it to every module the
 * stub below reaches, one object for the whole file, so a test sets the
 * fields it needs on it before it runs. The Worker's entry reads the stage once,
 * when it is imported: production, the stage a missing secret matters on.
 */
const WORKER_ENV: Record<string, unknown> = { LEXEMA_STAGE: "production", DEVELOPER_SIGN_UP: "closed", LEXEMA_RELEASE: RELEASE };
(globalThis as { lexemaTestEnv?: Record<string, unknown> }).lexemaTestEnv = WORKER_ENV;

/**
 * Import `path` outside workerd: `cloudflare:workers` and vinext's App Router
 * entry exist only in a build, and the card desk loads WebAssembly, so each is
 * stood in for. The App Router answers every request it is handed with a page,
 * so a route the Worker hands on is seen to be served.
 */
async function outsideWorkerd<T>(path: string): Promise<T> {
  const STUBS: Record<string, string> = {
    "cloudflare:workers": `export const env = globalThis.lexemaTestEnv; export class DurableObject {}`,
    "vinext/server/app-router-entry": `export default { fetch() { return new Response("the page", { status: 200 }); } };`,
  };
  const stub = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
  const hooks = registerHooks({
    resolve: (specifier, context, nextResolve) => {
      if (specifier in STUBS) return stub(STUBS[specifier]);
      const resolved = nextResolve(specifier, context);
      // A desk with nothing on it: only a card's address reaches into one, and no test here asks for a card.
      return resolved.url.endsWith("/worker/dictionary/card/desk.ts") ? stub(`export function workerDesk() { return {}; }`) : resolved;
    },
  });
  try {
    return (await import(path)) as T;
  } finally {
    hooks.deregister();
  }
}

/** The Worker's entry, imported as `outsideWorkerd` stands it up. */
async function workerEntry() {
  return (await outsideWorkerd<typeof import("../worker/index.ts")>("../worker/index.ts")).default;
}

type RouteModule = { POST: (request: Request) => Promise<Response> };

/** `POST /report` and `POST /report/open`, as the App Router runs them, over `WORKER_ENV`. */
async function reportRoutes(): Promise<{ report: RouteModule; open: RouteModule }> {
  return {
    report: await outsideWorkerd<RouteModule>("../app/(lexema)/report/route.ts"),
    open: await outsideWorkerd<RouteModule>("../app/(lexema)/report/open/route.ts"),
  };
}

/** Run `body` with console.error and console.warn captured, and return what each printed. */
async function printed(body: () => Promise<void>): Promise<{ errors: unknown[][]; warnings: unknown[][] }> {
  const errors: unknown[][] = [];
  const warnings: unknown[][] = [];
  const { error, warn } = console;
  console.error = (...args: unknown[]) => void errors.push(args);
  console.warn = (...args: unknown[]) => void warnings.push(args);
  try {
    await body();
  } finally {
    Object.assign(console, { error, warn });
  }
  return { errors, warnings };
}

/** A report a word page's box sends, as JSON. */
const reportRequest = (openToken = "a-token", host = "lexema.fyi") =>
  new Request(`https://${host}/report`, {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" },
    body: JSON.stringify({ word: "xqzt", choice: "missing", details: "", openToken, website: "" }),
  });

/** Set `fields` on the Worker's env, and remove each key named `undefined`. */
function setEnv(fields: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) delete WORKER_ENV[name];
    else WORKER_ENV[name] = value;
  }
}

test("the Worker's scheduled handler sweeps APP_DB at the trigger's time, on a cron every five minutes, in production too", async () => {
  const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
  for (const env of [undefined, "production"]) {
    assert.deepEqual(unstable_readConfig({ config: configPath, env }).triggers.crons, ["*/5 * * * *"], env ?? "top level");
  }
  const { sqlite } = freshAppDatabase();
  const code = await visitorHash("v4:203.0.113.7", KEY);
  storeAt(sqlite, NOW - HOUR_MS, code);
  storeAt(sqlite, NOW - 60_000, code);
  const worker = await workerEntry();
  await worker.scheduled({ scheduledTime: NOW }, { APP_DB: d1Over(sqlite) });
  assert.deepEqual(
    visitorCodes(sqlite).map(({ visitor_hash }) => visitor_hash),
    [null, code],
    "the hour-old code is gone; the minute-old one stays",
  );
  // With no APP_DB bound, there is no report to erase, and nothing fails.
  await worker.scheduled({ scheduledTime: NOW }, {});
});

test("the visitor code is an HMAC-SHA-256 under REPORT_VISITOR_KEY: one visitor, one code per key, and another key gives another (#621)", async () => {
  const code = await visitorHash("v4:203.0.113.7", KEY);
  assert.match(code, /^[0-9a-f]{64}$/);
  assert.equal(await visitorHash("v4:203.0.113.7", await keyOf(TEST_VISITOR_SECRET)), code, "the same visitor under the same key");
  assert.notEqual(await visitorHash("v4:198.51.100.9", KEY), code, "another visitor");
  const other = await visitorHash("v4:203.0.113.7", await keyOf("another-key-entirely"));
  assert.match(other, /^[0-9a-f]{64}$/);
  assert.notEqual(other, code, "the same visitor under another key");
  // HMAC-SHA-256 itself, from node:crypto: the stored code is the keyed digest of the visitor key and nothing else.
  assert.equal(code, createHmac("sha256", TEST_VISITOR_SECRET).update("v4:203.0.113.7").digest("hex"));
  // Unset and blank are the same missing key; a set one is trimmed as the other secrets are.
  assert.equal(await VisitorCodeKey.of(undefined), "missing");
  assert.equal(await VisitorCodeKey.of(""), "missing");
  assert.equal(await VisitorCodeKey.of("  \n"), "missing");
  assert.equal(await visitorHash("v4:203.0.113.7", await keyOf(`${TEST_VISITOR_SECRET}\n`)), code);
});

test("with REPORT_VISITOR_KEY unset or blank, POST /report is failed with a 503, stores nothing and logs one error naming it; the Worker still serves (#621)", async () => {
  const { report } = await reportRoutes();
  for (const secret of [undefined, "", "   "]) {
    const app = untouchedD1();
    const dictionary = untouchedD1();
    setEnv({ LEXEMA_STAGE: "production", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret", REPORT_VISITOR_KEY: secret, APP_DB: app.d1, DB: dictionary.d1 });
    const { errors } = await printed(async () => {
      const response = await report.POST(reportRequest());
      assert.equal(response.status, 503, JSON.stringify(secret));
      assert.deepEqual(await response.json(), { outcome: "failed" });
    });
    assert.deepEqual(errors, [["report box closed: REPORT_VISITOR_KEY not set", {}]], JSON.stringify(secret));
    assert.deepEqual(app.asked, [], "nothing is stored, nor read");
    assert.deepEqual(dictionary.asked, []);
  }
  // The Worker boots on production without the secret, and hands every other route on.
  const worker = await workerEntry();
  const page = await worker.fetch(new Request("https://lexema.fyi/licence"), WORKER_ENV as unknown as Env, {} as ExecutionContext);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "the page");
});

test("with REPORT_VISITOR_KEY set, POST /report stores the report under the key's visitor code", async () => {
  const { report } = await reportRoutes();
  const { sqlite } = freshAppDatabase();
  const token = await openReport(appTablesOverNodeSqlite(sqlite), Date.now() - 10_000);
  setEnv({ LEXEMA_STAGE: "local", TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET_KEY: undefined, REPORT_VISITOR_KEY: TEST_VISITOR_SECRET, APP_DB: d1Over(sqlite), DB: untouchedD1().d1 });
  const response = await report.POST(reportRequest(token));
  assert.deepEqual(await response.json(), { outcome: "sent" });
  const rows = sqlite.prepare("SELECT word, visitor_hash FROM reader_report").all();
  assert.deepEqual(rows.map((row) => ({ ...row })), [{ word: "xqzt", visitor_hash: await visitorHash("v4:203.0.113.7", KEY) }]);
});

test("on production with either Turnstile key missing, POST /report and POST /report/open are failed with a 503 and log the missing key (#621)", async () => {
  const { report, open } = await reportRoutes();
  const cases = [
    { site: "", secret: "secret", line: "report box closed: TURNSTILE_SITE_KEY not set" },
    { site: "site", secret: undefined, line: "report box closed: TURNSTILE_SECRET_KEY not set" },
    { site: " ", secret: "", line: "report box closed: TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY not set" },
  ];
  for (const { site, secret, line } of cases) {
    const app = untouchedD1();
    setEnv({ LEXEMA_STAGE: "production", TURNSTILE_SITE_KEY: site, TURNSTILE_SECRET_KEY: secret, REPORT_VISITOR_KEY: TEST_VISITOR_SECRET, APP_DB: app.d1, DB: untouchedD1().d1 });
    const { errors, warnings } = await printed(async () => {
      for (const response of [await report.POST(reportRequest()), await open.POST(new Request("https://lexema.fyi/report/open", { method: "POST" }))]) {
        assert.equal(response.status, 503, line);
        assert.deepEqual(await response.json(), { outcome: "failed" });
      }
    });
    assert.deepEqual(errors, [[line, {}], [line, {}]]);
    assert.deepEqual(warnings, [], "an error, not a warning");
    assert.deepEqual(app.asked, [], "no opening and no report is stored");
  }
  // With both secrets missing, one line names both.
  setEnv({ TURNSTILE_SITE_KEY: "", REPORT_VISITOR_KEY: undefined });
  const { errors } = await printed(async () => void (await report.POST(reportRequest())));
  assert.deepEqual(errors, [["report box closed: TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY and REPORT_VISITOR_KEY not set", {}]]);
});

test("on local and preview, a missing Turnstile key keeps today's behaviour: off, with a warning, and the box still opens", async () => {
  const { open } = await reportRoutes();
  for (const stage of ["local", "preview"]) {
    const { sqlite } = freshAppDatabase();
    setEnv({ LEXEMA_STAGE: stage, TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: undefined, APP_DB: d1Over(sqlite) });
    const { errors, warnings } = await printed(async () => {
      const response = await open.POST(new Request("https://lexema.fyi/report/open", { method: "POST" }));
      assert.equal(response.status, 200, stage);
      assert.equal(((await response.json()) as { outcome: string }).outcome, "opened");
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, [["Turnstile is off: TURNSTILE_SECRET_KEY is not set, and both are needed", {}]], stage);
    assert.equal((sqlite.prepare("SELECT count(*) AS n FROM report_opening").get() as { n: number }).n, 1);
  }
});

test("Turnstile's pass counts only when siteverify names the request's own hostname (#621)", async () => {
  const sent: FormData[] = [];
  const answers: Record<string, unknown>[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(init?.body as FormData);
    return Response.json(answers.shift());
  }) as typeof fetch;
  try {
    answers.push({ success: true, hostname: "lexema.fyi" });
    assert.equal(await verifyTurnstile("secret", "token", "203.0.113.7", "lexema.fyi"), true);
    answers.push({ success: true, hostname: "elsewhere.example" });
    assert.equal(await verifyTurnstile("secret", "token", "203.0.113.7", "lexema.fyi"), false, "solved on another site");
    answers.push({ success: true });
    assert.equal(await verifyTurnstile("secret", "token", "203.0.113.7", "lexema.fyi"), false, "no hostname named");
    answers.push({ success: false, hostname: "lexema.fyi" });
    assert.equal(await verifyTurnstile("secret", "token", "203.0.113.7", "lexema.fyi"), false, "a failed check on the right host");
    assert.equal(sent.length, 4);
    assert.equal(sent[0].get("secret"), "secret");
    assert.equal(sent[0].get("response"), "token");
    assert.equal(await verifyTurnstile("secret", undefined, null, "lexema.fyi"), false, "no token, no call");
    assert.equal(sent.length, 4);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the report box is ready only with every secret it needs, and names each one it lacks", async () => {
  const off = { state: "off" } as const;
  const on = { state: "on", siteKey: "site", secretKey: "secret" } as const;
  assert.deepEqual(reportKeys(on, KEY), { state: "ready", visitorCodeKey: KEY, turnstile: on });
  assert.deepEqual(reportKeys(off, KEY), { state: "ready", visitorCodeKey: KEY, turnstile: off });
  assert.deepEqual(reportKeys(off, "missing"), { state: "closed", missing: ["REPORT_VISITOR_KEY"] });
  assert.deepEqual(reportKeys({ state: "unset", missing: ["TURNSTILE_SECRET_KEY"] }, KEY), { state: "closed", missing: ["TURNSTILE_SECRET_KEY"] });
});

test("a reading from another release is refused, and nothing is stored", async () => {
  await withDatabase(async (db) => {
    assert.deepEqual(await receiveReport(submission(await opened(db), { recordId: 999_999 }), context(db)), {
      outcome: "rejected",
      reason: "reading",
    });
    assert.equal(stored(db).length, 0);
  });
});

test("with Turnstile configured a failed check is refused; with none configured it is skipped", async () => {
  await withDatabase(async (db) => {
    const tokens: (string | undefined)[] = [];
    const verifyChallenge = async (token: string | undefined) => {
      tokens.push(token);
      return token === "good";
    };
    // A failed check keeps the opening, so a retry with a fresh token works.
    const token = await opened(db);
    assert.deepEqual(await receiveReport(submission(token, { challenge: "bad" }), context(db, { verifyChallenge })), {
      outcome: "rejected",
      reason: "challenge",
    });
    assert.equal(stored(db).length, 0);
    assert.deepEqual(await receiveReport(submission(token, { challenge: "good" }), context(db, { verifyChallenge })), {
      outcome: "sent",
    });
    assert.deepEqual(tokens, ["bad", "good"]);
    assert.deepEqual(await receiveReport(submission(await opened(db)), context(db)), { outcome: "sent" });
    assert.equal(stored(db).length, 2);
  });
});

test("on local and preview Turnstile is on only when both keys are set; one alone is off, with a warning naming the missing key", () => {
  for (const stage of ["local", "preview"] as const) {
    const warnings: string[] = [];
    const warn = (message: string) => void warnings.push(message);
    assert.deepEqual(turnstileConfig(stage, "site", "secret", warn), { state: "on", siteKey: "site", secretKey: "secret" });
    assert.deepEqual(turnstileConfig(stage, undefined, undefined, warn), { state: "off" });
    assert.deepEqual(turnstileConfig(stage, "", "", warn), { state: "off" });
    assert.deepEqual(warnings, []);
    assert.deepEqual(turnstileConfig(stage, "", "secret", warn), { state: "off" });
    assert.deepEqual(turnstileConfig(stage, "site", undefined, warn), { state: "off" });
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /TURNSTILE_SITE_KEY is not set/);
    assert.match(warnings[1], /TURNSTILE_SECRET_KEY is not set/);
  }
});

test("on production a missing Turnstile key is unset, never off, and no warning stands in for the error the routes log", () => {
  const warnings: string[] = [];
  const warn = (message: string) => void warnings.push(message);
  assert.deepEqual(turnstileConfig("production", "site", "secret", warn), { state: "on", siteKey: "site", secretKey: "secret" });
  assert.deepEqual(turnstileConfig("production", "", "secret", warn), { state: "unset", missing: ["TURNSTILE_SITE_KEY"] });
  assert.deepEqual(turnstileConfig("production", "site", " ", warn), { state: "unset", missing: ["TURNSTILE_SECRET_KEY"] });
  assert.deepEqual(turnstileConfig("production", undefined, undefined, warn), { state: "unset", missing: ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] });
  assert.deepEqual(warnings, []);
});

test("after any answer that did not store the report, the box drops its Turnstile token for a fresh one", () => {
  const answers: ReportAnswer[] = [
    { outcome: "limited" },
    { outcome: "failed" },
    { outcome: "rejected", reason: "challenge" },
    { outcome: "rejected", reason: "expired" },
    { outcome: "rejected", reason: "details" },
  ];
  for (const answer of answers) assert.equal(afterAnswer(answer).keepChallenge, false, JSON.stringify(answer));
  assert.deepEqual(afterAnswer({ outcome: "sent" }), { status: "sent", keepChallenge: true });
  assert.equal(afterAnswer({ outcome: "rejected", reason: "challenge" }).status, "challenge");
  assert.equal(afterAnswer({ outcome: "rejected", reason: "expired" }).status, "expired");
});

test("a failed opening is not final: asking again gets a token, and a 429 says the box was opened too often", async () => {
  // The box's own request, against a server that fails once, then answers.
  const replies = [
    Response.json({ outcome: "failed" }, { status: 503 }),
    Response.json({ outcome: "opened", token: "fresh-token" }),
  ];
  const calls: string[] = [];
  const server = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(`${init?.method} ${String(url)}`);
    const reply = replies.shift();
    if (reply === undefined) throw new Error("no more replies");
    return reply;
  }) as typeof fetch;
  assert.deepEqual(await requestOpening(server), { trouble: "open-failed" });
  assert.deepEqual(await requestOpening(server), { token: "fresh-token" }, "the retry gets a token");
  assert.deepEqual(calls, ["POST /report/open", "POST /report/open"]);

  const offline = (async () => {
    throw new TypeError("network down");
  }) as typeof fetch;
  assert.deepEqual(await requestOpening(offline), { trouble: "open-failed" });

  const limited = (async () => Response.json({ outcome: "limited" }, { status: 429 })) as typeof fetch;
  assert.deepEqual(await requestOpening(limited), { trouble: "open-limited" });
  assert.match(OPENING_TROUBLE["open-limited"], /aperto questa finestra troppe volte/);
  assert.doesNotMatch(OPENING_TROUBLE["open-limited"], /ultima ora/, "not the hourly report limit");
});
