// `pnpm run names:fetch`: ask Wikidata for every name category (ADR 0032,
// #794) and write the snapshot `names/wikidata-names.jsonl`. With
// `--category <id>` it asks for that one category and replaces only its items
// in the committed snapshot, so adding or refreshing one category leaves every
// other line as committed. It writes the file and nothing else: the
// dictionary changes only through a change declaration of `load:names`, which
// reads the committed snapshot.

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { isNameCategoryId, NAME_CATEGORIES } from "./nameCategories.js";
import { NAME_SNAPSHOT_PATH, readNameSnapshot, snapshotOf, snapshotText } from "./nameSnapshot.js";
import { fetchNameItems } from "./wikidataQuery.js";

const USAGE = "usage: pnpm run names:fetch [--category <id>]";

export async function main(args: readonly string[] = [], fetchImpl: typeof fetch = fetch, root: string = process.cwd()): Promise<CommandResult> {
  const options = flags(args, ["category"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const only = options.get("category");
  if (only !== undefined && !isNameCategoryId(only)) return usageError(`${only} is not a name category`, USAGE);
  const asked = NAME_CATEGORIES.filter((category) => only === undefined || category.id === only);
  const fetched = await fetchNameItems(fetchImpl, (line) => process.stderr.write(`${line}\n`), asked);
  // Every other category's items stay as committed.
  const kept = only === undefined ? [] : (await readNameSnapshot(root)).filter((item) => item.category !== only);
  const items = snapshotOf([...kept, ...fetched]);
  await writeFile(resolve(root, NAME_SNAPSHOT_PATH), snapshotText(items));
  return { out: `${items.length} name item(s) written to ${NAME_SNAPSHOT_PATH}`, status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
