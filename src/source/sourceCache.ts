// The source archive and dump a local command reads, kept in `.data/source/`
// (#606). Their durable copies are `source/` in `povlabs/lexema-data`; a file
// missing from the cache is fetched from there on first use, and every file,
// fresh or cached, is held to the checks the dictionary deploy holds it to
// (`archiveRefusal`, `dumpRefusal`) before its path is returned. A fetched file
// is written under a temporary name and renamed into the cache only once it
// passes, so a half-download or a wrong file is never where the next run looks.
// A cached file that fails is refused and left as it is: nothing here deletes
// a file it did not just write.
//
// The cache keeps the data repository's layout, so the master's archive is
// `.data/source/it-extract.jsonl.gz` and its dump
// `.data/source/itwiktionary-20260701-pages-articles.xml.bz2`. A new linked
// worktree links the main checkout's `.data/source/` (tools/set-up-worktree.sh).

import { access, mkdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  type ArchiveFile,
  archiveRefusal,
  type ChangeFiles,
  type DataFetcher,
  DataRefused,
  type DumpCatalog,
  type DumpFile,
  dumpRefusal,
  type FetchedFiles,
  lexemaDataFetcher,
  releaseFiles,
} from "../deploy/dataFiles.js";
import type { ReleaseId } from "../update/declaration.js";
import { ARCHIVE_FACTS, type ArchiveFactsCatalog, PUBLISHED_ARCHIVE_SHA256 } from "./archiveFacts.js";
import { KNOWN_DUMPS, openRawPages, type RawPageInput } from "./wiktionaryDump.js";
import { releaseIdOf } from "./servedRelease.js";

/** The master's release, `it-0c432803`: what a local command reads when nothing names another. */
export const MASTER_RELEASE: ReleaseId = releaseIdOf(PUBLISHED_ARCHIVE_SHA256);

/** The directory the cache keeps the data repository's `source/` under. */
export const SOURCE_CACHE_ROOT = ".data";

/** Where a cache keeps its files, how it fetches one it lacks, and the catalogs that say what each must be. */
export interface SourceCacheOptions {
  readonly root?: string;
  readonly fetcher?: DataFetcher;
  readonly catalog?: ArchiveFactsCatalog;
  readonly dumps?: DumpCatalog;
}

/** A release's archive and dump in a local cache, each checked before its path is given out. */
export class SourceCache {
  private readonly root: string;
  private readonly fetcher: DataFetcher;
  private readonly catalog: ArchiveFactsCatalog;
  private readonly dumps: DumpCatalog;

  constructor({ root = resolve(SOURCE_CACHE_ROOT), fetcher = lexemaDataFetcher(), catalog = ARCHIVE_FACTS, dumps = KNOWN_DUMPS }: SourceCacheOptions = {}) {
    this.root = root;
    this.fetcher = fetcher;
    this.catalog = catalog;
    this.dumps = dumps;
  }

  /** The checked archive and dump of `releaseId`. */
  async files(releaseId: ReleaseId = MASTER_RELEASE): Promise<FetchedFiles> {
    const files = this.filesOf(releaseId);
    return { archive: await this.archiveFile(files.archive), dump: await this.dumpFile(files.dump) };
  }

  /** The checked archive of `releaseId`. */
  archive(releaseId: ReleaseId = MASTER_RELEASE): Promise<string> {
    return this.archiveFile(this.filesOf(releaseId).archive);
  }

  /** The checked dump `releaseId` was built from. */
  dump(releaseId: ReleaseId = MASTER_RELEASE): Promise<string> {
    return this.dumpFile(this.filesOf(releaseId).dump);
  }

  /**
   * The raw pages a measurement reads: what `RAW_PAGES` names, else the
   * master's dump from this cache. `openRawPages` itself never fetches, so
   * the seed and CI keep reading `fixtures/` on a fresh clone.
   */
  async rawPages(env: NodeJS.ProcessEnv = process.env): Promise<RawPageInput> {
    return env.RAW_PAGES === undefined ? openRawPages(env, await this.dump()) : openRawPages(env);
  }

  private filesOf(releaseId: ReleaseId): ChangeFiles {
    return releaseFiles(releaseId, this.catalog, this.dumps);
  }

  private archiveFile(archive: ArchiveFile): Promise<string> {
    return this.held(archive.path, (at) => archiveRefusal(archive, at));
  }

  private dumpFile(dump: DumpFile): Promise<string> {
    return this.held(dump.path, (at) => dumpRefusal(dump, at));
  }

  /** The cached copy of `path`, fetched first when it is not there; refused unless `refusal` finds nothing. */
  private async held(path: string, refusal: (at: string) => Promise<string | null>): Promise<string> {
    const at = join(this.root, path);
    if (await exists(at)) {
      const reason = await refusal(at);
      if (reason !== null) throw new DataRefused([`${at}, in the source cache: ${reason}. Remove it to fetch it again.`]);
      return at;
    }
    await mkdir(dirname(at), { recursive: true });
    const partial = `${at}.partial-${process.pid}`;
    try {
      await this.fetcher(path, partial);
      const reason = await refusal(partial);
      if (reason !== null) throw new DataRefused([reason]);
      await rename(partial, at);
      return at;
    } finally {
      await rm(partial, { force: true });
    }
  }
}

const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false);
