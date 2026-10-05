// The source cache (#606): a release's archive and dump, fetched from a
// made-up `povlabs/lexema-data` into `.data/source/` once, held to the deploy's
// checks fresh or cached, and never left at the cache path when they fail.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { type DataFetcher, DataRefused } from "../src/deploy/dataFiles.js";
import type { ArchiveFactsCatalog } from "../src/source/archiveFacts.js";
import { main as fetchMain } from "../src/source/fetchSourceCli.js";
import { MASTER_RELEASE, SourceCache } from "../src/source/sourceCache.js";
import { ARCHIVE_DUMP, openRawPages } from "../src/source/wiktionaryDump.js";

const ARCHIVE = Buffer.from('{"word":"casa"}\n');
const DUMP = Buffer.from("<mediawiki></mediawiki>\n");
const DUMP_ID = "itwiktionary-20991001";
const DUMP_FILE = `${DUMP_ID}-pages-articles.xml.bz2`;

/** A made-up data repository, the catalogs naming its one release, and a fetcher that counts what it is asked for. */
async function world(dir: string) {
  const data = join(dir, "lexema-data");
  const sha256 = createHash("sha256").update(ARCHIVE).digest("hex");
  const releaseId = `it-${sha256.slice(0, 8)}` as const;
  await mkdir(join(data, "source"), { recursive: true });
  await writeFile(join(data, "source", `${releaseId}.jsonl.gz`), ARCHIVE);
  await writeFile(join(data, "source", DUMP_FILE), DUMP);
  const catalog = {
    [sha256]: { sourceUrl: "https://example.invalid/it-extract.jsonl.gz", retrievedAt: "2099-10-02T00:00:00Z", dump: { id: DUMP_ID, basis: "recorded" }, evidence: [] },
  } as unknown as ArchiveFactsCatalog;
  const dumps = { [DUMP_ID]: { file: DUMP_FILE, bytes: DUMP.length, sha1: createHash("sha1").update(DUMP).digest("hex") } };
  const asked: string[] = [];
  const fetcher: DataFetcher = async (path, to) => {
    asked.push(path);
    await mkdir(dirname(to), { recursive: true });
    await copyFile(join(data, path), to);
  };
  const root = join(dir, ".data");
  return { data, releaseId, asked, root, cache: new SourceCache({ root, fetcher, catalog, dumps }) };
}

async function inTemp(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-source-cache-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("a cache miss fetches the archive and the dump once; a hit fetches nothing", () =>
  inTemp(async (dir) => {
    const { releaseId, asked, root, cache } = await world(dir);
    const fetched = await cache.files(releaseId);
    assert.deepEqual(fetched, { archive: join(root, "source", `${releaseId}.jsonl.gz`), dump: join(root, "source", DUMP_FILE) });
    assert.deepEqual(asked, [`source/${releaseId}.jsonl.gz`, `source/${DUMP_FILE}`]);
    assert.deepEqual(await readFile(fetched.archive), ARCHIVE);

    assert.deepEqual(await cache.files(releaseId), fetched);
    assert.equal(await cache.archive(releaseId), fetched.archive);
    assert.equal(await cache.dump(releaseId), fetched.dump);
    assert.equal(asked.length, 2);
    assert.deepEqual((await readdir(join(root, "source"))).sort(), [`${releaseId}.jsonl.gz`, DUMP_FILE].sort());
  }));

test("a fetched file with the wrong SHA-256, size or SHA-1 is refused and not left in the cache", () =>
  inTemp(async (dir) => {
    const { data, releaseId, root, cache } = await world(dir);
    const archive = join(data, "source", `${releaseId}.jsonl.gz`);
    const dump = join(data, "source", DUMP_FILE);
    const wrongSha1 = Buffer.from(DUMP.toString("utf8").replace("wiki", "WIKI"));
    assert.equal(wrongSha1.length, DUMP.length);
    for (const [path, bytes, why, fetch] of [
      [archive, Buffer.from("not the archive\n"), /has SHA-256/, () => cache.archive(releaseId)],
      [dump, Buffer.from("short\n"), /is not itwiktionary-20991001/, () => cache.dump(releaseId)],
      [dump, wrongSha1, /expected SHA-1/, () => cache.dump(releaseId)],
    ] as const) {
      const original = await readFile(path);
      await writeFile(path, bytes);
      await assert.rejects(fetch(), (error: unknown) => error instanceof DataRefused && why.test(error.message));
      await writeFile(path, original);
      // Nothing is left behind, under the cache name or the temporary one.
      assert.deepEqual(existsSync(join(root, "source")) ? await readdir(join(root, "source")) : [], []);
    }
    // With the right bytes back, the next run fetches and passes.
    await cache.files(releaseId);
  }));

test("a cached file that fails its check is refused, not trusted, and left for a person to remove", () =>
  inTemp(async (dir) => {
    const { releaseId, asked, root, cache } = await world(dir);
    await cache.files(releaseId);
    const cached = join(root, "source", `${releaseId}.jsonl.gz`);
    await writeFile(cached, "changed in place\n");
    await assert.rejects(cache.archive(releaseId), (error: unknown) => error instanceof DataRefused && /in the source cache: .*has SHA-256/.test(error.message));
    assert.equal(await readFile(cached, "utf8"), "changed in place\n");
    assert.equal(asked.length, 2);
  }));

test("openRawPages reads the master's dump from the cache when it is there, else fixtures/, and never fetches", () =>
  inTemp(async (dir) => {
    const here = process.cwd();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => assert.fail("openRawPages fetched")) as typeof fetch;
    try {
      await symlink(join(here, "fixtures"), join(dir, "fixtures"));
      process.chdir(dir);
      assert.equal((await openRawPages({})).described, `fixtures ${join(process.cwd(), "fixtures")}`);
      await mkdir(join(dir, ".data", "source"), { recursive: true });
      await writeFile(join(dir, ".data", "source", ARCHIVE_DUMP.file), "not the dump\n");
      await assert.rejects(openRawPages({}), new RegExp(`${join(".data", "source", ARCHIVE_DUMP.file)} is not the expected dump`));
    } finally {
      process.chdir(here);
      globalThis.fetch = realFetch;
    }
  }));

test("with no release named, the cache reads the master's archive and dump from lexema-data's source/", () =>
  inTemp(async (dir) => {
    assert.equal(MASTER_RELEASE, "it-0c432803");
    const asked: string[] = [];
    const cache = new SourceCache({
      root: join(dir, ".data"),
      fetcher: async (path) => {
        asked.push(path);
        throw new DataRefused([`offline: ${path}`]);
      },
    });
    await assert.rejects(cache.archive(), DataRefused);
    await assert.rejects(cache.dump(), DataRefused);
    assert.deepEqual(asked, ["source/it-extract.jsonl.gz", `source/${ARCHIVE_DUMP.file}`]);
    assert.deepEqual(await readdir(join(dir, ".data", "source")), []);
  }));

test("source:fetch fills the cache for a release and prints where its files are", () =>
  inTemp(async (dir) => {
    const { releaseId, root, cache } = await world(dir);
    assert.deepEqual(await fetchMain(["--release", releaseId], cache), {
      out: `${releaseId}\narchive ${join(root, "source", `${releaseId}.jsonl.gz`)}\ndump ${join(root, "source", DUMP_FILE)}`,
      status: 0,
    });
    assert.equal((await fetchMain(["--release", "casa"], cache)).status, 1);
    assert.match((await fetchMain(["--release", "it-00000000"], cache)).out, /no archive facts name release it-00000000/);
  }));
