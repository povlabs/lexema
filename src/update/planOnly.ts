// A plan-only run (#455): a write command run with `--plan-only` builds the
// same SQL file and counts it would apply, writes the file under `--out` for a
// reader to look at, and runs nothing on the database.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CommandResult } from "../commandLine.js";
import type { DeclaredCommand, PlanOnlyRun } from "./declaration.js";
import type { MasterReader } from "./master.js";
import { dictionaryRecords, type PlanCounts } from "./planCounts.js";

/** The flag that makes a write command a plan-only run. */
export const PLAN_ONLY = "--plan-only";

/** `args` without `--plan-only`, and whether it was there. */
export function planOnlyFlag(args: readonly string[]): { planOnly: boolean; rest: string[] } {
  return { planOnly: args.includes(PLAN_ONLY), rest: args.filter((arg) => arg !== PLAN_ONLY) };
}

/** A plan-only run of `command` over the dictionary `reader` reads. */
export const planOnlyRun = (command: DeclaredCommand, counts: PlanCounts, reader: MasterReader): PlanOnlyRun => ({
  command,
  counts,
  dictionaryRecords: dictionaryRecords(reader),
});

/**
 * What a plan-only run prints: one JSON object with its counts, the hard limits
 * it crosses, what the command adds, and the SQL file, written to `out` when
 * there is one. Nothing is written to the database.
 */
export async function planOnlyAnswer(run: PlanOnlyRun, sql: string, out: string, name: string, details: Record<string, unknown> = {}): Promise<CommandResult> {
  let file: string | null = null;
  if (sql !== "") {
    await mkdir(out, { recursive: true });
    file = join(out, `plan-${name}-${Date.now()}.sql`);
    await writeFile(file, sql);
  }
  return {
    out: JSON.stringify({
      command: run.command,
      planOnly: true,
      counts: run.counts,
      dictionaryRecords: run.dictionaryRecords,
      limitBreaches: run.counts.limitBreaches(run.dictionaryRecords),
      ...details,
      sql: file,
    }),
    status: 0,
  };
}
