// The preview smoke (#246): once the preview marker has announced a pull
// request's Preview at its head (previewMarkerCommand.ts), ask each of its
// three sites one thing a working Lexema answers, and report the result as a
// check run on that head.
//
// .github/workflows/preview-marker.yml runs this as the smoke job, after the
// announce job and on what it announced, with `GITHUB_TOKEN` alone. The URLs
// come from `PreviewAnnouncement`, the one place the marker names them, so the
// smoke asks exactly the sites the comment names.
//
// What each site must answer:
// - the dictionary finds every word in `SMOKE_WORDS`: `/?q=<word>` is a 200
//   whose page holds a reading (`data-record`, web/components/dictionary/Reading.tsx).
//   A word it cannot find is a 200 too, with no reading, so the status alone
//   says nothing. The reading must be visible as sent, since the smoke runs no
//   script (#115): React streams a result that is not ready at the first flush
//   as a hidden `<div hidden id="S:…">` after the page, for a script to swap in,
//   so a reading only in such a segment is one a reader without JavaScript never sees.
//   Its `<title>` and `og:title` must sit before `</head>`: a link previewer reads
//   the raw head, and metadata streamed after the footer gives it no card (#337);
// - the developer site answers its landing page, `/`, with a 200;
// - the API answers `GET /v1/lookup?q=andare` sent with a key that does not
//   exist with its own 401 `invalid_key`. Refusing that key takes a read of the
//   Preview's app database, so the answer says the API Worker is up and reaches
//   its D1. The key is a fixed string that names no key, not a secret; a real
//   key would be one, and this job holds none;
// - each of the three sites serves the site icon (#383): `/favicon.ico` and
//   `/apple-touch-icon.png` are a 200 with an icon's and a PNG's content type.
//   They are static assets, answered before the Worker runs, on every host;
// - every response carries `X-Robots-Tag: noindex` (web/worker/stage.ts), the
//   icons' from web/public/_headers.

import { type GitHub, hasNoindex, isHead, PreviewAnnouncement, type PreviewSite, restCall, restGitHub, SHA } from "./previewMarkerCommand.ts";

/** The words the dictionary must find on every Preview (#246). */
export const SMOKE_WORDS = ["sale", "andare", "andavano", "casa", "bello", "studente"] as const;

/** The check run the smoke reports as, on the pull request's head. */
export const SMOKE_CHECK = "preview smoke";

/** An API key no Preview can hold: every key is `lx_` and 64 hex digits (src/api/keys.ts). */
export const UNKNOWN_KEY = "preview-smoke-no-such-key";

/** What one request answered. */
export interface Page {
  readonly status: number;
  readonly robotsTag: string | undefined;
  readonly contentType: string | undefined;
  readonly body: string;
}

/**
 * The icon files every site must serve (#383, web/lib/shared/siteIcons.ts),
 * and the content types each may carry, without parameters. Cloudflare's
 * static assets answer `.ico` as `image/vnd.microsoft.icon` (wrangler dev,
 * 2026-10-01); `image/x-icon` is the older name for the same type.
 */
export const SMOKE_ICONS = [
  { path: "/favicon.ico", contentTypes: ["image/vnd.microsoft.icon", "image/x-icon"] },
  { path: "/apple-touch-icon.png", contentTypes: ["image/png"] },
] as const;

/** A reading on the dictionary's page: only a found word renders one. */
const READING = /<article\b[^>]*\bdata-record="/;
/** Where React's streamed, hidden segments begin: after everything the first flush showed. */
const HIDDEN_SEGMENT = /<div hidden id="S:/;

/** What is wrong with a found word's page, as sent and with no script run; nothing when it shows a reading. */
function readingProblem(body: string, word: string): string | undefined {
  const reading = READING.exec(body);
  if (reading === null) return `no reading for "${word}" on the page`;
  const hidden = HIDDEN_SEGMENT.exec(body);
  if (hidden !== null && hidden.index < reading.index) return `the reading for "${word}" is sent hidden, for a script to show`;
  return undefined;
}

/** The tags a link previewer needs in the raw `<head>` (#337, #304). */
const HEAD_TAGS = [
  { name: "<title>", pattern: /<title\b[^>]*>/ },
  { name: "og:title", pattern: /<meta\b[^>]*\bproperty="og:title"/ },
] as const;

/** Each tag a link previewer needs that a found word's page does not send before `</head>`. */
function headProblems(body: string, word: string): readonly string[] {
  const end = body.indexOf("</head>");
  if (end === -1) return [`the page for "${word}" has no </head>`];
  const head = body.slice(0, end);
  return HEAD_TAGS.filter(({ pattern }) => !pattern.test(head)).map(({ name }) => `the page for "${word}" has no ${name} before </head>`);
}

/** One request the smoke makes, and what its answer must be. */
export class SmokeProbe {
  readonly app: PreviewSite["app"];
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  private readonly status: number;
  /** What the answer must carry beyond its status and noindex, as the problems when it does not. */
  private readonly answerProblems: (page: Page) => readonly string[];

  // Plain `node` strips types and cannot run parameter properties, so the fields are assigned.
  private constructor(
    app: PreviewSite["app"],
    url: string,
    headers: Readonly<Record<string, string>>,
    status: number,
    answerProblems: (page: Page) => readonly string[],
  ) {
    this.app = app;
    this.url = url;
    this.headers = headers;
    this.status = status;
    this.answerProblems = answerProblems;
  }

  /** The dictionary's page for `word`: a reading shown without JavaScript, and its link-preview tags in `<head>`. */
  static word(siteUrl: string, word: string): SmokeProbe {
    const url = new URL(siteUrl);
    url.searchParams.set("q", word);
    return new SmokeProbe("web", url.href, {}, 200, ({ body }) => {
      const reading = readingProblem(body, word);
      return [...(reading === undefined ? [] : [reading]), ...headProblems(body, word)];
    });
  }

  /** The developer site's landing page. */
  static landing(siteUrl: string): SmokeProbe {
    return new SmokeProbe("developers", new URL("/", siteUrl).href, {}, 200, () => []);
  }

  /** The API's lookup, refusing a key it does not have. */
  static api(siteUrl: string): SmokeProbe {
    const url = new URL("/v1/lookup", siteUrl);
    url.searchParams.set("q", "andare");
    return new SmokeProbe("api", url.href, { "x-api-key": UNKNOWN_KEY }, 401, ({ body }) => {
      let code: unknown;
      try {
        const parsed: unknown = JSON.parse(body);
        code = typeof parsed === "object" && parsed !== null && "error" in parsed ? (parsed.error as { code?: unknown }).code : undefined;
      } catch {
        return ["the body is not JSON"];
      }
      return code === "invalid_key" ? [] : [`the error is ${JSON.stringify(code)}, not "invalid_key"`];
    });
  }

  /** One of the site icon files on any of the three sites (#383). */
  static icon(app: PreviewSite["app"], siteUrl: string, icon: (typeof SMOKE_ICONS)[number]): SmokeProbe {
    return new SmokeProbe(app, new URL(icon.path, siteUrl).href, {}, 200, ({ contentType }) => {
      const type = contentType?.split(";")[0].trim().toLowerCase();
      const allowed: readonly string[] = icon.contentTypes;
      return type !== undefined && allowed.includes(type) ? [] : [`Content-Type is ${contentType === undefined ? "missing" : JSON.stringify(contentType)}, not ${icon.contentTypes.join(" or ")}`];
    });
  }

  /** Everything wrong with `page` as this probe's answer; none when it is right. */
  problems(page: Page): readonly string[] {
    const problems: string[] = [];
    if (page.status !== this.status) problems.push(`answered ${page.status}, not ${this.status}`);
    if (!hasNoindex(page.robotsTag)) problems.push(`X-Robots-Tag is ${page.robotsTag === undefined ? "missing" : JSON.stringify(page.robotsTag)}, not noindex`);
    problems.push(...this.answerProblems(page));
    return problems;
  }
}

/** Every probe for one announced Preview: each word on the dictionary, the landing page, the API, then each site's icons. */
export function probesOf(announcement: PreviewAnnouncement): readonly SmokeProbe[] {
  const url = (app: PreviewSite["app"]) => {
    const site = announcement.sites.find(({ site }) => site.app === app);
    if (site === undefined) throw new Error(`the announcement names no ${app} site`);
    return site.url;
  };
  const apps = ["web", "developers", "api"] as const;
  return [
    ...SMOKE_WORDS.map((word) => SmokeProbe.word(url("web"), word)),
    SmokeProbe.landing(url("developers")),
    SmokeProbe.api(url("api")),
    ...apps.flatMap((app) => SMOKE_ICONS.map((icon) => SmokeProbe.icon(app, url(app), icon))),
  ];
}

/** What one probe found: passed when it lists no problem. */
export interface ProbeResult {
  readonly probe: SmokeProbe;
  /** What it answered, or why nothing did. */
  readonly answer: string;
  readonly problems: readonly string[];
}

/** A check run's conclusion and output, from every probe's result. */
export class SmokeReport {
  readonly announcement: PreviewAnnouncement;
  readonly results: readonly ProbeResult[];

  constructor(announcement: PreviewAnnouncement, results: readonly ProbeResult[]) {
    if (results.length === 0) throw new Error("a smoke report needs at least one probe");
    this.announcement = announcement;
    this.results = results;
  }

  get failed(): readonly ProbeResult[] {
    return this.results.filter(({ problems }) => problems.length > 0);
  }

  get conclusion(): "success" | "failure" {
    return this.failed.length === 0 ? "success" : "failure";
  }

  get title(): string {
    const failed = this.failed.length;
    return failed === 0 ? `All ${this.results.length} preview requests answered` : `${failed} of ${this.results.length} preview requests failed`;
  }

  /** The check run's summary: one row per request. */
  get summary(): string {
    const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const rows = this.results.map(
      ({ probe, answer, problems }) =>
        `| ${probe.app} | \`${cell(probe.url)}\` | ${cell(answer)} | ${problems.length === 0 ? "pass" : `**fail**: ${cell(problems.join("; "))}`} |`,
    );
    return [
      `Preview \`${this.announcement.preview.value}\` @ ${this.announcement.sha}, the one the preview comment names.`,
      "",
      "| Site | Request | Answer | Result |",
      "|---|---|---|---|",
      ...rows,
      "",
    ].join("\n");
  }
}

// --- Running it -----------------------------------------------------------------

/** A check run to create on a commit. */
export interface CheckRun {
  readonly headSha: string;
  readonly conclusion: "success" | "failure";
  readonly title: string;
  readonly summary: string;
  /** Where the run's log is. */
  readonly detailsUrl: string | undefined;
}

/** The GitHub calls the smoke makes, as the workflow's `GITHUB_TOKEN`. */
export interface SmokeGitHub extends Pick<GitHub, "repository" | "pullRequest"> {
  createCheckRun(run: CheckRun): Promise<void>;
}

export interface SmokeSteps {
  /** The commit the announce job announced, and the pull requests it announced it on. */
  readonly sha: string;
  readonly pullRequests: readonly number[];
  readonly github: SmokeGitHub;
  /** One request, or a throw when nothing answered. */
  fetchPage(url: string, headers: Readonly<Record<string, string>>): Promise<Page>;
  /** How often to send a request that got no answer, or a 5xx, before counting it failed. */
  readonly attempts: number;
  wait(): Promise<void>;
  readonly detailsUrl: string | undefined;
  log(line: string): void;
}

export type SmokeOutcome =
  | { readonly kind: "stale"; readonly sha: string }
  | { readonly kind: "reported"; readonly checks: readonly { readonly number: number; readonly conclusion: "success" | "failure" }[] };

/**
 * Ask one probe, again while it gets no answer or a server error. A wrong
 * answer, such as a word with no reading, is final: asking again would only
 * spend the dictionary's search limit (web/worker/rateLimit.ts).
 */
async function ask(probe: SmokeProbe, steps: SmokeSteps): Promise<ProbeResult> {
  for (let attempt = 1; ; attempt++) {
    let result: ProbeResult;
    let retry: boolean;
    try {
      const page = await steps.fetchPage(probe.url, probe.headers);
      result = { probe, answer: `${page.status}, X-Robots-Tag ${page.robotsTag ?? "none"}`, problems: probe.problems(page) };
      retry = page.status >= 500;
    } catch (error) {
      const said = error instanceof Error ? error.message : String(error);
      result = { probe, answer: said, problems: [`no answer: ${said}`] };
      retry = true;
    }
    steps.log(`${probe.url}: ${result.answer}${result.problems.length === 0 ? "" : ` (${result.problems.join("; ")})`}`);
    if (result.problems.length === 0 || !retry || attempt >= steps.attempts) return result;
    await steps.wait();
  }
}

/**
 * Smoke the Preview of every pull request the announce job named, if the
 * announced commit is still its head, and report a check run on that commit.
 * A pull request whose head moved on, before or during the smoke, gets none:
 * its Preview may already serve the newer commit, whose own run reports.
 */
export async function smokePreview(steps: SmokeSteps): Promise<SmokeOutcome> {
  const { github, sha, log } = steps;
  if (!SHA.test(sha)) throw new Error(`not a commit SHA: ${JSON.stringify(sha)}`);
  const checks: { number: number; conclusion: "success" | "failure" }[] = [];
  for (const number of steps.pullRequests) {
    const pull = await github.pullRequest(number);
    if (!isHead(pull, sha, github.repository)) {
      log(`PR #${number}: ${sha} is no longer its head; no smoke`);
      continue;
    }
    const announcement = PreviewAnnouncement.of(pull.headRef, sha);
    const results: ProbeResult[] = [];
    for (const probe of probesOf(announcement)) results.push(await ask(probe, steps));
    const report = new SmokeReport(announcement, results);
    if (!isHead(await github.pullRequest(number), sha, github.repository)) {
      log(`PR #${number}: its head moved past ${sha} during the smoke; no check reported`);
      continue;
    }
    await github.createCheckRun({ headSha: sha, conclusion: report.conclusion, title: report.title, summary: report.summary, detailsUrl: steps.detailsUrl });
    log(`PR #${number}: ${SMOKE_CHECK} ${report.conclusion} @ ${sha}: ${report.title}`);
    checks.push({ number, conclusion: report.conclusion });
  }
  return checks.length === 0 ? { kind: "stale", sha } : { kind: "reported", checks };
}

/** The smoke's GitHub calls over REST with `token`, for `repository` (`owner/name`). */
export function restSmokeGitHub(token: string, repository: string, fetchUrl: typeof fetch): SmokeGitHub {
  const { pullRequest } = restGitHub(token, repository, fetchUrl);
  const call = restCall(token, repository, fetchUrl);
  return {
    repository,
    pullRequest,
    async createCheckRun(run) {
      // https://docs.github.com/en/rest/checks/runs#create-a-check-run
      await call("POST", "/check-runs", {
        name: SMOKE_CHECK,
        head_sha: run.headSha,
        status: "completed",
        conclusion: run.conclusion,
        ...(run.detailsUrl === undefined ? {} : { details_url: run.detailsUrl }),
        output: { title: run.title, summary: run.summary },
      });
    },
  };
}
