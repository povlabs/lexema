// The monthly release workflow's two steps (#457), run by
// `.github/workflows/dictionary-release.yml` around the dictionary deploy's
// plan-only entry, which it calls between them.
//
// `prepareRelease`:
// 1. Read kaikki's Italian build log and the dump it names. Unless that dump is
//    later than every `ARCHIVE_FACTS` entry's, stop: nothing is written.
// 2. Download the archive. Its release id names the branch the pull request
//    comes from. When that branch exists and a pull request was opened from
//    it, nothing is written. When it exists with no pull request, an earlier
//    run stopped red after pushing it, and this run stops red too, naming it.
// 3. Read the build log again, and stop if it names another dump: kaikki
//    rebuilt meanwhile, so the archive's dump is not known.
// 4. Read the dump's size and SHA-1 from Wikimedia, download it and check it.
// 5. Store the archive, the build log, the download's headers and the dump in
//    `hueypov/lexema-data`.
// 6. Add the release's `ARCHIVE_FACTS` and `KNOWN_DUMPS` entries on a new
//    branch `release/<release id>` and push it.
//
// `openReleasePullRequest`, given the plan-only run's answer: add the change
// declaration with those counts to the branch and open the pull request. A
// re-run of a failed try replaces the declaration that try pushed.
//
// Neither step holds the Cloudflare token: the plan-only run does, in the
// dictionary deploy workflow's own job.

import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { sha256Of } from "../deploy/dataFiles.js";
import type { Git } from "../deploy/pending.js";
import { ARCHIVE_FACTS, type ArchiveFactsCatalog } from "../source/archiveFacts.js";
import { KNOWN_DUMPS, VerifiedDump } from "../source/wiktionaryDump.js";
import { DECLARATIONS_DIR, parseDeclaration, type ChangeDeclaration, type ReleaseId } from "../update/declaration.js";
import { type StoredFile, type StoreOutcome, RELEASE_COMMITTER } from "./dataStore.js";
import {
  checkRelease,
  dumpOfBuildLog,
  identityOfDumpStatus,
  KAIKKI_ARCHIVE_URL,
  KAIKKI_BUILD_LOG_URL,
  type KnownDump,
  ReleaseCandidate,
  ReleaseRefused,
  wikimediaDump,
  withArchiveFacts,
  withKnownDump,
} from "./releaseCandidate.js";

/** The two files a release's facts are added to, from the repository root. */
export const ARCHIVE_FACTS_FILE = "src/source/archiveFacts.ts";
export const KNOWN_DUMPS_FILE = "src/source/wiktionaryDump.ts";

/** The branch a release's pull request comes from, and the branch it goes to. */
export const releaseBranch = (releaseId: ReleaseId): string => `release/${releaseId}`;
export const BASE_BRANCH = "main";

/** The change a release's plan-only run and declaration are of: an `update:auto` of the release. */
export const releaseChange = (candidate: ReleaseCandidate): { command: "update:auto"; inputs: { feedRelease: ReleaseId } } => ({
  command: "update:auto",
  inputs: { feedRelease: candidate.releaseId },
});

/**
 * Why a release branch with no pull request stops the run: an earlier run
 * stored the release and pushed its branch, then stopped red before the pull
 * request opened. Re-running that run's failed jobs reuses what it stored; a
 * fresh run would download the archive again, and its headers would not match
 * the stored ones.
 */
export const strandedBranch = (branch: string): string =>
  `the branch ${branch} exists, but no pull request was ever opened from it: the run that pushed it stopped red after its prepare job. Open that run and select "Re-run failed jobs"; docs/DEPLOY.md, "When a run stops after prepare", says what to do when it cannot be re-run`;

/** The headers every GitHub API call here sends. */
const githubHeaders = (token: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
});

/** The URL of a pull request ever opened from `branch` in `repository` (`owner/name`), open or closed, or `undefined`. */
export async function pullRequestFrom(fetchImpl: typeof fetch, repository: string, token: string, branch: string): Promise<string | undefined> {
  const [owner] = repository.split("/");
  const url = `https://api.github.com/repos/${repository}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=all&per_page=1`;
  const response = await fetchImpl(url, { headers: githubHeaders(token) });
  const answer = (await response.json().catch(() => undefined)) as unknown;
  if (response.status !== 200 || !Array.isArray(answer)) throw new ReleaseRefused([`GitHub answered ${response.status} to listing the pull requests from ${branch}`]);
  const [first] = answer as { html_url?: unknown }[];
  if (first === undefined) return undefined;
  if (typeof first.html_url !== "string") throw new ReleaseRefused([`GitHub listed a pull request from ${branch} with no URL`]);
  return first.html_url;
}

/** What `prepareRelease` reads, writes and is told through. */
export interface PrepareDeps {
  readonly fetch: typeof fetch;
  /** Git in the repository's checkout, whose `origin` the branch is pushed to. */
  readonly git: Git;
  /** The checkout's root, where the facts files are edited. */
  readonly root: string;
  /** Where downloads go. */
  readonly workDir: string;
  /** Store files in `hueypov/lexema-data` as one commit. */
  readonly store: (files: readonly StoredFile[], message: string) => Promise<StoreOutcome>;
  /** The URL of a pull request ever opened from `branch`, open or closed, or `undefined` when none was. */
  readonly pullRequestFrom: (branch: string) => Promise<string | undefined>;
  readonly now?: () => Date;
  readonly catalog?: ArchiveFactsCatalog;
  readonly dumps?: Readonly<Record<string, KnownDump>>;
  readonly onStep?: (line: string) => void;
}

/** How `prepareRelease` ended: nothing new, or a branch with the release's facts and its files stored. */
export type PrepareOutcome =
  | { readonly kind: "none"; readonly reason: string }
  | { readonly kind: "prepared"; readonly candidate: ReleaseCandidate; readonly branch: string; readonly commit: string; readonly stored: StoreOutcome };

async function ok(fetchImpl: typeof fetch, url: string): Promise<Response> {
  const response = await fetchImpl(url);
  if (!response.ok || response.body === null) throw new ReleaseRefused([`${url} answered ${response.status}`]);
  return response;
}

async function download(fetchImpl: typeof fetch, url: string, to: string): Promise<Response> {
  const response = await ok(fetchImpl, url);
  await mkdir(dirname(to), { recursive: true });
  await pipeline(Readable.fromWeb(response.body as WebReadableStream<Uint8Array>), createWriteStream(to));
  return response;
}

/** A response's status line and headers, as `curl -D` keeps them. */
const headersText = (url: string, response: Response): string =>
  [`GET ${url}`, `HTTP ${response.status}`, ...[...response.headers].map(([name, value]) => `${name}: ${value}`), ""].join("\n");

/** The time, ISO-8601 UTC to the second. */
const toSecond = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Find a new kaikki Italian release and, when there is one, store its files and push its facts on a new branch. */
export async function prepareRelease(deps: PrepareDeps): Promise<PrepareOutcome> {
  const step = deps.onStep ?? (() => {});
  const catalog = deps.catalog ?? ARCHIVE_FACTS;
  const dumps = deps.dumps ?? KNOWN_DUMPS;

  step(`read ${KAIKKI_BUILD_LOG_URL}`);
  const dump = dumpOfBuildLog(await (await ok(deps.fetch, KAIKKI_BUILD_LOG_URL)).text());
  const check = checkRelease(dump, catalog);
  if (check.kind === "not-new") {
    return { kind: "none", reason: `kaikki's Italian build is from ${dump}, and the latest release recorded is from ${check.latest}, so there is no new release` };
  }

  step(`download ${KAIKKI_ARCHIVE_URL}`);
  const archive = join(deps.workDir, "it-extract.jsonl.gz");
  const archiveResponse = await download(deps.fetch, KAIKKI_ARCHIVE_URL, archive);
  const retrievedAt = toSecond((deps.now ?? (() => new Date()))());
  const archiveSha256 = await sha256Of(archive);
  const releaseId: ReleaseId = `it-${archiveSha256.slice(0, 8)}`;
  const branch = releaseBranch(releaseId);
  if (deps.git.run(["ls-remote", "--heads", "origin", `refs/heads/${branch}`]).trim() !== "") {
    const opened = await deps.pullRequestFrom(branch);
    if (opened === undefined) throw new ReleaseRefused([strandedBranch(branch)]);
    return { kind: "none", reason: `${releaseId} is new, but its pull request ${opened} was opened already from ${branch}` };
  }

  const log = await (await ok(deps.fetch, KAIKKI_BUILD_LOG_URL)).text();
  const again = dumpOfBuildLog(log);
  if (again !== dump) throw new ReleaseRefused([`kaikki's build log named ${dump}, then ${again}: it rebuilt while the archive was read, so the archive's dump is not known`]);

  const wikimedia = wikimediaDump(dump);
  step(`read ${wikimedia.statusUrl}`);
  const identity = identityOfDumpStatus(await (await ok(deps.fetch, wikimedia.statusUrl)).json(), dump);
  const candidate = ReleaseCandidate.of({ archiveSha256, retrievedAt, dump: { id: dump, ...identity } });
  candidate.catalogs(catalog, dumps);

  step(`download ${wikimedia.url}`);
  const dumpFile = join(deps.workDir, wikimedia.file);
  await download(deps.fetch, wikimedia.url, dumpFile);
  await (await VerifiedDump.open(dumpFile, identity)).close();

  const logFile = join(deps.workDir, `${releaseId}.log`);
  const headersFile = join(deps.workDir, `${releaseId}.headers`);
  await writeFile(logFile, log);
  await writeFile(headersFile, headersText(KAIKKI_ARCHIVE_URL, archiveResponse));
  const { paths } = candidate;
  step(`store ${Object.values(paths).join(", ")} in hueypov/lexema-data`);
  const stored = await deps.store(
    [
      { path: paths.archive, from: archive },
      { path: paths.buildLog, from: logFile },
      { path: paths.headers, from: headersFile },
      { path: paths.dump, from: dumpFile },
    ],
    `Add kaikki Italian release ${releaseId} and its dump ${dump}`,
  );

  step(`add the facts of ${releaseId} on ${branch}`);
  const factsPath = join(deps.root, ARCHIVE_FACTS_FILE);
  const dumpsPath = join(deps.root, KNOWN_DUMPS_FILE);
  await writeFile(factsPath, withArchiveFacts(await readFile(factsPath, "utf8"), candidate));
  await writeFile(dumpsPath, withKnownDump(await readFile(dumpsPath, "utf8"), candidate));
  deps.git.run(["switch", "--quiet", "-c", branch]);
  deps.git.run(["add", "--", ARCHIVE_FACTS_FILE, KNOWN_DUMPS_FILE]);
  deps.git.run([...RELEASE_COMMITTER, "commit", "--quiet", "-m", `feat(update): record kaikki Italian release ${releaseId} from ${dump}`]);
  deps.git.run(["push", "--quiet", "origin", `HEAD:refs/heads/${branch}`]);
  return { kind: "prepared", candidate, branch, commit: deps.git.run(["rev-parse", "HEAD"]).trim(), stored };
}

/** The plan-only run's answer, as the dictionary deploy workflow's `counts` output gives it, held as a declaration. */
export function declarationFor(candidate: ReleaseCandidate, planAnswer: string): { path: string; text: string; declaration: ChangeDeclaration; dictionaryRecords: number } {
  const path = `${DECLARATIONS_DIR}/${candidate.releaseId}.json`;
  let answer: { command?: unknown; counts?: unknown; dictionaryRecords?: unknown };
  try {
    answer = JSON.parse(planAnswer) as typeof answer;
  } catch (error: unknown) {
    throw new ReleaseRefused([`the plan-only answer is not JSON (${error instanceof Error ? error.message : String(error)})`]);
  }
  if (answer?.command !== "update:auto") throw new ReleaseRefused([`the plan-only answer is of ${JSON.stringify(answer?.command)}, not update:auto`]);
  const { dictionaryRecords } = answer;
  if (typeof dictionaryRecords !== "number" || !Number.isSafeInteger(dictionaryRecords) || dictionaryRecords < 0) {
    throw new ReleaseRefused(["the plan-only answer gives no dictionaryRecords"]);
  }
  const text = `${JSON.stringify({ ...releaseChange(candidate), expected: answer.counts }, null, 2)}\n`;
  return { path, text, declaration: parseDeclaration(path, text), dictionaryRecords };
}

const rowsTable = (declaration: ChangeDeclaration): string[] => {
  const { written, deleted } = declaration.expected;
  const tables = [...new Set([...Object.keys(written), ...Object.keys(deleted)])] as (keyof typeof written)[];
  if (tables.length === 0) return ["It writes and deletes no row."];
  return ["| Table | Rows written | Rows deleted |", "|---|---:|---:|", ...tables.map((table) => `| \`${table}\` | ${written[table] ?? 0} | ${deleted[table] ?? 0} |`)];
};

/** The release pull request's body: what it adds, and the counts the dictionary deploy will hold the release to. */
export function releasePullRequestBody(candidate: ReleaseCandidate, declared: ReturnType<typeof declarationFor>): string {
  const { declaration, dictionaryRecords } = declared;
  const { records } = declaration.expected;
  const breaches = declaration.expected.limitBreaches(dictionaryRecords);
  const { paths } = candidate;
  return [
    `kaikki.org published a new Italian build, release \`${candidate.releaseId}\`, from the Wiktionary dump \`${candidate.dumpId}\`. The monthly release workflow found it and opened this pull request.`,
    "",
    "It adds:",
    "",
    `- the release's \`ARCHIVE_FACTS\` entry in \`${ARCHIVE_FACTS_FILE}\` and its dump's \`KNOWN_DUMPS\` entry in \`${KNOWN_DUMPS_FILE}\`;`,
    `- the change declaration \`${declared.path}\`, an \`update:auto\` of \`${candidate.releaseId}\`.`,
    "",
    `The archive is stored in \`hueypov/lexema-data\` at \`${paths.archive}\`, with kaikki's build log at \`${paths.buildLog}\` and the download's headers at \`${paths.headers}\`. The dump is at \`${paths.dump}\`. Archive SHA-256 \`${candidate.archiveSha256}\`, downloaded ${candidate.retrievedAt}; dump ${candidate.dumpIdentity.bytes} bytes, SHA-1 \`${candidate.dumpIdentity.sha1}\`, as Wikimedia lists it.`,
    "",
    "## Expected counts",
    "",
    `From the dictionary deploy's plan-only run against the shared dictionary, which holds ${dictionaryRecords} records:`,
    "",
    "| Records added | Records changed | Records removed |",
    "|---:|---:|---:|",
    `| ${records.added} | ${records.changed} | ${records.removed} |`,
    "",
    ...rowsTable(declaration),
    "",
    ...(breaches.length === 0
      ? ["The plan crosses no hard limit."]
      : ["**The plan crosses a hard limit, so the dictionary deploy will stop red, writing nothing, if this merges:**", "", ...breaches.map((breach) => `- it ${breach}`)]),
    "",
    "Merging this pull request deploys the release through the dictionary deploy, which plans it again and stops if the counts differ. Closing it skips the release: its branch stays, so no later monthly run opens it again.",
    "",
  ].join("\n");
}

/** What `openReleasePullRequest` writes through. */
export interface OpenDeps {
  readonly fetch: typeof fetch;
  /** Git in the checkout of the release branch's commit. */
  readonly git: Git;
  readonly root: string;
  /** `owner/name` of this repository, and a token that may open its pull requests. */
  readonly repository: string;
  readonly token: string;
}

/**
 * The release branch's head when an earlier try of the same run already pushed
 * a declaration onto `facts`, the commit `prepare` pushed, and then failed to
 * open the pull request. That head is replaced, since a re-run plan may count
 * differently. `undefined` when the branch is still at `facts`. Anything else
 * on the branch is refused: it is not this run's.
 */
function earlierDeclaration(git: Git, branch: string, facts: string, path: string): string | undefined {
  let head = git.run(["ls-remote", "origin", `refs/heads/${branch}`]).split("\t")[0]?.trim() ?? "";
  if (head === facts) return undefined;
  if (head !== "") {
    git.run(["fetch", "--quiet", "origin", `refs/heads/${branch}`]);
    head = git.run(["rev-parse", "FETCH_HEAD"]).trim();
    const parent = git.run(["rev-parse", `${head}^`]).trim();
    const changed = git.run(["diff", "--name-only", facts, head]).trim();
    if (parent === facts && changed === path) return head;
  }
  throw new ReleaseRefused([`${branch} is at ${head === "" ? "no commit" : head}, not at ${facts} or one declaration on it, so this run does not own it`]);
}

/** Add the declaration with the plan-only counts to the release branch and open the pull request. Returns its URL. */
export async function openReleasePullRequest(candidate: ReleaseCandidate, planAnswer: string, deps: OpenDeps): Promise<string> {
  const declared = declarationFor(candidate, planAnswer);
  const branch = releaseBranch(candidate.releaseId);
  await mkdir(join(deps.root, DECLARATIONS_DIR), { recursive: true });
  await writeFile(join(deps.root, declared.path), declared.text);
  const facts = deps.git.run(["rev-parse", "HEAD"]).trim();
  const lease = earlierDeclaration(deps.git, branch, facts, declared.path);
  deps.git.run(["add", "--", declared.path]);
  deps.git.run([...RELEASE_COMMITTER, "commit", "--quiet", "-m", `feat(update): declare the update:auto of kaikki release ${candidate.releaseId}`]);
  deps.git.run(["push", "--quiet", ...(lease === undefined ? [] : [`--force-with-lease=refs/heads/${branch}:${lease}`]), "origin", `HEAD:refs/heads/${branch}`]);

  const response = await deps.fetch(`https://api.github.com/repos/${deps.repository}/pulls`, {
    method: "POST",
    headers: githubHeaders(deps.token),
    body: JSON.stringify({
      title: `feat(update): kaikki Italian release ${candidate.releaseId} from ${candidate.dumpId}`,
      head: branch,
      base: BASE_BRANCH,
      body: releasePullRequestBody(candidate, declared),
    }),
  });
  const answer = (await response.json().catch(() => ({}))) as { html_url?: unknown; message?: unknown };
  if (response.status !== 201 || typeof answer.html_url !== "string") {
    throw new ReleaseRefused([`GitHub answered ${response.status} to opening the pull request from ${branch}: ${String(answer.message ?? "no message")}`]);
  }
  return answer.html_url;
}
