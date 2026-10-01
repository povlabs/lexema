// `pnpm run report`: read readers' reports and record what a person found (#12).
//
//   pnpm run report list
//   pnpm run report list --all
//   pnpm run report answer 3 --outcome "Fixed upstream in Wiktionary." --by huey
//
// `list` prints the reports still waiting, oldest first, or every report with
// `--all`, each with where its reading is in the local dictionary. `answer`
// records one report's outcome, once. Nothing here changes the dictionary or
// anything a reader sees. The databases are the local ones `pnpm run seed:dev`
// builds in `SEED_STATE`, as `pnpm run plan` reaches them.

import { finish, flags, isMain, positive, usageError, type CommandResult } from "../commandLine.js";
import type { AppTables } from "../db/app/database.js";
import { seededAppDatabase, seededDictionary } from "../db/localD1.js";
import type { LookupDatabase } from "../lookup/database.js";
import { answerReport, listReports, locateTarget, type AnswerRefusal, type ReaderReport, type TargetInDictionary } from "./readerReport.js";

const USAGE = `usage:
  pnpm run report list [--all]
  pnpm run report answer <report id> --outcome <what was found or done> --by <who looked>`;

const usage = (problem: string): CommandResult => usageError(problem, USAGE);

const REFUSAL: Readonly<Record<AnswerRefusal, string>> = {
  "no-report": "no such report",
  "already-answered": "already answered; its answer stands",
  outcome: "--outcome is empty",
  "outcome-too-long": "--outcome is longer than 2,000 characters",
  reviewer: "--by is empty",
};

/** Where the reading is, in a few words. */
function describeTarget(report: ReaderReport, where: TargetInDictionary): string {
  if (report.target.kind === "word") return "no reading picked";
  const line = report.target.line === undefined ? "" : `line ${report.target.line.lineNo} of ${report.releaseId}`;
  switch (where.kind) {
    case "found":
      return `${line}, record ${where.recordId} in this dictionary`;
    case "changed":
      return `${line}, which this dictionary holds with another digest: not the record the reader saw`;
    case "not-loaded":
      return `${line}, not in this dictionary`;
    case "unpinned":
      return `record ${report.target.recordId} of ${report.releaseId}, sent before reports kept their line`;
    case "word":
      return "no reading picked";
  }
}

async function describeReport(report: ReaderReport, dictionary: LookupDatabase): Promise<string> {
  const review =
    report.review.state === "waiting"
      ? "waiting"
      : `answered ${report.review.reviewedAt} by ${report.review.reviewedBy}: ${report.review.outcome}`;
  return [
    `#${report.reportId}  ${report.receivedAt}  ${report.word}  (${report.choice})`,
    `  reading: ${describeTarget(report, await locateTarget(report, dictionary))}`,
    `  reader said: ${report.details}`,
    `  ${review}`,
  ].join("\n");
}

/** Run one command against the app database and the dictionary. */
export async function runReportCommand(
  args: readonly string[],
  appDb: AppTables,
  dictionary: LookupDatabase,
  now: number,
): Promise<CommandResult> {
  const [command, ...rest] = args;
  if (command === "list") {
    if (rest.length > 1 || (rest.length === 1 && rest[0] !== "--all")) return usage(`unknown argument ${rest[0]}`);
    const reports = await listReports(appDb, rest.length === 1 ? "all" : "waiting");
    if (reports.length === 0) return { out: rest.length === 1 ? "no reports" : "no report is waiting", status: 0 };
    const described: string[] = [];
    for (const report of reports) described.push(await describeReport(report, dictionary));
    return { out: described.join("\n\n"), status: 0 };
  }
  if (command === "answer") {
    const [idText, ...answerArgs] = rest;
    const reportId = positive(idText);
    if (reportId === undefined) return usage("answer needs a report id");
    const given = flags(answerArgs, ["outcome", "by"]);
    if (typeof given === "string") return usage(given);
    const outcome = given.get("outcome");
    const reviewedBy = given.get("by");
    if (outcome === undefined) return usage("answer needs --outcome");
    if (reviewedBy === undefined) return usage("answer needs --by");
    const answered = await answerReport(appDb, reportId, { outcome, reviewedBy }, now);
    if (answered.outcome === "refused") return { out: `report ${reportId}: ${REFUSAL[answered.reason]}`, status: 1 };
    return { out: `report ${reportId} answered`, status: 0 };
  }
  return usage(command === undefined ? "no command" : `unknown command ${command}`);
}

if (isMain(import.meta.url)) {
  finish(await runReportCommand(process.argv.slice(2), seededAppDatabase(), seededDictionary(), Date.now()));
}
