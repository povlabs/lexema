// Seeded development states kept for reuse (#843). `pnpm run seed:dev` takes
// tens of seconds, and its result is decided by its inputs alone: the seed's
// code, the committed fixtures, the Wrangler config and dependency versions,
// the raw pages it reads, and the `SEED_*` and `RAW_PAGES` settings. A
// `SeedInputs` digest names those inputs, and `SeededStates` keeps one seeded
// state per digest. Each caller gets its own copy, so no two Wrangler runs ever
// share a state; a state is seeded again only when a digest has none.
//
// A state is seeded into a temporary directory beside the kept ones and
// renamed into place only once the seed succeeds, so a failed or half-done
// seed is never where the next run looks. Two runs that seed the same digest
// at once both finish; the first rename wins and the other copy is dropped.

import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, utimes } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { ARCHIVE_DUMP } from "../source/wiktionaryDump.js";

/** Directories whose every file the seed may read, relative to the checkout. */
const INPUT_DIRECTORIES = ["src", "fixtures"] as const;
/** Single files the seed reads: the D1 config, and the versions of Wrangler and tsx. */
const INPUT_FILES = ["web/wrangler.jsonc", "package.json", "pnpm-lock.yaml"] as const;
/** Settings `seedDev.ts` and `openRawPages` read, beside `SEED_SQL` and `SEED_STATE`, which name where it writes. */
const INPUT_SETTINGS = ["SEED_INPUT", "SEED_RELEASE", "SEED_PART_BYTES", "RAW_PAGES"] as const;
/** The cached dump `openRawPages` reads when no setting names another (`.data/source/`). */
const DEFAULT_DUMP = join(".data", "source", ARCHIVE_DUMP.file);

/** A kept state unused for this long is removed when a new one is kept. */
export const UNUSED_STATE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const hex = /^[0-9a-f]{64}$/;

/** The SHA-256 digest of everything a development seed's result depends on. */
export class SeedInputs {
  private constructor(readonly digest: string) {}

  /**
   * The inputs of a seed run from `checkout` under `env`. A file is named by its
   * path and content; the large dump only by its path, size and modified time,
   * since `openRawPages` checks its identity on every read.
   */
  static async of(checkout: string, env: NodeJS.ProcessEnv): Promise<SeedInputs> {
    if (env.SEED_REMOTE !== undefined) throw new Error("SEED_REMOTE seeds a remote D1, which leaves no local state to keep");
    const hash = createHash("sha256");
    const files = [
      ...(await Promise.all(INPUT_DIRECTORIES.map((directory) => filesUnder(checkout, directory)))).flat(),
      ...INPUT_FILES,
    ].sort();
    for (const file of files) {
      hash.update(`file\0${file}\0`);
      hash.update(createHash("sha256").update(await readFile(join(checkout, file))).digest("hex"));
      hash.update("\n");
    }
    for (const name of INPUT_SETTINGS) hash.update(`setting\0${name}\0${env[name] ?? "\u0000unset"}\n`);
    const dump = await stat(join(checkout, DEFAULT_DUMP)).catch(() => undefined);
    hash.update(dump === undefined ? "dump\0absent\n" : `dump\0${dump.size}\0${dump.mtimeMs}\n`);
    return new SeedInputs(hash.digest("hex"));
  }

  /** A digest read back from a kept state's name. */
  static fromDigest(digest: string): SeedInputs | undefined {
    return hex.test(digest) ? new SeedInputs(digest) : undefined;
  }
}

/** Every file under `directory` of `checkout`, as a `/`-separated path relative to `checkout`. */
async function filesUnder(checkout: string, directory: string): Promise<string[]> {
  const entries = await readdir(join(checkout, directory), { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(checkout, join(entry.parentPath, entry.name)).split(sep).join("/"));
}

/** Seeds a fresh local state into `state`, which does not exist yet; throws when the seed fails. */
export type Seeder = (state: string, scratch: string) => Promise<void>;

/** Whether a state for the inputs was already kept, or was seeded by this run. */
export type StateOrigin = "reused" | "seeded";

/** Seeded states kept under one directory, one per `SeedInputs` digest. */
export class SeededStates {
  constructor(
    readonly root: string,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Copy the kept state for `inputs` to `destination`, seeding it first when
   * none is kept. `destination` must not exist; it becomes the caller's own.
   */
  async copyTo(inputs: SeedInputs, destination: string, seed: Seeder): Promise<StateOrigin> {
    const kept = this.pathOf(inputs);
    const origin: StateOrigin = (await isDirectory(kept)) ? "reused" : await this.seedInto(kept, seed);
    const at = new Date(this.now());
    await utimes(kept, at, at);
    await cp(kept, destination, { recursive: true, errorOnExist: true, force: false });
    return origin;
  }

  private pathOf(inputs: SeedInputs): string {
    return join(this.root, inputs.digest);
  }

  private async seedInto(kept: string, seed: Seeder): Promise<StateOrigin> {
    await mkdir(this.root, { recursive: true });
    const work = await mkdtemp(join(this.root, ".seeding-"));
    try {
      const state = join(work, "state");
      await seed(state, work);
      try {
        await rename(state, kept);
      } catch (error: unknown) {
        // Another run kept a state for these inputs first; it is the same state.
        if (!(await isDirectory(kept))) throw error;
        return "reused";
      }
    } finally {
      await rm(work, { recursive: true, force: true });
    }
    await this.removeUnused();
    return "seeded";
  }

  /**
   * Remove kept states unused for `UNUSED_STATE_LIFETIME_MS`, and seeds that
   * old a killed run left behind; no run reads either.
   */
  private async removeUnused(): Promise<void> {
    for (const name of await readdir(this.root)) {
      if (SeedInputs.fromDigest(name) === undefined && !name.startsWith(".seeding-")) continue;
      const path = join(this.root, name);
      const { mtimeMs } = await stat(path);
      if (this.now() - mtimeMs > UNUSED_STATE_LIFETIME_MS) await rm(path, { recursive: true, force: true });
    }
  }
}

const isDirectory = (path: string): Promise<boolean> => stat(path).then((s) => s.isDirectory(), () => false);
