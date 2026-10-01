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
  SMOKE_ICONS,
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

/** A word's page title, as `generateMetadata` writes it. */
const title = (word: string) => `${word[0].toUpperCase()}${word.slice(1)} — Lexema`;
/**
 * A found word's `<head>`, its title and link-preview tags inside it, cut from
 * what https://lexema.fyi/?q=casa sent a `Discordbot/2.0` User-Agent on 2026-10-01 (#337).
 */
const head = (word: string) =>
  `<head><meta charSet="utf-8"/><title>${title(word)}</title><meta name="description" content="a simple dictionary"/><meta property="og:title" content="${title(word)}"/></head>`;
/** A found word's page: its head and a reading article, as the Preview renders them. */
const found = (word: string): Page => ({
  status: 200,
  robotsTag: "noindex",
  contentType: "text/html; charset=utf-8",
  body: `${head(word)}<body><article class="scroll-mt-6 mt-7" id="reading-1011" aria-labelledby="reading-heading-1011" data-record="1011" data-line="2344">`,
});
/** A word the dictionary does not have: still a 200, with no reading. */
const notFound = (word: string): Page => ({
  status: 200,
  robotsTag: "noindex",
  contentType: "text/html; charset=utf-8",
  body: `<title>No entry for "${word}" — Lexema</title><h1>No entry for “<span lang="it">${word}</span>”</h1>`,
});
/**
 * A found word's page as the Preview of PR #328 sent it on 2026-10-01, before
 * #115: the loading line in the result's place, and the reading after the page
 * in a hidden segment that only a script shows.
 */
const hiddenFound = (word: string): Page => ({
  status: 200,
  robotsTag: "noindex",
  contentType: "text/html; charset=utf-8",
  body: `${head(word)}<body><main><!--$?--><template id="B:0"></template><p class="my-6 font-sans text-[0.95rem] text-text-muted" role="status">Searching for <q lang="it">${word}</q> …</p><!--/$--></main><div hidden id="S:0"><h1 lang="it">${word}</h1><article class="scroll-mt-6 mt-7" id="reading-1" aria-labelledby="reading-heading-1" data-record="1" data-line="1"></article></div><script>$RC("B:0","S:0")</script>`,
});
const LANDING: Page = { status: 200, robotsTag: "noindex", contentType: "text/html; charset=utf-8", body: "<title>Lexema API</title>" };
const REFUSED: Page = { status: 401, robotsTag: "noindex", contentType: "application/json", body: '{"error":{"code":"invalid_key","message":"This API key is not valid."}}' };
/** The icons as wrangler dev served them on all three local hosts on 2026-10-01 (#383). */
const FAVICON: Page = { status: 200, robotsTag: "noindex", contentType: "image/vnd.microsoft.icon", body: "" };
const TOUCH_ICON: Page = { status: 200, robotsTag: "noindex", contentType: "image/png", body: "" };
const SITES = { web: WEB, developers: DEVELOPERS, api: API } as const;
const FAVICON_URL = (site: string) => new URL("/favicon.ico", site).href;
const TOUCH_ICON_URL = (site: string) => new URL("/apple-touch-icon.png", site).href;
/** Each site's icon URLs, in the order the smoke asks them. */
const ICON_URLS = Object.entries(SITES).flatMap(([app, site]) => [
  [app, FAVICON_URL(site)],
  [app, TOUCH_ICON_URL(site)],
]);
/** How many requests the smoke makes: each word, the landing page, the API, and two icons on each site. */
const REQUESTS = SMOKE_WORDS.length + 2 + ICON_URLS.length;

const wordUrl = (word: string) => `${WEB}?q=${word}`;
const LOOKUP = `${API}v1/lookup?q=andare`;

/** What every site answers on a working Preview. */
const UP: Record<string, Page> = {
  ...Object.fromEntries(SMOKE_WORDS.map((word) => [wordUrl(word), found(word)])),
  [DEVELOPERS]: LANDING,
  [LOOKUP]: REFUSED,
  ...Object.fromEntries(
    Object.values(SITES).flatMap((site) => [
      [FAVICON_URL(site), FAVICON],
      [TOUCH_ICON_URL(site), TOUCH_ICON],
    ]),
  ),
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

test("it asks the announced sites: the six words on the dictionary, the developer landing page, the API, and each site's icons", () => {
  const probes = probesOf(PreviewAnnouncement.of(BRANCH, SHA));
  assert.deepEqual(
    probes.map(({ app, url }) => [app, url]),
    [...SMOKE_WORDS.map((word) => ["web", wordUrl(word)]), ["developers", DEVELOPERS], ["api", LOOKUP], ...ICON_URLS],
  );
  assert.deepEqual(
    SMOKE_ICONS.map(({ path }) => path),
    ["/favicon.ico", "/apple-touch-icon.png"],
  );
  assert.deepEqual(SMOKE_WORDS, ["sale", "andare", "andavano", "casa", "bello", "studente"]);
  // The API is sent a key no Preview holds: never a real one.
  const api = probes.find(({ url }) => url === LOOKUP);
  assert.deepEqual(api?.headers, { "x-api-key": UNKNOWN_KEY });
  assert.doesNotMatch(UNKNOWN_KEY, /^lx_[0-9a-f]{64}$/);
  for (const probe of probes.filter((probe) => probe !== api)) assert.deepEqual(probe.headers, {});
});

// --- When it passes and fails ------------------------------------------------------

test("a working Preview reports one successful check at the head, with a row per request", async () => {
  const github = new FakeGitHub(pr269());
  const { outcome, asked } = await smoke(github);
  assert.deepEqual(outcome, { kind: "reported", checks: [{ number: 269, conclusion: "success" }] });
  assert.equal(asked.length, REQUESTS);
  assert.equal(github.checks.length, 1);
  const [check] = github.checks;
  assert.equal(check.headSha, SHA);
  assert.equal(check.conclusion, "success");
  assert.equal(check.title, `All ${REQUESTS} preview requests answered`);
  assert.match(check.summary, /Preview `build-245-preview-e48bab4a` @ 8be5dd31adde7c3155860e89e1b8e8d5990394ff/);
  assert.equal(check.summary.split("\n").filter((line) => line.endsWith("| pass |")).length, REQUESTS);
  assert.equal(check.detailsUrl, "https://github.com/hueypov/lexema/actions/runs/1");
});

test("any of the six words that does not resolve fails the check, naming the word", async () => {
  for (const word of SMOKE_WORDS) {
    const github = new FakeGitHub(pr269());
    await smoke(github, { ...UP, [wordUrl(word)]: notFound(word) });
    const [check] = github.checks;
    assert.equal(check.conclusion, "failure", word);
    assert.equal(check.title, `1 of ${REQUESTS} preview requests failed`);
    assert.match(check.summary, new RegExp(`\\*\\*fail\\*\\*: no reading for "${word}" on the page`));
  }
});

test("a reading sent hidden for a script to show fails the check, naming the word (#115)", async () => {
  for (const word of SMOKE_WORDS) {
    const github = new FakeGitHub(pr269());
    await smoke(github, { ...UP, [wordUrl(word)]: hiddenFound(word) });
    const [check] = github.checks;
    assert.equal(check.conclusion, "failure", word);
    assert.equal(check.title, `1 of ${REQUESTS} preview requests failed`);
    assert.match(check.summary, new RegExp(`\\*\\*fail\\*\\*: the reading for "${word}" is sent hidden, for a script to show`));
  }
  // A hidden segment after a reading the page already shows does not hide it.
  const github = new FakeGitHub(pr269());
  const shown = found("casa");
  await smoke(github, { ...UP, [wordUrl("casa")]: { ...shown, body: `${shown.body}<div hidden id="S:0"></div>` } });
  assert.equal(github.checks[0].conclusion, "success");
});

test("a word page whose <title> or og:title is not before </head> fails the check, naming the word and tag (#337)", async () => {
  const shown = found("casa");
  const reading = shown.body.slice(shown.body.indexOf("<body>"));
  // As https://lexema.fyi/?q=casa sent a `curl/8` User-Agent on 2026-10-01: the tags streamed after the footer.
  const streamed = `<head><meta charSet="utf-8"/></head>${reading}<footer></footer><div hidden id="S:0"><title>${title("casa")}</title><meta property="og:title" content="${title("casa")}"/></div>`;
  const cases = [
    { body: streamed, problems: ["<title>", "og:title"].map((tag) => `the page for "casa" has no ${tag} before </head>`) },
    { body: shown.body.replace(/<meta property="og:title"[^>]*>/, ""), problems: ['the page for "casa" has no og:title before </head>'] },
    { body: shown.body.replace(/<title>[^<]*<\/title>/, ""), problems: ['the page for "casa" has no <title> before </head>'] },
    { body: shown.body.replace("</head>", ""), problems: ['the page for "casa" has no </head>'] },
  ];
  for (const { body, problems } of cases) {
    const github = new FakeGitHub(pr269());
    await smoke(github, { ...UP, [wordUrl("casa")]: { ...shown, body } });
    const [check] = github.checks;
    assert.equal(check.conclusion, "failure", body);
    assert.equal(check.title, `1 of ${REQUESTS} preview requests failed`);
    assert.ok(check.summary.includes(`**fail**: ${problems.join("; ")} |`), check.summary);
  }
  // Both tags before </head> pass, whatever follows.
  const github = new FakeGitHub(pr269());
  await smoke(github, { ...UP, [wordUrl("casa")]: shown });
  assert.equal(github.checks[0].conclusion, "success");
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
    { [DEVELOPERS]: { status: 404, robotsTag: undefined, contentType: undefined, body: "" } },
    // The API let an unknown key through, or refused it for another reason.
    { [LOOKUP]: { status: 200, robotsTag: "noindex", contentType: "application/json", body: "{}" } },
    { [LOOKUP]: { status: 401, robotsTag: "noindex", contentType: "application/json", body: '{"error":{"code":"missing_key","message":"…"}}' } },
    { [LOOKUP]: { status: 401, robotsTag: "noindex", contentType: "text/html; charset=utf-8", body: "<html>" } },
  ];
  for (const pages of wrong) {
    const github = new FakeGitHub(pr269());
    await smoke(github, { ...UP, ...pages });
    assert.equal(github.checks[0].conclusion, "failure", JSON.stringify(pages));
  }
});

test("each site must serve the favicon and the touch icon: a 200 with an icon's and a PNG's content type, and noindex (#383)", async () => {
  for (const site of Object.values(SITES)) {
    const wrong: [string, Page, RegExp][] = [
      // The Worker's own 404, which a request for a missing asset falls through to.
      [FAVICON_URL(site), { status: 404, robotsTag: "noindex", contentType: "text/plain; charset=utf-8", body: "Not Found" }, /answered 404, not 200/],
      [FAVICON_URL(site), { ...FAVICON, contentType: "text/html; charset=utf-8" }, /Content-Type is "text\/html; charset=utf-8", not image\/vnd\.microsoft\.icon or image\/x-icon/],
      [TOUCH_ICON_URL(site), { ...TOUCH_ICON, contentType: undefined }, /Content-Type is missing, not image\/png/],
      [TOUCH_ICON_URL(site), { ...TOUCH_ICON, robotsTag: undefined }, /X-Robots-Tag is missing, not noindex/],
    ];
    for (const [url, page, problem] of wrong) {
      const github = new FakeGitHub(pr269());
      await smoke(github, { ...UP, [url]: page });
      const [check] = github.checks;
      assert.equal(check.conclusion, "failure", url);
      assert.equal(check.title, `1 of ${REQUESTS} preview requests failed`);
      assert.match(check.summary, problem, url);
    }
  }
  // The older name for the icon type, and a parameter after a type, still pass.
  const github = new FakeGitHub(pr269());
  await smoke(github, {
    ...UP,
    [FAVICON_URL(API)]: { ...FAVICON, contentType: "image/x-icon" },
    [TOUCH_ICON_URL(WEB)]: { ...TOUCH_ICON, contentType: "image/png; charset=binary" },
  });
  assert.equal(github.checks[0].conclusion, "success");
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
