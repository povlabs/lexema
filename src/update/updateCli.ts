// `pnpm run update:diff` and `pnpm run update:apply` (#18): compare a later
// kaikki archive with the master, and apply the changes a person chose. Both
// pick their database the way the seed does: the local D1 under `SEED_STATE`
// (default `.data/seed-state`), or the remote D1 `SEED_REMOTE` names. Both
// run from the laptop, through Wrangler, never through the Worker's read-only
// dictionary binding (ADR 0018). docs/UPDATE_THE_DICTIONARY.md is the runbook.
//
//   pnpm run update:upgrade
//   pnpm run update:diff <archive> [--out <dir>]
//   pnpm run update:apply <archive> <change id> [<change id> ...] [--out <dir>]
//
// `update:upgrade` gives a dictionary seeded before #18 the tables and views
// lookups now read (src/update/masterUpgrade.ts), and nothing else. Run it on
// such a dictionary before code that reads `served_release` serves from it.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, isMain, usageError, type CommandResult } from "../commandLine.js";
import { seedTargetFrom, webWrangler, type SeedTarget } from "../import/seedTarget.js";
import { ApplyRefused, checkApplied, chooseChanges, planApply } from "./apply.js";
import { diffAgainstMaster, reportMarkdown, reportOf } from "./diff.js";
import { readMasterRelease, type MasterReader } from "./master.js";
import { masterUpgradeSql } from "./masterUpgrade.js";

const USAGE = `usage:
  pnpm run update:upgrade [--out <dir>]
  pnpm run update:diff <archive> [--out <dir>]
  pnpm run update:apply <archive> <change id> [<change id> ...] [--out <dir>]
The database is the local D1 under SEED_STATE (default .data/seed-state), or the remote D1 SEED_REMOTE names.`;

const SCHEMA = resolve("src/db/schema.sql");

/** The master through Wrangler: each SELECT is one `d1 execute --command`. */
export function masterReaderOf(target: SeedTarget): MasterReader {
  return {
    query<Row>(sql: string): Row[] {
      const answers = JSON.parse(target.execute(["--json", "--command", sql], true)) as { results: Row[] }[];
      return answers.at(-1)?.results ?? [];
    },
  };
}

/** The positional arguments and the output directory, or what is wrong with the arguments. */
function readArguments(args: readonly string[]): { positional: string[]; out: string } | string {
  const positional: string[] = [];
  let out = resolve(".data/updates");
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out") {
      if (args[i + 1] === undefined) return "--out needs a directory";
      out = resolve(args[i + 1]);
      i += 1;
    } else if (args[i].startsWith("--")) {
      return `unknown argument ${args[i]}`;
    } else {
      positional.push(args[i]);
    }
  }
  return { positional, out };
}

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

async function diffCommand(target: SeedTarget, args: readonly string[]): Promise<CommandResult> {
  const read = readArguments(args);
  if (typeof read === "string") return usageError(read, USAGE);
  if (read.positional.length !== 1) return usageError("update:diff takes one archive and no change ids", USAGE);
  const archive = resolve(read.positional[0]);
  log(`reading the master in ${target.dictionary} and ${archive}; nothing is written to the database`);
  const report = await reportOf(await diffAgainstMaster(masterReaderOf(target), archive));
  await mkdir(read.out, { recursive: true });
  const base = join(read.out, `diff-${report.master.releaseId}-${report.feed.releaseId}`);
  await writeFile(`${base}.md`, reportMarkdown(report));
  await writeFile(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`);
  const { counts } = report;
  return {
    out:
      `${report.feed.releaseId} against ${report.master.releaseId}: ${counts.new} new, ${counts.changedSenses} with changed senses, ` +
      `${counts.changedElsewhere} changed elsewhere, ${counts.lost} lost, ${counts.ambiguous} ambiguous, ${counts.unchanged} unchanged\n` +
      `report: ${base}.md\n        ${base}.json`,
    status: 0,
  };
}

async function applyCommand(target: SeedTarget, args: readonly string[]): Promise<CommandResult> {
  const read = readArguments(args);
  if (typeof read === "string") return usageError(read, USAGE);
  const [given, ...ids] = read.positional;
  if (given === undefined) return usageError("name the later archive, then the change ids", USAGE);
  const archive = resolve(given);
  const reader = masterReaderOf(target);
  log(`reading the master in ${target.dictionary} and ${archive}`);
  const found = await diffAgainstMaster(reader, archive);
  let plan;
  try {
    plan = await planApply(reader, found, chooseChanges(found, ids), {
      schema: await readFile(SCHEMA, "utf8"),
      appliedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    if (error instanceof ApplyRefused) return { out: error.message, status: 1 };
    throw error;
  }
  await mkdir(read.out, { recursive: true });
  const file = join(read.out, `apply-${plan.masterReleaseId}-${plan.feedReleaseId}-${Date.now()}.sql`);
  await writeFile(file, plan.sql);
  log(`applying ${plan.changes.length} change(s) as one transaction: ${file}`);
  // One file, one transaction: if any statement fails, D1 leaves the master as it was.
  try {
    target.execute(["--file", file], false);
  } catch (error: unknown) {
    return {
      out: `the apply did not run to its end, so D1 kept the master as it was before it (${error instanceof Error ? error.message : String(error)})`,
      status: 1,
    };
  }
  const check = checkApplied(reader, plan);
  if (check.missing.length > 0 || check.differing.length > 0) {
    return {
      out:
        `the apply ran, but the master does not read back as planned: ` +
        JSON.stringify(check) +
        `\nsee "If an apply reads back wrong" in docs/UPDATE_THE_DICTIONARY.md`,
      status: 1,
    };
  }
  const lines = plan.changes.map(({ change, recordId }) =>
    `  ${change.id} ${change.kind} ${change.word} (${change.pos}): record ${recordId}` +
    (change.kind === "changed" ? `, replacing record ${change.master.recordId}` : ""),
  );
  const rows = Object.entries(plan.rows).map(([table, count]) => `  ${table}: ${count}`);
  return {
    out: [`applied ${plan.changes.length} change(s) from ${plan.feedReleaseId} to ${plan.masterReleaseId}:`, ...lines, "rows written:", ...rows].join("\n"),
    status: 0,
  };
}

async function upgradeCommand(target: SeedTarget, args: readonly string[]): Promise<CommandResult> {
  const read = readArguments(args);
  if (typeof read === "string") return usageError(read, USAGE);
  if (read.positional.length > 0) return usageError("update:upgrade takes no archive and no change ids", USAGE);
  const master = readMasterRelease(masterReaderOf(target));
  if (master.upgraded) return { out: `${target.dictionary} (master ${master.releaseId}) already has the tables and views for applied changes; nothing to do`, status: 0 };
  await mkdir(read.out, { recursive: true });
  const file = join(read.out, `upgrade-${master.releaseId}-${Date.now()}.sql`);
  await writeFile(file, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
  log(`adding the tables and views for applied changes: ${file}`);
  target.execute(["--file", file], false);
  if (!readMasterRelease(masterReaderOf(target)).upgraded) return { out: `the upgrade ran, but ${target.dictionary} still lacks its tables or views`, status: 1 };
  return { out: `${target.dictionary} (master ${master.releaseId}) has the tables and views for applied changes; no row was written`, status: 0 };
}

const COMMANDS = { upgrade: upgradeCommand, diff: diffCommand, apply: applyCommand } as const;

export async function main(argv: readonly string[]): Promise<CommandResult> {
  const [command, ...args] = argv;
  if (command === undefined || !Object.hasOwn(COMMANDS, command)) return usageError(`unknown command ${command ?? "(none)"}`, USAGE);
  const target = seedTargetFrom(process.env, webWrangler, resolve(".data/seed-state"));
  return COMMANDS[command as keyof typeof COMMANDS](target, args);
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
