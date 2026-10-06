// One public issue per production reader report (#631): the read never selects
// the note, the visitor code or the time; an issue body holds the report's
// facts and no note; a re-run opens no twin; and one run opens at most 20. Its
// word is never the one the reader sent as sent (#639): a report on a record
// shows the dictionary's headword, read in one checked statement, and a report
// on no record shows its typed text only when it has the shape of a word. An
// issue reads at a glance (#652): its title names that word, when it may stand
// in a title, and what is wrong, and its body is short sentences.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readerReport } from "../src/db/app/schema.js";
import {
  Headwords,
  headwordQuery,
  ISSUES_PER_RUN,
  RecordKey,
  ReportNotice,
  inertCode,
  planRun,
  PROBLEMS,
  reportMarker,
  sendWaitingReports,
  sentReportIds,
  typedWord,
  WAITING_REPORTS_QUERY,
  type Dictionary,
  type ReportIssues,
} from "../src/readerReport/reportIssue.js";
import { githubIssues, nextPage, productionDictionary, productionReports, rowsOf, type Fetch } from "../src/readerReport/reportIssuesCli.js";
import { freshAppDatabase } from "./databases.js";

const sha = (digit: string) => digit.repeat(64);
const RELEASE = "it-0c432803";

interface Row {
  report_id: number;
  release_id: string;
  word: string;
  record_id: number | null;
  line_no: number | null;
  line_sha256: string | null;
  choice: string;
  has_note: 0 | 1;
}

const row = (reportId: number, fields: Partial<Row> = {}): Row => ({
  report_id: reportId,
  release_id: RELEASE,
  word: "sale",
  record_id: null,
  line_no: null,
  line_sha256: null,
  choice: "meaning",
  has_note: 1,
  ...fields,
});

const notice = (reportId: number, fields: Partial<Row> = {}) => ReportNotice.fromRow(row(reportId, fields));

/** A `source_record` row as the headword read answers it. */
interface SourceRow {
  record_id: number;
  release_id: string;
  line_no: number;
  line_sha256: string;
  word: string;
  /** `Sostantivo` when a test leaves it out. */
  pos_title?: string;
}

/** A dictionary that answers every read with `held`, as D1 would filter it, and keeps each statement it ran. */
function fakeDictionary(held: readonly SourceRow[]): Dictionary & { statements: string[] } {
  const statements: string[] = [];
  return {
    statements,
    rows(statement) {
      statements.push(statement);
      return held
        .filter(
          (r) =>
            statement.includes(`(release_id = '${r.release_id}' AND line_no = ${r.line_no} AND line_sha256 = '${r.line_sha256}')`) ||
            statement.includes(`(record_id = ${r.record_id} AND release_id = '${r.release_id}')`),
        )
        .map((r) => ({ pos_title: "Sostantivo", ...r }));
    },
  };
}

/** The headwords one read over `held` finds for `n`. */
const headwordsOf = (n: ReportNotice, held: readonly SourceRow[] = []): Headwords =>
  Headwords.read(n.recordKey === undefined ? [] : [n.recordKey], fakeDictionary(held));

/** The body of `n`'s issue after one headword read over `held`. */
const bodyOf = (n: ReportNotice, held: readonly SourceRow[] = []): string => n.body(headwordsOf(n, held));

/** The title of `n`'s issue after one headword read over `held`. */
const titleOf = (n: ReportNotice, held: readonly SourceRow[] = []): string => n.title(headwordsOf(n, held));

const lineOf = (body: string, prefix: string): string | undefined => body.split("\n").find((line) => line.startsWith(prefix));

/** The body's sentence about the word. */
const wordLine = (body: string): string | undefined => lineOf(body, "The word is ");

/** That sentence for a shown word, whose page link ends with `query`. */
const shownLine = (word: string, query: string): string => `The word is ${inertCode(word)}. Its page is <https://lexema.fyi/?q=${query}>.`;

const WITHHELD_LINE = "The word is withheld.";

test("the read selects exactly the issue's columns and a computed has_note, and never the note, the visitor code or the time", () => {
  const [, columns] = /^SELECT (.*) FROM reader_report /.exec(WAITING_REPORTS_QUERY) ?? [];
  assert.deepEqual(columns.split(", "), [
    "report_id",
    "release_id",
    "word",
    "record_id",
    "line_no",
    "line_sha256",
    "choice",
    "details IS NOT NULL AND length(details) > 0 AS has_note",
  ]);
  const hasNote = "details IS NOT NULL AND length(details) > 0 AS has_note";
  assert.ok(!WAITING_REPORTS_QUERY.replace(hasNote, "").includes("details"), "details is named only inside has_note");
  assert.ok(!WAITING_REPORTS_QUERY.includes("visitor_hash"));
  assert.ok(!WAITING_REPORTS_QUERY.includes("received_at"));
  assert.match(WAITING_REPORTS_QUERY, /^SELECT /);
  assert.doesNotMatch(WAITING_REPORTS_QUERY, /\b(UPDATE|INSERT|DELETE|REPLACE|DROP|ALTER|CREATE)\b/i);
  assert.ok(!WAITING_REPORTS_QUERY.includes(";"), "one statement");
});

test("the read runs on the real reader_report table: waiting reports only, oldest first, with has_note and no note", async () => {
  const { sqlite, appDb } = freshAppDatabase();
  const base = { releaseId: "it-a", visitorHash: sha("f"), receivedAt: "2026-10-01T09:00:00.000Z" } as const;
  await appDb.app.insert(readerReport).values([
    { ...base, word: "sale", recordId: 4, lineNo: 9, lineSha256: sha("9"), choice: "meaning", details: "Secret note." },
    { ...base, word: "zzz", choice: "missing", details: "" },
    { ...base, word: "casa", choice: "other", outcome: "Fixed.", reviewedAt: base.receivedAt, reviewedBy: "huey" },
  ]);
  const rows = sqlite.prepare(WAITING_REPORTS_QUERY).all();
  assert.deepEqual(
    rows.map((r) => ({ ...r })),
    [
      { report_id: 1, release_id: "it-a", word: "sale", record_id: 4, line_no: 9, line_sha256: sha("9"), choice: "meaning", has_note: 1 },
      { report_id: 2, release_id: "it-a", word: "zzz", record_id: null, line_no: null, line_sha256: null, choice: "missing", has_note: 0 },
    ],
  );
  assert.deepEqual(
    rows.map((r) => ReportNotice.fromRow({ ...r }).reportId),
    [1, 2],
  );
});

test("the production read names lexema-app by its real id, gives Wrangler no GitHub token, and runs only the fixed SELECT", () => {
  const calls: { args: readonly string[]; env: NodeJS.ProcessEnv }[] = [];
  const answer = JSON.stringify([{ results: [row(3, { has_note: 0 })], success: true }]);
  const reports = productionReports(
    (args, env) => {
      calls.push({ args, env });
      return { status: 0, stdout: answer };
    },
    { CLOUDFLARE_API_TOKEN: "cf", GITHUB_TOKEN: "gh", GH_TOKEN: "gh2", PATH: "/bin" },
  ).read();
  assert.deepEqual(
    reports.map(({ reportId }) => reportId),
    [3],
  );
  const [{ args, env }] = calls;
  assert.deepEqual(args.slice(0, 4), ["d1", "execute", "lexema-app", "--remote"]);
  assert.ok(args.includes("--json"));
  assert.equal(args.at(-1), `--command=${WAITING_REPORTS_QUERY}`);
  assert.equal(env.CLOUDFLARE_API_TOKEN, "cf");
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.GH_TOKEN, undefined);
});

test("a failed read names the exit status and quotes nothing Wrangler said", () => {
  const reports = productionReports(() => ({ status: 1, stdout: '{"error":{"text":"row: sale"}}' }), {});
  assert.throws(() => reports.read(), (error: Error) => /exit 1/.test(error.message) && !error.message.includes("sale"));
  assert.throws(() => rowsOf("not json with sale"), (error: Error) => !error.message.includes("sale"));
});

test("a row the table would refuse is refused by report and column, without its values", () => {
  assert.throws(() => ReportNotice.fromRow(row(5, { choice: "secret-choice" })), /^Error: report 5: choice is not/);
  assert.throws(() => ReportNotice.fromRow(row(5, { choice: "missing", record_id: 2 })), /report 5: record_id/);
  assert.throws(() => ReportNotice.fromRow(row(5, { record_id: 2, line_no: 3 })), /report 5: line_sha256/);
  assert.throws(() => ReportNotice.fromRow({ word: "sale" }), (error: Error) => !error.message.includes("sale"));
});

test("a report's issue holds no note, no visitor code and no submitted word, even when the row carries them", () => {
  const leaky = ReportNotice.fromRow({
    ...row(8, { word: "call 333 1234567", record_id: 4 }),
    details: "My email is a@b.c",
    visitor_hash: sha("e"),
    received_at: "2026-10-01",
  });
  assert.deepEqual(Object.keys(leaky).sort(), ["choice", "hasNote", "reading", "reportId", "subject"]);
  const held = [{ record_id: 4, release_id: RELEASE, line_no: 4, line_sha256: sha("4"), word: "sale" }];
  for (const text of [titleOf(leaky, held), bodyOf(leaky, held)]) {
    for (const secret of ["a@b.c", sha("e"), "2026-10-01", "333", "call"]) assert.ok(!text.includes(secret), secret);
  }
});

test("a withheld word is in neither the title nor the body", () => {
  const cases: [ReportNotice, SourceRow[]][] = [
    // Typed text without the shape of a word.
    [notice(60, { word: "mario.rossi@example.com", choice: "missing" }), []],
    // A record the dictionary read does not find: its submitted word is never shown.
    [notice(61, { word: "segreto", record_id: 8, line_no: 3, line_sha256: sha("f") }), []],
    // A record whose key failed its check never reaches the read.
    [notice(62, { word: "segreto", record_id: 9, release_id: "it-a" }), [{ record_id: 9, release_id: "it-a", line_no: 9, line_sha256: sha("9"), word: "segreto" }]],
  ];
  for (const [n, held] of cases) {
    const title = titleOf(n, held);
    const body = bodyOf(n, held);
    assert.equal(title, `Report ${n.reportId}: ${n.problem} (reader report)`);
    assert.equal(wordLine(body), WITHHELD_LINE);
    for (const text of [title, body]) {
      for (const secret of ["mario", "example.com", "segreto"]) assert.ok(!text.includes(secret), `${n.reportId}: ${secret}`);
    }
  }
});

test("the title names a word-shaped word and the problem, else the report id, and always ends with (reader report)", () => {
  const held = [
    { record_id: 5782, release_id: RELEASE, line_no: 33646, line_sha256: sha("a"), word: "bello", pos_title: "Aggettivo" },
    { record_id: 3, release_id: RELEASE, line_no: 3, line_sha256: sha("3"), word: "#651" },
    { record_id: 4, release_id: RELEASE, line_no: 4, line_sha256: sha("4"), word: "G8" },
  ];
  const titles: [ReportNotice, string][] = [
    [notice(1, { word: "bel", record_id: 5782, line_no: 33646, line_sha256: sha("a"), choice: "meaning" }), "bello: a meaning is wrong (reader report)"],
    [notice(2, { word: "zzzz", choice: "missing" }), "zzzz: missing word (reader report)"],
    [notice(3, { word: "333 1234567", choice: "missing" }), "Report 3: missing word (reader report)"],
    [notice(4, { word: "x", record_id: 99, line_no: 99, line_sha256: sha("b"), choice: "example" }), "Report 4: an example is wrong (reader report)"],
    [notice(5, { word: "x", record_id: 3, choice: "form" }), "Report 5: a form is wrong (reader report)"],
    [notice(6, { word: "x", record_id: 4, choice: "synonym" }), "Report 6: a synonym is wrong (reader report)"],
  ];
  for (const [n, title] of titles) {
    assert.equal(titleOf(n, held), title);
    assert.ok(title.endsWith(" (reader report)"));
    assert.ok(!title.startsWith("Reader report"));
  }
  // A headword the title may not hold is still shown in the body, inside its code span.
  assert.equal(wordLine(bodyOf(titles[4][0], held)), shownLine("#651", "%23651"));
});

test("each of the six options maps to its plain words, in the title and the body alike", () => {
  const expected: Record<string, string> = {
    meaning: "a meaning is wrong",
    example: "an example is wrong",
    form: "a form is wrong",
    synonym: "a synonym is wrong",
    other: "something else is wrong",
    missing: "missing word",
  };
  assert.deepEqual(PROBLEMS, expected);
  assert.deepEqual([...readerReport.choice.enumValues].sort(), Object.keys(expected).sort());
  for (const [choice, words] of Object.entries(expected)) {
    const n = notice(70, { word: "casa", choice });
    assert.equal(n.problem, words);
    assert.equal(titleOf(n), `casa: ${words} (reader report)`);
    assert.equal(lineOf(bodyOf(n), "The reader picked: "), `The reader picked: ${words}.`);
  }
});

test("a report on a record shows the dictionary's headword and its page, never the word it was sent with", () => {
  const byLine = notice(31, { word: "Mario Rossi", record_id: 42, line_no: 1234, line_sha256: sha("a"), choice: "meaning" });
  const byRecord = notice(32, { word: "mi chiamo Mario", record_id: 7, choice: "example" });
  const held = [
    { record_id: 99, release_id: RELEASE, line_no: 1234, line_sha256: sha("a"), word: "andare" },
    { record_id: 7, release_id: RELEASE, line_no: 55, line_sha256: sha("b"), word: "perché" },
  ];
  const lineBody = bodyOf(byLine, held);
  assert.equal(wordLine(lineBody), shownLine("andare", "andare"));
  assert.ok(!lineBody.includes("Mario"));
  assert.ok(!titleOf(byLine, held).includes("Mario"));
  const recordBody = bodyOf(byRecord, held);
  assert.equal(wordLine(recordBody), shownLine("perché", "perch%C3%A9"));
  assert.ok(!recordBody.includes("Mario"));
  assert.equal(titleOf(byRecord, held), "perché: an example is wrong (reader report)");
});

test("a report that kept its line is matched on release, line and digest only, never on its record_id", () => {
  const kept = notice(33, { word: "x", record_id: 5, line_no: 10, line_sha256: sha("c") });
  // The dictionary holds record 5 under another line now, and line 10 under another digest.
  const held = [
    { record_id: 5, release_id: RELEASE, line_no: 11, line_sha256: sha("d"), word: "casa" },
    { record_id: 6, release_id: RELEASE, line_no: 10, line_sha256: sha("e"), word: "cane" },
  ];
  assert.equal(wordLine(bodyOf(kept, held)), WITHHELD_LINE);
});

test("a record the dictionary read does not find shows the word withheld, no page link and no part of speech", () => {
  const body = bodyOf(notice(34, { word: "sale", record_id: 8, line_no: 3, line_sha256: sha("f") }), []);
  assert.equal(wordLine(body), WITHHELD_LINE);
  assert.equal(lineOf(body, "The reading's "), "The reading's part of speech is not known.");
  assert.ok(!body.includes("sale"));
  assert.ok(!body.includes("https:"));
});

test("the headword read is one fixed SELECT of source_record's keys, word and pos_title, matching by line when kept and by record otherwise", () => {
  const keys = [
    notice(1, { record_id: 42, line_no: 1234, line_sha256: sha("a") }),
    notice(2, { record_id: 7 }),
    notice(3, { record_id: 7 }),
    notice(4, { choice: "missing" }),
  ].flatMap(({ recordKey }) => (recordKey === undefined ? [] : [recordKey]));
  const statement = headwordQuery(keys);
  assert.equal(
    statement,
    "SELECT record_id, release_id, line_no, line_sha256, word, pos_title FROM source_record WHERE " +
      `(release_id = '${RELEASE}' AND line_no = 1234 AND line_sha256 = '${sha("a")}') OR ` +
      `(record_id = 7 AND release_id = '${RELEASE}')`,
  );
  const [, columns, table] = /^SELECT (.*) FROM (\w+) WHERE /.exec(statement ?? "") ?? [];
  assert.deepEqual(columns.split(", "), ["record_id", "release_id", "line_no", "line_sha256", "word", "pos_title"]);
  assert.equal(table, "source_record");
  assert.ok(!statement?.includes(";"), "one statement");
  assert.equal(headwordQuery([]), undefined, "no key, no read");
  // A run reads at most once, and not at all when no report to open names a record.
  const dictionary = fakeDictionary([]);
  Headwords.read(keys, dictionary);
  Headwords.read([], dictionary);
  assert.equal(dictionary.statements.length, 1);
});

test("every value bound for the headword read is checked first; a report that fails a check is withheld and never reaches the statement", () => {
  const malformed = [
    { release_id: "it-0C432803" },
    { release_id: "it-0c432803' OR 1=1 --" },
    { release_id: "it-a" },
    { line_no: 3, line_sha256: "f".repeat(63) },
    { line_no: 3, line_sha256: `${"f".repeat(63)}'` },
    { line_no: 3, line_sha256: "F".repeat(64) },
  ];
  for (const fields of malformed) {
    const n = notice(40, { record_id: 9, word: "sale", ...fields });
    assert.equal(n.recordKey, undefined, JSON.stringify(fields));
    const dictionary = fakeDictionary([{ record_id: 9, release_id: RELEASE, line_no: 3, line_sha256: sha("f"), word: "sale" }]);
    const body = n.body(Headwords.read([], dictionary));
    assert.equal(wordLine(body), WITHHELD_LINE, JSON.stringify(fields));
    assert.ok(!body.includes("https:"));
  }
  assert.equal(RecordKey.of({ releaseId: RELEASE, recordId: 1.5, lineNo: undefined }, undefined), undefined);
  assert.equal(RecordKey.of({ releaseId: RELEASE, recordId: 1, lineNo: 0 }, sha("a")), undefined);
  // A non-whole record_id or line_no never gets that far: the row is refused.
  assert.throws(() => notice(41, { record_id: "1 OR 1=1" as unknown as number }), /report 41: record_id/);
  assert.throws(() => notice(41, { record_id: 1, line_no: 2.5, line_sha256: sha("a") }), /report 41: line_no/);
  // A dictionary row source_record would refuse stops the run, quoting none of it.
  const odd = notice(42, { record_id: 9 });
  assert.throws(
    () => Headwords.read([odd.recordKey as RecordKey], { rows: () => [{ record_id: 9, release_id: RELEASE, word: "secret" }] }),
    (error: Error) => !error.message.includes("secret"),
  );
  // So does a row whose pos_title is missing or not a string.
  const keyed = { record_id: 9, release_id: RELEASE, line_no: 9, line_sha256: sha("9"), word: "casa" };
  for (const posTitle of [undefined, null, 7, ["secret"]]) {
    const answer = posTitle === undefined ? keyed : { ...keyed, pos_title: posTitle };
    assert.throws(
      () => Headwords.read([odd.recordKey as RecordKey], { rows: () => [answer] }),
      (error: Error) => error.message === "the headword read answered a row source_record would refuse",
      JSON.stringify(posTitle),
    );
  }
});

test("the reading's part of speech comes from the row the headword read found it in", () => {
  const n = notice(43, { word: "x", record_id: 5782, line_no: 33646, line_sha256: sha("a") });
  const headwords = Headwords.read([n.recordKey as RecordKey], {
    rows: () => [{ record_id: 5782, release_id: RELEASE, line_no: 33646, line_sha256: sha("a"), word: "bello", pos_title: "Aggettivo" }],
  });
  assert.deepEqual(headwords.of(n.recordKey as RecordKey), { word: "bello", posTitle: "Aggettivo" });
  assert.equal(lineOf(n.body(headwords), "The reading's "), "The reading's part of speech is ` Aggettivo `.");
});

test("typed text is shown only in the shape of a word: phone numbers, emails, URLs and sentences are withheld", () => {
  const withheld = [
    "333 1234567",
    "+39 333 123 4567",
    "mario.rossi@example.com",
    "https://evil.example",
    "www.evil.example",
    "questa è una frase molto lunga che non è una parola",
    "uno due tre quattro cinque",
    "a".repeat(41),
    " casa",
    "casa ",
    "casa  bianca",
    "casa\nbianca",
    "casa/bianca",
    "ore 10:30",
    "@huey",
    "'",
    "",
  ];
  for (const text of withheld) {
    assert.equal(typedWord(text), undefined, text);
    const body = bodyOf(notice(50, { word: text, choice: "missing" }));
    assert.equal(wordLine(body), WITHHELD_LINE, text);
    assert.ok(!body.includes("https:"), text);
  }
  const shown: [string, string][] = [
    ["casa", "casa"],
    ["perché", "perch%C3%A9"],
    ["dell'arte", "dell%27arte"],
    ["dell’arte", "dell%E2%80%99arte"],
    ["capo-stazione", "capo-stazione"],
    ["casa bianca", "casa%20bianca"],
    ["Città", "Citt%C3%A0"],
  ];
  for (const [text, query] of shown) {
    const body = bodyOf(notice(51, { word: text, choice: "missing" }));
    assert.equal(wordLine(body), shownLine(text, query), text);
  }
  assert.equal(typedWord("a".repeat(40)), "a".repeat(40));
  assert.equal(typedWord("perche\u0301"), "perché", "a decomposed accent is joined");
});

test("a mistake report sent with Not sure has no record, so it takes the word shape too", () => {
  const body = bodyOf(notice(52, { word: "mario.rossi@example.com", choice: "meaning" }));
  assert.equal(wordLine(body), WITHHELD_LINE);
  assert.equal(wordLine(bodyOf(notice(53, { word: "sale", choice: "meaning" }))), shownLine("sale", "sale"));
});

test("each kind of report renders the marker, then short sentences: the word and its page, the reading, the option and the note", () => {
  const held = [
    { record_id: 5782, release_id: RELEASE, line_no: 33646, line_sha256: sha("a"), word: "bello", pos_title: "Aggettivo" },
    { record_id: 7, release_id: RELEASE, line_no: 70, line_sha256: sha("7"), word: "casa", pos_title: "Sostantivo" },
  ];
  const cases: [ReportNotice, string][] = [
    [
      notice(1, { word: "bello", record_id: 5782, line_no: 33646, line_sha256: sha("a"), choice: "meaning" }),
      [
        "<!-- lexema-reader-report:1 -->",
        "The word is ` bello `. Its page is <https://lexema.fyi/?q=bello>.",
        "The reading's part of speech is ` Aggettivo `.",
        "<sub>Release ` it-0c432803 `, line 33646, record 5782.</sub>",
        "The reader picked: a meaning is wrong.",
        "The reader left a note. Read it with `pnpm run report list`.",
        "<sub>Report 1.</sub>",
      ].join("\n\n"),
    ],
    [
      notice(11, { word: "sale", choice: "other", has_note: 0 }),
      [
        "<!-- lexema-reader-report:11 -->",
        "The word is ` sale `. Its page is <https://lexema.fyi/?q=sale>.",
        "The reader picked no reading.",
        "The reader picked: something else is wrong.",
        "No note.",
        "<sub>Report 11.</sub>",
      ].join("\n\n"),
    ],
    [
      notice(13, { word: "zzzz", choice: "missing" }),
      [
        "<!-- lexema-reader-report:13 -->",
        "The word is ` zzzz `. Its page is <https://lexema.fyi/?q=zzzz>.",
        "The reader picked no reading.",
        "The reader picked: missing word.",
        "The reader left a note. Read it with `pnpm run report list`.",
        "<sub>Report 13.</sub>",
      ].join("\n\n"),
    ],
    [
      notice(14, { word: "casa", record_id: 7, line_no: null, choice: "example", has_note: 0 }),
      [
        "<!-- lexema-reader-report:14 -->",
        "The word is ` casa `. Its page is <https://lexema.fyi/?q=casa>.",
        "The reading's part of speech is ` Sostantivo `.",
        "<sub>Release ` it-0c432803 `, no line kept, record 7.</sub>",
        "The reader picked: an example is wrong.",
        "No note.",
        "<sub>Report 14.</sub>",
      ].join("\n\n"),
    ],
    [
      notice(15, { word: "Mario", record_id: 8, line_no: 3, line_sha256: sha("f"), choice: "form" }),
      [
        "<!-- lexema-reader-report:15 -->",
        "The word is withheld.",
        "The reading's part of speech is not known.",
        "<sub>Release ` it-0c432803 `, line 3, record 8.</sub>",
        "The reader picked: a form is wrong.",
        "The reader left a note. Read it with `pnpm run report list`.",
        "<sub>Report 15.</sub>",
      ].join("\n\n"),
    ],
  ];
  for (const [n, expected] of cases) {
    const body = bodyOf(n, held);
    assert.equal(body, `${expected}\n`, `report ${n.reportId}`);
    // The marker is alone on the first line, and the run still reads it there.
    assert.equal(body.split("\n")[0], reportMarker(n.reportId));
    assert.deepEqual([...sentReportIds([body])], [n.reportId]);
  }
});

test("a hostile headword renders inert: no mention, no other link, no way out of its code span", () => {
  const word = "@huey ``x`` [click](https://evil.example)\n\n# heading\r\n<!-- lexema-reader-report:99 --> #1 end";
  const posTitle = "@pos ``y``\n# [z](https://evil.example)";
  const n = notice(21, { record_id: 3 });
  const held = [{ record_id: 3, release_id: RELEASE, line_no: 3, line_sha256: sha("3"), word, pos_title: posTitle }];
  const body = bodyOf(n, held);
  const sentence = wordLine(body);
  assert.ok(sentence !== undefined);
  const code = inertCode(word);
  assert.ok(sentence.startsWith(`The word is ${code}. Its page is <`));
  // One code span: the fence is longer than any backtick run inside, and the word holds no line break.
  assert.match(code, /^(`{3}) .* \1$/);
  assert.doesNotMatch(code.slice(4, -4), /`{3}/);
  const plain = bodyOf(notice(22, { record_id: 4 }), [{ record_id: 4, release_id: RELEASE, line_no: 4, line_sha256: sha("4"), word: "casa" }]);
  assert.equal(body.split("\n").length, plain.split("\n").length, "the word and the part of speech add no line");
  // The page link is one autolink: its URL holds no space, `>` or Markdown syntax, so it cannot end early.
  const page = /Its page is <(\S+)>\.$/m.exec(body)?.[1] ?? "";
  assert.match(page, /^https:\/\/lexema\.fyi\/\?q=[A-Za-z0-9%._~-]+$/);
  // The part of speech is one code span too.
  assert.equal(lineOf(body, "The reading's "), `The reading's part of speech is ${inertCode(posTitle)}.`);
  // Outside the code spans and that URL, the body names no user and holds no other link.
  const outside = body.replace(code, "").replace(page, "").replace(inertCode(posTitle), "");
  assert.doesNotMatch(outside, /@|evil|\]\(|https?:/);
  // The title may not hold it, so it falls back to the report id.
  assert.equal(titleOf(n, held), "Report 21: a meaning is wrong (reader report)");
  // A marker inside the word is not a marker: only the first line is.
  assert.deepEqual([...sentReportIds([body])], [21]);
});

test("the dictionary read names lexema-dictionary by its real id, with the same Cloudflare env, no GitHub token, and the statement it is handed", () => {
  const calls: { args: readonly string[]; env: NodeJS.ProcessEnv }[] = [];
  const answer = JSON.stringify([{ results: [{ record_id: 1, release_id: RELEASE, line_no: 1, line_sha256: sha("1"), word: "casa" }], success: true }]);
  const dictionary = productionDictionary(
    (args, env) => {
      calls.push({ args, env });
      return { status: 0, stdout: answer };
    },
    { CLOUDFLARE_API_TOKEN: "cf", CLOUDFLARE_ACCOUNT_ID: "acct", GITHUB_TOKEN: "gh", GH_TOKEN: "gh2", PATH: "/bin" },
  );
  const statement = headwordQuery([notice(1, { record_id: 1 }).recordKey as RecordKey]) ?? "";
  assert.equal(dictionary.rows(statement).length, 1);
  const [{ args, env }] = calls;
  assert.deepEqual(args.slice(0, 4), ["d1", "execute", "lexema-dictionary", "--remote"]);
  const config = JSON.parse(readFileSync(args[args.indexOf("--config") + 1], "utf8"));
  assert.deepEqual(config.d1_databases, [{ binding: "DB", database_name: "lexema-dictionary", database_id: "b07d3441-91c6-4f94-8ae3-fe8c7088f21d" }]);
  assert.equal(args.at(-1), `--command=${statement}`);
  assert.equal(env.CLOUDFLARE_API_TOKEN, "cf");
  assert.equal(env.CLOUDFLARE_ACCOUNT_ID, "acct");
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.GH_TOKEN, undefined);
  const failed = productionDictionary(() => ({ status: 1, stdout: '{"error":"word casa"}' }), {});
  assert.throws(() => failed.rows(statement), (error: Error) => /lexema-dictionary failed \(exit 1\)/.test(error.message) && !error.message.includes("casa"));
});

test("a re-run opens no twin: a report marked on any labelled issue, open or closed, is skipped", async () => {
  const opened: string[] = [];
  const issues: ReportIssues = {
    labelledBodies: async () => [bodyOf(notice(1)), `closed and edited\r\n${reportMarker(2)}\r\n`, null, "no marker here"],
    ensureLabel: async () => {},
    open: async (_title, body) => void opened.push(body),
  };
  const result = await sendWaitingReports({ read: () => [notice(3), notice(1), notice(2)] }, issues, fakeDictionary([]), () => {});
  assert.deepEqual(result, { opened: [3], alreadySent: [1, 2], later: [] });
  assert.deepEqual(sentReportIds(opened), new Set([3]));
});

test("one run opens at most 20 issues, oldest first, and leaves the rest for the next run", async () => {
  assert.equal(ISSUES_PER_RUN, 20);
  // Even reports name a record; the dictionary holds the headword of every fourth.
  const waiting = Array.from({ length: 25 }, (_, i) => 25 - i).map((id) => notice(id, id % 2 === 0 ? { record_id: id, word: "submitted" } : {}));
  const held = waiting.flatMap(({ reportId: id }) => (id % 4 === 0 ? [{ record_id: id, release_id: RELEASE, line_no: id, line_sha256: sha("1"), word: "casa" }] : []));
  const dictionary = fakeDictionary(held);
  const opened: string[] = [];
  const logged: string[] = [];
  let labelled = 0;
  const issues: ReportIssues = {
    labelledBodies: async () => opened,
    ensureLabel: async () => void labelled++,
    open: async (_title, body) => void opened.push(body),
  };
  const first = await sendWaitingReports({ read: () => waiting }, issues, dictionary, (line) => logged.push(line));
  assert.deepEqual(first.opened, Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(first.later, [21, 22, 23, 24, 25]);
  assert.equal(labelled, 1);
  // One headword read for the run, naming only the records of the reports it opens.
  assert.equal(dictionary.statements.length, 1);
  assert.ok(dictionary.statements[0].includes("(record_id = 20 AND"));
  assert.ok(!dictionary.statements[0].includes("(record_id = 22 AND"));
  assert.ok(logged.includes("reader reports: found the headword of 5 of 10 records"));
  assert.ok(!opened.join("\n").includes("submitted"));
  const second = await sendWaitingReports({ read: () => waiting }, issues, dictionary, () => {});
  assert.deepEqual(second.opened, [21, 22, 23, 24, 25]);
  assert.equal(dictionary.statements.length, 2);
  const third = await sendWaitingReports({ read: () => waiting }, issues, dictionary, () => {});
  assert.deepEqual(third.opened, []);
  assert.equal(third.alreadySent.length, 25);
  assert.equal(dictionary.statements.length, 2, "nothing to open, no headword read");
  // The log holds counts and report ids only.
  for (const line of logged) assert.match(line, /^reader reports: [a-z0-9 ,():]+$/);
  assert.ok(!logged.join("\n").includes("sale"));
  assert.ok(!logged.join("\n").includes("casa"));
});

test("planRun keeps the oldest unsent reports and counts the rest", () => {
  const plan = planRun([notice(4), notice(2), notice(3)], new Set([2]), 1);
  assert.deepEqual(
    plan.open.map(({ reportId }) => reportId),
    [3],
  );
  assert.deepEqual(plan.alreadySent, [2]);
  assert.deepEqual(
    plan.later.map(({ reportId }) => reportId),
    [4],
  );
});

test("the marker read pages through the REST issues list, open and closed, and never uses search", async () => {
  const urls: string[] = [];
  const page2 = "https://api.github.com/repositories/1/issues?labels=reader-report&state=all&per_page=100&page=2";
  const fetch: Fetch = async (url) => {
    urls.push(url);
    if (url === page2) return Response.json([{ body: reportMarker(101) }, { body: null }]);
    return Response.json(
      Array.from({ length: 100 }, (_, i) => ({ body: reportMarker(i + 1) })),
      { headers: { link: `<${page2}>; rel="next", <${page2}>; rel="last"` } },
    );
  };
  const bodies = await githubIssues("povlabs/lexema", "token", fetch).labelledBodies();
  assert.equal(bodies.length, 102);
  assert.equal(sentReportIds(bodies).size, 101);
  assert.deepEqual(urls, ["https://api.github.com/repos/povlabs/lexema/issues?labels=reader-report&state=all&per_page=100", page2]);
  assert.ok(urls.every((url) => !url.includes("/search/")));
  assert.equal(nextPage(`<${page2}>; rel="last"`), undefined);
});

test("the label is created only when missing, issues carry it, and a refusal names its status, not the body", async () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  let labelThere = false;
  const fetch: Fetch = async (url, { method, body }) => {
    calls.push({ url, method, body });
    if (url.endsWith("/labels/reader-report")) return new Response(null, { status: labelThere ? 200 : 404 });
    if (url.endsWith("/labels")) return new Response(null, { status: 201 });
    if (url.endsWith("/issues")) return new Response('{"message":"word sale"}', { status: 422 });
    return new Response(null, { status: 500 });
  };
  const issues = githubIssues("povlabs/lexema", "token", fetch, async () => {});
  await issues.ensureLabel();
  labelThere = true;
  await issues.ensureLabel();
  assert.deepEqual(
    calls.map(({ url, method }) => `${method} ${url.replace("https://api.github.com/repos/povlabs/lexema", "")}`),
    ["GET /labels/reader-report", "POST /labels", "GET /labels/reader-report"],
  );
  await assert.rejects(issues.open("t", "b"), (error: Error) => error.message === "GitHub refused to open a report issue (HTTP 422)");
  assert.deepEqual(JSON.parse(calls.at(-1)?.body ?? "{}"), { title: "t", body: "b", labels: ["reader-report"] });
});

test("a run opens each issue with its readable title and body, and the reader-report label", async () => {
  const posts: unknown[] = [];
  const fetch: Fetch = async (url, { method, body }) => {
    if (method === "POST" && url.endsWith("/issues")) posts.push(JSON.parse(body ?? "null"));
    if (url.includes("/issues?")) return Response.json([]);
    return new Response(null, { status: 201 });
  };
  const waiting = [notice(1, { word: "bel", record_id: 5782, line_no: 33646, line_sha256: sha("a") }), notice(2, { word: "zzzz", choice: "missing" })];
  const dictionary = fakeDictionary([{ record_id: 5782, release_id: RELEASE, line_no: 33646, line_sha256: sha("a"), word: "bello", pos_title: "Aggettivo" }]);
  await sendWaitingReports({ read: () => waiting }, githubIssues("povlabs/lexema", "token", fetch, async () => {}), dictionary, () => {});
  assert.deepEqual(
    posts.map((post) => (post as { title: string; labels: string[] }).title),
    ["bello: a meaning is wrong (reader report)", "zzzz: missing word (reader report)"],
  );
  for (const post of posts) {
    const { body, labels } = post as { body: string; labels: string[] };
    assert.deepEqual(labels, ["reader-report"]);
    assert.ok(body.startsWith("<!-- lexema-reader-report:"));
  }
  assert.deepEqual(sentReportIds(posts.map((post) => (post as { body: string }).body)), new Set([1, 2]));
});

test("reader-reports.yml runs hourly and by hand, in dictionary-plan with the read token alone, and checks its settings first", () => {
  const yaml = readFileSync(new URL("../.github/workflows/reader-reports.yml", import.meta.url), "utf8");
  const code = yaml.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
  assert.match(code, /^on:\n {2}schedule:\n {4}- cron: "\d+ \* \* \* \*"\n {2}workflow_dispatch:$/m);
  assert.match(code, /^permissions: \{\}$/m);
  assert.match(code, /^concurrency:\n {2}group: reader-reports\n {2}cancel-in-progress: false$/m);
  assert.equal([...code.matchAll(/^ {2}[\w-]+:$/gm)].filter(([line]) => code.indexOf(line) > code.indexOf("\njobs:")).length, 1, "one job");
  assert.match(code, /^ {4}environment: dictionary-plan$/m);
  assert.match(code, /^ {4}timeout-minutes: \d+$/m);
  assert.match(code, /^ {4}permissions:\n {6}contents: read\n {6}issues: write\n {4}env:/m);
  assert.deepEqual([...new Set(code.match(/secrets\.[A-Z0-9_]+/g))], ["secrets.CLOUDFLARE_D1_READ_TOKEN"]);
  assert.doesNotMatch(code, /CLOUDFLARE_D1_TOKEN|pull_request|GH_TOKEN|secrets\.GITHUB/);
  assert.match(code, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  for (const [, ref] of code.matchAll(/uses: (\S+)/g)) assert.match(ref, /@[0-9a-f]{40}$/, ref);
  // The first step names a missing token or account id, before any install, read or write.
  const steps = code.slice(code.indexOf("    steps:\n"));
  const first = steps.slice(0, steps.indexOf("\n      - ", steps.indexOf("      - ") + 1));
  assert.doesNotMatch(first, /uses:|pnpm|wrangler|gh /);
  for (const name of ["CLOUDFLARE_D1_READ_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    assert.match(first, new RegExp(`if \\[ -z "\\$${name}" \\]; then\\n\\s+echo "::error::${name} is missing or empty`));
  }
  assert.match(first, /exit "\$missing"/);
});
