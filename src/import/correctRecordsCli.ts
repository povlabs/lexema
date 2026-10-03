// `pnpm run correct:records`: the one-off update that writes the curated
// corrections (src/italian/curatedCorrections.ts, #420, #450) into an already seeded
// dictionary (correctRecords.ts). It picks its database the way the seed does:
// the local D1 under `SEED_STATE` (default `.data/seed-state`), or the remote
// D1 `SEED_REMOTE` names. The dictionary deploy workflow writes the shared
// dictionary, from a change declaration (#490, ADR 0018); an agent runs this
// command against a local D1 only. `--plan-only` prints the plan's counts as
// JSON and writes nothing to the database (src/update/planOnly.ts). See
// docs/RUN_AN_IMPORT.md.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { CURATED_CORRECTIONS, type CuratedCorrection } from "../italian/curatedCorrections.js";
import { planOnlyAnswer, planOnlyFlag, planOnlyRun } from "../update/planOnly.js";
import { masterReaderOf } from "../update/updateCli.js";
import { describeDefinition, describeEntry, planCorrections, unwritten } from "./correctRecords.js";
import { seedTargetFrom, webWrangler, type Wrangler } from "./seedTarget.js";

const USAGE = "usage: pnpm run correct:records [--out <dir>] [--plan-only]";

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export async function main(
  env: NodeJS.ProcessEnv = process.env,
  args: readonly string[] = [],
  wrangler: Wrangler = webWrangler,
  corrections: readonly CuratedCorrection[] = CURATED_CORRECTIONS,
): Promise<CommandResult> {
  const { planOnly, rest } = planOnlyFlag(args);
  const options = flags(rest, ["out"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const plan = planCorrections(reader, corrections, await readFile(resolve("src/db/schema.sql"), "utf8"));
  log(`planning ${corrections.length} curated correction(s) for the master ${plan.masterReleaseId} in ${target.dictionary}`);
  const lines = [...plan.entries.map(describeEntry), ...plan.definitions.map(describeDefinition)];
  const out = resolve(options.get("out") ?? ".data/updates");
  if (planOnly) {
    return planOnlyAnswer(planOnlyRun("correct:records", plan.counts, reader), plan.sql, out, `correct-${plan.masterReleaseId}`, {
      entries: lines.map((line) => line.trim()),
    });
  }
  const writes = [...plan.entries, ...plan.definitions].filter((entry) => entry.state === "write").length;
  if (plan.sql === "") return { out: [`nothing to write in ${target.dictionary}`, ...lines].join("\n"), status: 0 };

  await mkdir(out, { recursive: true });
  const file = join(out, `correct-${plan.masterReleaseId}-${Date.now()}.sql`);
  await writeFile(file, plan.sql);
  log(`writing ${writes} correction(s) as one transaction: ${file}`);
  // One file, one transaction: if any statement fails, D1 leaves the master as it was.
  try {
    target.execute(["--file", file], false);
  } catch (error: unknown) {
    return { out: `the update did not run to its end, so D1 kept the master as it was (${error instanceof Error ? error.message : String(error)})`, status: 1 };
  }
  const left = unwritten(reader, plan);
  if (left.length > 0) return { out: `the update ran, but these corrections do not read back as written: ${left.join(", ")}`, status: 1 };
  return { out: [`written now: ${writes}`, ...lines].join("\n"), status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.env, process.argv.slice(2)));
