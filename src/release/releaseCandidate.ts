// A new kaikki Italian release the monthly release workflow found (#457): its
// archive's SHA-256, the facts its `ARCHIVE_FACTS` entry records, and the size
// and SHA-1 of the Wiktionary dump its build log names. One value says all of
// it, so the entries written into the repository, the plan-only run's catalogs
// and the release pull request's text cannot disagree.
//
// A release is new when the dump its build log names is later than the dump of
// every `ARCHIVE_FACTS` entry. That is the order `update:auto` itself holds a
// feed to (src/update/ordering.ts): a later archive of the same dump has no
// verified order, so it is not a new release either.

import { ARCHIVE_FACTS, type ArchiveFacts, type ArchiveFactsCatalog, type WiktionaryDumpId } from "../source/archiveFacts.js";
import { type DumpIdentity, KNOWN_DUMPS } from "../source/wiktionaryDump.js";
import type { ReleaseId } from "../update/declaration.js";

/** Where kaikki publishes the Italian extract and the log of the build that wrote it. */
export const KAIKKI_ARCHIVE_URL = "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz";
export const KAIKKI_BUILD_LOG_URL = "https://kaikki.org/dictionary/downloads/it/it-extract.log";

/** A dump as `KNOWN_DUMPS` holds it. */
export type KnownDump = DumpIdentity & { readonly file: string; readonly url: string };

/** Why a value is not a release candidate, or a release cannot be added. */
export class ReleaseRefused extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(reasons.join("\n"));
    this.name = "ReleaseRefused";
  }
}

const DUMP_ID = /^itwiktionary-(\d{8})$/;

/** The dump's date digits, `YYYYMMDD`, when `id` names a real calendar day. */
function dumpDigits(id: string): string | undefined {
  const digits = DUMP_ID.exec(id)?.[1];
  if (digits === undefined) return undefined;
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? digits : undefined;
}

export const isDumpId = (id: string): id is WiktionaryDumpId => dumpDigits(id) !== undefined;

/** The `pages-articles` file of a dump, and where Wikimedia publishes it and its status. */
export function wikimediaDump(id: WiktionaryDumpId): { file: string; url: string; statusUrl: string } {
  const digits = id.slice(-8);
  const file = `${id}-pages-articles.xml.bz2`;
  return {
    file,
    url: `https://dumps.wikimedia.org/itwiktionary/${digits}/${file}`,
    statusUrl: `https://dumps.wikimedia.org/itwiktionary/${digits}/dumpstatus.json`,
  };
}

/**
 * The dump a kaikki build log names, from its `dump file path:` line, such as
 * `.../itwiktionary-20260901-pages-articles.xml.bz2`. Refuses a log with no
 * such line, or with two that disagree.
 */
export function dumpOfBuildLog(log: string): WiktionaryDumpId {
  const named = new Set<string>();
  for (const line of log.split("\n")) {
    const path = /dump file path:\s*(\S+)/.exec(line)?.[1];
    if (path === undefined) continue;
    const id = /(itwiktionary-\d{8})-pages-articles\.xml\.bz2$/.exec(path)?.[1];
    if (id === undefined || !isDumpId(id)) throw new ReleaseRefused([`the build log's dump file path ${path} is not an Italian Wiktionary pages-articles dump`]);
    named.add(id);
  }
  if (named.size === 0) throw new ReleaseRefused(["the build log has no 'dump file path:' line, so it names no dump"]);
  if (named.size > 1) throw new ReleaseRefused([`the build log names ${named.size} dumps: ${[...named].join(", ")}`]);
  return [...named][0] as WiktionaryDumpId;
}

/**
 * The size and SHA-1 Wikimedia's `dumpstatus.json` lists for a dump's
 * `pages-articles` file. Refuses a dump whose articles job is not `done`.
 */
export function identityOfDumpStatus(status: unknown, id: WiktionaryDumpId): DumpIdentity {
  const job = (status as { jobs?: { articlesdump?: { status?: unknown; files?: Record<string, { size?: unknown; sha1?: unknown }> } } } | null)?.jobs?.articlesdump;
  const { file } = wikimediaDump(id);
  if (job?.status !== "done") throw new ReleaseRefused([`Wikimedia's articles dump of ${id} is ${JSON.stringify(job?.status ?? "missing")}, not done`]);
  const listed = job.files?.[file];
  const bytes = listed?.size;
  const sha1 = listed?.sha1;
  if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes <= 0 || typeof sha1 !== "string" || !/^[0-9a-f]{40}$/.test(sha1)) {
    throw new ReleaseRefused([`Wikimedia's dumpstatus.json lists no size and SHA-1 for ${file}`]);
  }
  return { bytes, sha1 };
}

/** The latest dump any archive in `catalog` was built from, or none for an empty catalog. */
export function latestDump(catalog: ArchiveFactsCatalog = ARCHIVE_FACTS): WiktionaryDumpId | null {
  let latest: WiktionaryDumpId | null = null;
  for (const facts of Object.values(catalog)) {
    if (dumpDigits(facts.dump.id) === undefined) throw new ReleaseRefused([`archive facts name ${facts.dump.id}, which is not a dated Italian Wiktionary dump`]);
    if (latest === null || facts.dump.id.slice(-8) > latest.slice(-8)) latest = facts.dump.id;
  }
  return latest;
}

/** Whether a build of `dump` is a new release against `catalog`: its dump is later than every archive's there. */
export type ReleaseCheck =
  | { readonly kind: "new"; readonly dump: WiktionaryDumpId; readonly latest: WiktionaryDumpId | null }
  | { readonly kind: "not-new"; readonly dump: WiktionaryDumpId; readonly latest: WiktionaryDumpId };

export function checkRelease(dump: WiktionaryDumpId, catalog: ArchiveFactsCatalog = ARCHIVE_FACTS): ReleaseCheck {
  const latest = latestDump(catalog);
  return latest !== null && dump.slice(-8) <= latest.slice(-8) ? { kind: "not-new", dump, latest } : { kind: "new", dump, latest };
}

/** The fields a candidate is made of; everything else follows from them. */
export interface ReleaseCandidateFields {
  /** Lowercase hex SHA-256 of the archive as downloaded. */
  readonly archiveSha256: string;
  /** When the archive was downloaded, ISO-8601 UTC to the second. */
  readonly retrievedAt: string;
  /** The dump the build log names, with the size and SHA-1 Wikimedia publishes for it. */
  readonly dump: { readonly id: string; readonly bytes: number; readonly sha1: string };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Where a candidate's files are kept in `hueypov/lexema-data`, beside the archive. */
export const releaseFilePaths = (releaseId: ReleaseId, dumpFile: string) =>
  ({
    archive: `source/${releaseId}.jsonl.gz`,
    buildLog: `source/${releaseId}.log`,
    headers: `source/${releaseId}.headers`,
    dump: `source/${dumpFile}`,
  }) as const;

/**
 * A new release: valid by construction, since `of` and `parse` are the only
 * ways to get one and both check every field.
 */
export class ReleaseCandidate {
  private constructor(
    readonly archiveSha256: string,
    readonly retrievedAt: string,
    readonly dumpId: WiktionaryDumpId,
    readonly dumpIdentity: DumpIdentity,
  ) {}

  static of(fields: ReleaseCandidateFields): ReleaseCandidate {
    const reasons: string[] = [];
    if (!/^[0-9a-f]{64}$/.test(fields.archiveSha256)) reasons.push(`archiveSha256 must be 64 lowercase hex digits, got ${JSON.stringify(fields.archiveSha256)}`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(fields.retrievedAt) || Number.isNaN(Date.parse(fields.retrievedAt))) {
      reasons.push(`retrievedAt must be an ISO-8601 UTC time to the second, got ${JSON.stringify(fields.retrievedAt)}`);
    }
    const { id, bytes, sha1 } = fields.dump;
    if (!isDumpId(id)) reasons.push(`dump.id must be itwiktionary- and a dump's date, got ${JSON.stringify(id)}`);
    if (!Number.isSafeInteger(bytes) || bytes <= 0) reasons.push(`dump.bytes must be a whole number above zero, got ${JSON.stringify(bytes)}`);
    if (!/^[0-9a-f]{40}$/.test(sha1)) reasons.push(`dump.sha1 must be 40 lowercase hex digits, got ${JSON.stringify(sha1)}`);
    if (reasons.length > 0) throw new ReleaseRefused(reasons);
    return new ReleaseCandidate(fields.archiveSha256, fields.retrievedAt, id as WiktionaryDumpId, { bytes, sha1 });
  }

  /** The candidate `text` states, as `toJSON` writes it. */
  static parse(text: string): ReleaseCandidate {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (error: unknown) {
      throw new ReleaseRefused([`the release is not JSON (${error instanceof Error ? error.message : String(error)})`]);
    }
    if (!isObject(value) || !isObject(value.dump)) throw new ReleaseRefused(["the release must be an object with archiveSha256, retrievedAt and dump"]);
    const unknown = [
      ...Object.keys(value).filter((key) => !["archiveSha256", "retrievedAt", "dump"].includes(key)),
      ...Object.keys(value.dump).filter((key) => !["id", "bytes", "sha1"].includes(key)).map((key) => `dump.${key}`),
    ];
    if (unknown.length > 0) throw new ReleaseRefused(unknown.map((key) => `the release has an unknown field ${JSON.stringify(key)}`));
    return ReleaseCandidate.of(value as unknown as ReleaseCandidateFields);
  }

  get releaseId(): ReleaseId {
    return `it-${this.archiveSha256.slice(0, 8)}`;
  }

  /** The dump as `KNOWN_DUMPS` holds it. */
  get knownDump(): KnownDump {
    const { file, url } = wikimediaDump(this.dumpId);
    return { file, url, ...this.dumpIdentity };
  }

  /** Where its archive, build log, response headers and dump are kept in `hueypov/lexema-data`. */
  get paths(): ReturnType<typeof releaseFilePaths> {
    return releaseFilePaths(this.releaseId, this.knownDump.file);
  }

  /** The facts its `ARCHIVE_FACTS` entry records. */
  get facts(): ArchiveFacts {
    return {
      sourceUrl: KAIKKI_ARCHIVE_URL,
      retrievedAt: this.retrievedAt,
      dump: { id: this.dumpId, basis: "recorded" },
      evidence: [
        `hueypov/lexema-data ${this.paths.buildLog}: kaikki's build log, whose dump file path names ${this.dumpId}`,
        `hueypov/lexema-data ${this.paths.headers}: the response headers of the download`,
      ],
    };
  }

  /**
   * The committed catalogs with this release added, for a plan-only run of a
   * release not committed yet. Refuses when either catalog already holds a
   * different entry under the same key.
   */
  catalogs(catalog: ArchiveFactsCatalog = ARCHIVE_FACTS, dumps: Readonly<Record<string, KnownDump>> = KNOWN_DUMPS): { catalog: ArchiveFactsCatalog; dumps: Readonly<Record<string, KnownDump>> } {
    const reasons: string[] = [];
    if (Object.hasOwn(catalog, this.archiveSha256)) reasons.push(`archive facts already name ${this.releaseId}`);
    if (Object.hasOwn(dumps, this.dumpId)) {
      const known = dumps[this.dumpId];
      if (known.bytes !== this.dumpIdentity.bytes || known.sha1 !== this.dumpIdentity.sha1) {
        reasons.push(`KNOWN_DUMPS gives ${this.dumpId} ${known.bytes} bytes and SHA-1 ${known.sha1}, not ${this.dumpIdentity.bytes} and ${this.dumpIdentity.sha1}`);
      }
    }
    if (reasons.length > 0) throw new ReleaseRefused(reasons);
    return { catalog: { ...catalog, [this.archiveSha256]: this.facts }, dumps: { ...dumps, [this.dumpId]: this.knownDump } };
  }

  toJSON(): ReleaseCandidateFields {
    return { archiveSha256: this.archiveSha256, retrievedAt: this.retrievedAt, dump: { id: this.dumpId, ...this.dumpIdentity } };
  }
}

/** `n` with `_` between each group of three digits, as the catalogs write sizes. */
const grouped = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "_");

/** The text between `start` and the `};` that closes the object it opens, or a refusal naming `what`. */
function objectEnd(source: string, start: string, what: string): number {
  const at = source.indexOf(start);
  const end = at === -1 ? -1 : source.indexOf("\n};\n", at);
  if (end === -1) throw new ReleaseRefused([`${what} has no "${start}" object closed by "};" to add the entry to`]);
  return end + 1;
}

/**
 * `source`, the text of src/source/archiveFacts.ts, with this release's entry
 * added last in `ARCHIVE_FACTS`. Refuses when the file already names it.
 */
export function withArchiveFacts(source: string, candidate: ReleaseCandidate): string {
  if (source.includes(`"${candidate.archiveSha256}"`)) throw new ReleaseRefused([`src/source/archiveFacts.ts already names ${candidate.releaseId}`]);
  const { facts } = candidate;
  const entry = [
    `  // \`it-extract.jsonl.gz\` of kaikki's build from \`${candidate.dumpId}\`, release`,
    `  // \`${candidate.releaseId}\`, added by the monthly release workflow (#457).`,
    `  ${JSON.stringify(candidate.archiveSha256)}: {`,
    `    sourceUrl: ${JSON.stringify(facts.sourceUrl)},`,
    `    retrievedAt: ${JSON.stringify(facts.retrievedAt)},`,
    `    dump: { id: ${JSON.stringify(facts.dump.id)}, basis: ${JSON.stringify(facts.dump.basis)} },`,
    "    evidence: [",
    ...facts.evidence.map((line) => `      ${JSON.stringify(line)},`),
    "    ],",
    "  },",
    "",
  ].join("\n");
  const end = objectEnd(source, "export const ARCHIVE_FACTS: ArchiveFactsCatalog = {", "src/source/archiveFacts.ts");
  return `${source.slice(0, end)}${entry}${source.slice(end)}`;
}

/**
 * `source`, the text of src/source/wiktionaryDump.ts, with this release's dump
 * added last in `KNOWN_DUMPS`, or unchanged when it already names that dump.
 * `candidate.catalogs()` is what refuses a dump known with another size or
 * SHA-1, so run it first.
 */
export function withKnownDump(source: string, candidate: ReleaseCandidate): string {
  const dump = candidate.knownDump;
  if (source.includes(`"${candidate.dumpId}":`)) return source;
  const entry = [
    `  ${JSON.stringify(candidate.dumpId)}: {`,
    `    file: ${JSON.stringify(dump.file)},`,
    `    url: ${JSON.stringify(dump.url)},`,
    `    bytes: ${grouped(dump.bytes)},`,
    `    sha1: ${JSON.stringify(dump.sha1)},`,
    "  },",
    "",
  ].join("\n");
  const end = objectEnd(source, "export const KNOWN_DUMPS", "src/source/wiktionaryDump.ts");
  return `${source.slice(0, end)}${entry}${source.slice(end)}`;
}
