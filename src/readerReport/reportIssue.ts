// One public GitHub issue per reader report (#631). Production's reports reach
// nobody on their own, so an hourly workflow reads the waiting ones and opens an
// issue for each new one. The repository is public, and so are its issues and
// its Actions logs. So what an issue is built from has no field for the
// reader's note or their visitor code, the read never selects either, and the
// word a reader typed is shown inert. The workflow never writes the database:
// it tells a sent report by the hidden marker on its issue.

import type { readerReport } from "../db/app/schema.js";

/** The label every report issue carries, and the only issues the run reads its markers from. */
export const REPORT_LABEL = "reader-report";

/** The most issues one run opens. The rest wait for the next run, oldest first. */
export const ISSUES_PER_RUN = 20;

/** Where a report's word is looked up on the live site. */
export const SITE_SEARCH = "https://lexema.fyi/?q=";

/**
 * The run's one read of `reader_report`: the waiting reports, oldest first.
 * It selects the columns an issue shows and whether a note is there, never the
 * note itself, the visitor code or the time it came in. `report_id` is the
 * row's integer key, so it rises with each report stored.
 */
export const WAITING_REPORTS_QUERY =
  "SELECT report_id, release_id, word, record_id, line_no, choice, " +
  "details IS NOT NULL AND length(details) > 0 AS has_note " +
  "FROM reader_report WHERE outcome IS NULL ORDER BY report_id";

type Choice = (typeof readerReport.$inferSelect)["choice"];
const CHOICES: readonly Choice[] = ["meaning", "example", "form", "synonym", "other", "missing"];

/** The reading a report names: its record, and its source line once #12 kept it. */
export interface NamedReading {
  readonly releaseId: string;
  readonly recordId: number;
  readonly lineNo: number | undefined;
}

const MARKER_PREFIX = "<!-- lexema-reader-report:";
const MARKER_SUFFIX = " -->";
/** A marker alone on its line, which is how an issue body here carries it. */
const MARKER_LINE = /^<!-- lexema-reader-report:([1-9]\d*) -->$/gm;

/** The hidden line that says which report an issue is for. */
export const reportMarker = (reportId: number): string => `${MARKER_PREFIX}${reportId}${MARKER_SUFFIX}`;

/** Line breaks of every kind, and the other control characters, which could end a code span's line. */
const LINE_BREAKING = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

/**
 * Reader text as one inline code span that nothing can break out of: every
 * control character and line break becomes a space, and the fence is one
 * backtick longer than the longest run inside, padded with a space on each
 * side. Inside a code span GitHub forms no mention, link or reference, and
 * shows HTML as text.
 */
export function inertCode(text: string): string {
  const oneLine = text.replace(LINE_BREAKING, " ");
  const longestRun = Math.max(0, ...[...oneLine.matchAll(/`+/g)].map(([run]) => run.length));
  const fence = "`".repeat(longestRun + 1);
  return `${fence} ${oneLine} ${fence}`;
}

/**
 * The word's page on the live site. `encodeURIComponent` leaves `!'()*` as they
 * are; they are encoded too, so the URL holds nothing Markdown reads as syntax.
 */
export function sitePage(word: string): string {
  const query = encodeURIComponent(word).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${SITE_SEARCH}${query}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/**
 * A waiting report as its public issue shows it. It holds no note and no
 * visitor code, only whether a note is there, so nothing built from it can
 * publish either.
 */
export class ReportNotice {
  readonly reportId: number;
  readonly word: string;
  readonly reading: NamedReading | undefined;
  readonly choice: Choice;
  readonly hasNote: boolean;

  private constructor(reportId: number, word: string, reading: NamedReading | undefined, choice: Choice, hasNote: boolean) {
    this.reportId = reportId;
    this.word = word;
    this.reading = reading;
    this.choice = choice;
    this.hasNote = hasNote;
  }

  /**
   * One row of `WAITING_REPORTS_QUERY`, or a throw. Only the fields named here
   * are read, so any other column a row carried is dropped. A refusal names the
   * report and the column, never a value.
   */
  static fromRow(row: unknown): ReportNotice {
    if (!isRecord(row) || !isWhole(row.report_id)) throw new Error("a waiting report has no whole report_id");
    const id = row.report_id;
    const refuse = (column: string): never => {
      throw new Error(`report ${id}: ${column} is not what reader_report allows`);
    };
    const { release_id: releaseId, word, record_id: recordId, line_no: lineNo, choice, has_note: hasNote } = row;
    if (typeof releaseId !== "string" || releaseId === "") return refuse("release_id");
    if (typeof word !== "string") return refuse("word");
    if (typeof choice !== "string" || !CHOICES.includes(choice as Choice)) return refuse("choice");
    if (hasNote !== 0 && hasNote !== 1) return refuse("has_note");
    if (recordId !== null && !isWhole(recordId)) return refuse("record_id");
    if (lineNo !== null && !isWhole(lineNo)) return refuse("line_no");
    if (recordId === null && lineNo !== null) return refuse("line_no");
    if (recordId !== null && choice === "missing") return refuse("record_id");
    const reading = recordId === null ? undefined : { releaseId, recordId, lineNo: lineNo ?? undefined };
    return new ReportNotice(id, word, reading, choice as Choice, hasNote === 1);
  }

  /** The issue's title. The word is left out: GitHub links a `#` reference in a title, and a title has no code span. */
  get title(): string {
    return `Reader report ${this.reportId}: ${this.choice}`;
  }

  /** The issue's body: the hidden marker on its own line, then one line per fact, and nothing else from the row. */
  get body(): string {
    const reading =
      this.reading === undefined
        ? "no reading picked"
        : [
            `release ${inertCode(this.reading.releaseId)}`,
            this.reading.lineNo === undefined ? "no line kept" : `line ${this.reading.lineNo}`,
            `record ${this.reading.recordId}`,
          ].join(", ");
    return [
      reportMarker(this.reportId),
      "",
      `- report id: ${this.reportId}`,
      `- word: ${inertCode(this.word)}`,
      `- page: <${sitePage(this.word)}>`,
      `- reading: ${reading}`,
      `- option: ${this.choice}`,
      `- has a note: ${this.hasNote ? "yes" : "no"}`,
      "",
    ].join("\n");
  }
}

/** The report ids the given issue bodies already carry a marker for. */
export function sentReportIds(bodies: readonly (string | null)[]): Set<number> {
  const sent = new Set<number>();
  for (const body of bodies) {
    for (const [, id] of (body ?? "").replaceAll("\r\n", "\n").matchAll(MARKER_LINE)) sent.add(Number(id));
  }
  return sent;
}

/** What one run does: the reports it opens an issue for, the ones already sent, and the ones left for the next run. */
export interface RunPlan {
  readonly open: readonly ReportNotice[];
  readonly alreadySent: readonly number[];
  readonly later: readonly ReportNotice[];
}

/** Split the waiting reports, oldest first, into those to open now (at most `cap`), those already sent, and those for later. */
export function planRun(waiting: readonly ReportNotice[], sent: ReadonlySet<number>, cap: number = ISSUES_PER_RUN): RunPlan {
  const oldestFirst = [...waiting].sort((a, b) => a.reportId - b.reportId);
  const unsent = oldestFirst.filter(({ reportId }) => !sent.has(reportId));
  return {
    open: unsent.slice(0, cap),
    alreadySent: oldestFirst.filter(({ reportId }) => sent.has(reportId)).map(({ reportId }) => reportId),
    later: unsent.slice(cap),
  };
}

/** Where the waiting reports come from. */
export interface WaitingReports {
  read(): ReportNotice[];
}

/** Where report issues live. */
export interface ReportIssues {
  /** The body of every issue that carries `REPORT_LABEL`, open and closed. */
  labelledBodies(): Promise<(string | null)[]>;
  /** Create `REPORT_LABEL` when the repository lacks it. */
  ensureLabel(): Promise<void>;
  /** Open one issue with `REPORT_LABEL`. */
  open(title: string, body: string): Promise<void>;
}

/** What a run did, by report id. */
export interface RunResult {
  readonly opened: readonly number[];
  readonly alreadySent: readonly number[];
  readonly later: readonly number[];
}

/**
 * One run: read the waiting reports, skip each one a labelled issue already
 * marks, and open an issue for the oldest `cap` of the rest. Logs counts and
 * report ids only, never a word or a row.
 */
export async function sendWaitingReports(
  source: WaitingReports,
  issues: ReportIssues,
  log: (line: string) => void,
  cap: number = ISSUES_PER_RUN,
): Promise<RunResult> {
  const waiting = source.read();
  log(`reader reports: ${waiting.length} waiting`);
  if (waiting.length === 0) return { opened: [], alreadySent: [], later: [] };
  const plan = planRun(waiting, sentReportIds(await issues.labelledBodies()), cap);
  log(`reader reports: ${plan.alreadySent.length} already have an issue`);
  const opened: number[] = [];
  if (plan.open.length > 0) await issues.ensureLabel();
  for (const notice of plan.open) {
    await issues.open(notice.title, notice.body);
    opened.push(notice.reportId);
    log(`reader reports: opened an issue for report ${notice.reportId}`);
  }
  if (plan.later.length > 0) {
    log(`reader reports: ${plan.later.length} left for the next run (at most ${cap} a run): ${plan.later.map(({ reportId }) => reportId).join(", ")}`);
  }
  log(`reader reports: opened ${opened.length}`);
  return { opened, alreadySent: plan.alreadySent, later: plan.later.map(({ reportId }) => reportId) };
}
