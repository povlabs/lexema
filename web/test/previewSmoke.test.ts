// The preview smoke (#246, web/builds/previewSmokeCommand.ts): what it asks
// each preview site, when an answer fails it, and the check run it reports.
// The pages are cut from what PR #269's Preview answered on 2026-09-30
// (`build-245-preview-e48bab4a`): `/?q=andare` holds reading articles, and
// `/?q=zzqxnotaword` answers 200 with "No entry" and no reading. Everything
// runs against a fake GitHub and fake sites, with no network and no credential.

import assert from "node:assert/strict";
import { test } from "node:test";
import { type PullRequest, PreviewAnnouncement } from "@/builds/previewMarkerCommand.ts";
import {
  type CheckRun,
  type Page,
  probesOf,
  restSmokeGitHub,
  SMOKE_CHECK,
  SMOKE_WORDS,
  type SmokeGitHub,
  smokePreview,
  UNKNOWN_KEY,
} from "@/builds/previewSmokeCommand.ts";

const REPOSITORY = "hueypov/lexema";
const BRANCH = "build/245-preview-test-sign-in-4e2f1c60";
const SHA = "8be5dd31adde7c3155860e89e1b8e8d5990394ff";
const LATER_SHA = "d1f82ee99418ab14ec11730d9c0f32bd657b724f";
const WEB = "https://build-245-preview-e48bab4a.preview.lexema.fyi/";
const DEVELOPERS = "https://build-245-preview-e48bab4a.developers-preview.lexema.fyi/";
const API = "https://build-245-preview-e48bab4a.api-preview.lexema.fyi/";

/** A found word's page: its title and a reading article, as the Preview renders them. */
const found = (word: string): Page => ({
  status: 200,
  robotsTag: "noindex",
  body: `<title>${word[0].toUpperCase()}${word.slice(1)} — Lexema</title><article class="scroll-mt-6 mt-7" id="reading-1011" aria-labelledby="reading-heading-1011" data-record="1011" data-line="2344">`,
});
/** A word the dictionary does not have: still a 200, with no reading. */
const notFound = (word: string): Page => ({
  status: 200,
  robotsTag: "noindex",
  body: `<title>No entry for "${word}" — Lexema</title><h1>No entry for “<span lang="it">${word}</span>”</h1>`,
});
const LANDING: Page = { status: 200, robotsTag: "noindex", body: "<title>Lexema API</title>" };
const REFUSED: Page = { status: 401, robotsTag: "noindex", body: '{"error":{"code":"invalid_key","message":"This API key is not valid."}}' };

const wordUrl = (word: string) => `${WEB}?q=${word}`;
const LOOKUP = `${API}v1/lookup?q=andare`;

/** What every site answers on a working Preview. */
const UP: Record<string, Page> = {
  ...Object.fromEntries(SMOKE_WORDS.map((word) => [wordUrl(word), found(word)])),
  [DEVELOPERS]: LANDING,
  [LOOKUP]: REFUSED,
};

class FakeGitHub implements SmokeGitHub {
  readonly repository = REPOSITORY;
  readonly checks: CheckRun[] = [];
  /** Heads the pull request moves to, one per read. */
  heads: string[] = [];

  constructor(readonly pull: PullRequest) {}

  async pullRequest(): Promise<PullRequest> {
    const moved = this.heads.shift();
    return moved === undefined ? this.pull : { ...this.pull, headSha: moved };
  }
  async createCheckRun(run: CheckRun): Promise<void> {
    this.checks.push(run);
  }
}

const pr269 = (extra: Partial<PullRequest> = {}): PullRequest => ({
  number: 269,
  state: "open",
  headSha: SHA,
  headRef: BRANCH,
  headRepository: REPOSITORY,
  ...extra,
});

/** Run the smoke over `pages`; a URL missing from them gets no answer. */
async function smoke(github: FakeGitHub, pages: Record<string, Page | Error> = UP, attempts = 1) {
  const asked: { url: string; headers: Readonly<Record<string, string>> }[] = [];
  const outcome = await smokePreview({
    sha: SHA,
    pullRequests: [269],
    github,
    fetchPage: async (url, headers) => {
      asked.push({ url, headers });
      const page = pages[url];
      if (page === undefined) throw new Error(`fetch failed: ${url}`);
      if (page instanceof Error) throw page;
      return page;
    },
    attempts,
    wait: async () => {},
    detailsUrl: "https://github.com/hueypov/lexema/actions/runs/1",
    log: () => {},
  });
  return { outcome, asked };
}

// --- What it asks -----------------------------------------------------------------

test("it asks the announced sites: the six words on the dictionary, the developer landing page, the API", () => {
  const probes = probesOf(PreviewAnnouncement.of(BRANCH, SHA));
  assert.deepEqual(
    probes.map(({ app, url }) => [app, url]),
    [...SMOKE_WORDS.map((word) => ["web", wordUrl(word)]), ["developers", DEVELOPERS], ["api", LOOKUP]],
  );
  assert.deepEqual(SMOKE_WORDS, ["sale", "andare", "andavano", "casa", "bello", "studente"]);
  // The API is sent a key no Preview holds: never a real one.
  assert.deepEqual(probes.at(-1)?.headers, { "x-api-key": UNKNOWN_KEY });
  assert.doesNotMatch(UNKNOWN_KEY, /^lx_[0-9a-f]{64}$/);
  for (const probe of probes.slice(0, -1)) assert.deepEqual(probe.headers, {});
});

// --- When it passes and fails ------------------------------------------------------

test("a working Preview reports one successful check at the head, with a row per request", async () => {
  const github = new FakeGitHub(pr269());
  const { outcome, asked } = await smoke(github);
  assert.deepEqual(outcome, { kind: "reported", checks: [{ number: 269, conclusion: "success" }] });
  assert.equal(asked.length, SMOKE_WORDS.length + 2);
  assert.equal(github.checks.length, 1);
  const [check] = github.checks;
  assert.equal(check.headSha, SHA);
  assert.equal(check.conclusion, "success");
  assert.equal(check.title, "All 8 preview requests answered");
  assert.match(check.summary, /Preview `build-245-preview-e48bab4a` @ 8be5dd31adde7c3155860e89e1b8e8d5990394ff/);
  assert.equal(check.summary.split("\n").filter((line) => line.endsWith("| pass |")).length, 8);
  assert.equal(check.detailsUrl, "https://github.com/hueypov/lexema/actions/runs/1");
});

test("any of the six words that does not resolve fails the check, naming the word", async () => {
  for (const word of SMOKE_WORDS) {
    const github = new FakeGitHub(pr269());
    await smoke(github, { ...UP, [wordUrl(word)]: notFound(word) });
    const [check] = github.checks;
    assert.equal(check.conclusion, "failure", word);
    assert.equal(check.title, "1 of 8 preview requests failed");
    assert.match(check.summary, new RegExp(`\\*\\*fail\\*\\*: no reading for "${word}" on the page`));
  }
});

test("a response without noindex fails the check, on any of the three sites", async () => {
  for (const url of [wordUrl("casa"), DEVELOPERS, LOOKUP]) {
    for (const robotsTag of [undefined, "all", "nofollow"]) {
      const github = new FakeGitHub(pr269());
      await smoke(github, { ...UP, [url]: { ...UP[url], robotsTag } });
      const [check] = github.checks;
      assert.equal(check.conclusion, "failure", `${url} ${robotsTag}`);
      assert.match(check.summary, /X-Robots-Tag is .*, not noindex/);
    }
  }
  // Noindex among other directives still counts.
  const github = new FakeGitHub(pr269());
  await smoke(github, { ...UP, [DEVELOPERS]: { ...LANDING, robotsTag: "nofollow, NoIndex" } });
  assert.equal(github.checks[0].conclusion, "success");
});

test("the landing page and the API must give their own answers", async () => {
  const wrong: Record<string, Page>[] = [
    // Cloudflare's own answer for a name with no Preview.
    { [DEVELOPERS]: { status: 404, robotsTag: undefined, body: "" } },
    // The API let an unknown key through, or refused it for another reason.
    { [LOOKUP]: { status: 200, robotsTag: "noindex", body: "{}" } },
    { [LOOKUP]: { status: 401, robotsTag: "noindex", body: '{"error":{"code":"missing_key","message":"…"}}' } },
    { [LOOKUP]: { status: 401, robotsTag: "noindex", body: "<html>" } },
  ];
  for (const pages of wrong) {
    const github = new FakeGitHub(pr269());
    await smoke(github, { ...UP, ...pages });
    assert.equal(github.checks[0].conclusion, "failure", JSON.stringify(pages));
  }
});

test("a request with no answer, or a 5xx, is asked again; a wrong answer is not", async () => {
  const github = new FakeGitHub(pr269());
  const down = { ...UP, [DEVELOPERS]: new Error("fetch failed"), [wordUrl("sale")]: { ...found("sale"), status: 503 } };
  const { asked } = await smoke(github, down, 3);
  const count = (url: string) => asked.filter((request) => request.url === url).length;
  assert.equal(count(DEVELOPERS), 3);
  assert.equal(count(wordUrl("sale")), 3);
  assert.match(github.checks[0].summary, /no answer: fetch failed/);

  const wrongWord = new FakeGitHub(pr269());
  const again = await smoke(wrongWord, { ...UP, [wordUrl("casa")]: notFound("casa") }, 3);
  assert.equal(again.asked.filter((request) => request.url === wordUrl("casa")).length, 1);
  assert.equal(wrongWord.checks[0].conclusion, "failure");
});

// --- Which head it reports on --------------------------------------------------------

test("a PR whose head moved on, before or during the smoke, gets no check", async () => {
  const before = new FakeGitHub(pr269({ headSha: LATER_SHA }));
  const first = await smoke(before);
  assert.deepEqual(first.outcome, { kind: "stale", sha: SHA });
  assert.deepEqual(first.asked, []);
  assert.deepEqual(before.checks, []);

  const during = new FakeGitHub(pr269());
  during.heads = [SHA, LATER_SHA];
  assert.deepEqual((await smoke(during)).outcome, { kind: "stale", sha: SHA });
  assert.deepEqual(during.checks, []);
});

test("a closed PR, or one whose head is a fork, is not smoked", async () => {
  for (const pull of [pr269({ state: "closed" }), pr269({ headRepository: "someone/lexema" })]) {
    const github = new FakeGitHub(pull);
    assert.equal((await smoke(github)).outcome.kind, "stale");
    assert.deepEqual(github.checks, []);
  }
});

// --- GitHub's REST API ----------------------------------------------------------------

test("the check run is created on the head through the Checks API with GITHUB_TOKEN", async () => {
  const requests: { key: string; body: unknown }[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer t0ken");
    requests.push({ key: `${init?.method} ${url.pathname}`, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    if (url.pathname === "/repos/hueypov/lexema/pulls/269") {
      return Response.json({ number: 269, state: "open", head: { sha: SHA, ref: BRANCH, repo: { full_name: REPOSITORY } } });
    }
    return Response.json({ id: 1 }, { status: 201 });
  }) as typeof fetch;

  const github = restSmokeGitHub("t0ken", REPOSITORY, fakeFetch);
  assert.deepEqual(await github.pullRequest(269), pr269());
  await github.createCheckRun({ headSha: SHA, conclusion: "failure", title: "t", summary: "s", detailsUrl: "https://example.test/run" });
  assert.deepEqual(requests.at(-1), {
    key: "POST /repos/hueypov/lexema/check-runs",
    body: {
      name: SMOKE_CHECK,
      head_sha: SHA,
      status: "completed",
      conclusion: "failure",
      details_url: "https://example.test/run",
      output: { title: "t", summary: "s" },
    },
  });
  assert.throws(() => restSmokeGitHub("", REPOSITORY, fakeFetch), /GITHUB_TOKEN/);
});
