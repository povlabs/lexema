// `pnpm run load:page-entries`: the update that loads the page-only entries
// (ADR 0024, ADR 0028) into an already seeded dictionary (loadPageEntries.ts,
// #440, #477). It picks its database the way the seed does: the local D1 under
// `SEED_STATE` (default `.data/seed-state`), or the remote D1 `SEED_REMOTE`
// names. It reads the archive the master was seeded from (`SEED_INPUT`,
// default `it-extract.jsonl.gz`), to check it is the master's and to know the
// words its records spell, and the dump that archive was built from
// (`RAW_PAGES`, default the dump in the repository root), held to its size and
// SHA-1. The dictionary deploy writes
// the shared dictionary from a change declaration (ADR 0018); an agent runs
// this command against a local D1 only. `--plan-only` prints the plan's counts
// as JSON and writes nothing to the database (src/update/planOnly.ts). See
// docs/PAGE_ENTRIES.md.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { sha256Of } from "../deploy/dataFiles.js";
import { CURATED_CORRECTIONS, type CuratedCorrection } from "../italian/curatedCorrections.js";
import { archiveFactsFor } from "../source/archiveFacts.js";
import { KNOWN_DUMPS, VerifiedDump } from "../source/wiktionaryDump.js";
import { changedUpgrade, readMasterRelease } from "../update/master.js";
import { planOnlyAnswer, planOnlyFlag, planOnlyRun } from "../update/planOnly.js";
import { masterReaderOf } from "../update/updateCli.js";
import { archiveWords, describePlannedEntry, findPageEntries, missingForLoad, planPageEntries, unloaded } from "./loadPageEntries.js";
import { seedTargetFrom, webWrangler, type Wrangler } from "./seedTarget.js";

const USAGE = "usage: pnpm run load:page-entries [--out <dir>] [--plan-only]";

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
  const master = readMasterRelease(reader);
  const archive = resolve(env.SEED_INPUT ?? "it-extract.jsonl.gz");
  const sha256 = await sha256Of(archive);
  if (sha256 !== master.archiveSha256) {
    return { out: `${archive} has SHA-256 ${sha256}; the master ${master.releaseId} was seeded from ${master.archiveSha256}. Nothing was written.`, status: 1 };
  }
  const dumpId = archiveFactsFor(sha256)?.dump.id;
  const identity = dumpId === undefined || !Object.hasOwn(KNOWN_DUMPS, dumpId) ? undefined : KNOWN_DUMPS[dumpId];
  if (identity === undefined) return { out: `no dump is known for the master ${master.releaseId}. Nothing was written.`, status: 1 };
  const dumpPath = resolve(env.RAW_PAGES ?? identity.file);
  log(`reading ${dumpPath} for the page-only entries of the master ${master.releaseId} in ${target.dictionary}`);

  const spelled = await archiveWords(archive);
  const dump = await VerifiedDump.open(dumpPath, identity);
  let found;
  try {
    found = await findPageEntries(dump.pages(), spelled);
  } finally {
    await dump.close();
  }
  const plan = planPageEntries(reader, found, corrections);
  const lines = [
    ...plan.entries.map(describePlannedEntry),
    ...plan.corrections.map(({ id, title, entryId }) => `  ${id} ${title} (entry ${entryId}): corrected definition written`),
  ];
  const summary = `the rule reads ${found.length} entr${found.length === 1 ? "y" : "ies"} off the pages whose title no record of ${master.releaseId}'s archive spells`;
  const out = resolve(options.get("out") ?? ".data/updates");
  if (planOnly) {
    return planOnlyAnswer(planOnlyRun("load:page-entries", plan.counts, reader), plan.sql, out, `page-entries-${plan.masterReleaseId}`, {
      found: found.length,
      entries: lines.map((line) => line.trim()),
    });
  }
  if (plan.sql === "") return { out: [`${summary}; nothing to write in ${target.dictionary}`, ...lines].join("\n"), status: 0 };
  const missing = missingForLoad(reader);
  if (missing.length > 0) return { out: `${target.dictionary} lacks ${missing.join(", ")}; run pnpm run update:upgrade first. Nothing was written.`, status: 1 };
  // A table stored with an older definition, such as rule v1's verb-only recovered_entry, refuses the entries rule v2 reads.
  const changed = changedUpgrade(reader, await readFile(resolve("src/db/schema.sql"), "utf8"));
  if (changed.length > 0) return { out: `${target.dictionary} stores ${changed.join(", ")} unlike schema.sql; run pnpm run update:upgrade first. Nothing was written.`, status: 1 };

  await mkdir(out, { recursive: true });
  const file = join(out, `page-entries-${plan.masterReleaseId}-${Date.now()}.sql`);
  await writeFile(file, plan.sql);
  const writes = plan.entries.filter((planned) => planned.state === "write").length;
  log(`writing ${writes} page-only entr${writes === 1 ? "y" : "ies"} as one transaction: ${file}`);
  // One file, one transaction: if any statement fails, D1 leaves the master as it was.
  try {
    target.execute(["--file", file], false);
  } catch (error: unknown) {
    return { out: `the update did not run to its end, so D1 kept the master as it was (${error instanceof Error ? error.message : String(error)})`, status: 1 };
  }
  const left = unloaded(reader, plan);
  if (left.length > 0) return { out: `the update ran, but these entries do not read back as written: ${left.join(", ")}`, status: 1 };
  return { out: [`${summary}; written now: ${writes}`, ...lines].join("\n"), status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.env, process.argv.slice(2)));
