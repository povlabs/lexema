// The monthly release workflow's two steps (#457), run by
// `.github/workflows/dictionary-release.yml` around the dictionary deploy's
// plan-only entry, which it calls between them.
//
// `prepareRelease`:
// 1. Read kaikki's Italian build log and the dump it names. Unless that dump is
//    later than every `ARCHIVE_FACTS` entry's, stop: nothing is written.
// 2. Download the archive. Its release id names the branch the pull request
//    comes from; when that branch exists, a pull request was opened for the
//    release already, and nothing is written.
// 3. Read the build log again, and stop if it names another dump: kaikki
//    rebuilt meanwhile, so the archive's dump is not known.
// 4. Read the dump's size and SHA-1 from Wikimedia, download it and check it.
// 5. Store the archive, the build log, the download's headers and the dump in
//    `hueypov/lexema-data`.
// 6. Add the release's `ARCHIVE_FACTS` and `KNOWN_DUMPS` entries on a new
//    branch `release/<release id>` and push it.
//
// `openReleasePullRequest`, given the plan-only run's answer: add the change
// declaration with those counts to the branch and open the pull request.
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
    return { kind: "none", reason: `${releaseId} is new, but the branch ${branch} exists, so its pull request was opened already` };
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

/** Add the declaration with the plan-only counts to the release branch and open the pull request. Returns its URL. */
export async function openReleasePullRequest(candidate: ReleaseCandidate, planAnswer: string, deps: OpenDeps): Promise<string> {
  const declared = declarationFor(candidate, planAnswer);
  const branch = releaseBranch(candidate.releaseId);
  await mkdir(join(deps.root, DECLARATIONS_DIR), { recursive: true });
  await writeFile(join(deps.root, declared.path), declared.text);
  deps.git.run(["add", "--", declared.path]);
  deps.git.run([...RELEASE_COMMITTER, "commit", "--quiet", "-m", `feat(update): declare the update:auto of kaikki release ${candidate.releaseId}`]);
  deps.git.run(["push", "--quiet", "origin", `HEAD:refs/heads/${branch}`]);

  const response = await deps.fetch(`https://api.github.com/repos/${deps.repository}/pulls`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${deps.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
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
