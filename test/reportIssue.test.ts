// One public issue per production reader report (#631): the read never selects
// the note, the visitor code or the time; an issue body holds the report's
// facts and no note, with the reader's word inert; a re-run opens no twin; and
// one run opens at most 20.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readerReport } from "../src/db/app/schema.js";
import {
  ISSUES_PER_RUN,
  ReportNotice,
  inertCode,
  planRun,
  reportMarker,
  sendWaitingReports,
  sentReportIds,
  WAITING_REPORTS_QUERY,
  type ReportIssues,
} from "../src/readerReport/reportIssue.js";
import { githubIssues, nextPage, productionReports, rowsOf, type Fetch } from "../src/readerReport/reportIssuesCli.js";
import { freshAppDatabase } from "./databases.js";

const sha = (digit: string) => digit.repeat(64);

interface Row {
  report_id: number;
  release_id: string;
  word: string;
  record_id: number | null;
  line_no: number | null;
  choice: string;
  has_note: 0 | 1;
}

const row = (reportId: number, fields: Partial<Row> = {}): Row => ({
  report_id: reportId,
  release_id: "it-0c432803",
  word: "sale",
  record_id: null,
  line_no: null,
  choice: "meaning",
  has_note: 1,
  ...fields,
});

const notice = (reportId: number, fields: Partial<Row> = {}) => ReportNotice.fromRow(row(reportId, fields));

test("the read selects exactly the issue's columns and a computed has_note, and never the note, the visitor code or the time", () => {
  const [, columns] = /^SELECT (.*) FROM reader_report /.exec(WAITING_REPORTS_QUERY) ?? [];
  assert.deepEqual(columns.split(", "), [
    "report_id",
    "release_id",
    "word",
    "record_id",
    "line_no",
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
      { report_id: 1, release_id: "it-a", word: "sale", record_id: 4, line_no: 9, choice: "meaning", has_note: 1 },
      { report_id: 2, release_id: "it-a", word: "zzz", record_id: null, line_no: null, choice: "missing", has_note: 0 },
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
  assert.throws(() => ReportNotice.fromRow({ word: "sale" }), (error: Error) => !error.message.includes("sale"));
});

test("a report's issue holds no note and no visitor code, even when the row carries them", () => {
  const leaky = ReportNotice.fromRow({ ...row(8), details: "My email is a@b.c", visitor_hash: sha("e"), received_at: "2026-10-01" });
  assert.deepEqual(Object.keys(leaky).sort(), ["choice", "hasNote", "reading", "reportId", "word"]);
  for (const text of [leaky.title, leaky.body]) {
    assert.ok(!text.includes("a@b.c"));
    assert.ok(!text.includes(sha("e")));
    assert.ok(!text.includes("2026-10-01"));
  }
});

test("each kind of report renders its facts, the code-span word, the page link, the option, has a note and the marker", () => {
  const cases = [
    {
      name: "a word report",
      notice: notice(11, { word: "sale", choice: "other" }),
      lines: ["- report id: 11", "- word: ` sale `", "- page: <https://lexema.fyi/?q=sale>", "- reading: no reading picked", "- option: other", "- has a note: yes"],
    },
    {
      name: "a reading report",
      notice: notice(12, { word: "andare", record_id: 42, line_no: 1234, choice: "meaning" }),
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
      lines: ["- reading: release ` it-0c432803 `, no line kept, record 7", "- option: example", "- has a note: yes"],
    },
  ];
  for (const { name, notice: n, lines } of cases) {
    const body = n.body.split("\n");
    assert.equal(body[0], `<!-- lexema-reader-report:${n.reportId} -->`, name);
    assert.ok(body.includes(`- report id: ${n.reportId}`), name);
    for (const line of lines) assert.ok(body.includes(line), `${name}: ${line}`);
    assert.equal(n.title, `Reader report ${n.reportId}: ${n.choice}`);
  }
});

test("a hostile word renders inert: no mention, no other link, no way out of its code span", () => {
  const word = "@huey ``x`` [click](https://evil.example)\n\n# heading\r\n<!-- lexema-reader-report:99 --> #1 end";
  const body = notice(21, { word }).body;
  const wordLine = body.split("\n").find((line) => line.startsWith("- word: "));
  assert.ok(wordLine !== undefined);
  const code = wordLine.slice("- word: ".length);
  // One code span: the fence is longer than any backtick run inside, and the word holds no line break.
  assert.equal(code, inertCode(word));
  assert.match(code, /^(`{3}) .* \1$/);
  assert.doesNotMatch(code.slice(4, -4), /`{3}/);
  assert.equal(body.split("\n").length, notice(22).body.split("\n").length, "the word adds no line");
  // The page link is one autolink: its URL holds no space, `>` or Markdown syntax, so it cannot end early.
  const page = /^- page: <(\S+)>$/m.exec(body)?.[1] ?? "";
  assert.match(page, /^https:\/\/lexema\.fyi\/\?q=[A-Za-z0-9%._~-]+$/);
  // Outside the code span and that URL, the body names no user and holds no other link.
  const outside = body.replace(code, "").replace(page, "");
  assert.doesNotMatch(outside, /@|evil|\]\(|https?:/);
  // A marker inside the word is not a marker: only the first line is.
  assert.deepEqual([...sentReportIds([body])], [21]);
});

test("a re-run opens no twin: a report marked on any labelled issue, open or closed, is skipped", async () => {
  const opened: string[] = [];
  const issues: ReportIssues = {
    labelledBodies: async () => [notice(1).body, `closed and edited\r\n${reportMarker(2)}\r\n`, null, "no marker here"],
    ensureLabel: async () => {},
    open: async (_title, body) => void opened.push(body),
  };
  const result = await sendWaitingReports({ read: () => [notice(3), notice(1), notice(2)] }, issues, () => {});
  assert.deepEqual(result, { opened: [3], alreadySent: [1, 2], later: [] });
  assert.deepEqual(sentReportIds(opened), new Set([3]));
});

test("one run opens at most 20 issues, oldest first, and leaves the rest for the next run", async () => {
  assert.equal(ISSUES_PER_RUN, 20);
  const waiting = Array.from({ length: 25 }, (_, i) => notice(25 - i));
  const opened: string[] = [];
  const logged: string[] = [];
  let labelled = 0;
  const issues: ReportIssues = {
    labelledBodies: async () => opened,
    ensureLabel: async () => void labelled++,
    open: async (_title, body) => void opened.push(body),
  };
  const first = await sendWaitingReports({ read: () => waiting }, issues, (line) => logged.push(line));
  assert.deepEqual(first.opened, Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(first.later, [21, 22, 23, 24, 25]);
  assert.equal(labelled, 1);
  const second = await sendWaitingReports({ read: () => waiting }, issues, () => {});
  assert.deepEqual(second.opened, [21, 22, 23, 24, 25]);
  const third = await sendWaitingReports({ read: () => waiting }, issues, () => {});
  assert.deepEqual(third.opened, []);
  assert.equal(third.alreadySent.length, 25);
  // The log holds counts and report ids only.
  for (const line of logged) assert.match(line, /^reader reports: [a-z0-9 ,():]+$/);
  assert.ok(!logged.join("\n").includes("sale"));
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
