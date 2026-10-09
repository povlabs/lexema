// The preview smoke (#246, web/builds/previewSmokeCommand.ts): what it asks
// each preview site, when an answer fails it, and the check run it reports.
// The pages are cut from what PR #269's Preview answered on 2026-09-30
// (`build-245-preview-e48bab4a`): `/?q=andare` holds reading articles, and
// `/?q=zzqxnotaword` answers 200 with "No entry" and no reading. Everything
// runs against a fake GitHub and fake sites, with no network and no credential.

import assert from "node:assert/strict";
import { test } from "node:test";
import { type PullRequest, PreviewAnnouncement } from "@/builds/previewMarkerCommand.ts";
import { readFile } from "node:fs/promises";
import {
  type CheckRun,
  NOT_FOUND_SMOKE_WORDS,
  type Page,
  probesOf,
  restSmokeGitHub,
  SEARCH_SPACING_MS,
  SEARCHES_PER_MINUTE,
  SMOKE_CHECK,
  SMOKE_ICONS,
  SMOKE_WORDS,
  type SmokeGitHub,
  smokePreview,
  UNKNOWN_KEY,
} from "@/builds/previewSmokeCommand.ts";

const REPOSITORY = "povlabs/lexema";
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
  body: `<title>No entry for "${word}" — Lexema</title><h1 lang="it">Nessuna voce per “${word}”</h1>`,
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

const wordUrl = (word: string) => {
  const url = new URL(WEB);
  url.searchParams.set("q", word);
  return url.href;
};
const LOOKUP = `${API}v1/lookup?q=andare`;

/** The smoke words a working Lexema finds. */
const FOUND_WORDS = SMOKE_WORDS.filter((word) => !NOT_FOUND_SMOKE_WORDS.includes(word));

/** What every site answers on a working Preview. */
const UP: Record<string, Page> = {
  ...Object.fromEntries(SMOKE_WORDS.map((word) => [wordUrl(word), NOT_FOUND_SMOKE_WORDS.includes(word) ? notFound(word) : found(word)])),
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

/**
 * Run the smoke over `pages`; a URL missing from them gets no answer. `asked`
 * holds each request, and `spaced` how many had been sent at each wait between
 * two searches.
 */
async function smoke(github: FakeGitHub, pages: Record<string, Page | Error> = UP, attempts = 1) {
  const asked: { url: string; headers: Readonly<Record<string, string>> }[] = [];
  const spaced: number[] = [];
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
    spaceSearches: async () => {
      spaced.push(asked.length);
    },
    detailsUrl: "https://github.com/povlabs/lexema/actions/runs/1",
    log: () => {},
  });
  return { outcome, asked, spaced };
}

// --- What it asks -----------------------------------------------------------------

test("it asks the announced sites: the smoke words on the dictionary, the developer landing page, the API, and each site's icons", () => {
  const probes = probesOf(PreviewAnnouncement.of(BRANCH, SHA));
  assert.deepEqual(
    probes.map(({ app, url }) => [app, url]),
    [...SMOKE_WORDS.map((word) => ["web", wordUrl(word)]), ["developers", DEVELOPERS], ["api", LOOKUP], ...ICON_URLS],
  );
  assert.deepEqual(
    SMOKE_ICONS.map(({ path }) => path),
    ["/favicon.ico", "/apple-touch-icon.png"],
  );
  // The 59 words of the word-page audit on #695, in its order, less the five
  // P2 words #696 owns (#700).
  assert.deepEqual(SMOKE_WORDS, [
    "bello", "sale", "andare", "casa", "grande", "essere", "bella", "belli", "belle", "case", "studenti", "grandi",
    "bellissima", "vira", "andavano", "andassi", "vada", "parti", "sono andato", "sono andata", "siamo andate",
    "siamo andati", "ho mangiato", "sarei andato", "mi sono accorto", "mi sono accorta", "mi sono arresa",
    "ci siamo accorte", "accorgersi", "arrendersi", "correre", "assorbire", "vivere", "sono corso", "salivate", "andati",
    "andata", "andate", "andato", "stato", "salivare", "litigante", "gravida", "presina", "sditalinare", "costruttrici",
    "attrici", "lavoratrici", "citta", "mangare", "xqzzy", "anima gemella", "vado via", "Roma",
  ]);
  assert.equal(SMOKE_WORDS.length, 54);
  for (const word of ["sbucciapatate", "ottemperanza", "decrepito", "buio pesto", "fare l'abitudine"]) {
    assert.ok(!(SMOKE_WORDS as readonly string[]).includes(word), `${word} is #696's`);
  }
  assert.deepEqual(NOT_FOUND_SMOKE_WORDS, ["mangare", "xqzzy"]);
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
  assert.equal(check.detailsUrl, "https://github.com/povlabs/lexema/actions/runs/1");
});

test("any found smoke word that does not resolve fails the check, naming the word", async () => {
  for (const word of FOUND_WORDS) {
    const github = new FakeGitHub(pr269());
    await smoke(github, { ...UP, [wordUrl(word)]: notFound(word) });
    const [check] = github.checks;
    assert.equal(check.conclusion, "failure", word);
    assert.equal(check.title, `1 of ${REQUESTS} preview requests failed`);
    assert.match(check.summary, new RegExp(`\\*\\*fail\\*\\*: no reading for "${word}" on the page`));
  }
});

test("a verb form block is a reading: a page of one block and no record's reading passes (#636)", async () => {
  // As PR #645's Preview sent `/?q=andavano` on 2026-10-06, with the block marked.
  const github = new FakeGitHub(pr269());
  const block: Page = {
    ...found("andavano"),
    body: `${head("andavano")}<body><article class="scroll-mt-6 mt-7" id="reading-voce-verbale-andare" aria-labelledby="reading-heading-voce-verbale-andare" data-verb-form="andare">`,
  };
  await smoke(github, { ...UP, [wordUrl("andavano")]: block });
  assert.equal(github.checks[0].conclusion, "success");
  // A form only its base word's grid spells is a reading too (#700): `gravida`.
  const grid = new FakeGitHub(pr269());
  const gravida: Page = {
    ...found("gravida"),
    body: `${head("gravida")}<body><article class="scroll-mt-6 mt-7" id="reading-forma-flessa-449472" aria-labelledby="reading-heading-forma-flessa-449472" data-grid-form="gravido">`,
  };
  await smoke(grid, { ...UP, [wordUrl("gravida")]: gravida });
  assert.equal(grid.checks[0].conclusion, "success");
});

test("a reading sent hidden for a script to show fails the check, naming the word (#115)", async () => {
  for (const word of FOUND_WORDS) {
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

// --- The word-page law on real data (#700) ---------------------------------------------
//
// The markup is cut from what https://lexema.fyi sent on 2026-10-07 for
// `andavano` (a block, its non-finite line) and `presina` (a grid row with a
// dash), shortened to the attributes the checks read.

const HEADING = (id: string, number: string) =>
  `<h2 class="m-0 flex font-sans" id="reading-heading-${id}">${number}<span class="font-normal text-text-muted" aria-hidden="true">·</span><span lang="it">Voce verbale</span></h2>`;
const NUMBER = (n: number) => `<span class="font-normal text-accent tabular-nums">${n}</span>`;
const DASH = `<span class="font-mono text-text-muted" aria-hidden="true">—</span>`;
const FORM = `<span><a class="cursor-pointer font-mono" href="/?q=andando" lang="it" data-form="1">andando</a></span>`;
const NON_FINITE = (slots: readonly string[]) =>
  `<dl class="m-0 flex">${slots.map((slot, i) => `<div class="flex"><dt class="m-0" lang="it">${["gerundio", "participio", "ausiliare"][i]}</dt><dd class="m-0 font-mono">${slot}</dd></div>`).join("")}</dl>`;
const GRID_ROW = (cells: readonly string[]) =>
  `<div role="row" class="contents"><span class="pt-1" role="rowheader" lang="it">femminile</span>${cells.map((cell) => `<div class="min-w-0" role="cell">${cell}</div>`).join("")}</div>`;
const GRID = (rows: readonly string[]) =>
  `<div class="grid" role="table" aria-label="Forme di presina" data-grid=""><div role="row" class="contents"><span role="columnheader"></span><span role="columnheader" lang="it">singolare</span><span role="columnheader" lang="it">plurale</span></div>${rows.join("")}</div>`;
const SPELLING = `<div class="[&amp;+&amp;]:mt-2"><p class="m-0 font-mono" lang="it"><span data-headword="">presina</span></p></div>`;
const LEMMA_FORMS = (word: string) =>
  `<section class="mt-[1.125rem]" aria-labelledby="lemma-forms-x-${word}"><h3 class="m-0" id="lemma-forms-x-${word}">Forme di<span class="ml-1" lang="it">${word}</span></h3></section>`;
const BLOCK = (verb: string, n: number, inside: string) =>
  `<article class="scroll-mt-6" id="reading-voce-verbale-${verb}" aria-labelledby="reading-heading-voce-verbale-${verb}" data-verb-form="${verb}">${HEADING(`voce-verbale-${verb}`, NUMBER(n))}${inside}</article>`;

/** `andavano`'s page with `readings` in place of its own. */
const andavanoWith = (readings: string): Page => ({ ...found("andavano"), body: `${head("andavano")}<body>${readings}</body>` });

/** The one problem the smoke reports for `andavano`'s page drawn as `page`. */
async function andavanoProblem(page: Page): Promise<string> {
  const github = new FakeGitHub(pr269());
  await smoke(github, { ...UP, [wordUrl("andavano")]: page });
  const [check] = github.checks;
  assert.equal(check.conclusion, "failure");
  assert.equal(check.title, `1 of ${REQUESTS} preview requests failed`);
  const row = check.summary.split("\n").find((line) => line.includes("**fail**"));
  return row?.slice(row.indexOf("**fail**: ") + "**fail**: ".length, row.lastIndexOf(" |")) ?? "";
}

test("a page that keeps the word-page law passes: a numbered block, a non-finite line and a grid row with a form", async () => {
  const github = new FakeGitHub(pr269());
  const page = andavanoWith(BLOCK("andare", 1, `${LEMMA_FORMS("andare")}${NON_FINITE([FORM, DASH, DASH])}<div aria-label="Modi di andare"></div>${GRID([GRID_ROW([SPELLING, DASH])])}`));
  await smoke(github, { ...UP, [wordUrl("andavano")]: page });
  assert.equal(github.checks[0].conclusion, "success", github.checks[0].summary);
});

test("an empty reading fails the check, naming the word (#700)", async () => {
  const empty = andavanoWith(
    `<article class="scroll-mt-6" id="reading-1011" aria-labelledby="reading-heading-1011" data-record="1011" data-line="2344">${HEADING("1011", NUMBER(1))}</article>`,
  );
  assert.equal(await andavanoProblem(empty), '"andavano" draws an empty reading (1011)');
});

test("a Forms row of dashes only fails the check, naming the word: a non-finite line or a grid row (#700)", async () => {
  assert.equal(await andavanoProblem(andavanoWith(BLOCK("andare", 1, NON_FINITE([DASH, DASH, DASH])))), '"andavano" draws a Forms row of dashes only');
  assert.equal(
    await andavanoProblem(andavanoWith(BLOCK("andare", 1, GRID([GRID_ROW([SPELLING, DASH]), GRID_ROW([DASH, DASH])])))),
    '"andavano" draws a Forms row of dashes only',
  );
});

test("a reading or block heading with no number fails the check, naming the word (#700)", async () => {
  const unnumbered = andavanoWith(
    `<article class="scroll-mt-6" id="reading-voce-verbale-andare" aria-labelledby="reading-heading-voce-verbale-andare" data-verb-form="andare">${HEADING("voce-verbale-andare", "")}${LEMMA_FORMS("andare")}</article>`,
  );
  assert.equal(await andavanoProblem(unnumbered), '"andavano" draws a reading heading with no number (voce-verbale-andare)');
});

test("the same base word's table or block drawn twice fails the check, naming the word and the base word (#700)", async () => {
  assert.equal(
    await andavanoProblem(andavanoWith(`${BLOCK("andare", 1, LEMMA_FORMS("andare"))}${BLOCK("salire", 2, LEMMA_FORMS("andare"))}`)),
    `"andavano" draws andare's Forme di 2 times`,
  );
  assert.equal(
    await andavanoProblem(andavanoWith(BLOCK("andare", 1, '<div aria-label="Modi di andare"></div><div aria-label="Modi di andare"></div>'))),
    `"andavano" draws andare's conjugation 2 times`,
  );
  assert.equal(
    await andavanoProblem(andavanoWith(`${BLOCK("andare", 1, "<p>x</p>")}${BLOCK("andare", 2, "<p>y</p>")}`)),
    `"andavano" draws andare's Voce verbale block 2 times`,
  );
  // Two base words, each drawn once, pass.
  const github = new FakeGitHub(pr269());
  await smoke(github, { ...UP, [wordUrl("andavano")]: andavanoWith(`${BLOCK("salire", 1, LEMMA_FORMS("salire"))}${BLOCK("salivare", 2, LEMMA_FORMS("salivare"))}`) });
  assert.equal(github.checks[0].conclusion, "success");
});

test("a word the dictionary has no entry for must say so and show no reading (#700)", async () => {
  for (const word of NOT_FOUND_SMOKE_WORDS) {
    for (const [page, problem] of [
      [found(word), `the page for "${word}" does not say there is no entry; the page for "${word}" shows a reading`],
      [{ ...notFound(word), body: `${notFound(word).body}<article class="x" id="reading-1" data-record="1">` }, `the page for "${word}" shows a reading`],
    ] as const) {
      const github = new FakeGitHub(pr269());
      await smoke(github, { ...UP, [wordUrl(word)]: page });
      const [check] = github.checks;
      assert.equal(check.conclusion, "failure", word);
      assert.ok(check.summary.includes(`**fail**: ${problem} |`), check.summary);
    }
  }
});

test("the word requests are spaced to stay under the Preview's search limit, and a 429 is asked again (#700)", async () => {
  const { asked, spaced } = await smoke(new FakeGitHub(pr269()));
  // One wait before every word but the first; none before the other requests.
  assert.deepEqual(spaced, SMOKE_WORDS.slice(1).map((_, i) => i + 1));
  assert.equal(asked.length, REQUESTS);
  // The spacing keeps under the limit wrangler.jsonc gives a Preview.
  const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const previews = wrangler.slice(wrangler.indexOf('"previews"'));
  const limit = /"SEARCH_LIMIT"[^}]*"limit": (\d+)/.exec(previews)?.[1];
  assert.equal(Number(limit), SEARCHES_PER_MINUTE);
  assert.ok(SEARCH_SPACING_MS * SEARCHES_PER_MINUTE > 60_000);

  const limited = new FakeGitHub(pr269());
  const tooMany = await smoke(limited, { ...UP, [wordUrl("sale")]: { ...found("sale"), status: 429 } }, 3);
  assert.equal(tooMany.asked.filter((request) => request.url === wordUrl("sale")).length, 3);
  assert.match(limited.checks[0].summary, /answered 429, not 200/);
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
    if (url.pathname === "/repos/povlabs/lexema/pulls/269") {
      return Response.json({ number: 269, state: "open", head: { sha: SHA, ref: BRANCH, repo: { full_name: REPOSITORY } } });
    }
    return Response.json({ id: 1 }, { status: 201 });
  }) as typeof fetch;

  const github = restSmokeGitHub("t0ken", REPOSITORY, fakeFetch);
  assert.deepEqual(await github.pullRequest(269), pr269());
  await github.createCheckRun({ headSha: SHA, conclusion: "failure", title: "t", summary: "s", detailsUrl: "https://example.test/run" });
  assert.deepEqual(requests.at(-1), {
    key: "POST /repos/povlabs/lexema/check-runs",
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
