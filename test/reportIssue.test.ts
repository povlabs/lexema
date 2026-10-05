// One public issue per production reader report (#631): the read never selects
// the note, the visitor code or the time; an issue body holds the report's
// facts and no note; a re-run opens no twin; and one run opens at most 20. Its
// word is never the one the reader sent as sent (#639): a report on a record
// shows the dictionary's headword, read in one checked statement, and a report
// on no record shows its typed text only when it has the shape of a word.

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
}

/** A dictionary that answers every read with `held`, as D1 would filter it, and keeps each statement it ran. */
function fakeDictionary(held: readonly SourceRow[]): Dictionary & { statements: string[] } {
  const statements: string[] = [];
  return {
    statements,
    rows(statement) {
      statements.push(statement);
      return held.filter(
        (r) =>
          statement.includes(`(release_id = '${r.release_id}' AND line_no = ${r.line_no} AND line_sha256 = '${r.line_sha256}')`) ||
          statement.includes(`(record_id = ${r.record_id} AND release_id = '${r.release_id}')`),
      );
    },
  };
}

/** The body of `n`'s issue after one headword read over `held`. */
const bodyOf = (n: ReportNotice, held: readonly SourceRow[] = []): string =>
  n.body(Headwords.read(n.recordKey === undefined ? [] : [n.recordKey], fakeDictionary(held)));

const lineOf = (body: string, prefix: string): string | undefined => body.split("\n").find((line) => line.startsWith(prefix));

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
  for (const text of [leaky.title, bodyOf(leaky, [{ record_id: 4, release_id: RELEASE, line_no: 4, line_sha256: sha("4"), word: "sale" }])]) {
    for (const secret of ["a@b.c", sha("e"), "2026-10-01", "333"]) assert.ok(!text.includes(secret), secret);
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
  assert.equal(lineOf(lineBody, "- word: "), "- word: ` andare `");
  assert.equal(lineOf(lineBody, "- page: "), "- page: <https://lexema.fyi/?q=andare>");
  assert.ok(!lineBody.includes("Mario"));
  const recordBody = bodyOf(byRecord, held);
  assert.equal(lineOf(recordBody, "- word: "), "- word: ` perché `");
  assert.equal(lineOf(recordBody, "- page: "), "- page: <https://lexema.fyi/?q=perch%C3%A9>");
  assert.ok(!recordBody.includes("Mario"));
});

test("a report that kept its line is matched on release, line and digest only, never on its record_id", () => {
  const kept = notice(33, { word: "x", record_id: 5, line_no: 10, line_sha256: sha("c") });
  // The dictionary holds record 5 under another line now, and line 10 under another digest.
  const held = [
    { record_id: 5, release_id: RELEASE, line_no: 11, line_sha256: sha("d"), word: "casa" },
    { record_id: 6, release_id: RELEASE, line_no: 10, line_sha256: sha("e"), word: "cane" },
  ];
  assert.equal(lineOf(bodyOf(kept, held), "- word: "), "- word: word withheld");
});

test("a record the dictionary read does not find shows word withheld and no page link", () => {
  const body = bodyOf(notice(34, { word: "sale", record_id: 8, line_no: 3, line_sha256: sha("f") }), []);
  assert.equal(lineOf(body, "- word: "), "- word: word withheld");
  assert.equal(lineOf(body, "- page: "), undefined);
  assert.ok(!body.includes("sale"));
  assert.ok(!body.includes("https:"));
});

test("the headword read is one fixed SELECT of source_record's keys and word, matching by line when kept and by record otherwise", () => {
  const keys = [
    notice(1, { record_id: 42, line_no: 1234, line_sha256: sha("a") }),
    notice(2, { record_id: 7 }),
    notice(3, { record_id: 7 }),
    notice(4, { choice: "missing" }),
  ].flatMap(({ recordKey }) => (recordKey === undefined ? [] : [recordKey]));
  const statement = headwordQuery(keys);
  assert.equal(
    statement,
    "SELECT record_id, release_id, line_no, line_sha256, word FROM source_record WHERE " +
      `(release_id = '${RELEASE}' AND line_no = 1234 AND line_sha256 = '${sha("a")}') OR ` +
      `(record_id = 7 AND release_id = '${RELEASE}')`,
  );
  const [, columns, table] = /^SELECT (.*) FROM (\w+) WHERE /.exec(statement ?? "") ?? [];
  assert.deepEqual(columns.split(", "), ["record_id", "release_id", "line_no", "line_sha256", "word"]);
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
    assert.equal(lineOf(body, "- word: "), "- word: word withheld", JSON.stringify(fields));
    assert.equal(lineOf(body, "- page: "), undefined);
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
    assert.equal(lineOf(body, "- word: "), "- word: word withheld", text);
    assert.equal(lineOf(body, "- page: "), undefined, text);
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
    assert.equal(lineOf(body, "- word: "), `- word: ${inertCode(text)}`, text);
    assert.equal(lineOf(body, "- page: "), `- page: <https://lexema.fyi/?q=${query}>`, text);
  }
  assert.equal(typedWord("a".repeat(40)), "a".repeat(40));
  assert.equal(typedWord("perche\u0301"), "perché", "a decomposed accent is joined");
});

test("a mistake report sent with Not sure has no record, so it takes the word shape too", () => {
  const body = bodyOf(notice(52, { word: "mario.rossi@example.com", choice: "meaning" }));
  assert.equal(lineOf(body, "- word: "), "- word: word withheld");
  assert.equal(lineOf(bodyOf(notice(53, { word: "sale", choice: "meaning" })), "- word: "), "- word: ` sale `");
});

test("each kind of report renders its facts, the code-span word, the page link, the option, has a note and the marker", () => {
  const held = [
    { record_id: 42, release_id: RELEASE, line_no: 1234, line_sha256: sha("a"), word: "andare" },
    { record_id: 7, release_id: RELEASE, line_no: 70, line_sha256: sha("7"), word: "casa" },
  ];
  const cases = [
    {
      name: "a word report",
      notice: notice(11, { word: "sale", choice: "other" }),
      lines: ["- report id: 11", "- word: ` sale `", "- page: <https://lexema.fyi/?q=sale>", "- reading: no reading picked", "- option: other", "- has a note: yes"],
    },
    {
      name: "a reading report",
      notice: notice(12, { word: "andare", record_id: 42, line_no: 1234, line_sha256: sha("a"), choice: "meaning" }),
      lines: [
        "- word: ` andare `",
        "- page: <https://lexema.fyi/?q=andare>",
        "- reading: release ` it-0c432803 `, line 1234, record 42",
        "- option: meaning",
        "- has a note: yes",
      ],
    },
    {
      name: "a missing-word report with an empty note",
      notice: notice(13, { word: "dell'acqua", choice: "missing", has_note: 0 }),
      lines: ["- word: ` dell'acqua `", "- page: <https://lexema.fyi/?q=dell%27acqua>", "- reading: no reading picked", "- option: missing", "- has a note: no"],
    },
    {
      name: "a report with a note",
      notice: notice(14, { word: "casa", record_id: 7, line_no: null, choice: "example", has_note: 1 }),
      lines: ["- word: ` casa `", "- reading: release ` it-0c432803 `, no line kept, record 7", "- option: example", "- has a note: yes"],
    },
  ];
  for (const { name, notice: n, lines } of cases) {
    const body = bodyOf(n, held).split("\n");
    assert.equal(body[0], `<!-- lexema-reader-report:${n.reportId} -->`, name);
    assert.ok(body.includes(`- report id: ${n.reportId}`), name);
    for (const line of lines) assert.ok(body.includes(line), `${name}: ${line}`);
    assert.equal(n.title, `Reader report ${n.reportId}: ${n.choice}`);
  }
});

test("a hostile headword renders inert: no mention, no other link, no way out of its code span", () => {
  const word = "@huey ``x`` [click](https://evil.example)\n\n# heading\r\n<!-- lexema-reader-report:99 --> #1 end";
  const body = bodyOf(notice(21, { record_id: 3 }), [{ record_id: 3, release_id: RELEASE, line_no: 3, line_sha256: sha("3"), word }]);
  const wordLine = lineOf(body, "- word: ");
  assert.ok(wordLine !== undefined);
  const code = wordLine.slice("- word: ".length);
  // One code span: the fence is longer than any backtick run inside, and the word holds no line break.
  assert.equal(code, inertCode(word));
  assert.match(code, /^(`{3}) .* \1$/);
  assert.doesNotMatch(code.slice(4, -4), /`{3}/);
  assert.equal(body.split("\n").length, bodyOf(notice(22)).split("\n").length, "the word adds no line");
  // The page link is one autolink: its URL holds no space, `>` or Markdown syntax, so it cannot end early.
  const page = /^- page: <(\S+)>$/m.exec(body)?.[1] ?? "";
  assert.match(page, /^https:\/\/lexema\.fyi\/\?q=[A-Za-z0-9%._~-]+$/);
  // Outside the code span and that URL, the body names no user and holds no other link.
  const outside = body.replace(code, "").replace(page, "");
  assert.doesNotMatch(outside, /@|evil|\]\(|https?:/);
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
