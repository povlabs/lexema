// A reader's report of a mistake, as a person reviews it (#12). The page's box
// stores it (web/lib/dictionary/report.ts, #51); this is the other half: read
// what waits, find the reading it names, and record what the person found.
//
// A report is what a reader said, not what Lexema says. Nothing here writes to
// the dictionary, and nothing a page or the API serves reads a report or its
// answer. A person who finds a real mistake fixes it by hand, elsewhere.

import { and, asc, eq, isNull } from "drizzle-orm";
import type { AppTables } from "../db/app/database.js";
import { readerReport } from "../db/app/schema.js";
import type { LookupDatabase } from "../lookup/database.js";

/** The longest answer a person may record, in characters, as the table allows. */
export const OUTCOME_LIMIT = 2000;

/** One line of a release's source file: where a reading came from, whatever number a build gave it. */
export interface SourceLine {
  lineNo: number;
  lineSha256: string;
}

/** What the report is about: the word alone, or one reading of it. */
export type ReportTarget =
  | { kind: "word" }
  /** `line` is undefined only for a report stored before #12 kept it. */
  | { kind: "reading"; recordId: number; line: SourceLine | undefined };

/** Whether someone has looked yet. */
export type ReportReview =
  | { state: "waiting" }
  | { state: "answered"; outcome: string; reviewedAt: string; reviewedBy: string };

type Row = typeof readerReport.$inferSelect;

export interface ReaderReport {
  reportId: number;
  releaseId: string;
  word: string;
  target: ReportTarget;
  choice: Row["choice"];
  details: string;
  receivedAt: string;
  review: ReportReview;
}

/** A stored row as a report. The table's CHECKs make every other shape unstorable. */
export function reportFromRow(row: Row): ReaderReport {
  const target: ReportTarget =
    row.recordId === null
      ? { kind: "word" }
      : {
          kind: "reading",
          recordId: row.recordId,
          line: row.lineNo === null || row.lineSha256 === null ? undefined : { lineNo: row.lineNo, lineSha256: row.lineSha256 },
        };
  const review: ReportReview =
    row.outcome === null || row.reviewedAt === null || row.reviewedBy === null
      ? { state: "waiting" }
      : { state: "answered", outcome: row.outcome, reviewedAt: row.reviewedAt, reviewedBy: row.reviewedBy };
  return {
    reportId: row.reportId,
    releaseId: row.releaseId,
    word: row.word,
    target,
    choice: row.choice,
    details: row.details,
    receivedAt: row.receivedAt,
    review,
  };
}

/** The reports, oldest first: those still waiting, or all of them. */
export async function listReports({ app }: AppTables, which: "waiting" | "all"): Promise<ReaderReport[]> {
  const query = app.select().from(readerReport);
  const rows = await (which === "waiting" ? query.where(isNull(readerReport.outcome)) : query).orderBy(asc(readerReport.reportId));
  return rows.map(reportFromRow);
}

/**
 * Where a report's reading is in the dictionary at hand, found by its source
 * line and never by its stored `record_id`, which a re-seed may renumber.
 *
 * - `word`: the report names no reading.
 * - `found`: the release is loaded and its line still has the digest the report
 *   kept; `recordId` is that record's number in this dictionary.
 * - `changed`: the release is loaded but that line's digest differs, so the
 *   record there is not the one the reader saw.
 * - `not-loaded`: this dictionary does not hold that line of that release.
 * - `unpinned`: the report predates #12 and kept no line to follow.
 */
export type TargetInDictionary =
  | { kind: "word" }
  | { kind: "found"; recordId: number }
  | { kind: "changed" }
  | { kind: "not-loaded" }
  | { kind: "unpinned" };

export async function locateTarget(report: ReaderReport, db: LookupDatabase): Promise<TargetInDictionary> {
  if (report.target.kind === "word") return { kind: "word" };
  const { line } = report.target;
  if (line === undefined) return { kind: "unpinned" };
  const [held] = await db.all<{ recordId: number; lineSha256: string }>(
    "SELECT record_id AS recordId, line_sha256 AS lineSha256 FROM source_record WHERE release_id = ? AND line_no = ?",
    [report.releaseId, line.lineNo],
  );
  if (held === undefined) return { kind: "not-loaded" };
  if (held.lineSha256 !== line.lineSha256) return { kind: "changed" };
  return { kind: "found", recordId: held.recordId };
}

/** A person's answer to one report, checked before it is stored. */
export interface ReportAnswer {
  outcome: string;
  reviewedBy: string;
}

/** Why an answer was not recorded. */
export type AnswerRefusal = "no-report" | "already-answered" | "outcome" | "outcome-too-long" | "reviewer";

/**
 * Record what a person found, once. A report already answered keeps its
 * answer: a second one is refused rather than written over the first.
 */
export async function answerReport(
  { app }: AppTables,
  reportId: number,
  answer: ReportAnswer,
  now: number,
): Promise<{ outcome: "answered" } | { outcome: "refused"; reason: AnswerRefusal }> {
  const outcome = answer.outcome.trim();
  const reviewedBy = answer.reviewedBy.trim();
  if (outcome === "") return { outcome: "refused", reason: "outcome" };
  if (outcome.length > OUTCOME_LIMIT) return { outcome: "refused", reason: "outcome-too-long" };
  if (reviewedBy === "") return { outcome: "refused", reason: "reviewer" };
  const [found] = await app
    .select({ outcome: readerReport.outcome })
    .from(readerReport)
    .where(eq(readerReport.reportId, reportId));
  if (found === undefined) return { outcome: "refused", reason: "no-report" };
  if (found.outcome !== null) return { outcome: "refused", reason: "already-answered" };
  await app
    .update(readerReport)
    .set({ outcome, reviewedAt: new Date(now).toISOString(), reviewedBy })
    .where(and(eq(readerReport.reportId, reportId), isNull(readerReport.outcome)));
  return { outcome: "answered" };
}
