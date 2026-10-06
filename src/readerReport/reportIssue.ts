// One public GitHub issue per reader report (#631). Production's reports reach
// nobody on their own, so an hourly workflow reads the waiting ones and opens an
// issue for each new one. The repository is public, and so are its issues and
// its Actions logs. So what an issue is built from has no field for the
// reader's note or their visitor code, and the read never selects either. Nor
// does an issue print the word a reader sent as sent (#639): a report on a
// record shows that record's headword, read from the dictionary, and a report
// on no record shows its typed text only when it has the shape of a word.
// Anything else is withheld. The workflow never writes the database:
// it tells a sent report by the hidden marker on its issue.

import type { readerReport } from "../db/app/schema.js";

/** The label every report issue carries, and the only issues the run reads its markers from. */
export const REPORT_LABEL = "reader-report";

/** The most issues one run opens. The rest wait for the next run, oldest first. */
export const ISSUES_PER_RUN = 20;

/** Where a report's word is looked up on the live site. */
export const SITE_SEARCH = "https://lexema.fyi/?q=";

/** Every issue title ends with this, so the issue list says what each one is. */
export const TITLE_SUFFIX = " (reader report)";

/**
 * The run's one read of `reader_report`: the waiting reports, oldest first.
 * It selects the columns an issue is built from and whether a note is there,
 * never the note itself, the visitor code or the time it came in. `report_id`
 * is the row's integer key, so it rises with each report stored.
 */
export const WAITING_REPORTS_QUERY =
  "SELECT report_id, release_id, word, record_id, line_no, line_sha256, choice, " +
  "details IS NOT NULL AND length(details) > 0 AS has_note " +
  "FROM reader_report WHERE outcome IS NULL ORDER BY report_id";

type Choice = (typeof readerReport.$inferSelect)["choice"];

/** What the reader says is wrong, by the option they picked, in the plain words an issue's title and body both use. */
export const PROBLEMS = {
  meaning: "a meaning is wrong",
  example: "an example is wrong",
  form: "a form is wrong",
  synonym: "a synonym is wrong",
  other: "something else is wrong",
  missing: "missing word",
} as const satisfies Record<Choice, string>;
const CHOICES = Object.keys(PROBLEMS) as readonly Choice[];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isString = (value: unknown): value is string => typeof value === "string";

/** The reading a report names: its record, and its source line once #12 kept it. */
export interface NamedReading {
  readonly releaseId: string;
  readonly recordId: number;
  readonly lineNo: number | undefined;
}

/** A release id: `it-` and the first eight hex digits of the source file's SHA-256. */
const RELEASE_ID = /^it-[0-9a-f]{8}$/;
/** A source line's SHA-256, as `source_record.line_sha256` holds it. */
const LINE_SHA256 = /^[0-9a-f]{64}$/;

/** How the dictionary read finds a record: by its source line, or by its number alone. */
type RecordMatch = { readonly lineNo: number; readonly lineSha256: string } | { readonly recordId: number };

/**
 * The record a report names, as the dictionary read finds it. It holds only
 * values checked to be safe inside that read's statement. A report that kept
 * its source line is found by that line, because a re-seed of the same release
 * may renumber `record_id`; one stored before #12 has only its `record_id`.
 */
export class RecordKey {
  private constructor(
    readonly releaseId: string,
    readonly match: RecordMatch,
  ) {}

  /** The key of `reading`, or undefined when a value fails its check, so no statement ever carries it. */
  static of(reading: NamedReading, lineSha256: string | undefined): RecordKey | undefined {
    if (!RELEASE_ID.test(reading.releaseId)) return undefined;
    if (reading.lineNo === undefined) return isWhole(reading.recordId) ? new RecordKey(reading.releaseId, { recordId: reading.recordId }) : undefined;
    if (!isWhole(reading.lineNo) || lineSha256 === undefined || !LINE_SHA256.test(lineSha256)) return undefined;
    return new RecordKey(reading.releaseId, { lineNo: reading.lineNo, lineSha256 });
  }

  /** One string per key, the same for a key and for the dictionary row it matches. */
  get id(): string {
    return "recordId" in this.match ? recordId(this.releaseId, this.match.recordId) : lineId(this.releaseId, this.match.lineNo, this.match.lineSha256);
  }

  /** This key's condition in the headword read. Every value in it passed its check in `of`. */
  get condition(): string {
    return "recordId" in this.match
      ? `(record_id = ${this.match.recordId} AND release_id = '${this.releaseId}')`
      : `(release_id = '${this.releaseId}' AND line_no = ${this.match.lineNo} AND line_sha256 = '${this.match.lineSha256}')`;
  }
}

const recordId = (releaseId: string, id: number): string => `record ${releaseId} ${id}`;
const lineId = (releaseId: string, lineNo: number, lineSha256: string): string => `line ${releaseId} ${lineNo} ${lineSha256}`;

/** The columns the headword read selects from `source_record`: its keys, `word` and `pos_title`, nothing else. */
const HEADWORD_COLUMNS = "record_id, release_id, line_no, line_sha256, word, pos_title";

/**
 * The run's one read of production's `lexema-dictionary`: the headwords of the
 * records `keys` name, or undefined when there are none to read. Its shape is
 * fixed; only the checked values of the keys vary.
 */
export function headwordQuery(keys: readonly RecordKey[]): string | undefined {
  const conditions = [...new Set(keys.map(({ condition }) => condition))];
  if (conditions.length === 0) return undefined;
  return `SELECT ${HEADWORD_COLUMNS} FROM source_record WHERE ${conditions.join(" OR ")}`;
}

/** Where the headword read runs: it takes `headwordQuery`'s statement and gives back its rows. */
export interface Dictionary {
  rows(statement: string): unknown[];
}

/** A record as the headword read found it: its headword and its part of speech. */
export interface Headword {
  readonly word: string;
  readonly posTitle: string;
}

/** The headwords one dictionary read found, by record key. */
export class Headwords {
  private constructor(private readonly byKey: ReadonlyMap<string, Headword>) {}

  /** No headwords: what a run with no record to look up holds. */
  static readonly none = new Headwords(new Map());

  /**
   * Read the headwords of the records `keys` name in one statement, or none,
   * with no read, when no key needs one. A row `source_record` would refuse is
   * a throw that quotes none of it.
   */
  static read(keys: readonly RecordKey[], dictionary: Dictionary): Headwords {
    const statement = headwordQuery(keys);
    if (statement === undefined) return Headwords.none;
    const byKey = new Map<string, Headword>();
    for (const row of dictionary.rows(statement)) {
      if (!isRecord(row)) throw new Error("the headword read answered a row that is not a record");
      const { record_id: id, release_id: releaseId, line_no: lineNo, line_sha256: lineSha256, word, pos_title: posTitle } = row;
      if (!isWhole(id) || !isString(releaseId) || !isWhole(lineNo) || !isString(lineSha256) || !isString(word) || !isString(posTitle)) {
        throw new Error("the headword read answered a row source_record would refuse");
      }
      const headword: Headword = { word, posTitle };
      byKey.set(lineId(releaseId, lineNo, lineSha256), headword);
      byKey.set(recordId(releaseId, id), headword);
    }
    return new Headwords(byKey);
  }

  /** The headword of the record `key` names, if the read found it. */
  of(key: RecordKey): Headword | undefined {
    return this.byKey.get(key.id);
  }
}

/** The letters a typed word may hold: Latin letters and the accented letters Italian writes. */
const LETTER = "A-Za-zÀÈÉÌÍÎÒÓÙÚàèéìíîòóùú";
/** One word: letters, apostrophes and hyphens, with at least one letter. */
const TYPED_WORD = new RegExp(`^[${LETTER}'’-]*[${LETTER}][${LETTER}'’-]*$`);
/** The longest typed text an issue shows, in characters and in words. */
export const TYPED_WORD_LIMIT = { characters: 40, words: 4 } as const;

/**
 * A reader's typed text when it has the shape of a word or a short phrase, so
 * an issue may show it, or undefined: letters, apostrophes and hyphens only, so
 * no digits, `@`, `/`, `:` or `.`; single spaces between words and none at
 * either end; at most 40 characters and 4 words. A decomposed accent is joined
 * first, so `perché` passes however it was typed.
 */
export function typedWord(text: string): string | undefined {
  const word = text.normalize("NFC");
  const words = word.split(" ");
  if ([...word].length > TYPED_WORD_LIMIT.characters || words.length > TYPED_WORD_LIMIT.words) return undefined;
  return words.every((part) => TYPED_WORD.test(part)) ? word : undefined;
}

/**
 * What a report is about, as its issue may show it: a record, found by its key,
 * or the reader's typed text. Neither holds text that may not be shown: a
 * record's submitted word is dropped when the row is read, and typed text that
 * fails the word shape is never kept. An undefined key or word is withheld.
 */
export type ReportSubject =
  | { readonly kind: "record"; readonly key: RecordKey | undefined }
  | { readonly kind: "typed"; readonly word: string | undefined };

const MARKER_PREFIX = "<!-- lexema-reader-report:";
const MARKER_SUFFIX = " -->";
/** A marker alone on its line, which is how an issue body here carries it. */
const MARKER_LINE = /^<!-- lexema-reader-report:([1-9]\d*) -->$/gm;

/** The hidden line that says which report an issue is for. */
export const reportMarker = (reportId: number): string => `${MARKER_PREFIX}${reportId}${MARKER_SUFFIX}`;

/** Line breaks of every kind, and the other control characters, which could end a code span's line. */
const LINE_BREAKING = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

/**
 * Text as one inline code span that nothing can break out of: every control
 * character and line break becomes a space, and the fence is one backtick
 * longer than the longest run inside, padded with a space on each side. Inside
 * a code span GitHub forms no mention, link or reference, and shows HTML as
 * text.
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

/**
 * A waiting report as its public issue shows it. It holds no note and no
 * visitor code, only whether a note is there, and no word a reader typed
 * unless it has the shape of a word, so nothing built from it can publish any
 * of them.
 */
export class ReportNotice {
  readonly reportId: number;
  readonly subject: ReportSubject;
  readonly reading: NamedReading | undefined;
  readonly choice: Choice;
  readonly hasNote: boolean;

  private constructor(reportId: number, subject: ReportSubject, reading: NamedReading | undefined, choice: Choice, hasNote: boolean) {
    this.reportId = reportId;
    this.subject = subject;
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
    const { release_id: releaseId, word, record_id: recordId, line_no: lineNo, line_sha256: lineSha256, choice, has_note: hasNote } = row;
    if (typeof releaseId !== "string" || releaseId === "") return refuse("release_id");
    if (typeof word !== "string") return refuse("word");
    if (typeof choice !== "string" || !CHOICES.includes(choice as Choice)) return refuse("choice");
    if (hasNote !== 0 && hasNote !== 1) return refuse("has_note");
    if (recordId !== null && !isWhole(recordId)) return refuse("record_id");
    if (lineNo !== null && !isWhole(lineNo)) return refuse("line_no");
    if (lineSha256 !== null && !isString(lineSha256)) return refuse("line_sha256");
    if (recordId === null && lineNo !== null) return refuse("line_no");
    if ((lineNo === null) !== (lineSha256 === null)) return refuse("line_sha256");
    if (recordId !== null && choice === "missing") return refuse("record_id");
    const reading = recordId === null ? undefined : { releaseId, recordId, lineNo: lineNo ?? undefined };
    const subject: ReportSubject =
      reading === undefined ? { kind: "typed", word: typedWord(word) } : { kind: "record", key: RecordKey.of(reading, lineSha256 ?? undefined) };
    return new ReportNotice(id, subject, reading, choice as Choice, hasNote === 1);
  }

  /** The key the headword read finds this report's record by, when it names one whose values passed their checks. */
  get recordKey(): RecordKey | undefined {
    return this.subject.kind === "record" ? this.subject.key : undefined;
  }

  /** The word the issue shows: the record's headword or the accepted typed text, or undefined when it is withheld. */
  shownWord(headwords: Headwords): string | undefined {
    if (this.subject.kind === "typed") return this.subject.word;
    return this.subject.key === undefined ? undefined : headwords.of(this.subject.key)?.word;
  }

  /** What the reader says is wrong, in plain words. */
  get problem(): string {
    return PROBLEMS[this.choice];
  }

  /**
   * The issue's title: `<word>: <problem> (reader report)`, or
   * `Report <id>: <problem> (reader report)` when the word is withheld or lacks
   * the shape of a word. A title has no code span and GitHub links a `#`
   * reference in one, so only a word `typedWord` accepts may stand there.
   */
  title(headwords: Headwords): string {
    const word = this.shownWord(headwords);
    const titled = word === undefined ? undefined : typedWord(word);
    return `${titled ?? `Report ${this.reportId}`}: ${this.problem}${TITLE_SUFFIX}`;
  }

  /**
   * The issue's body: the hidden marker on its own line, then one short
   * paragraph per fact, and nothing else from the row. The word and its page
   * link both come from `shownWord`; a withheld word has no page link. The
   * part of speech comes from the same dictionary row as the headword.
   */
  body(headwords: Headwords): string {
    const word = this.shownWord(headwords);
    const paragraphs = [
      word === undefined ? "The word is withheld." : `The word is ${inertCode(word)}. Its page is <${sitePage(word)}>.`,
      ...this.readingParagraphs(headwords),
      `The reader picked: ${this.problem}.`,
      this.hasNote ? "The reader left a note. Read it with `pnpm run report list`." : "No note.",
      `<sub>Report ${this.reportId}.</sub>`,
    ];
    return `${reportMarker(this.reportId)}\n\n${paragraphs.join("\n\n")}\n`;
  }

  /** The reading's part of speech, when the read found it, then its release, line and record in small print; or that none was picked. */
  private readingParagraphs(headwords: Headwords): string[] {
    if (this.reading === undefined) return ["The reader picked no reading."];
    const key = this.recordKey;
    const posTitle = key === undefined ? undefined : headwords.of(key)?.posTitle;
    const where = [
      `Release ${inertCode(this.reading.releaseId)}`,
      this.reading.lineNo === undefined ? "no line kept" : `line ${this.reading.lineNo}`,
      `record ${this.reading.recordId}`,
    ].join(", ");
    return [
      posTitle === undefined ? "The reading's part of speech is not known." : `The reading's part of speech is ${inertCode(posTitle)}.`,
      `<sub>${where}.</sub>`,
    ];
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
 * marks, read the headwords of the records the oldest `cap` of the rest name,
 * in one dictionary read, and open an issue for each of those reports. Logs
 * counts and report ids only, never a word or a row.
 */
export async function sendWaitingReports(
  source: WaitingReports,
  issues: ReportIssues,
  dictionary: Dictionary,
  log: (line: string) => void,
  cap: number = ISSUES_PER_RUN,
): Promise<RunResult> {
  const waiting = source.read();
  log(`reader reports: ${waiting.length} waiting`);
  if (waiting.length === 0) return { opened: [], alreadySent: [], later: [] };
  const plan = planRun(waiting, sentReportIds(await issues.labelledBodies()), cap);
  log(`reader reports: ${plan.alreadySent.length} already have an issue`);
  const keys = plan.open.flatMap(({ recordKey }) => (recordKey === undefined ? [] : [recordKey]));
  const headwords = Headwords.read(keys, dictionary);
  if (keys.length > 0) log(`reader reports: found the headword of ${keys.filter((key) => headwords.of(key) !== undefined).length} of ${keys.length} records`);
  const opened: number[] = [];
  if (plan.open.length > 0) await issues.ensureLabel();
  for (const notice of plan.open) {
    await issues.open(notice.title(headwords), notice.body(headwords));
    opened.push(notice.reportId);
    log(`reader reports: opened an issue for report ${notice.reportId}`);
  }
  if (plan.later.length > 0) {
    log(`reader reports: ${plan.later.length} left for the next run (at most ${cap} a run): ${plan.later.map(({ reportId }) => reportId).join(", ")}`);
  }
  log(`reader reports: opened ${opened.length}`);
  return { opened, alreadySent: plan.alreadySent, later: plan.later.map(({ reportId }) => reportId) };
}
