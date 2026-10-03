// `pnpm run correct:records`: the one-off update that writes the curated
// corrections (src/italian/curatedCorrections.ts, #420, #450) into an already seeded
// dictionary (correctRecords.ts). It picks its database the way the seed does:
// the local D1 under `SEED_STATE` (default `.data/seed-state`), or the remote
// D1 `SEED_REMOTE` names. The shared dictionary is Huey's to write, from his
// laptop, never an agent's (ADR 0018). See docs/RUN_AN_IMPORT.md.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, isMain, type CommandResult } from "../commandLine.js";
import { CURATED_CORRECTIONS } from "../italian/curatedCorrections.js";
import { masterReaderOf } from "../update/updateCli.js";
import { describeDefinition, describeEntry, planCorrections, unwritten } from "./correctRecords.js";
import { seedTargetFrom, webWrangler } from "./seedTarget.js";

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<CommandResult> {
  const target = seedTargetFrom(env, webWrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const plan = planCorrections(reader, CURATED_CORRECTIONS, await readFile(resolve("src/db/schema.sql"), "utf8"));
  log(`planning ${CURATED_CORRECTIONS.length} curated correction(s) for the master ${plan.masterReleaseId} in ${target.dictionary}`);
  const lines = [...plan.entries.map(describeEntry), ...plan.definitions.map(describeDefinition)];
  const writes = [...plan.entries, ...plan.definitions].filter((entry) => entry.state === "write").length;
  if (plan.sql === "") return { out: [`nothing to write in ${target.dictionary}`, ...lines].join("\n"), status: 0 };

  const out = resolve(".data/updates");
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

if (isMain(import.meta.url)) finish(await main());
