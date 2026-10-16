// `pnpm run load:wikidata-words`: bring an already seeded dictionary's
// Wikidata words in line with the committed snapshot
// (wikidata-words/wikidata-words.jsonl, ADR 0033, #812;
// loadWikidataWords.ts). It picks its database the way the seed does: the
// local D1 under `SEED_STATE` (default `.data/seed-state`), or the remote D1
// `SEED_REMOTE` names. The dictionary deploy workflow writes the shared
// dictionary, from a change declaration (ADR 0018); an agent runs this
// command against a local D1 only. `--plan-only` prints the plan's counts as
// JSON and writes nothing to the database (src/update/planOnly.ts). On a
// dictionary `update:upgrade` has not given the tables, it plans but refuses
// to write.

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { seedTargetFrom, webWrangler, type Wrangler } from "../import/seedTarget.js";
import { upgradeFirst } from "../update/master.js";
import { planOnlyAnswer, planOnlyFlag, planOnlyRun } from "../update/planOnly.js";
import { masterReaderOf } from "../update/updateCli.js";
import { missingForWikidataWords, planWikidataWords, unwrittenWikidataWords } from "./loadWikidataWords.js";
import type { WikidataWord } from "./wikidataWord.js";
import { readWordSnapshot } from "./wordSnapshot.js";

const USAGE = "usage: pnpm run load:wikidata-words [--out <dir>] [--plan-only]";

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export async function main(
  env: NodeJS.ProcessEnv = process.env,
  args: readonly string[] = [],
  wrangler: Wrangler = webWrangler,
  words?: readonly WikidataWord[],
): Promise<CommandResult> {
  const { planOnly, rest } = planOnlyFlag(args);
  const options = flags(rest, ["out"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const snapshot = words ?? (await readWordSnapshot());
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const plan = await planWikidataWords(reader, snapshot);
  log(`planning ${snapshot.length} Wikidata word(s) of the dump of ${plan.snapshot} for the master ${plan.masterReleaseId} in ${target.dictionary}`);
  const lines = [
    `written: ${plan.written.length}`,
    `left out, no Italian gloss: ${plan.unglossed.length}`,
    `left out, the dictionary already answers every spelling: ${plan.answered.length}`,
    `held but no longer in the snapshot, left serving: ${plan.absent.length}${plan.absent.length === 0 ? "" : ` (${plan.absent.join(", ")})`}`,
  ];
  const out = resolve(options.get("out") ?? ".data/updates");
  if (planOnly) {
    return planOnlyAnswer(planOnlyRun("load:wikidata-words", plan.counts, reader), plan.sql, out, `wikidata-words-${plan.masterReleaseId}`, {
      written: plan.written.length,
      unglossed: plan.unglossed.length,
      answered: plan.answered.length,
      absent: plan.absent.length,
    });
  }
  if (plan.sql === "") return { out: [`nothing to write in ${target.dictionary}`, ...lines].join("\n"), status: 0 };
  const needed = missingForWikidataWords(reader);
  if (needed.length > 0) return { out: upgradeFirst(target.dictionary, needed), status: 1 };

  await mkdir(out, { recursive: true });
  const file = join(out, `wikidata-words-${plan.masterReleaseId}-${Date.now()}.sql`);
  await writeFile(file, plan.sql);
  log(`writing the Wikidata words as one transaction: ${file}`);
  // One file, one transaction: if any statement fails, D1 leaves the master as it was.
  try {
    target.execute(["--file", file], false);
  } catch (error: unknown) {
    return { out: `the update did not run to its end, so D1 kept the master as it was (${error instanceof Error ? error.message : String(error)})`, status: 1 };
  }
  const left = unwrittenWikidataWords(reader, plan);
  if (left.length > 0) return { out: `the update ran, but these Wikidata words do not read back as planned: ${left.slice(0, 20).join(", ")}`, status: 1 };
  return { out: lines.join("\n"), status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.env, process.argv.slice(2)));
