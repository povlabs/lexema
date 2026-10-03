// Update operations compare a later archive with the currently served master.
// update:auto selects and applies eligible definitions under ADR 0025. All
// pick their database the way the seed does: the local D1 under `SEED_STATE`
// (default `.data/seed-state`), or the remote D1 `SEED_REMOTE` names. All
// run from the laptop, through Wrangler, never through the Worker's read-only
// dictionary binding (ADR 0018). docs/UPDATE_THE_DICTIONARY.md is the runbook.
//
//   pnpm run update:auto <archive> --pages <dump> [--out <dir>]
//   pnpm run update:upgrade
//   pnpm run update:diff <archive> [--out <dir>]
//   pnpm run update:select <archive> --pages <dump> [--out <dir>]
//   pnpm run update:apply <archive> <change id> [<change id> ...] [--out <dir>]
//   pnpm run update:apply <archive> --ids <file> [--out <dir>]
//
// `update:select` sorts the diff's changes by feed-selection/v4
// (src/update/selection.ts) and writes the ids it takes to a file that
// `update:apply --ids` reads.
//
// `update:upgrade` gives a dictionary seeded from an older schema.sql the
// tables and views lookups now read (src/update/masterUpgrade.ts): the update
// tables and views of #18, and the page-entry tables of #403, created empty.
// It writes no row. Run it on such a dictionary before code that reads them
// serves from it.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, isMain, usageError, type CommandResult } from "../commandLine.js";
import { seedTargetFrom, webWrangler, type SeedTarget } from "../import/seedTarget.js";
import { ApplyRefused, checkApplied, chooseChanges, planApply, type ApplyPlan } from "./apply.js";
import { diffAgainstMaster, reportMarkdown, reportOf } from "./diff.js";
import { missingUpgrade, readMasterRelease, type MasterReader } from "./master.js";
import { masterUpgradeSql } from "./masterUpgrade.js";
import { automaticPlan } from "./automatic.js";
import { selectChanges, selectionIds, selectionMarkdown, withFeedDump } from "./select.js";

const USAGE = `usage:
  pnpm run update:auto <archive> --pages <dump the archive was built from> [--out <dir>]
  pnpm run update:upgrade [--out <dir>]
  pnpm run update:diff <archive> [--out <dir>]
  pnpm run update:select <archive> --pages <dump the archive was built from> [--out <dir>]
  pnpm run update:apply <archive> <change id> [<change id> ...] [--out <dir>]
  pnpm run update:apply <archive> --ids <file of change ids> [--out <dir>]
The database is the local D1 under SEED_STATE (default .data/seed-state), or the remote D1 SEED_REMOTE names.`;

const SCHEMA = resolve("src/db/schema.sql");
/** The dump's language headings, which #29's rule reads (src/italian/sectionLanguage.ts). */
const LANGUAGES = resolve("fixtures/section-language/regressions.json");

/** The master through Wrangler: each SELECT is one `d1 execute --command`. */
export function masterReaderOf(target: SeedTarget): MasterReader {
  return {
    query<Row>(sql: string): Row[] {
      const answers = JSON.parse(target.execute(["--json", "--command", sql], true)) as { results: Row[] }[];
      return answers.at(-1)?.results ?? [];
    },
  };
}

/** The options a command takes, each with a path after it. */
const PATH_OPTIONS = { "--out": "out", "--ids": "ids", "--pages": "pages" } as const;

interface Arguments {
  positional: string[];
  out: string;
  /** A file of change ids, for `update:apply`. */
  ids?: string;
  /** The dump the later archive was built from, for `update:select`. */
  pages?: string;
}

/** The positional arguments and the options, or what is wrong with the arguments. */
function readArguments(args: readonly string[]): Arguments | string {
  const read: Arguments = { positional: [], out: resolve(".data/updates") };
  for (let i = 0; i < args.length; i += 1) {
    if (Object.hasOwn(PATH_OPTIONS, args[i])) {
      if (args[i + 1] === undefined) return `${args[i]} needs a path`;
      read[PATH_OPTIONS[args[i] as keyof typeof PATH_OPTIONS]] = resolve(args[i + 1]);
      i += 1;
    } else if (args[i].startsWith("--")) {
      return `unknown argument ${args[i]}`;
    } else {
      read.positional.push(args[i]);
    }
  }
  return read;
}

/** The change ids in a file: whitespace between them, and `#` to the end of a line a comment. */
export function idsInFile(text: string): string[] {
  return text.split("\n").flatMap((line) => line.replace(/#.*$/, "").split(/\s+/).filter((id) => id !== ""));
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

async function selectCommand(target: SeedTarget, args: readonly string[]): Promise<CommandResult> {
  const read = readArguments(args);
  if (typeof read === "string") return usageError(read, USAGE);
  if (read.positional.length !== 1) return usageError("update:select takes one archive and no change ids", USAGE);
  if (read.pages === undefined) return usageError("update:select needs --pages, the dump the archive was built from", USAGE);
  const archive = resolve(read.positional[0]);
  const reader = masterReaderOf(target);
  log(`reading the master in ${target.dictionary}, ${archive} and ${read.pages}; nothing is written to the database`);
  const found = await diffAgainstMaster(reader, archive);
  const selection = await withFeedDump(found.feed, read.pages, LANGUAGES, (pages) => selectChanges(reader, found, pages));
  await mkdir(read.out, { recursive: true });
  const base = join(read.out, `selection-${selection.master.releaseId}-${selection.feed.releaseId}`);
  await writeFile(`${base}.md`, `${selectionMarkdown(selection)}\n`);
  await writeFile(`${base}.json`, `${JSON.stringify(selection, null, 2)}\n`);
  await writeFile(`${base}.ids`, selectionIds(selection));
  return {
    out:
      `${selection.feed.releaseId} against ${selection.master.releaseId} by ${selection.rule}: ` +
      `${selection.taken.length} taken, ${selection.skipped.length} new or changed skipped\n` +
      `report: ${base}.md\n        ${base}.json\nids:    ${base}.ids`,
    status: 0,
  };
}

async function applyCommand(target: SeedTarget, args: readonly string[]): Promise<CommandResult> {
  const read = readArguments(args);
  if (typeof read === "string") return usageError(read, USAGE);
  const [given, ...named] = read.positional;
  if (given === undefined) return usageError("name the later archive, then the change ids or --ids <file>", USAGE);
  if (read.ids !== undefined && named.length > 0) return usageError("give the change ids or --ids <file>, not both", USAGE);
  const ids = read.ids === undefined ? named : idsInFile(await readFile(read.ids, "utf8"));
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
  return executeApply(target, reader, plan, read.out, false);
}

async function automaticCommand(target: SeedTarget, args: readonly string[]): Promise<CommandResult> {
  const read = readArguments(args);
  if (typeof read === "string") return usageError(read, USAGE);
  if (read.positional.length !== 1 || read.pages === undefined || read.ids !== undefined) return usageError("update:auto takes one archive, --pages and no change ids", USAGE);
  const reader = masterReaderOf(target);
  const found = await diffAgainstMaster(reader, resolve(read.positional[0]));
  const plan = await withFeedDump(found.feed, read.pages, LANGUAGES, async (pages) => automaticPlan(reader, found, pages, {
    schema: await readFile(SCHEMA, "utf8"), appliedAt: new Date().toISOString(),
  }));
  if (plan === null) return { out: `${found.feed.releaseId}: no eligible changes; nothing written`, status: 0 };
  return executeApply(target, reader, plan, read.out, true);
}

async function executeApply(target: SeedTarget, reader: MasterReader, plan: ApplyPlan, out: string, aggregate: boolean): Promise<CommandResult> {
  await mkdir(out, { recursive: true });
  const file = join(out, `apply-${plan.masterReleaseId}-${plan.feedReleaseId}-${Date.now()}.sql`);
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
        `\nsee "If an apply stops" in docs/UPDATE_THE_DICTIONARY.md`,
      status: 1,
    };
  }
  const lines = plan.changes.map(({ change, recordId }) =>
    `  ${change.id} ${change.kind} ${change.word} (${change.pos}): record ${recordId}` +
    (change.kind === "changed" ? `, replacing record ${change.master.recordId}` : ""),
  );
  const rows = Object.entries(plan.rows).map(([table, count]) => `  ${table}: ${count}`);
  return {
    out: [`applied ${plan.changes.length} change(s) from ${plan.feedReleaseId} to ${plan.masterReleaseId}:`, ...(aggregate ? [] : lines), "rows written:", ...rows].join("\n"),
    status: 0,
  };
}

async function upgradeCommand(target: SeedTarget, args: readonly string[]): Promise<CommandResult> {
  const read = readArguments(args);
  if (typeof read === "string") return usageError(read, USAGE);
  if (read.positional.length > 0) return usageError("update:upgrade takes no archive and no change ids", USAGE);
  const master = readMasterRelease(masterReaderOf(target));
  const missing = missingUpgrade(masterReaderOf(target));
  if (missing.length === 0) return { out: `${target.dictionary} (master ${master.releaseId}) already has every table and view the upgrade adds; nothing to do`, status: 0 };
  await mkdir(read.out, { recursive: true });
  const file = join(read.out, `upgrade-${master.releaseId}-${Date.now()}.sql`);
  await writeFile(file, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
  log(`adding ${missing.join(", ")}: ${file}`);
  target.execute(["--file", file], false);
  const still = missingUpgrade(masterReaderOf(target));
  if (still.length > 0) return { out: `the upgrade ran, but ${target.dictionary} still lacks ${still.join(", ")}`, status: 1 };
  return { out: `${target.dictionary} (master ${master.releaseId}) has every table and view the upgrade adds; no row was written`, status: 0 };
}

const COMMANDS = { auto: automaticCommand, upgrade: upgradeCommand, diff: diffCommand, select: selectCommand, apply: applyCommand } as const;

export async function main(argv: readonly string[]): Promise<CommandResult> {
  const [command, ...args] = argv;
  if (command === undefined || !Object.hasOwn(COMMANDS, command)) return usageError(`unknown command ${command ?? "(none)"}`, USAGE);
  const target = seedTargetFrom(process.env, webWrangler, resolve(".data/seed-state"));
  return COMMANDS[command as keyof typeof COMMANDS](target, args);
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
