// `pnpm run load:recovered-definitions`: the update that writes the definitions
// a section states outside its `#` list — `*` bullet lines and plain prose
// lines under the part-of-speech heading (ADR 0029) — into an already seeded
// dictionary (loadRecoveredDefinitions.ts, #706), and removes the recovered
// definitions a seed wrote onto a record from another record's verb-type part
// (#775). It picks its database the way
// the seed does: the local D1 under `SEED_STATE` (default `.data/seed-state`),
// or the remote D1 `SEED_REMOTE` names. It reads the archive the master was
// seeded from (`SEED_INPUT`, default the master's archive in `.data/source/`),
// checked against the master, for its records, and the dump that archive was
// built from (`RAW_PAGES`, default its copy in `.data/source/`), held to its
// size and SHA-1. A file the cache lacks is fetched from `povlabs/lexema-data`
// (src/source/sourceCache.ts). The dictionary deploy writes the shared
// dictionary from a change declaration (ADR 0018); an agent runs this command
// against a local D1 only. `--plan-only` prints the plan's counts and every
// definition as JSON and writes nothing to the database
// (src/update/planOnly.ts). See docs/DEPLOY.md.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { sha256Of } from "../deploy/dataFiles.js";
import { archiveFactsFor } from "../source/archiveFacts.js";
import { releaseIdOf } from "../source/servedRelease.js";
import { SourceCache } from "../source/sourceCache.js";
import { KNOWN_DUMPS, VerifiedDump } from "../source/wiktionaryDump.js";
import { readMasterRelease, upgradeFirst } from "../update/master.js";
import { planOnlyAnswer, planOnlyFlag, planOnlyRun } from "../update/planOnly.js";
import { masterReaderOf } from "../update/updateCli.js";
import {
  changedForLoad,
  describePlannedRecord,
  findRuledDefinitions,
  pagesForTheRules,
  planRecoveredDefinitions,
  unwrittenDefinitions,
} from "./loadRecoveredDefinitions.js";
import { seedTargetFrom, webWrangler, type Wrangler } from "./seedTarget.js";

const USAGE = "usage: pnpm run load:recovered-definitions [--out <dir>] [--plan-only]";

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export async function main(
  env: NodeJS.ProcessEnv = process.env,
  args: readonly string[] = [],
  wrangler: Wrangler = webWrangler,
  source: SourceCache = new SourceCache(),
): Promise<CommandResult> {
  const { planOnly, rest } = planOnlyFlag(args);
  const options = flags(rest, ["out"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const master = readMasterRelease(reader);
  const release = releaseIdOf(master.archiveSha256);
  const archive = env.SEED_INPUT === undefined ? await source.archive(release) : resolve(env.SEED_INPUT);
  const sha256 = await sha256Of(archive);
  if (sha256 !== master.archiveSha256) {
    return { out: `${archive} has SHA-256 ${sha256}; the master ${master.releaseId} was seeded from ${master.archiveSha256}. Nothing was written.`, status: 1 };
  }
  const dumpId = archiveFactsFor(sha256)?.dump.id;
  const identity = dumpId === undefined || !Object.hasOwn(KNOWN_DUMPS, dumpId) ? undefined : KNOWN_DUMPS[dumpId];
  if (identity === undefined) return { out: `no dump is known for the master ${master.releaseId}. Nothing was written.`, status: 1 };
  const dumpPath = env.RAW_PAGES === undefined ? await source.dump(release) : resolve(env.RAW_PAGES);
  log(`reading ${dumpPath} for the bullet and prose lines and the split verb sections of the master ${master.releaseId}'s records in ${target.dictionary}`);

  const dump = await VerifiedDump.open(dumpPath, identity);
  let pages;
  try {
    pages = await pagesForTheRules(dump.pages());
  } finally {
    await dump.close();
  }
  const found = await findRuledDefinitions(archive, pages);
  const plan = planRecoveredDefinitions(reader, found);
  const lines = plan.records.flatMap(describePlannedRecord);
  const summary = `the rules read ${lines.length} definition(s) for ${found.length} record(s) of ${master.releaseId}`;
  const out = resolve(options.get("out") ?? ".data/updates");
  if (planOnly) {
    return planOnlyAnswer(planOnlyRun("load:recovered-definitions", plan.counts, reader), plan.sql, out, `recovered-definitions-${plan.masterReleaseId}`, {
      records: found.length,
      definitions: lines,
    });
  }
  if (plan.sql === "") return { out: [`${summary}; nothing to write in ${target.dictionary}`, ...lines].join("\n"), status: 0 };
  const changed = changedForLoad(reader, await readFile(resolve("src/db/schema.sql"), "utf8"));
  if (changed.length > 0) return { out: upgradeFirst(target.dictionary, changed), status: 1 };

  await mkdir(out, { recursive: true });
  const file = join(out, `recovered-definitions-${plan.masterReleaseId}-${Date.now()}.sql`);
  await writeFile(file, plan.sql);
  log(`writing ${plan.counts.written.recovered_definition ?? 0} recovered definition(s) and removing ${plan.counts.deleted.recovered_definition ?? 0} as one transaction: ${file}`);
  // One file, one transaction: if any statement fails, D1 leaves the master as it was.
  try {
    target.execute(["--file", file], false);
  } catch (error: unknown) {
    return { out: `the update did not run to its end, so D1 kept the master as it was (${error instanceof Error ? error.message : String(error)})`, status: 1 };
  }
  const left = unwrittenDefinitions(reader, plan);
  if (left.length > 0) return { out: `the update ran, but these definitions do not read back as written or removed: ${left.join(", ")}`, status: 1 };
  return { out: [`${summary}; written now: ${plan.counts.written.recovered_definition ?? 0}, removed now: ${plan.counts.deleted.recovered_definition ?? 0}`, ...lines].join("\n"), status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.env, process.argv.slice(2)));
