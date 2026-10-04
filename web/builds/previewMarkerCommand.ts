// The preview marker (ADR 0018, #244): when Workers Builds has built a pull
// request's head, keep one comment on that pull request naming the three
// preview sites at that commit, in the shape Fabrika's `review-ui render`
// reads (`readPreviewAnnouncement` in @kampus/fabrika-cli's capture/resolve.js).
//
// Workers Builds posts no comment on this repository's pull requests, only a
// check run named `Workers Builds: lexema-web` from the Cloudflare GitHub App
// (#244, ruling of 2026-09-30). So .github/workflows/preview-marker.yml runs
// this on `check_run` `completed`, with `GITHUB_TOKEN` alone: it calls GitHub
// and the three preview hosts, and never Cloudflare's API.
//
// The Preview's name comes from the pull request's branch through
// `PreviewName.ofBranch`, the one function the Preview command names it with,
// and each site answers one label below its preview-only domain
// (web/worker/shared/hosts.ts, `PREVIEW_DOMAIN`). A check run for any commit but an
// open pull request's current head changes nothing: the name always serves
// its latest deployment, so announcing an older commit would bind a newer
// tree's pixels to it.

import { PreviewName } from "./previewName.ts";

/** The GitHub App Workers Builds reports through; no other app's check run counts. */
export const WORKERS_BUILDS_APP = "cloudflare-workers-and-pages";
/** The check run Workers Builds reports a `lexema-web` build as. */
export const WORKERS_BUILDS_CHECK = "Workers Builds: lexema-web";
/** The sticky comment's own marker, beside its three per-site anchors. */
export const MARKER = "<!-- preview-deploy -->";
/** Who writes a comment with `GITHUB_TOKEN`; a marker in anyone else's comment is not ours. */
export const ACTIONS_BOT = "github-actions[bot]";

/** A full commit SHA, as GitHub sends one. */
export const SHA = /^[0-9a-f]{40}$/;

/**
 * One preview site as Fabrika names it, the domain it answers one label below
 * (the same three as `PREVIEW_DOMAIN` in web/worker/shared/hosts.ts, which a test
 * holds this to), and the status its root answers once the Preview is up.
 *
 * Every response on the preview stage carries `X-Robots-Tag: noindex`
 * (web/worker/shared/stage.ts), and Cloudflare's own answer for a name with no
 * Preview does not, so that header is what says the Worker answered. The API
 * has no endpoint at `/` and answers it with its own JSON 404; the dictionary
 * and the developer site answer `/` with their home pages.
 */
export const PREVIEW_SITES = [
  { app: "web", domain: "preview.lexema.fyi", readyStatus: 200 },
  { app: "developers", domain: "developers-preview.lexema.fyi", readyStatus: 200 },
  { app: "api", domain: "api-preview.lexema.fyi", readyStatus: 404 },
] as const;

export type PreviewSite = (typeof PREVIEW_SITES)[number];

// --- The check run ------------------------------------------------------------

/** What one `check_run` event says: a built commit to announce, or why it says nothing. */
export type PreviewBuild =
  | { readonly kind: "built"; readonly sha: string; readonly pullRequests: readonly number[] }
  | { readonly kind: "ignored"; readonly reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * Read a `check_run` webhook payload (`$GITHUB_EVENT_PATH` on `on: check_run`).
 * Only a completed, successful `Workers Builds: lexema-web` run from the
 * Cloudflare app is a build; any other app can name a check run the same. The
 * pull requests it lists are hints only: GitHub leaves the list empty for
 * some events and keeps listing a pull request after its head moves on.
 */
export function readPreviewBuild(event: unknown): PreviewBuild {
  const run = isRecord(event) ? event.check_run : undefined;
  if (!isRecord(run)) return { kind: "ignored", reason: "the event carries no check_run" };
  const app = isRecord(run.app) ? run.app.slug : undefined;
  if (app !== WORKERS_BUILDS_APP) return { kind: "ignored", reason: `the check run is from ${String(app)}, not ${WORKERS_BUILDS_APP}` };
  if (run.name !== WORKERS_BUILDS_CHECK) return { kind: "ignored", reason: `the check run is ${JSON.stringify(run.name)}, not ${WORKERS_BUILDS_CHECK}` };
  if (run.status !== "completed" || run.conclusion !== "success") {
    return { kind: "ignored", reason: `the build is ${String(run.status)}/${String(run.conclusion)}, not completed/success` };
  }
  if (typeof run.head_sha !== "string" || !SHA.test(run.head_sha)) return { kind: "ignored", reason: "the check run names no commit" };
  const pullRequests = (Array.isArray(run.pull_requests) ? run.pull_requests : [])
    .map((pull) => (isRecord(pull) ? pull.number : undefined))
    .filter((number): number is number => Number.isSafeInteger(number));
  return { kind: "built", sha: run.head_sha, pullRequests };
}

// --- The announcement ---------------------------------------------------------

/** One site's Preview URL. */
export interface AnnouncedSite {
  readonly site: PreviewSite;
  readonly url: string;
}

/**
 * The comment that announces one branch's Preview at one commit. It is made
 * only from a branch and a full SHA, so every block names a URL and a head.
 */
export class PreviewAnnouncement {
  readonly preview: PreviewName;
  readonly sha: string;

  private constructor(preview: PreviewName, sha: string) {
    if (!SHA.test(sha)) throw new Error(`not a commit SHA: ${JSON.stringify(sha)}`);
    this.preview = preview;
    this.sha = sha;
  }

  /** The announcement of `branch`'s Preview, built at `sha`. */
  static of(branch: string, sha: string): PreviewAnnouncement {
    return new PreviewAnnouncement(PreviewName.ofBranch(branch), sha);
  }

  /** Each site's Preview URL, `https://<name>.<domain>/`. */
  get sites(): readonly AnnouncedSite[] {
    return PREVIEW_SITES.map((site) => ({ site, url: `https://${this.preview.value}.${site.domain}/` }));
  }

  /**
   * The comment body. Each site has its own block, from its
   * `<!-- preview-deploy:<app> -->` anchor to the next one, holding its URL
   * and `@ <sha>`, which is how `readPreviewAnnouncement` bounds and reads it.
   */
  get body(): string {
    const blocks = this.sites.map(({ site, url }) => `<!-- preview-deploy:${site.app} -->\n- **${site.app}**: ${url} @ ${this.sha}`);
    return [MARKER, `Preview \`${this.preview.value}\`, built by Workers Builds.`, "", ...blocks, ""].join("\n");
  }
}

// --- Announcing ---------------------------------------------------------------

/** The part of a pull request this reads. */
export interface PullRequest {
  readonly number: number;
  readonly state: string;
  readonly headSha: string;
  readonly headRef: string;
  /** `owner/name` of the head's repository, or none when a fork was deleted. */
  readonly headRepository: string | undefined;
}

/** The part of a comment this reads. */
export interface IssueComment {
  readonly id: number;
  readonly author: string;
  readonly body: string;
}

/** The GitHub calls the marker makes, as the workflow's `GITHUB_TOKEN`. */
export interface GitHub {
  readonly repository: string;
  pullRequest(number: number): Promise<PullRequest>;
  /** The open pull requests GitHub associates with a commit. */
  pullRequestsOf(sha: string): Promise<readonly number[]>;
  comments(pullRequest: number): Promise<readonly IssueComment[]>;
  createComment(pullRequest: number, body: string): Promise<void>;
  updateComment(id: number, body: string): Promise<void>;
}

/** What one request to a preview URL answered. */
export interface Answer {
  readonly status: number;
  readonly robotsTag: string | undefined;
}

export interface MarkerSteps {
  /** The `check_run` webhook payload. */
  readonly event: unknown;
  readonly github: GitHub;
  /** One GET of `url`, or a throw when nothing answered. */
  probe(url: string): Promise<Answer>;
  /** How often to ask each site before giving up, and how long to wait between. */
  readonly attempts: number;
  wait(): Promise<void>;
  log(line: string): void;
}

/** What one run did for each pull request it looked at. */
export type MarkerOutcome =
  | { readonly kind: "ignored"; readonly reason: string }
  | { readonly kind: "stale"; readonly sha: string }
  | {
      readonly kind: "announced";
      readonly sha: string;
      readonly pullRequests: readonly { readonly number: number; readonly comment: "created" | "updated" | "unchanged" }[];
    };

/** Whether an `X-Robots-Tag` value says `noindex`, as every preview-stage response's does (web/worker/shared/stage.ts). */
export function hasNoindex(robotsTag: string | undefined): boolean {
  return (robotsTag ?? "").split(",").some((value) => value.trim().toLowerCase() === "noindex");
}

/** Whether `site` answered as its Preview does. */
export function isReady(site: PreviewSite, answer: Answer): boolean {
  return hasNoindex(answer.robotsTag) && answer.status === site.readyStatus;
}

/** An open pull request of this repository whose head is `sha` now. */
export function isHead(pull: PullRequest, sha: string, repository: string): boolean {
  return pull.state === "open" && pull.headSha === sha && pull.headRepository === repository;
}

/** Ask every site until it answers as its Preview; throw naming the ones that never did. */
async function awaitSites(announcement: PreviewAnnouncement, steps: MarkerSteps): Promise<void> {
  let waiting = announcement.sites;
  for (let attempt = 1; attempt <= steps.attempts; attempt++) {
    const still: AnnouncedSite[] = [];
    for (const announced of waiting) {
      let ready = false;
      let said: string;
      try {
        const answer = await steps.probe(announced.url);
        ready = isReady(announced.site, answer);
        said = `${answer.status}, x-robots-tag ${answer.robotsTag ?? "none"}`;
      } catch (error) {
        said = error instanceof Error ? error.message : String(error);
      }
      steps.log(`${announced.url}: ${said}${ready ? "" : " (not ready)"}`);
      if (!ready) still.push(announced);
    }
    waiting = still;
    if (waiting.length === 0) return;
    if (attempt < steps.attempts) await steps.wait();
  }
  throw new Error(`the Preview never answered at ${waiting.map(({ url }) => url).join(", ")}`);
}

/** Keep one comment on `pull` carrying `body`: this bot's marked comment, edited, or a new one. */
async function upsert(github: GitHub, pull: number, body: string): Promise<"created" | "updated" | "unchanged"> {
  const ours = (await github.comments(pull)).find((comment) => comment.author === ACTIONS_BOT && comment.body.includes(MARKER));
  if (ours === undefined) {
    await github.createComment(pull, body);
    return "created";
  }
  if (ours.body === body) return "unchanged";
  await github.updateComment(ours.id, body);
  return "updated";
}

/**
 * Announce the Preview a `check_run` event reports, on every open pull request
 * whose head it is. Nothing is written for any other event, for a commit no
 * open pull request has at its head, or when a site never answers.
 */
export async function announcePreview(steps: MarkerSteps): Promise<MarkerOutcome> {
  const { github, log } = steps;
  const build = readPreviewBuild(steps.event);
  if (build.kind === "ignored") {
    log(`nothing to announce: ${build.reason}`);
    return build;
  }

  const candidates = new Set(build.pullRequests);
  for (const number of await github.pullRequestsOf(build.sha)) candidates.add(number);
  const heads: PullRequest[] = [];
  for (const number of [...candidates].sort((a, b) => a - b)) {
    const pull = await github.pullRequest(number);
    if (isHead(pull, build.sha, github.repository)) heads.push(pull);
  }
  if (heads.length === 0) {
    log(`nothing to announce: no open pull request of ${github.repository} has ${build.sha} at its head`);
    return { kind: "stale", sha: build.sha };
  }

  const announced: { number: number; comment: "created" | "updated" | "unchanged" }[] = [];
  for (const pull of heads) {
    const announcement = PreviewAnnouncement.of(pull.headRef, build.sha);
    log(`PR #${pull.number}: Preview ${announcement.preview} for ${pull.headRef} @ ${build.sha}`);
    await awaitSites(announcement, steps);
    // The sites can take minutes; a push in the meantime makes this commit stale.
    if (!isHead(await github.pullRequest(pull.number), build.sha, github.repository)) {
      log(`PR #${pull.number}: its head moved past ${build.sha} while the sites came up; nothing written`);
      continue;
    }
    const comment = await upsert(github, pull.number, announcement.body);
    log(`PR #${pull.number}: preview comment ${comment}`);
    announced.push({ number: pull.number, comment });
  }
  return announced.length === 0 ? { kind: "stale", sha: build.sha } : { kind: "announced", sha: build.sha, pullRequests: announced };
}

// --- What the smoke job reads -----------------------------------------------------

/**
 * The commit a run announced and the pull requests it announced it on. The
 * workflow's announce job writes it as its `announced` output, and the smoke
 * job (web/builds/previewSmokeCommand.ts) reads it back.
 */
export interface AnnouncedHead {
  readonly sha: string;
  readonly pullRequests: readonly number[];
}

/** The `announced` output for an outcome, or none when nothing was announced. */
export function announcedOutput(outcome: MarkerOutcome): string | undefined {
  if (outcome.kind !== "announced") return undefined;
  const head: AnnouncedHead = { sha: outcome.sha, pullRequests: outcome.pullRequests.map(({ number }) => number) };
  return JSON.stringify(head);
}

/** Read the `announced` output back; anything but what `announcedOutput` writes is refused. */
export function readAnnouncedOutput(text: string): AnnouncedHead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`the announce job's output is not JSON: ${JSON.stringify(text)}`);
  }
  if (!isRecord(parsed) || typeof parsed.sha !== "string" || !SHA.test(parsed.sha) || !Array.isArray(parsed.pullRequests)) {
    throw new Error(`the announce job's output names no commit and pull requests: ${JSON.stringify(text)}`);
  }
  const pullRequests = parsed.pullRequests.filter((number): number is number => Number.isSafeInteger(number) && number > 0);
  if (pullRequests.length === 0 || pullRequests.length !== parsed.pullRequests.length) {
    throw new Error(`the announce job's output names no pull request: ${JSON.stringify(text)}`);
  }
  return { sha: parsed.sha, pullRequests };
}

// --- GitHub's REST API ----------------------------------------------------------

/** GitHub's largest page (https://docs.github.com/en/rest/issues/comments#list-issue-comments). */
const PAGE_SIZE = 100;
/** More comments than this on one pull request is not something to page through blind. */
const MAX_PAGES = 20;

/** One REST call on a repository's endpoints: the parsed JSON, or a throw naming the status. */
export type RestCall = (method: string, path: string, body?: unknown) => Promise<unknown>;

/** REST calls with `token` under `https://api.github.com/repos/<repository>`. */
export function restCall(token: string, repository: string, fetchUrl: typeof fetch): RestCall {
  if (token.trim() === "") throw new Error("GITHUB_TOKEN is not set");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error(`not a repository: ${JSON.stringify(repository)}`);
  const base = `https://api.github.com/repos/${repository}`;

  return async (method, path, body) => {
    const response = await fetchUrl(`${base}${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} answered ${response.status}`);
    return response.json();
  };
}

/** The `GitHub` calls over REST with `token`, for `repository` (`owner/name`). */
export function restGitHub(token: string, repository: string, fetchUrl: typeof fetch): GitHub {
  const call = restCall(token, repository, fetchUrl);

  return {
    repository,
    async pullRequest(number) {
      const pull = await call("GET", `/pulls/${number}`);
      if (!isRecord(pull) || !isRecord(pull.head)) throw new Error(`GitHub sent no pull request #${number}`);
      const { head } = pull;
      if (typeof pull.state !== "string" || typeof head.sha !== "string" || typeof head.ref !== "string") {
        throw new Error(`pull request #${number} is not in the shape GitHub documents`);
      }
      const headRepository = isRecord(head.repo) && typeof head.repo.full_name === "string" ? head.repo.full_name : undefined;
      return { number, state: pull.state, headSha: head.sha, headRef: head.ref, headRepository };
    },
    async pullRequestsOf(sha) {
      const pulls = await call("GET", `/commits/${sha}/pulls`);
      if (!Array.isArray(pulls)) throw new Error(`GitHub sent no pull request list for ${sha}`);
      return pulls.filter((pull) => isRecord(pull) && pull.state === "open" && Number.isSafeInteger(pull.number)).map((pull) => pull.number as number);
    },
    async comments(pullRequest) {
      const comments: IssueComment[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const listed = await call("GET", `/issues/${pullRequest}/comments?per_page=${PAGE_SIZE}&page=${page}`);
        if (!Array.isArray(listed)) throw new Error(`GitHub sent no comment list for #${pullRequest}`);
        for (const comment of listed) {
          if (!isRecord(comment) || !Number.isSafeInteger(comment.id) || typeof comment.body !== "string") continue;
          const author = isRecord(comment.user) && typeof comment.user.login === "string" ? comment.user.login : "";
          comments.push({ id: comment.id as number, author, body: comment.body });
        }
        if (listed.length < PAGE_SIZE) return comments;
      }
      throw new Error(`#${pullRequest} has more than ${PAGE_SIZE * MAX_PAGES} comments; refusing to guess which is ours`);
    },
    async createComment(pullRequest, body) {
      await call("POST", `/issues/${pullRequest}/comments`, { body });
    },
    async updateComment(id, body) {
      await call("PATCH", `/issues/comments/${id}`, { body });
    },
  };
}
