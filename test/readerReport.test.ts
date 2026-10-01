// A reader's report as a person reviews it (#12): the reading it names is
// followed by source line, never by a record number a re-seed may change; an
// answer is recorded once, beside the report; and nothing the site serves reads
// either.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { AppTables } from "../src/db/app/database.js";
import { readerReport } from "../src/db/app/schema.js";
import {
  OUTCOME_LIMIT,
  answerReport,
  listReports,
  locateTarget,
  reportFromRow,
} from "../src/readerReport/readerReport.js";
import { runReportCommand } from "../src/readerReport/reportCli.js";
import { freshAppDatabase, readOnlyDictionary } from "./databases.js";

const file = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const RELEASE = "it-a";
const NOW = Date.parse("2026-10-01T09:00:00Z");
const sha = (digit: string) => digit.repeat(64);

/**
 * One release loaded into a dictionary, each record given as
 * `[record_id, line_no, line_sha256, word]`. Seeding the same release twice
 * with other record numbers is what a re-seed under a changed importer does.
 */
function dictionary(records: readonly (readonly [number, number, string, string])[], release = RELEASE): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(file("src/db/schema.sql"), "utf8"));
  db.prepare(
    `INSERT INTO source_release
      (release_id, source_name, archive_r2_key, archive_sha256, archive_bytes, normalizer, importer_version, schema_version)
      VALUES (?, 'kaikki-it-wiktextract', 'releases/a.jsonl.gz', ?, 1, 'it-normalize/v1', 'it-import/v1', 1)`,
  ).run(release, sha("0"));
  for (const [recordId, lineNo, lineSha256, word] of records) {
    db.prepare("INSERT INTO source_record VALUES (?, ?, ?, ?, ?, 'noun', 'Sostantivo', 'it')").run(recordId, release, lineNo, lineSha256, word);
  }
  return db;
}

/** A report as the box stores it, on the reading at `line`, or on the word alone. */
const store = (appDb: AppTables, line?: { recordId: number; lineNo: number; lineSha256: string }) =>
  appDb.app.insert(readerReport).values({
    releaseId: RELEASE,
    word: "sale",
    recordId: line?.recordId ?? null,
    lineNo: line?.lineNo ?? null,
    lineSha256: line?.lineSha256 ?? null,
    choice: "meaning",
    details: "This meaning belongs to sala.",
    visitorHash: sha("f"),
    receivedAt: "2026-09-30T12:00:00.000Z",
  });

test("a re-seed that renumbers the records leaves a report on the line the reader saw, not on the old number", async () => {
  const { appDb } = freshAppDatabase();
  // The reader picked line 5, which this build numbered 2.
  await store(appDb, { recordId: 2, lineNo: 5, lineSha256: sha("5") });
  const [report] = await listReports(appDb, "waiting");

  const first = readOnlyDictionary(dictionary([[1, 4, sha("4"), "sala"], [2, 5, sha("5"), "sale"]]));
  assert.deepEqual(await locateTarget(report, first), { kind: "found", recordId: 2 });

  // The same release seeded again by an importer that admits one more line: 2 is now another record.
  const reseeded = readOnlyDictionary(dictionary([[1, 3, sha("3"), "sal"], [2, 4, sha("4"), "sala"], [3, 5, sha("5"), "sale"]]));
  assert.deepEqual(await locateTarget(report, reseeded), { kind: "found", recordId: 3 });
  assert.deepEqual(report.target, { kind: "reading", recordId: 2, line: { lineNo: 5, lineSha256: sha("5") } }, "the report itself is unchanged");
});

test("a line this dictionary does not hold, or holds with another digest, is said so, never matched to whatever is there", async () => {
  const { appDb } = freshAppDatabase();
  await store(appDb, { recordId: 2, lineNo: 5, lineSha256: sha("5") });
  await store(appDb);
  const [onReading, onWord] = await listReports(appDb, "waiting");
  assert.deepEqual(await locateTarget(onReading, readOnlyDictionary(dictionary([[2, 5, sha("9"), "sale"]]))), { kind: "changed" });
  assert.deepEqual(await locateTarget(onReading, readOnlyDictionary(dictionary([[2, 5, sha("5"), "sale"]], "it-b"))), { kind: "not-loaded" });
  assert.deepEqual(await locateTarget(onReading, readOnlyDictionary(dictionary([[2, 6, sha("5"), "sale"]]))), { kind: "not-loaded" });
  assert.deepEqual(await locateTarget(onWord, readOnlyDictionary(dictionary([]))), { kind: "word" });
});

test("a report stored before reports kept their line still lists, and is said to have no line to follow", async () => {
  const { appDb } = freshAppDatabase();
  await appDb.app.insert(readerReport).values({
    releaseId: RELEASE,
    word: "sale",
    recordId: 2,
    choice: "meaning",
    details: "Old report.",
    visitorHash: sha("f"),
    receivedAt: "2026-09-28T12:00:00.000Z",
  });
  const [report] = await listReports(appDb, "all");
  assert.deepEqual(report.target, { kind: "reading", recordId: 2, line: undefined });
  assert.deepEqual(await locateTarget(report, readOnlyDictionary(dictionary([[2, 5, sha("5"), "sale"]]))), { kind: "unpinned" });
});

test("the table refuses a line with no reading or no digest, and a half-written answer", async () => {
  const { sqlite } = freshAppDatabase();
  const insert = (columns: string, values: string) =>
    `INSERT INTO reader_report (release_id, word, choice, details, visitor_hash, received_at${columns})
     VALUES ('${RELEASE}', 'sale', 'meaning', 'x', 'h', '2026-09-30'${values})`;
  const refused: [string, string][] = [
    ["a line with no reading", insert(", line_no, line_sha256", `, 5, '${sha("5")}'`)],
    ["a line with no digest", insert(", record_id, line_no", ", 2, 5")],
    ["a digest that is not SHA-256", insert(", record_id, line_no, line_sha256", ", 2, 5, 'abc'")],
    ["an outcome with no reviewer", insert(", outcome, reviewed_at", ", 'Fixed.', '2026-10-01'")],
    ["a reviewer with no outcome", insert(", reviewed_at, reviewed_by", ", '2026-10-01', 'huey'")],
    ["an empty outcome", insert(", outcome, reviewed_at, reviewed_by", ", '', '2026-10-01', 'huey'")],
  ];
  for (const [what, sql] of refused) assert.throws(() => sqlite.exec(sql), /CHECK constraint failed/, what);
  sqlite.exec(insert(", record_id, line_no, line_sha256, outcome, reviewed_at, reviewed_by", `, 2, 5, '${sha("5")}', 'Fixed.', '2026-10-01', 'huey'`));
});

test("an answer is recorded once, beside the report, and takes it off the waiting list", async () => {
  const { appDb } = freshAppDatabase();
  await store(appDb, { recordId: 2, lineNo: 5, lineSha256: sha("5") });
  const answer = { outcome: "  Reported upstream on Wiktionary.  ", reviewedBy: "huey" };
  assert.deepEqual(await answerReport(appDb, 1, answer, NOW), { outcome: "answered" });
  assert.deepEqual(await answerReport(appDb, 1, { outcome: "Something else.", reviewedBy: "huey" }, NOW + 1), {
    outcome: "refused",
    reason: "already-answered",
  });
  assert.deepEqual(await listReports(appDb, "waiting"), []);
  const [report] = await listReports(appDb, "all");
  assert.deepEqual(report.review, {
    state: "answered",
    outcome: "Reported upstream on Wiktionary.",
    reviewedAt: new Date(NOW).toISOString(),
    reviewedBy: "huey",
  });
  assert.equal(report.details, "This meaning belongs to sala.", "what the reader said is kept as sent");
});

test("an answer needs a report that exists, an outcome within the limit and someone who looked", async () => {
  const { appDb } = freshAppDatabase();
  await store(appDb);
  const refused = (reportId: number, outcome: string, reviewedBy: string) => answerReport(appDb, reportId, { outcome, reviewedBy }, NOW);
  assert.deepEqual(await refused(9, "Fixed.", "huey"), { outcome: "refused", reason: "no-report" });
  assert.deepEqual(await refused(1, "   ", "huey"), { outcome: "refused", reason: "outcome" });
  assert.deepEqual(await refused(1, "x".repeat(OUTCOME_LIMIT + 1), "huey"), { outcome: "refused", reason: "outcome-too-long" });
  assert.deepEqual(await refused(1, "Fixed.", " "), { outcome: "refused", reason: "reviewer" });
  assert.equal((await listReports(appDb, "waiting")).length, 1);
});

test("a row reads back as the report it holds", () => {
  const row = {
    reportId: 4,
    releaseId: RELEASE,
    word: "sale",
    recordId: null,
    lineNo: null,
    lineSha256: null,
    choice: "other" as const,
    details: "x",
    visitorHash: sha("f"),
    receivedAt: "2026-09-30",
    outcome: null,
    reviewedAt: null,
    reviewedBy: null,
  };
  assert.deepEqual(reportFromRow(row), {
    reportId: 4,
    releaseId: RELEASE,
    word: "sale",
    target: { kind: "word" },
    choice: "other",
    details: "x",
    receivedAt: "2026-09-30",
    review: { state: "waiting" },
  });
});

test("`pnpm run report` lists what waits with where its reading is, and records an answer", async () => {
  const { appDb } = freshAppDatabase();
  const db = readOnlyDictionary(dictionary([[3, 5, sha("5"), "sale"]]));
  assert.deepEqual(await runReportCommand(["list"], appDb, db, NOW), { out: "no report is waiting", status: 0 });
  await store(appDb, { recordId: 2, lineNo: 5, lineSha256: sha("5") });
  assert.deepEqual(await runReportCommand(["list"], appDb, db, NOW), {
    out: [
      "#1  2026-09-30T12:00:00.000Z  sale  (meaning)",
      `  reading: line 5 of ${RELEASE}, record 3 in this dictionary`,
      "  reader said: This meaning belongs to sala.",
      "  waiting",
    ].join("\n"),
    status: 0,
  });
  assert.deepEqual(await runReportCommand(["answer", "1", "--outcome", "Fixed upstream.", "--by", "huey"], appDb, db, NOW), {
    out: "report 1 answered",
    status: 0,
  });
  assert.deepEqual(await runReportCommand(["answer", "1", "--outcome", "Again.", "--by", "huey"], appDb, db, NOW), {
    out: "report 1: already answered; its answer stands",
    status: 1,
  });
  assert.deepEqual(await runReportCommand(["list"], appDb, db, NOW), { out: "no report is waiting", status: 0 });
  const all = await runReportCommand(["list", "--all"], appDb, db, NOW);
  assert.match(all.out, /answered 2026-10-01T09:00:00\.000Z by huey: Fixed upstream\./);
  assert.equal((await runReportCommand(["answer", "1", "--outcome", "x"], appDb, db, NOW)).status, 1);
  assert.equal((await runReportCommand(["list", "--everything"], appDb, db, NOW)).status, 1);
});

/** Every source file the Worker builds from, tests aside. */
function siteSources(): string[] {
  return readdirSync(file("web"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`)
    .filter((path) => !/\/(node_modules|dist|test|\.wrangler|\.next)\//.test(path));
}

test("nothing the site serves reads a report or its answer: only the box's store touches the table", () => {
  const sources = siteSources();
  assert.ok(sources.some((path) => path.endsWith("lib/dictionary/report.ts")), "the scan reads the site's sources");
  const touching = sources
    .filter((path) => /\breaderReport\b|\breader_report\b/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(file("web").length));
  assert.deepEqual(touching, ["/lib/dictionary/report.ts"]);
});
