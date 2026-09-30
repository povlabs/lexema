// The preview marker (#244, web/builds/previewMarkerCommand.ts): which check
// runs it acts on, the comment it keeps, and the GitHub calls it makes. The
// check runs are real ones from Workers Builds on PR #269, recorded with
// `gh api repos/hueypov/lexema/commits/<sha>/check-runs`: 8be5dd31 built
// (success), f7a54b1b failed. A `check_run` webhook delivers the same object
// under `check_run`. Everything runs against a fake GitHub and fake sites, with
// no network and no credential.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ACTIONS_BOT,
  type Answer,
  announcedOutput,
  announcePreview,
  type GitHub,
  type IssueComment,
  isReady,
  MARKER,
  PREVIEW_SITES,
  PreviewAnnouncement,
  type PullRequest,
  readAnnouncedOutput,
  readPreviewBuild,
  restGitHub,
} from "@/builds/previewMarkerCommand.ts";
import { PreviewName } from "@/builds/previewName.ts";
import { PREVIEW_DOMAIN } from "@/worker/hosts.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const BUILT = fixture("workers-builds-check-run-success.json");
const FAILED = fixture("workers-builds-check-run-failure.json");

const REPOSITORY = "hueypov/lexema";
const BRANCH = "build/245-preview-test-sign-in-4e2f1c60";
const BUILT_SHA = "8be5dd31adde7c3155860e89e1b8e8d5990394ff";
const LATER_SHA = "d1f82ee99418ab14ec11730d9c0f32bd657b724f";

/** The payload `on: check_run` delivers, around one check run. */
const eventOf = (checkRun: unknown) => ({ action: "completed", check_run: checkRun, repository: { full_name: REPOSITORY } });

/** What each site answers once PR #269's Preview is up, as they answered on 2026-09-30. */
const UP: Record<string, Answer> = {
  "https://build-245-preview-e48bab4a.preview.lexema.fyi/": { status: 200, robotsTag: "noindex" },
  "https://build-245-preview-e48bab4a.developers-preview.lexema.fyi/": { status: 200, robotsTag: "noindex" },
  "https://build-245-preview-e48bab4a.api-preview.lexema.fyi/": { status: 404, robotsTag: "noindex" },
};

/** A GitHub with pull requests and comments in memory, recording every write. */
class FakeGitHub implements GitHub {
  readonly repository = REPOSITORY;
  readonly writes: string[] = [];
  readonly stored: IssueComment[] = [];
  private nextId = 1;
  /** Heads the pull request moves to, one per read after the first. */
  headMoves: string[] = [];

  constructor(
    readonly pulls: Map<number, PullRequest>,
    readonly associated: readonly number[] = [],
  ) {}

  async pullRequest(number: number): Promise<PullRequest> {
    const pull = this.pulls.get(number);
    if (pull === undefined) throw new Error(`no #${number}`);
    const moved = this.headMoves.shift();
    return moved === undefined ? pull : { ...pull, headSha: moved };
  }
  async pullRequestsOf(): Promise<readonly number[]> {
    return this.associated;
  }
  async comments(): Promise<readonly IssueComment[]> {
    return [...this.stored];
  }
  async createComment(pullRequest: number, body: string): Promise<void> {
    this.writes.push(`create #${pullRequest}`);
    this.stored.push({ id: this.nextId++, author: ACTIONS_BOT, body });
  }
  async updateComment(id: number, body: string): Promise<void> {
    this.writes.push(`update ${id}`);
    const at = this.stored.findIndex((comment) => comment.id === id);
    this.stored[at] = { ...this.stored[at], body };
  }
}

const pr269 = (headSha: string, extra: Partial<PullRequest> = {}): PullRequest => ({
  number: 269,
  state: "open",
  headSha,
  headRef: BRANCH,
  headRepository: REPOSITORY,
  ...extra,
});

const run = (github: GitHub, event: unknown, answers: Record<string, Answer> = UP, attempts = 1) => {
  const probed: string[] = [];
  const outcome = announcePreview({
    event,
    github,
    probe: async (url) => {
      probed.push(url);
      const answer = answers[url];
      if (answer === undefined) throw new Error(`fetch failed: ${url}`);
      return answer;
    },
    attempts,
    wait: async () => {},
    log: () => {},
  });
  return { outcome, probed };
};

/**
 * `readPreviewAnnouncement` from @kampus/fabrika-cli 0.8.0's capture/resolve.js,
 * the reader `review-ui render` resolves a PR's preview with, reduced to its
 * rules: the app's block runs from its anchor to the next anchor, its URL is
 * the first absolute http(s) URL in it, and its head is the anchored SHA left
 * once the URLs are taken out. Fabrika is not a dependency of this repository,
 * so the rules are restated here; the PR that added this checked the real
 * module against the same body.
 */
function fabrikaRead(body: string, app: string): { url: string; sha: string } | undefined {
  const anchor = `<!-- preview-deploy:${app} -->`;
  const start = body.indexOf(anchor);
  if (start === -1) return undefined;
  const rest = body.slice(start + anchor.length);
  const next = rest.indexOf("<!-- preview-deploy:");
  const block = next === -1 ? rest : rest.slice(0, next);
  const url = /https?:\/\/[^\s<>()"'`\]]+/.exec(block)?.[0];
  const sha = /(?:@|\(|`|\bhead\b)[ \t]*`?([0-9a-f]{7,40})`?/i.exec(block.replace(/https?:\/\/[^\s<>()"'`\]]+/g, " "))?.[1];
  return url === undefined || sha === undefined ? undefined : { url, sha };
}

// --- The check run ------------------------------------------------------------

test("the recorded Workers Builds success is a build of its commit; the recorded failure is not", () => {
  assert.deepEqual(readPreviewBuild(eventOf(BUILT)), { kind: "built", sha: BUILT_SHA, pullRequests: [269] });
  const failed = readPreviewBuild(eventOf(FAILED));
  assert.equal(failed.kind, "ignored");
  assert.match(failed.kind === "ignored" ? failed.reason : "", /failure/);
});

test("a check run from any other app, or under any other name, is not a build, whatever it says", () => {
  const impostor = { ...BUILT, app: { ...BUILT.app, slug: "someone-elses-app" } };
  assert.equal(readPreviewBuild(eventOf(impostor)).kind, "ignored");
  assert.equal(readPreviewBuild(eventOf({ ...BUILT, name: "Workers Builds: another-worker" })).kind, "ignored");
  assert.equal(readPreviewBuild(eventOf({ ...BUILT, status: "in_progress", conclusion: null })).kind, "ignored");
  assert.equal(readPreviewBuild(eventOf({ ...BUILT, head_sha: "8be5dd3" })).kind, "ignored");
  assert.equal(readPreviewBuild({ action: "completed" }).kind, "ignored");
});

test("a check run that lists no pull request still names its commit", () => {
  assert.deepEqual(readPreviewBuild(eventOf({ ...BUILT, pull_requests: [] })), { kind: "built", sha: BUILT_SHA, pullRequests: [] });
});

// --- The comment ----------------------------------------------------------------

test("the comment names each site's Preview URL and the head, and Fabrika's reader reads all three", () => {
  const announcement = PreviewAnnouncement.of(BRANCH, BUILT_SHA);
  assert.equal(announcement.preview.value, PreviewName.ofBranch(BRANCH).value);
  assert.equal(announcement.preview.value, "build-245-preview-e48bab4a");
  assert.equal(
    announcement.body,
    [
      MARKER,
      "Preview `build-245-preview-e48bab4a`, built by Workers Builds.",
      "",
      "<!-- preview-deploy:web -->",
      `- **web**: https://build-245-preview-e48bab4a.preview.lexema.fyi/ @ ${BUILT_SHA}`,
      "<!-- preview-deploy:developers -->",
      `- **developers**: https://build-245-preview-e48bab4a.developers-preview.lexema.fyi/ @ ${BUILT_SHA}`,
      "<!-- preview-deploy:api -->",
      `- **api**: https://build-245-preview-e48bab4a.api-preview.lexema.fyi/ @ ${BUILT_SHA}`,
      "",
    ].join("\n"),
  );
  for (const { site, url } of announcement.sites) {
    assert.deepEqual(fabrikaRead(announcement.body, site.app), { url, sha: BUILT_SHA }, site.app);
  }
});

test("the three sites are the Worker's own preview domains", () => {
  assert.deepEqual(
    PREVIEW_SITES.map(({ domain }) => domain),
    [PREVIEW_DOMAIN.lexema, PREVIEW_DOMAIN.developers, PREVIEW_DOMAIN.api],
  );
});

test("a site is up only when the Preview Worker itself answers, with the status its root gives", () => {
  const [web, , api] = PREVIEW_SITES;
  assert.equal(isReady(web, { status: 200, robotsTag: "noindex" }), true);
  assert.equal(isReady(api, { status: 404, robotsTag: "noindex" }), true);
  // Cloudflare's answer for a name with no Preview: a 404 with no noindex.
  assert.equal(isReady(api, { status: 404, robotsTag: undefined }), false);
  assert.equal(isReady(web, { status: 404, robotsTag: undefined }), false);
  assert.equal(isReady(web, { status: 503, robotsTag: "noindex" }), false);
});

// --- Announcing ---------------------------------------------------------------

test("a successful build of the PR's head posts one comment, and the next build edits it in place", async () => {
  const github = new FakeGitHub(new Map([[269, pr269(BUILT_SHA)]]));
  const first = run(github, eventOf(BUILT));
  assert.deepEqual(await first.outcome, { kind: "announced", sha: BUILT_SHA, pullRequests: [{ number: 269, comment: "created" }] });
  assert.deepEqual(first.probed, Object.keys(UP));

  github.pulls.set(269, pr269(LATER_SHA));
  const later = run(github, eventOf({ ...BUILT, head_sha: LATER_SHA }));
  assert.deepEqual(await later.outcome, { kind: "announced", sha: LATER_SHA, pullRequests: [{ number: 269, comment: "updated" }] });
  assert.deepEqual(github.writes, ["create #269", "update 1"]);
  assert.equal(github.stored.length, 1);
  assert.equal(fabrikaRead(github.stored[0].body, "web")?.sha, LATER_SHA);

  // The same build reported twice writes nothing the second time.
  assert.deepEqual(await run(github, eventOf({ ...BUILT, head_sha: LATER_SHA })).outcome, {
    kind: "announced",
    sha: LATER_SHA,
    pullRequests: [{ number: 269, comment: "unchanged" }],
  });
  assert.equal(github.writes.length, 2);
});

test("a build of a commit that is no longer the PR's head changes nothing", async () => {
  // PR #269 today: the recorded build is of 8be5dd31, and its head is d1f82ee9.
  const github = new FakeGitHub(new Map([[269, pr269(LATER_SHA)]]));
  const { outcome, probed } = run(github, eventOf(BUILT));
  assert.deepEqual(await outcome, { kind: "stale", sha: BUILT_SHA });
  assert.deepEqual(probed, []);
  assert.deepEqual(github.writes, []);
});

test("a push while the sites come up makes the build stale, and nothing is written", async () => {
  const github = new FakeGitHub(new Map([[269, pr269(BUILT_SHA)]]));
  github.headMoves = [BUILT_SHA, LATER_SHA];
  assert.deepEqual(await run(github, eventOf(BUILT)).outcome, { kind: "stale", sha: BUILT_SHA });
  assert.deepEqual(github.writes, []);
});

test("a closed PR, or one whose head is a fork, gets no comment", async () => {
  for (const pull of [pr269(BUILT_SHA, { state: "closed" }), pr269(BUILT_SHA, { headRepository: "someone/lexema" })]) {
    const github = new FakeGitHub(new Map([[269, pull]]));
    assert.equal((await run(github, eventOf(BUILT)).outcome).kind, "stale");
    assert.deepEqual(github.writes, []);
  }
});

test("a failed build or another app's check run writes nothing and asks no site", async () => {
  const github = new FakeGitHub(new Map([[269, pr269(FAILED.head_sha)]]));
  for (const event of [eventOf(FAILED), eventOf({ ...BUILT, app: { slug: "github-actions" } })]) {
    const { outcome, probed } = run(github, event);
    assert.equal((await outcome).kind, "ignored");
    assert.deepEqual(probed, []);
  }
  assert.deepEqual(github.writes, []);
});

test("a check run listing no PR finds it through the commit", async () => {
  const github = new FakeGitHub(new Map([[269, pr269(BUILT_SHA)]]), [269]);
  assert.deepEqual(await run(github, eventOf({ ...BUILT, pull_requests: [] })).outcome, {
    kind: "announced",
    sha: BUILT_SHA,
    pullRequests: [{ number: 269, comment: "created" }],
  });
});

test("what a run announced is the smoke job's input, and nothing else reads as one", async () => {
  const github = new FakeGitHub(new Map([[269, pr269(BUILT_SHA)]]));
  const output = announcedOutput(await run(github, eventOf(BUILT)).outcome);
  assert.equal(output, `{"sha":"${BUILT_SHA}","pullRequests":[269]}`);
  assert.deepEqual(readAnnouncedOutput(output ?? ""), { sha: BUILT_SHA, pullRequests: [269] });

  assert.equal(announcedOutput({ kind: "stale", sha: BUILT_SHA }), undefined);
  assert.equal(announcedOutput({ kind: "ignored", reason: "not ours" }), undefined);
  for (const bad of ["", "not json", `{"sha":"8be5dd3","pullRequests":[269]}`, `{"sha":"${BUILT_SHA}","pullRequests":[]}`, `{"sha":"${BUILT_SHA}","pullRequests":["269"]}`]) {
    assert.throws(() => readAnnouncedOutput(bad), /announce job's output/, bad);
  }
});

test("a Preview that never answers fails the run and writes nothing", async () => {
  const github = new FakeGitHub(new Map([[269, pr269(BUILT_SHA)]]));
  const down = { ...UP, "https://build-245-preview-e48bab4a.api-preview.lexema.fyi/": { status: 404, robotsTag: undefined } };
  const { outcome, probed } = run(github, eventOf(BUILT), down, 3);
  await assert.rejects(outcome, /never answered at https:\/\/build-245-preview-e48bab4a\.api-preview\.lexema\.fyi\//);
  // Asked each site once, then only the one still down.
  assert.equal(probed.length, 3 + 2);
  assert.deepEqual(github.writes, []);
});

test("only this bot's marked comment is edited; a marker someone else wrote is left alone", async () => {
  const github = new FakeGitHub(new Map([[269, pr269(BUILT_SHA)]]));
  github.stored.push({ id: 90, author: "someone", body: `${MARKER}\nnot ours` });
  await run(github, eventOf(BUILT)).outcome;
  assert.deepEqual(github.writes, ["create #269"]);
  assert.equal(github.stored[0].body, `${MARKER}\nnot ours`);
});

// --- GitHub's REST API ----------------------------------------------------------

test("the REST calls use GITHUB_TOKEN on this repository's endpoints, and page through comments", async () => {
  const requests: string[] = [];
  const page = (length: number, from: number) =>
    Array.from({ length }, (_, i) => ({ id: from + i, body: "x", user: { login: "someone" } }));
  const answers: Record<string, unknown> = {
    "GET /repos/hueypov/lexema/pulls/269": {
      number: 269,
      state: "open",
      head: { sha: BUILT_SHA, ref: BRANCH, repo: { full_name: REPOSITORY } },
    },
    [`GET /repos/hueypov/lexema/commits/${BUILT_SHA}/pulls`]: [
      { number: 269, state: "open" },
      { number: 12, state: "closed" },
    ],
    "GET /repos/hueypov/lexema/issues/269/comments?per_page=100&page=1": page(100, 1),
    "GET /repos/hueypov/lexema/issues/269/comments?per_page=100&page=2": page(1, 101),
    "POST /repos/hueypov/lexema/issues/269/comments": {},
    "PATCH /repos/hueypov/lexema/issues/comments/7": {},
  };
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method} ${url.pathname}${url.search}`;
    assert.equal(url.origin, "https://api.github.com");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer t0ken");
    requests.push(init?.body === undefined ? key : `${key} ${init.body}`);
    return key in answers ? Response.json(answers[key]) : new Response("{}", { status: 404 });
  }) as typeof fetch;

  const github = restGitHub("t0ken", REPOSITORY, fakeFetch);
  assert.deepEqual(await github.pullRequest(269), pr269(BUILT_SHA));
  assert.deepEqual(await github.pullRequestsOf(BUILT_SHA), [269]);
  assert.equal((await github.comments(269)).length, 101);
  await github.createComment(269, "hi");
  await github.updateComment(7, "hi");
  await assert.rejects(github.pullRequest(1), /answered 404/);
  assert.deepEqual(requests.slice(-3), [
    'POST /repos/hueypov/lexema/issues/269/comments {"body":"hi"}',
    'PATCH /repos/hueypov/lexema/issues/comments/7 {"body":"hi"}',
    "GET /repos/hueypov/lexema/pulls/1",
  ]);
  assert.throws(() => restGitHub("", REPOSITORY, fakeFetch), /GITHUB_TOKEN/);
});
