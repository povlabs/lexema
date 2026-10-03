// The archive and dump a declared change reads, fetched from
// `hueypov/lexema-data` and checked before anything is written (#456). An
// archive must have the SHA-256 its `ARCHIVE_FACTS` entry is keyed by, and a
// dump the size and SHA-1 `KNOWN_DUMPS` gives it; a file that does not is
// refused, so no plan is built from it and nothing is written.
//
// Where a file lives in `hueypov/lexema-data`, under `source/`:
// - the master's archive, `it-0c432803`: `source/it-extract.jsonl.gz`, as it
//   has always been kept;
// - any other release's archive: `source/<release id>.jsonl.gz`;
// - a dump: `source/<KNOWN_DUMPS file>`, such as
//   `source/itwiktionary-20260901-pages-articles.xml.bz2`.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { ARCHIVE_FACTS, PUBLISHED_ARCHIVE_SHA256, type ArchiveFactsCatalog } from "../source/archiveFacts.js";
import { type DumpIdentity, KNOWN_DUMPS, VerifiedDump } from "../source/wiktionaryDump.js";
import type { DeclaredChange, ReleaseId } from "../update/declaration.js";

/** The repository the deploy reads archives and dumps from, with its own read-only token. */
export const DATA_REPOSITORY = "hueypov/lexema-data";

/** The dumps by id, each with its file name. */
export type DumpCatalog = Readonly<Record<string, DumpIdentity & { readonly file: string }>>;

/** Why a change's files cannot be used: nothing was planned or written from them. */
export class DataRefused extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(reasons.join("\n"));
    this.name = "DataRefused";
  }
}

/** One archive a change reads: its release, the SHA-256 it must have, and its path in the data repository. */
export interface ArchiveFile {
  readonly releaseId: ReleaseId;
  readonly sha256: string;
  readonly path: string;
}

/** One dump a change reads: its id, the bytes it must be, and its path in the data repository. */
export interface DumpFile {
  readonly id: string;
  readonly identity: DumpIdentity;
  readonly path: string;
}

/** The files one change reads, or none. */
export interface ChangeFiles {
  readonly archive: ArchiveFile;
  readonly dump: DumpFile;
}

/** Where the archive of `releaseId`, with this SHA-256, lives in the data repository. */
export const archivePath = (releaseId: ReleaseId, sha256: string): string =>
  sha256 === PUBLISHED_ARCHIVE_SHA256 ? "source/it-extract.jsonl.gz" : `source/${releaseId}.jsonl.gz`;

/** Where a dump of this file name lives in the data repository. */
export const dumpPath = (file: string): string => `source/${file}`;

/**
 * The archive and dump `change` reads, from the catalogs: `update:auto` reads
 * its feed release, `hide:records` the master's archive, each with the dump it
 * was built from. `update:upgrade` and `normalize:source-text` read none.
 */
export function filesFor(
  change: DeclaredChange,
  catalog: ArchiveFactsCatalog = ARCHIVE_FACTS,
  dumps: DumpCatalog = KNOWN_DUMPS,
): ChangeFiles | null {
  switch (change.command) {
    case "update:upgrade":
    case "normalize:source-text":
      return null;
    case "update:auto":
      return releaseFiles(change.inputs.feedRelease, catalog, dumps);
    case "hide:records":
      return releaseFiles(change.inputs.archive, catalog, dumps);
  }
}

function releaseFiles(releaseId: ReleaseId, catalog: ArchiveFactsCatalog, dumps: DumpCatalog): ChangeFiles {
  const prefix = releaseId.slice("it-".length);
  const known = Object.keys(catalog).filter((sha256) => sha256.startsWith(prefix));
  if (known.length !== 1) {
    throw new DataRefused([
      known.length === 0
        ? `no archive facts name release ${releaseId} (src/source/archiveFacts.ts), so its archive has no checksum to be held to`
        : `${known.length} archive facts entries start with ${prefix}: release ${releaseId} names none of them alone`,
    ]);
  }
  const [sha256] = known;
  const dumpId = catalog[sha256].dump.id;
  const dump = Object.hasOwn(dumps, dumpId) ? dumps[dumpId] : undefined;
  if (dump === undefined) throw new DataRefused([`${dumpId}, the dump ${releaseId} was built from, has no size and SHA-1 in KNOWN_DUMPS`]);
  return {
    archive: { releaseId, sha256, path: archivePath(releaseId, sha256) },
    dump: { id: dumpId, identity: { bytes: dump.bytes, sha1: dump.sha1 }, path: dumpPath(dump.file) },
  };
}

/** Copies the file at `path` in the data repository to `to`. */
export type DataFetcher = (path: string, to: string) => Promise<void>;

/**
 * The data repository through GitHub's contents API, read with `token`, a
 * fine-grained token with Contents read-only on that repository alone. The
 * raw media type serves a file of up to 100 MB; the largest here, a dump, is
 * about 71 MB.
 */
export function lexemaDataFetcher(token: string, fetchImpl: typeof fetch = fetch): DataFetcher {
  return async (path, to) => {
    const url = `https://api.github.com/repos/${DATA_REPOSITORY}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github.raw+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok || response.body === null) throw new DataRefused([`${DATA_REPOSITORY} answered ${response.status} for ${path}`]);
    await mkdir(dirname(to), { recursive: true });
    await pipeline(Readable.fromWeb(response.body as WebReadableStream<Uint8Array>), createWriteStream(to));
  };
}

async function sha256Of(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/** A change's files on disk, each checked against the bytes it must be. */
export interface FetchedFiles {
  readonly archive: string;
  readonly dump: string;
}

/**
 * Fetch `files` into `dir` and check each one: the archive's SHA-256 and the
 * dump's size and SHA-1. Refuses, naming every file that is not what it must
 * be, before anything reads it.
 */
export async function fetchVerified(files: ChangeFiles, fetcher: DataFetcher, dir: string): Promise<FetchedFiles> {
  const archive = join(dir, files.archive.path);
  const dump = join(dir, files.dump.path);
  await fetcher(files.archive.path, archive);
  await fetcher(files.dump.path, dump);
  const reasons: string[] = [];
  const sha256 = await sha256Of(archive);
  if (sha256 !== files.archive.sha256) {
    reasons.push(`${files.archive.path} has SHA-256 ${sha256}; release ${files.archive.releaseId} must have ${files.archive.sha256} (src/source/archiveFacts.ts)`);
  }
  try {
    await (await VerifiedDump.open(dump, files.dump.identity)).close();
  } catch (error: unknown) {
    reasons.push(`${files.dump.path} is not ${files.dump.id} as KNOWN_DUMPS gives it: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (reasons.length > 0) throw new DataRefused(reasons);
  return { archive, dump };
}
