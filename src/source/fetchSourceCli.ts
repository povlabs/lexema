// `pnpm run source:fetch [--release <id>]`: fill the source cache,
// `.data/source/`, with a release's archive and dump from `povlabs/lexema-data`,
// checked, and print where they are (src/source/sourceCache.ts, #606). Every
// command that reads them does this on first use; this is for a command that
// only reads a path it is given, such as `seed:dev` with `SEED_INPUT`.

import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { DataRefused } from "../deploy/dataFiles.js";
import { RELEASE_ID, type ReleaseId } from "../update/declaration.js";
import { MASTER_RELEASE, SourceCache } from "./sourceCache.js";

const USAGE = "usage: pnpm run source:fetch [--release <it-xxxxxxxx>]";

export async function main(args: readonly string[] = [], source: SourceCache = new SourceCache()): Promise<CommandResult> {
  const options = flags(args, ["release"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const release = options.get("release") ?? MASTER_RELEASE;
  if (!RELEASE_ID.test(release)) return usageError(`${release} is not a release id`, USAGE);
  try {
    const files = await source.files(release as ReleaseId);
    return { out: `${release}\narchive ${files.archive}\ndump ${files.dump}`, status: 0 };
  } catch (error: unknown) {
    if (error instanceof DataRefused) return { out: error.message, status: 1 };
    throw error;
  }
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
