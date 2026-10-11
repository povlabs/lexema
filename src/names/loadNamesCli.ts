// `pnpm run load:names`: bring an already seeded dictionary's name entries in
// line with the committed Wikidata snapshot (names/wikidata-names.jsonl, ADR
// 0032, #794; loadNames.ts). It picks its database the way the seed does: the
// local D1 under `SEED_STATE` (default `.data/seed-state`), or the remote D1
// `SEED_REMOTE` names. The dictionary deploy workflow writes the shared
// dictionary, from a change declaration (ADR 0018); an agent runs this command
// against a local D1 only. `--plan-only` prints the plan's counts as JSON and
// writes nothing to the database (src/update/planOnly.ts). On a dictionary
// `update:upgrade` has not given `name_entry`, it plans but refuses to write.

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { seedTargetFrom, webWrangler, type Wrangler } from "../import/seedTarget.js";
import { upgradeFirst } from "../update/master.js";
import { planOnlyAnswer, planOnlyFlag, planOnlyRun } from "../update/planOnly.js";
import { masterReaderOf } from "../update/updateCli.js";
import { missingForNames, planNames, unwrittenNames } from "./loadNames.js";
import type { NameItem } from "./nameItem.js";
import { readNameSnapshot } from "./nameSnapshot.js";

const USAGE = "usage: pnpm run load:names [--out <dir>] [--plan-only]";

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export async function main(
  env: NodeJS.ProcessEnv = process.env,
  args: readonly string[] = [],
  wrangler: Wrangler = webWrangler,
  names?: readonly NameItem[],
): Promise<CommandResult> {
  const { planOnly, rest } = planOnlyFlag(args);
  const options = flags(rest, ["out"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const snapshot = names ?? (await readNameSnapshot());
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const plan = planNames(reader, snapshot);
  log(`planning ${snapshot.length} Wikidata name(s) for the master ${plan.masterReleaseId} in ${target.dictionary}`);
  const lines = [
    `written: ${plan.written.length}`,
    `removed: ${plan.removed.length}`,
    `left out, Wiktionary already gives the label a meaning: ${plan.explained.length}`,
  ];
  const out = resolve(options.get("out") ?? ".data/updates");
  if (planOnly) {
    return planOnlyAnswer(planOnlyRun("load:names", plan.counts, reader), plan.sql, out, `names-${plan.masterReleaseId}`, {
      written: plan.written.length,
      removed: plan.removed.length,
      explained: plan.explained.length,
    });
  }
  if (plan.sql === "") return { out: [`nothing to write in ${target.dictionary}`, ...lines].join("\n"), status: 0 };
  const needed = missingForNames(reader);
  if (needed.length > 0) return { out: upgradeFirst(target.dictionary, needed), status: 1 };

  await mkdir(out, { recursive: true });
  const file = join(out, `names-${plan.masterReleaseId}-${Date.now()}.sql`);
  await writeFile(file, plan.sql);
  log(`writing the name entries as one transaction: ${file}`);
  // One file, one transaction: if any statement fails, D1 leaves the master as it was.
  try {
    target.execute(["--file", file], false);
  } catch (error: unknown) {
    return { out: `the update did not run to its end, so D1 kept the master as it was (${error instanceof Error ? error.message : String(error)})`, status: 1 };
  }
  const left = unwrittenNames(reader, plan);
  if (left.length > 0) return { out: `the update ran, but these name entries do not read back as planned: ${left.slice(0, 20).join(", ")}`, status: 1 };
  return { out: lines.join("\n"), status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.env, process.argv.slice(2)));
