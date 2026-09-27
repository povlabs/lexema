// The report store (#51), over a database seeded the way the page test seeds
// one, so the table and the release it checks against are the real schema's.
//
// The Worker's per-minute binding is web/test/rateLimit.test.ts; this file is
// everything after it: what a report must carry, the honeypot, the timing
// check, the hourly allowance, the Turnstile hook, and what is stored.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../../src/import/seedSql.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import {
  REPORT_DETAILS_LIMIT,
  REPORT_MIN_OPEN_MS,
  REPORTS_PER_HOUR,
  afterAnswer,
  OPENING_TROUBLE,
  openReport,
  requestOpening,
  readSubmission,
  receiveReport,
  turnstileConfig,
  visitorHash,
  type ReportAnswer,
  type ReportContext,
  type ReportSubmission,
} from "../app/report.ts";
import { FIXTURE_LINES } from "./fixture.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-report-test";
const NOW = Date.parse("2026-09-27T12:00:00Z");

async function withDatabase(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
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
    const db = new DatabaseSync(":memory:");
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    await run(db);
    db.close();
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
const opened = (db: DatabaseSync, at = NOW - 10_000): Promise<string> => openReport(fromNodeSqlite(db), at);

const context = (db: DatabaseSync, overrides: Partial<ReportContext> = {}): ReportContext => ({
  db: fromNodeSqlite(db),
  release: RELEASE,
  now: NOW,
  visitor: "v4:203.0.113.7",
  verifyChallenge: undefined,
  ...overrides,
});

const stored = (db: DatabaseSync) =>
  db.prepare("SELECT release_id, word, record_id, choice, details, visitor_hash, received_at FROM reader_report ORDER BY report_id").all() as {
    release_id: string;
    word: string;
    record_id: number | null;
    choice: string;
    details: string;
    visitor_hash: string;
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

test("a valid report is stored for review, with the served release and a hash in place of the address", async () => {
  await withDatabase(async (db) => {
    const [casa] = db.prepare("SELECT record_id FROM source_record WHERE word = 'casa' AND release_id = ?").all(RELEASE) as {
      record_id: number;
    }[];
    assert.deepEqual(await receiveReport(submission(await opened(db), { recordId: casa.record_id }), context(db)), {
      outcome: "sent",
    });
    const [row] = stored(db);
    assert.equal(row.release_id, RELEASE);
    assert.equal(row.record_id, casa.record_id);
    assert.equal(row.choice, "form");
    assert.equal(row.details, "The plural should be case.");
    assert.equal(row.received_at, new Date(NOW).toISOString());
    assert.equal(row.visitor_hash, await visitorHash("v4:203.0.113.7"));
    assert.doesNotMatch(row.visitor_hash, /203\.0\.113/);
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
    assert.equal((db.prepare("SELECT count(*) AS n FROM report_opening").get() as { n: number }).n, 1);
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

test("Turnstile is on only when both keys are set; one alone is off, with a warning naming the missing key", () => {
  const warnings: string[] = [];
  const warn = (message: string) => void warnings.push(message);
  assert.deepEqual(turnstileConfig("site", "secret", warn), { siteKey: "site", secretKey: "secret" });
  assert.equal(turnstileConfig(undefined, undefined, warn), undefined);
  assert.equal(turnstileConfig("", "", warn), undefined);
  assert.deepEqual(warnings, []);
  assert.equal(turnstileConfig("", "secret", warn), undefined);
  assert.equal(turnstileConfig("site", undefined, warn), undefined);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /TURNSTILE_SITE_KEY is not set/);
  assert.match(warnings[1], /TURNSTILE_SECRET_KEY is not set/);
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
  assert.match(OPENING_TROUBLE["open-limited"], /opened this box too often/);
  assert.doesNotMatch(OPENING_TROUBLE["open-limited"], /hour/, "not the hourly report limit");
});
