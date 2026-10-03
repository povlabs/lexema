// The monthly release workflow (#457), end to end against local Git remotes
// standing in for this repository and `hueypov/lexema-data`, and a fetch that
// answers as kaikki, Wikimedia and GitHub's pull request API do. No network,
// no credential.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { main as deployMain } from "../src/deploy/deployCli.js";
import { gitIn } from "../src/deploy/pending.js";
import { LANGUAGES } from "../src/deploy/writePlan.js";
import { storeFiles, StoreRefused } from "../src/release/dataStore.js";
import { declarationFor, openReleasePullRequest, prepareRelease, releasePullRequestBody, type PrepareDeps } from "../src/release/monthlyRelease.js";
import { main as releaseMain } from "../src/release/releaseCli.js";
import {
  checkRelease,
  dumpOfBuildLog,
  identityOfDumpStatus,
  KAIKKI_ARCHIVE_URL,
  KAIKKI_BUILD_LOG_URL,
  ReleaseCandidate,
  ReleaseRefused,
  withArchiveFacts,
  withKnownDump,
} from "../src/release/releaseCandidate.js";
import { ARCHIVE_FACTS } from "../src/source/archiveFacts.js";
import { KNOWN_DUMPS } from "../src/source/wiktionaryDump.js";
import { parseDeclaration } from "../src/update/declaration.js";
import type { FeedArchive } from "../src/update/feed.js";
import { withFeedDump } from "../src/update/select.js";

const ARCHIVE_FACTS_TEXT = await readFile(resolve("src/source/archiveFacts.ts"), "utf8");
const KNOWN_DUMPS_TEXT = await readFile(resolve("src/source/wiktionaryDump.ts"), "utf8");

/** A kaikki build log's lines around the one that names the dump, as the real log writes them. */
const buildLog = (dump: string): string =>
  [
    "MINOR it WIKTWORDS STARTED: Sun Oct 27 05:20:00 AM EEST 2026",
    "2026-10-27 05:20:00,811 INFO: skip_extract_dump: False, save_pages_path: None",
    `2026-10-27 05:20:00,811 INFO: dump file path: /home/ubuntu/temp-wiktionary/editions/it/data/${dump}-pages-articles.xml.bz2`,
    "2026-10-27 05:20:01,725 INFO:   ... 10000 raw pages collected",
    "",
  ].join("\n");

/** Wikimedia's `dumpstatus.json` for a dump, its articles job in `status`. */
const dumpStatus = (dump: string, bytes: Buffer, status = "done") => ({
  version: "0.8",
  jobs: {
    articlesdump: {
      status,
      files: {
        [`${dump}-pages-articles.xml.bz2`]: {
          size: bytes.length,
          url: `/itwiktionary/${dump.slice(-8)}/${dump}-pages-articles.xml.bz2`,
          sha1: createHash("sha1").update(bytes).digest("hex"),
        },
      },
    },
  },
});

const ARCHIVE = Buffer.from('{"word": "casa", "lang_code": "it"}\n');
const ARCHIVE_SHA256 = createHash("sha256").update(ARCHIVE).digest("hex");
const RELEASE_ID = `it-${ARCHIVE_SHA256.slice(0, 8)}`;
const DUMP = Buffer.from("<mediawiki></mediawiki>\n");
const NEW_DUMP = "itwiktionary-20261001";

const candidateOf = (sha256 = ARCHIVE_SHA256, dump = NEW_DUMP): ReleaseCandidate =>
  ReleaseCandidate.of({
    archiveSha256: sha256,
    retrievedAt: "2026-11-05T06:17:42Z",
    dump: { id: dump, bytes: DUMP.length, sha1: createHash("sha1").update(DUMP).digest("hex") },
  });

/** Git with a fixed author and no signing, so a commit never depends on the machine's config. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** What the fake network serves, and every URL it was asked for. */
interface Network {
  logs: string[];
  status: unknown;
  dump: Buffer;
  archive: Buffer;
  asked: string[];
  pulls: { url: string; body: Record<string, unknown> }[];
  pullStatus: number;
}

function fakeFetch(network: Network): typeof fetch {
  let logReads = 0;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    network.asked.push(url);
    if (url === KAIKKI_BUILD_LOG_URL) return new Response(network.logs[Math.min(logReads++, network.logs.length - 1)]);
    if (url === KAIKKI_ARCHIVE_URL) {
      return new Response(new Uint8Array(network.archive), { headers: { "last-modified": "Mon, 26 Oct 2026 15:24:26 GMT", etag: '"abc-123"' } });
    }
    if (url.endsWith("/dumpstatus.json")) return new Response(JSON.stringify(network.status));
    if (url.endsWith("-pages-articles.xml.bz2")) return new Response(new Uint8Array(network.dump));
    if (url.endsWith("/pulls")) {
      network.pulls.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return new Response(JSON.stringify({ html_url: "https://github.com/hueypov/lexema/pull/999" }), { status: network.pullStatus });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

interface World {
  readonly dir: string;
  /** This repository's checkout, and its `origin`. */
  readonly work: string;
  readonly origin: string;
  /** `hueypov/lexema-data`. */
  readonly data: string;
  readonly network: Network;
  deps(extra?: Partial<PrepareDeps>): PrepareDeps;
  /** The data repository's files, by path, at its default branch. */
  dataFiles(): string[];
  /** The branches `origin` holds. */
  branches(): string[];
}

async function withWorld(run: (world: World) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-release-"));
  try {
    const origin = join(dir, "origin.git");
    const work = join(dir, "work");
    const data = join(dir, "data.git");
    git(dir, "init", "--bare", "--initial-branch=main", origin);
    git(dir, "clone", "--quiet", origin, work);
    git(work, "checkout", "--quiet", "-B", "main");
    await mkdir(join(work, "src/source"), { recursive: true });
    await writeFile(join(work, "src/source/archiveFacts.ts"), ARCHIVE_FACTS_TEXT);
    await writeFile(join(work, "src/source/wiktionaryDump.ts"), KNOWN_DUMPS_TEXT);
    git(work, "add", "--all");
    git(work, "commit", "--quiet", "-m", "base");
    git(work, "push", "--quiet", "origin", "main");

    git(dir, "init", "--bare", "--initial-branch=main", data);
    const seed = join(dir, "data-seed");
    git(dir, "clone", "--quiet", data, seed);
    await mkdir(join(seed, "source"), { recursive: true });
    await writeFile(join(seed, "source/README.md"), "# Source archive\n");
    git(seed, "add", "--all");
    git(seed, "commit", "--quiet", "-m", "seed");
    git(seed, "push", "--quiet", "origin", "HEAD:refs/heads/main");

    const network: Network = { logs: [buildLog(NEW_DUMP)], status: dumpStatus(NEW_DUMP, DUMP), dump: DUMP, archive: ARCHIVE, asked: [], pulls: [], pullStatus: 201 };
    let clones = 0;
    const world: World = {
      dir, work, origin, data, network,
      deps: (extra = {}) => ({
        fetch: fakeFetch(network),
        git: gitIn(work),
        root: work,
        workDir: join(dir, `downloads-${clones}`),
        store: (files, message) => storeFiles(pathToFileURL(data).href, join(dir, `data-clone-${clones++}`), files, message),
        now: () => new Date("2026-11-05T06:17:42.123Z"),
        ...extra,
      }),
      dataFiles: () => git(data, "ls-tree", "-r", "--name-only", "main").split("\n").filter((line) => line !== ""),
      branches: () => git(origin, "for-each-ref", "--format=%(refname:short)", "refs/heads").split("\n").filter((line) => line !== "").sort(),
    };
    await run(world);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("the build log's dump file path names the dump; a log with none, or with two, is refused", () => {
  assert.equal(dumpOfBuildLog(buildLog("itwiktionary-20260901")), "itwiktionary-20260901");
  assert.throws(() => dumpOfBuildLog("INFO: Capturing words\n"), (error: unknown) => error instanceof ReleaseRefused && /names no dump/.test(error.message));
  assert.throws(() => dumpOfBuildLog(buildLog("itwiktionary-20260901") + buildLog("itwiktionary-20261001")), /names 2 dumps/);
  assert.throws(() => dumpOfBuildLog(buildLog("enwiktionary-20261001")), /not an Italian Wiktionary pages-articles dump/);
});

test("a release is new only when its dump is later than every ARCHIVE_FACTS entry's", () => {
  // The latest entry is it-78385b62, from itwiktionary-20260901.
  assert.deepEqual(checkRelease("itwiktionary-20260901"), { kind: "not-new", dump: "itwiktionary-20260901", latest: "itwiktionary-20260901" });
  assert.equal(checkRelease("itwiktionary-20260701").kind, "not-new");
  assert.deepEqual(checkRelease("itwiktionary-20261001"), { kind: "new", dump: "itwiktionary-20261001", latest: "itwiktionary-20260901" });
  assert.equal(checkRelease("itwiktionary-20261001", {}).kind, "new");
});

test("a dump's size and SHA-1 are read from Wikimedia's dumpstatus.json, and a dump not done is refused", () => {
  assert.deepEqual(identityOfDumpStatus(dumpStatus(NEW_DUMP, DUMP), NEW_DUMP), { bytes: DUMP.length, sha1: createHash("sha1").update(DUMP).digest("hex") });
  assert.throws(() => identityOfDumpStatus(dumpStatus(NEW_DUMP, DUMP, "in-progress"), NEW_DUMP), /"in-progress", not done/);
  assert.throws(() => identityOfDumpStatus(dumpStatus("itwiktionary-20260901", DUMP), NEW_DUMP), /lists no size and SHA-1/);
});

test("a release candidate is valid by construction, round-trips as JSON and adds itself to the catalogs", () => {
  const candidate = candidateOf();
  assert.equal(candidate.releaseId, RELEASE_ID);
  assert.deepEqual(ReleaseCandidate.parse(JSON.stringify(candidate)), candidate);
  assert.deepEqual(candidate.knownDump, {
    file: `${NEW_DUMP}-pages-articles.xml.bz2`,
    url: `https://dumps.wikimedia.org/itwiktionary/20261001/${NEW_DUMP}-pages-articles.xml.bz2`,
    bytes: DUMP.length,
    sha1: createHash("sha1").update(DUMP).digest("hex"),
  });
  assert.equal(candidate.facts.dump.basis, "recorded");
  assert.equal(candidate.facts.sourceUrl, KAIKKI_ARCHIVE_URL);

  const { catalog, dumps } = candidate.catalogs();
  assert.deepEqual(catalog[ARCHIVE_SHA256], candidate.facts);
  assert.deepEqual(dumps[NEW_DUMP], candidate.knownDump);
  assert.equal(Object.keys(catalog).length, Object.keys(ARCHIVE_FACTS).length + 1);

  // A release already recorded, or a dump known with other bytes, is refused.
  assert.throws(() => candidateOf(Object.keys(ARCHIVE_FACTS)[0]).catalogs(), /already name/);
  assert.throws(() => candidateOf(ARCHIVE_SHA256, "itwiktionary-20260901").catalogs(), /KNOWN_DUMPS gives itwiktionary-20260901/);

  for (const bad of [
    '{"archiveSha256": "abc", "retrievedAt": "2026-11-05T06:17:42Z", "dump": {"id": "itwiktionary-20261001", "bytes": 1, "sha1": "' + "a".repeat(40) + '"}}',
    `{"archiveSha256": "${ARCHIVE_SHA256}", "retrievedAt": "yesterday", "dump": {"id": "itwiktionary-20261001", "bytes": 1, "sha1": "${"a".repeat(40)}"}}`,
    `{"archiveSha256": "${ARCHIVE_SHA256}", "retrievedAt": "2026-11-05T06:17:42Z", "dump": {"id": "itwiktionary-20261399", "bytes": 1, "sha1": "${"a".repeat(40)}"}}`,
    `{"archiveSha256": "${ARCHIVE_SHA256}", "retrievedAt": "2026-11-05T06:17:42Z", "dump": {"id": "itwiktionary-20261001", "bytes": 0, "sha1": "${"a".repeat(40)}"}}`,
    `{"archiveSha256": "${ARCHIVE_SHA256}", "retrievedAt": "2026-11-05T06:17:42Z", "dump": {"id": "itwiktionary-20261001", "bytes": 1, "sha1": "${"a".repeat(40)}"}, "extra": 1}`,
    "not json",
  ]) {
    assert.throws(() => ReleaseCandidate.parse(bad), ReleaseRefused, bad);
  }
});

test("the ARCHIVE_FACTS entry written into archiveFacts.ts is the candidate's facts, after every entry already there", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-facts-"));
  try {
    const candidate = candidateOf();
    const text = withArchiveFacts(ARCHIVE_FACTS_TEXT, candidate);
    const file = join(dir, "archiveFacts.ts");
    await writeFile(file, text);
    const written = (await import(pathToFileURL(file).href)) as { ARCHIVE_FACTS: typeof ARCHIVE_FACTS };
    assert.deepEqual(Object.keys(written.ARCHIVE_FACTS), [...Object.keys(ARCHIVE_FACTS), ARCHIVE_SHA256]);
    assert.deepEqual(written.ARCHIVE_FACTS[ARCHIVE_SHA256], candidate.facts);
    for (const [sha256, facts] of Object.entries(ARCHIVE_FACTS)) assert.deepEqual(written.ARCHIVE_FACTS[sha256], facts);
    assert.throws(() => withArchiveFacts(text, candidate), /already names/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/** The `KNOWN_DUMPS` object a wiktionaryDump.ts text defines, evaluated with its one reference stubbed. */
function knownDumpsOf(source: string): Record<string, unknown> {
  const start = source.indexOf("export const KNOWN_DUMPS");
  const literal = source.slice(source.indexOf("= {", start) + 2, source.indexOf("\n};\n", start) + 2);
  return new Function("ARCHIVE_DUMP", `return (${literal});`)("the July dump") as Record<string, unknown>;
}

test("the KNOWN_DUMPS entry written into wiktionaryDump.ts is the candidate's dump, and a dump already named is left as it is", () => {
  const candidate = candidateOf();
  const text = withKnownDump(KNOWN_DUMPS_TEXT, candidate);
  const dumps = knownDumpsOf(text);
  assert.deepEqual(Object.keys(dumps), [...Object.keys(KNOWN_DUMPS), NEW_DUMP]);
  assert.deepEqual(dumps[NEW_DUMP], candidate.knownDump);
  assert.deepEqual(dumps["itwiktionary-20260901"], KNOWN_DUMPS["itwiktionary-20260901"]);
  assert.equal(withKnownDump(text, candidate), text);
});

test("with no new kaikki release, nothing is downloaded or stored and no branch is pushed", async () => {
  await withWorld(async (world) => {
    world.network.logs = [buildLog("itwiktionary-20260901")];
    const before = world.dataFiles();
    const outcome = await prepareRelease(world.deps());
    assert.equal(outcome.kind, "none");
    assert.match(outcome.kind === "none" ? outcome.reason : "", /no new release/);
    assert.deepEqual(world.network.asked, [KAIKKI_BUILD_LOG_URL]);
    assert.deepEqual(world.dataFiles(), before);
    assert.deepEqual(world.branches(), ["main"]);
  });
});

test("a new release is stored in lexema-data and its facts pushed on release/<id>; a second run then opens nothing", async () => {
  await withWorld(async (world) => {
    const outcome = await prepareRelease(world.deps());
    assert.ok(outcome.kind === "prepared");
    const { candidate, branch, commit, stored } = outcome;
    assert.equal(candidate.releaseId, RELEASE_ID);
    assert.equal(candidate.retrievedAt, "2026-11-05T06:17:42Z");
    assert.equal(branch, `release/${RELEASE_ID}`);
    assert.equal(stored.kind, "stored");

    // The archive, the build log, the headers and the dump, beside what was there.
    assert.deepEqual(world.dataFiles(), [
      `source/${NEW_DUMP}-pages-articles.xml.bz2`,
      "source/README.md",
      `source/${RELEASE_ID}.headers`,
      `source/${RELEASE_ID}.jsonl.gz`,
      `source/${RELEASE_ID}.log`,
    ].sort());
    assert.deepEqual(Buffer.from(execFileSync("git", ["show", `main:source/${RELEASE_ID}.jsonl.gz`], { cwd: world.data })), ARCHIVE);
    assert.match(git(world.data, "show", `main:source/${RELEASE_ID}.headers`), /^last-modified: Mon, 26 Oct 2026 15:24:26 GMT$/m);
    assert.equal(git(world.data, "show", `main:source/${RELEASE_ID}.log`), buildLog(NEW_DUMP).trim());

    // The branch carries the two facts entries and nothing else.
    assert.deepEqual(world.branches(), ["main", branch]);
    assert.equal(git(world.origin, "rev-parse", `refs/heads/${branch}`), commit);
    assert.deepEqual(git(world.origin, "diff", "--name-only", `main..${branch}`).split("\n"), ["src/source/archiveFacts.ts", "src/source/wiktionaryDump.ts"]);
    assert.equal(git(world.origin, "show", `${branch}:src/source/archiveFacts.ts`), withArchiveFacts(ARCHIVE_FACTS_TEXT, candidate).trim());
    assert.equal(git(world.origin, "show", `${branch}:src/source/wiktionaryDump.ts`), withKnownDump(KNOWN_DUMPS_TEXT, candidate).trim());

    // The next month, kaikki still serves the same release: its branch stands, so nothing is written.
    git(world.work, "checkout", "--quiet", "main");
    const dataHead = git(world.data, "rev-parse", "main");
    const again = await prepareRelease(world.deps());
    assert.equal(again.kind, "none");
    assert.match(again.kind === "none" ? again.reason : "", /branch release\/it-[0-9a-f]{8} exists/);
    assert.equal(git(world.data, "rev-parse", "main"), dataHead);
  });
});

test("a build log that names another dump on the second read, or a dump that is not what Wikimedia lists, stores nothing", async () => {
  await withWorld(async (world) => {
    const before = world.dataFiles();
    world.network.logs = [buildLog(NEW_DUMP), buildLog("itwiktionary-20261020")];
    await assert.rejects(prepareRelease(world.deps()), (error: unknown) => error instanceof ReleaseRefused && /rebuilt while the archive was read/.test(error.message));

    world.network.logs = [buildLog(NEW_DUMP)];
    world.network.dump = Buffer.from("<mediawiki>altered</mediawiki>\n");
    await assert.rejects(prepareRelease(world.deps()), /is not the expected dump/);

    assert.deepEqual(world.dataFiles(), before);
    assert.deepEqual(world.branches(), ["main"]);
  });
});

test("a file already in lexema-data with the same bytes is left alone, and one with other bytes is refused", async () => {
  await withWorld(async (world) => {
    const remote = pathToFileURL(world.data).href;
    const file = join(world.dir, "archive.jsonl.gz");
    await writeFile(file, ARCHIVE);
    const first = await storeFiles(remote, join(world.dir, "clone-a"), [{ path: "source/it-x.jsonl.gz", from: file }], "add");
    assert.equal(first.kind, "stored");
    const second = await storeFiles(remote, join(world.dir, "clone-b"), [{ path: "source/it-x.jsonl.gz", from: file }], "add");
    assert.deepEqual(second, { kind: "stored-already", commit: first.commit });
    await writeFile(file, "other bytes");
    await assert.rejects(storeFiles(remote, join(world.dir, "clone-c"), [{ path: "source/it-x.jsonl.gz", from: file }], "add"), StoreRefused);
    assert.equal(git(world.data, "rev-parse", "main"), first.commit);
  });
});

/** The dictionary deploy's plan-only answer, as its `counts` output gives it. */
const planAnswer = (removed = 0): string =>
  JSON.stringify({
    command: "update:auto",
    counts: { records: { added: 259, changed: 693, removed }, written: { source_record: 952, applied_change: 952 }, deleted: { lookup_form: 120 } },
    dictionaryRecords: 560_357,
    limitBreaches: [],
    planOnly: true,
  });

test("the declaration takes the plan-only run's counts, and the pull request body states them and any hard limit crossed", () => {
  const candidate = candidateOf();
  const declared = declarationFor(candidate, planAnswer());
  assert.equal(declared.path, `dictionary-changes/${RELEASE_ID}.json`);
  const reread = parseDeclaration(declared.path, declared.text);
  assert.ok(reread.command === "update:auto");
  assert.equal(reread.inputs.feedRelease, RELEASE_ID);
  assert.deepEqual(reread.expected.toJSON(), JSON.parse(planAnswer()).counts);

  const body = releasePullRequestBody(candidate, declared);
  assert.match(body, /\| 259 \| 693 \| 0 \|/);
  assert.match(body, /\| `source_record` \| 952 \| 0 \|/);
  assert.match(body, /\| `lookup_form` \| 0 \| 120 \|/);
  assert.match(body, /holds 560357 records/);
  assert.match(body, /crosses no hard limit/);
  assert.match(body, /Closing it skips the release/);

  const breaching = releasePullRequestBody(candidate, declarationFor(candidate, planAnswer(150)));
  assert.match(breaching, /will stop red/);
  assert.match(breaching, /- it removes 150 records, more than 100/);

  assert.throws(() => declarationFor(candidate, JSON.stringify({ ...JSON.parse(planAnswer()), command: "hide:records" })), /not update:auto/);
  assert.throws(() => declarationFor(candidate, JSON.stringify({ ...JSON.parse(planAnswer()), counts: { records: { added: -1 } } })), /is not a change declaration/);
});

test("the pull request adds the declaration to the release branch and is opened from it into main", async () => {
  await withWorld(async (world) => {
    const outcome = await prepareRelease(world.deps());
    assert.ok(outcome.kind === "prepared");
    const checkout = join(world.dir, "pr-checkout");
    git(world.dir, "clone", "--quiet", world.origin, checkout);
    git(checkout, "checkout", "--quiet", "--detach", outcome.commit);

    const deps = { fetch: fakeFetch(world.network), git: gitIn(checkout), root: checkout, repository: "hueypov/lexema", token: "a-token" };
    const url = await openReleasePullRequest(outcome.candidate, planAnswer(), deps);
    assert.equal(url, "https://github.com/hueypov/lexema/pull/999");

    const path = `dictionary-changes/${RELEASE_ID}.json`;
    assert.deepEqual(git(world.origin, "diff", "--name-only", `${outcome.commit}..${outcome.branch}`).split("\n"), [path]);
    assert.equal(parseDeclaration(path, git(world.origin, "show", `${outcome.branch}:${path}`)).command, "update:auto");

    assert.equal(world.network.pulls.length, 1);
    const [{ url: api, body }] = world.network.pulls;
    assert.equal(api, "https://api.github.com/repos/hueypov/lexema/pulls");
    assert.equal(body.head, outcome.branch);
    assert.equal(body.base, "main");
    assert.match(String(body.title), new RegExp(RELEASE_ID));
    assert.match(String(body.body), /## Expected counts/);

    // A pull request GitHub refuses to open is a refusal, never a URL.
    world.network.pullStatus = 422;
    await assert.rejects(openReleasePullRequest(outcome.candidate, planAnswer(1), deps), /GitHub answered 422/);
    assert.equal(world.network.pulls.length, 2);
  });
});

test("the monthly release commands run only in GitHub Actions on main, and prepare needs the write token", async () => {
  for (const verb of [["prepare"], ["open", "--release", "{}", "--plan", "{}"]]) {
    const result = await releaseMain(verb, {}, fakeFetch({ logs: [], status: {}, dump: DUMP, archive: ARCHIVE, asked: [], pulls: [], pullStatus: 201 }));
    assert.equal(result.status, 1);
    assert.match(result.out, /runs only in the monthly release workflow on main/);
  }
  const prepare = await releaseMain(["prepare"], { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main" });
  assert.equal(prepare.status, 1);
  assert.match(prepare.out, /LEXEMA_DATA_WRITE_TOKEN is not set/);
});

test("a plan-only run's --release must be a release candidate", async () => {
  const result = await deployMain(["--plan-only", "--change", '{"command":"update:upgrade"}', "--release", '{"archiveSha256":"nope"}'], {});
  assert.equal(result.status, 1);
  assert.match(result.out, /--release is not a release to plan against/);
});

test("a feed's dump is found through the catalogs a plan is given, so a release not committed yet can be planned", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-feed-dump-"));
  try {
    const candidate = candidateOf();
    const dumpPath = join(dir, candidate.knownDump.file);
    await writeFile(dumpPath, DUMP);
    const feed = { path: join(dir, "it-extract.jsonl.gz"), releaseId: RELEASE_ID, archiveSha256: ARCHIVE_SHA256 } as FeedArchive;
    await assert.rejects(withFeedDump(feed, dumpPath, LANGUAGES, async (pages) => pages.dump), /no archive facts name the dump/);
    assert.equal(await withFeedDump(feed, dumpPath, LANGUAGES, async (pages) => pages.dump, candidate.catalogs()), NEW_DUMP);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/** Each job of a workflow file by its id, as the text of its block under `jobs:`. */
function jobsOf(yaml: string): Map<string, string> {
  const lines = yaml.slice(yaml.indexOf("\njobs:\n") + "\njobs:\n".length).split("\n");
  const jobs = new Map<string, string>();
  let id: string | undefined;
  for (const line of lines) {
    const head = /^ {2}([\w-]+):\s*$/.exec(line);
    if (head !== null) id = head[1];
    else if (id !== undefined) jobs.set(id, `${jobs.get(id) ?? ""}${line}\n`);
  }
  return jobs;
}

test("only the monthly release workflow's prepare job reads the lexema-data write token, and none of its jobs is given the Cloudflare token", async () => {
  const workflows = resolve(".github/workflows");
  const yaml = await readFile(join(workflows, "dictionary-release.yml"), "utf8");
  const jobs = jobsOf(yaml);
  assert.deepEqual([...jobs.keys()], ["prepare", "plan", "pull-request"]);
  assert.deepEqual([...new Set(yaml.match(/secrets\.[A-Z0-9_]+/g))], ["secrets.LEXEMA_DATA_WRITE_TOKEN"]);
  const holders = [...jobs].filter(([, block]) => block.includes("secrets.LEXEMA_DATA_WRITE_TOKEN")).map(([id]) => id);
  assert.deepEqual(holders, ["prepare"]);
  assert.match(jobs.get("prepare") ?? "", /^ {4}environment: dictionary-release$/m);

  // The counts come from the dictionary deploy's plan-only entry, which is passed no secret.
  const plan = jobs.get("plan") ?? "";
  assert.match(plan, /^ {4}uses: \.\/\.github\/workflows\/dictionary-deploy\.yml$/m);
  assert.doesNotMatch(yaml, /^\s*secrets:/m);
  assert.doesNotMatch(yaml, /CLOUDFLARE|environment: dictionary-deploy/);
  assert.match(jobs.get("pull-request") ?? "", /needs\.plan\.outputs\.counts/);

  // No other workflow reads the write token.
  const readers: string[] = [];
  for (const file of await readdir(workflows)) {
    if ((await readFile(join(workflows, file), "utf8")).includes("LEXEMA_DATA_WRITE_TOKEN")) readers.push(file);
  }
  assert.deepEqual(readers, ["dictionary-release.yml"]);
});
