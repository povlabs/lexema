// `ready-for:human` holds the merge (ADR 0006, #565). The `ci-required` job the
// merge queue requires fails a queue entry whose pull request carries the
// label. These read `.github/workflows/ci.yml` and run the hold step's own
// script under bash, with a stub `gh` in place of the GitHub API.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const HOLD_STEP = "hold a pull request labelled ready-for:human";
const QUEUE_REF = `refs/heads/gh-readonly-queue/main/pr-563-${"a4".repeat(20)}`;

const yaml = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");

/** The text of one job's block under `jobs:`, by its id. */
function jobOf(id: string): string {
  const lines = yaml.slice(yaml.indexOf("\njobs:\n") + "\njobs:\n".length).split("\n");
  const start = lines.indexOf(`  ${id}:`);
  assert.notEqual(start, -1, `no job ${id}`);
  const end = lines.findIndex((line, i) => i > start && /^ {2}[\w-]+:\s*$/.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}

/** Each step of a job, as the text from its `- ` line to the next. */
function stepsOf(job: string): string[] {
  return job.slice(job.indexOf("\n    steps:\n")).split(/\n(?= {6}- )/).slice(1);
}

const ciRequired = jobOf("ci-required");
const steps = stepsOf(ciRequired);
const hold = steps.find((step) => step.includes(`name: ${HOLD_STEP}`));

/** The hold step's script, as bash receives it. */
function holdScript(): string {
  assert.ok(hold !== undefined, "ci-required has no hold step");
  const lines = hold.split("\n");
  const body: string[] = [];
  for (const line of lines.slice(lines.findIndex((line) => /^ {8}run: \|$/.test(line)) + 1)) {
    if (line.trim() !== "" && !line.startsWith(" ".repeat(10))) break;
    body.push(line.slice(10));
  }
  return `${body.join("\n")}\n`;
}

type Run = { status: number | null; out: string; ghArgs: string };

/** Runs the hold step with `labels` on the pull request, or with a `gh` that fails when `labels` is null. */
function runHold(headRef: string, labels: readonly string[] | null): Run {
  const dir = mkdtempSync(join(tmpdir(), "merge-hold-"));
  try {
    const gh = join(dir, "gh");
    const ghLog = join(dir, "gh-args");
    writeFileSync(
      gh,
      labels === null
        ? `#!/bin/sh\necho "$*" > "${ghLog}"\necho "HTTP 502" >&2\nexit 1\n`
        : `#!/bin/sh\necho "$*" > "${ghLog}"\nprintf '%s' '${labels.map((label) => `${label}\n`).join("")}'\n`,
    );
    chmodSync(gh, 0o755);
    const result = spawnSync("bash", ["-e", "-c", holdScript()], {
      env: { PATH: `${dir}:${process.env.PATH ?? ""}`, HEAD_REF: headRef, REPO: "povlabs/lexema", GH_TOKEN: "stub" },
      encoding: "utf8",
    });
    let ghArgs = "";
    try {
      ghArgs = readFileSync(ghLog, "utf8").trim();
    } catch {
      // gh was never called.
    }
    return { status: result.status, out: `${result.stdout}${result.stderr}`, ghArgs };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the hold runs only on a merge queue entry, before the gate, and checks ready-for:human", () => {
  assert.ok(hold !== undefined, "ci-required has no hold step");
  assert.equal(steps.indexOf(hold), 0);
  assert.match(hold, /^ {8}if: github\.event_name == 'merge_group'$/m);
  assert.match(hold, /^ {10}HEAD_REF: \$\{\{ github\.event\.merge_group\.head_ref \}\}$/m);
  assert.match(hold, /ready-for:human/);
  // The gate step is still there and still reads every gated job.
  assert.equal(steps.length, 2);
  assert.doesNotMatch(steps[1] ?? "", /^ {8}if:/m);
  assert.match(steps[1] ?? "", /gate "validate the ADR corpus" "\$NEED_ADR" "\$VALIDATE"/);
});

test("ci-required may read pull requests and write nothing", () => {
  assert.match(ciRequired, /^ {4}permissions:\n {6}pull-requests: read\n {4}steps:$/m);
  assert.doesNotMatch(ciRequired, /: write\b|write-all/);
});

test("a labelled pull request fails the queue entry, naming it and how to release it", () => {
  const run = runHold(QUEUE_REF, ["type:bug", "ready-for:human"]);
  assert.equal(run.status, 1, run.out);
  assert.equal(run.ghArgs, "api repos/povlabs/lexema/pulls/563 --jq .labels[].name");
  assert.match(run.out, /::error::pull request #563 carries ready-for:human/);
  assert.match(run.out, /remove the label, then queue the pull request again/);
});

test("a pull request without the label passes, on a base whose name has a slash too", () => {
  assert.equal(runHold(QUEUE_REF, ["type:bug", "ready-for:agent"]).status, 0);
  assert.equal(runHold(QUEUE_REF, []).status, 0);
  const run = runHold(`refs/heads/gh-readonly-queue/release/1.x/pr-7-${"0".repeat(40)}`, []);
  assert.equal(run.status, 0, run.out);
  assert.equal(run.ghArgs, "api repos/povlabs/lexema/pulls/7 --jq .labels[].name");
});

test("a label set it cannot read fails closed", () => {
  const failedRead = runHold(QUEUE_REF, null);
  assert.equal(failedRead.status, 1, failedRead.out);
  assert.match(failedRead.out, /::error::could not read the labels of pull request #563/);

  for (const ref of [
    "",
    "refs/heads/main",
    "refs/heads/gh-readonly-queue/main/pr-x-" + "a".repeat(40),
    "refs/heads/gh-readonly-queue/main/pr-563-abc",
    "refs/heads/gh-readonly-queue/pr-563-" + "a".repeat(40),
  ]) {
    const run = runHold(ref, []);
    assert.equal(run.status, 1, ref);
    assert.equal(run.ghArgs, "", ref);
    assert.match(run.out, /::error::merge queue head ref .* names no pull request/, ref);
  }
});
