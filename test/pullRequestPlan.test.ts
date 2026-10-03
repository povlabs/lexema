// The pull request plan check (#494): which declarations a pull request adds,
// which of them it plans, how their counts are held to `expected`, and the
// declaration it prints when they differ. Plans here are stand-ins, so no
// test needs a dictionary or a Cloudflare token; dictionaryDeploy.test.ts
// runs the check through the command line against a local D1.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { gitIn } from "../src/deploy/pending.js";
import type { PlanOnlyAnswer } from "../src/deploy/dictionaryDeploy.js";
import { addedDeclarations, declarationWith, planPullRequest, pullRequestPlanReport } from "../src/deploy/pullRequestPlan.js";
import { type DeclarationDraft, type DeclaredChange, DeclarationRefused, HIDING_RULES, parseDeclaration, parseDraft } from "../src/update/declaration.js";
import { PlanCounts } from "../src/update/planCounts.js";
import { PAGE_ENTRY_RULES } from "../src/import/loadPageEntries.js";

const COUNTS = { records: { added: 0, changed: 2, removed: 0 }, written: { corrected_claim: 3, correction_version: 1 }, deleted: {} };
const correction = (expected?: object): string => JSON.stringify({ command: "correct:records", ...(expected === undefined ? {} : { expected }) });
const AUTO = JSON.stringify({ command: "update:auto", inputs: { feedRelease: "it-78385b62" }, expected: COUNTS });
const HIDE = JSON.stringify({ command: "hide:records", inputs: { archive: "it-0c432803", rules: [...HIDING_RULES] }, expected: COUNTS });
const LOAD = JSON.stringify({ command: "load:page-entries", inputs: { archive: "it-0c432803", rules: [...PAGE_ENTRY_RULES] }, expected: COUNTS });

/** A plan-only answer of `counts` on a dictionary of `dictionaryRecords` records. */
function answerOf(change: DeclaredChange, counts: object = COUNTS, dictionaryRecords = 1000): PlanOnlyAnswer {
  const planned = parseDeclaration("plan", JSON.stringify({ command: change.command, inputs: change.inputs, expected: counts })).expected;
  return { command: change.command, counts: planned, dictionaryRecords, limitBreaches: planned.limitBreaches(dictionaryRecords) };
}

/** A stand-in for the plan-only entry that records each change it is asked to plan. */
function planner(counts: object = COUNTS, dictionaryRecords = 1000): { plan: (change: DeclaredChange) => Promise<PlanOnlyAnswer>; planned: string[] } {
  const planned: string[] = [];
  return { planned, plan: async (change) => (planned.push(change.file), answerOf(change, counts, dictionaryRecords)) };
}

const drafts = (files: Record<string, string>): DeclarationDraft[] => Object.entries(files).map(([file, text]) => parseDraft(file, text));

test("a draft may leave out expected; anything else a declaration refuses, it refuses", () => {
  assert.equal(parseDraft("d.json", correction()).expected, null);
  assert.deepEqual(parseDraft("d.json", correction(COUNTS)).expected?.toJSON(), COUNTS);
  assert.throws(() => parseDraft("d.json", correction({ records: {} })), DeclarationRefused);
  assert.throws(() => parseDraft("d.json", JSON.stringify({ command: "update:apply" })), /command must be one of/);
  assert.throws(() => parseDraft("d.json", JSON.stringify({ command: "correct:records", note: "x" })), /unknown field "note"/);
});

/** Git with a fixed author and no signing, so a commit never depends on the machine's config. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function commit(dir: string, files: Record<string, string>): Promise<string> {
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), text);
  }
  git(dir, "add", "--all");
  git(dir, "commit", "--allow-empty", "-m", "change");
  return git(dir, "rev-parse", "HEAD");
}

test("the declarations a pull request adds are its new top-level .json files under dictionary-changes, in path order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-pr-plan-"));
  try {
    git(dir, "init", "--initial-branch=main");
    const base = await commit(dir, { "dictionary-changes/README.md": "# Change declarations\n", "dictionary-changes/deployed.json": correction(COUNTS) });
    const head = await commit(dir, {
      "dictionary-changes/deployed.json": correction({ ...COUNTS, records: { added: 1, changed: 0, removed: 0 } }),
      "dictionary-changes/b-second.json": correction(),
      "dictionary-changes/a-first.json": correction(COUNTS),
      "dictionary-changes/notes/c.json": correction(COUNTS),
      "dictionary-changes/d.txt": "not a declaration",
      "src/other.json": correction(COUNTS),
    });
    const added = addedDeclarations(gitIn(dir), base, head);
    assert.deepEqual(added.map(({ file }) => file), ["dictionary-changes/a-first.json", "dictionary-changes/b-second.json"]);
    assert.deepEqual(added[0].expected?.toJSON(), COUNTS);
    assert.equal(added[1].expected, null);
    assert.deepEqual(addedDeclarations(gitIn(dir), head, head), []);

    const broken = await commit(dir, { "dictionary-changes/broken.json": "{ command: " });
    assert.throws(() => addedDeclarations(gitIn(dir), head, broken), (error: unknown) => error instanceof DeclarationRefused && error.file === "dictionary-changes/broken.json");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a declaration whose counts match expected passes, and nothing else is planned", async () => {
  const { plan, planned } = planner();
  const outcomes = await planPullRequest(drafts({ "dictionary-changes/fix.json": correction(COUNTS) }), plan);
  const report = pullRequestPlanReport(outcomes, "lexema-dictionary");
  assert.equal(report.green, true);
  assert.deepEqual(planned, ["dictionary-changes/fix.json"]);
  assert.match(report.markdown, /## Dictionary plan check: green/);
  assert.match(report.markdown, /The plan's counts match `expected`\./);
  assert.match(report.markdown, /against `lexema-dictionary`\. Nothing was written\./);
});

test("a count that differs is red, names each difference and prints the declaration with the plan's counts", async () => {
  const declared = { records: { added: 0, changed: 1, removed: 0 }, written: { corrected_claim: 3 } };
  const outcomes = await planPullRequest(drafts({ "dictionary-changes/fix.json": correction(declared) }), planner().plan);
  const report = pullRequestPlanReport(outcomes, "lexema-dictionary");
  assert.equal(report.green, false);
  assert.match(report.markdown, /## Dictionary plan check: red/);
  assert.match(report.markdown, /- `records\.changed` is 2 in the plan, 1 declared/);
  assert.match(report.markdown, /- `written\.correction_version` is 1 in the plan, 0 declared/);
  const printed = /```json\n([\s\S]*?)\n```/.exec(report.markdown)?.[1];
  assert.ok(printed !== undefined, report.markdown);
  assert.deepEqual(JSON.parse(printed), { command: "correct:records", inputs: {}, expected: COUNTS });
  // What it prints is a declaration whose counts the same plan matches.
  const fixed = await planPullRequest(drafts({ "dictionary-changes/fix.json": printed }), planner().plan);
  assert.equal(pullRequestPlanReport(fixed, "lexema-dictionary").green, true);
});

test("a declaration with no expected is red and prints the expected to put in it", async () => {
  const outcomes = await planPullRequest(drafts({ "dictionary-changes/fix.json": correction() }), planner().plan);
  const report = pullRequestPlanReport(outcomes, "lexema-dictionary");
  assert.equal(report.green, false);
  assert.match(report.markdown, /It has no `expected` yet\./);
  assert.ok(report.markdown.includes(declarationWith(outcomes[0].declaration, new PlanCounts(COUNTS.records, COUNTS.written)).trimEnd()), report.markdown);
});

test("a plan that crosses a hard limit is red and names it, even when expected matches", async () => {
  const removing = { records: { added: 0, changed: 0, removed: 150 }, written: {}, deleted: {} };
  const outcomes = await planPullRequest(drafts({ "dictionary-changes/fix.json": correction(removing) }), planner(removing).plan);
  const report = pullRequestPlanReport(outcomes, "lexema-dictionary");
  assert.equal(report.green, false);
  assert.match(report.markdown, /The plan's counts match `expected`\./);
  assert.match(report.markdown, /crosses a hard limit[\s\S]*- removes 150 records, more than 100/);
  assert.match(report.markdown, /- changes or removes 150 of 1000 records, more than 5%/);
});

test("only the first declaration is planned; a later one is refused, naming the earlier ones", async () => {
  const { plan, planned } = planner();
  const outcomes = await planPullRequest(drafts({ "dictionary-changes/a.json": correction(COUNTS), "dictionary-changes/b.json": correction(COUNTS) }), plan);
  assert.deepEqual(planned, ["dictionary-changes/a.json"]);
  assert.deepEqual(outcomes.map(({ kind }) => kind), ["planned", "after-earlier"]);
  const report = pullRequestPlanReport(outcomes, "lexema-dictionary");
  assert.equal(report.green, false);
  assert.match(report.markdown, /### `dictionary-changes\/b\.json` \(`correct:records`\)\n\nNot planned: it comes after `dictionary-changes\/a\.json` in this pull request/);
  assert.match(report.markdown, /its own pull request/);
});

test("update:auto, hide:records and load:page-entries are not planned and do not fail the pull request", async () => {
  const { plan, planned } = planner();
  const outcomes = await planPullRequest(drafts({ "dictionary-changes/it-78385b62.json": AUTO, "dictionary-changes/hide.json": HIDE, "dictionary-changes/load.json": LOAD }), plan);
  assert.deepEqual(planned, []);
  assert.deepEqual(outcomes.map(({ kind }) => kind), ["not-planned", "not-planned", "not-planned"]);
  const report = pullRequestPlanReport(outcomes, "lexema-dictionary");
  assert.equal(report.green, true);
  assert.match(report.markdown, /Not planned here: `update:auto` reads an archive and a dump from `hueypov\/lexema-data`/);
  assert.match(report.markdown, /Not planned here: `hide:records` reads/);
  assert.match(report.markdown, /Not planned here: `load:page-entries` reads/);
  assert.match(report.markdown, /This does not fail the pull request\./);
});

test("a declaration after one that reads an archive is refused, since its counts would ignore that write", async () => {
  const { plan, planned } = planner();
  const outcomes = await planPullRequest(drafts({ "dictionary-changes/a.json": AUTO, "dictionary-changes/b.json": correction(COUNTS) }), plan);
  assert.deepEqual(planned, []);
  assert.deepEqual(outcomes.map(({ kind }) => kind), ["not-planned", "after-earlier"]);
  assert.equal(pullRequestPlanReport(outcomes, "lexema-dictionary").green, false);
});

test("a pull request that adds no declaration passes with nothing to plan", async () => {
  const report = pullRequestPlanReport(await planPullRequest([], planner().plan), "lexema-dictionary");
  assert.equal(report.green, true);
  assert.match(report.markdown, /adds no change declaration, so there is nothing to plan/);
});
