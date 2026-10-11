// `pnpm run names:fetch`: ask Wikidata for every name category (ADR 0032,
// #794) and write the snapshot `names/wikidata-names.jsonl`. It writes the
// file and nothing else: the dictionary changes only through a change
// declaration of `load:names`, which reads the committed snapshot.

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { finish, isMain, usageError, type CommandResult } from "../commandLine.js";
import { NAME_SNAPSHOT_PATH, snapshotOf, snapshotText } from "./nameSnapshot.js";
import { fetchNameItems } from "./wikidataQuery.js";

const USAGE = "usage: pnpm run names:fetch";

export async function main(args: readonly string[] = [], fetchImpl: typeof fetch = fetch, root: string = process.cwd()): Promise<CommandResult> {
  if (args.length > 0) return usageError(`unknown argument ${args[0]}`, USAGE);
  const items = snapshotOf(await fetchNameItems(fetchImpl, (line) => process.stderr.write(`${line}\n`)));
  await writeFile(resolve(root, NAME_SNAPSHOT_PATH), snapshotText(items));
  return { out: `${items.length} name item(s) written to ${NAME_SNAPSHOT_PATH}`, status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
