// Load generated seed SQL into a target D1 and verify it there. The same plan
// runs against the local database and a remote one; only the target decides
// where each Wrangler command goes (seedTarget.ts).

import { stat } from "node:fs/promises";
import { getTableName } from "drizzle-orm";
import * as appSchema from "../db/app/schema.js";
import type { SeedSqlReport } from "./seedSql.js";
import type { SeedTarget } from "./seedTarget.js";
import { applyParts, PartFailure } from "./sqlParts.js";

/** What the load reads back from the target. */
export type LoadedRows = Record<string, number>;

/**
 * A run that stopped after writing to the target: a part failed, or the loaded
 * database differed from the run. `message` ends with the target's next step.
 */
export class SeedStopped extends Error {
  constructor(reason: string, afterStop: string) {
    super(`seed stopped: ${reason}\n${afterStop}`);
    this.name = "SeedStopped";
  }
}

/** What the load needs from the generated SQL: its parts and what they should hold. */
export type SeedReport = Pick<
  SeedSqlReport,
  | "releaseId" | "parts" | "status" | "linesRead" | "admitted"
  | "skippedOtherLanguage" | "malformed" | "malformedMembers" | "archiveFacts"
> & { readonly rows: Readonly<Record<string, number>> };

const quoted = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/**
 * Apply `report.parts` in order to `target`, then check the loaded row counts
 * and the `source_release` row against the run. The release stays `importing`,
 * which is never served, until every check passes; only then is it given its
 * final status, and that write is read back.
 */
export async function loadSeed(
  target: SeedTarget,
  report: SeedReport,
  log: (line: string) => void,
): Promise<LoadedRows> {
  log(`loading ${target.described}`);
  try {
    await applyParts(report.parts, async (part, index, total) => {
      log(`part ${index} of ${total}: ${part} (${(await stat(part)).size} bytes)`);
      target.execute(["--file", part], false);
    });
  } catch (error: unknown) {
    if (!(error instanceof PartFailure)) throw error;
    throw new SeedStopped(error.message, target.afterStop());
  }

  const appTables = Object.values(appSchema).map((table) => getTableName(table));
  const [schema] = JSON.parse(
    target.execute(["--json", "--command", "SELECT name FROM sqlite_schema WHERE type = 'table'"], true),
  ) as [{ results: { name: string }[] }];
  const dictionaryHas = new Set(schema.results.map(({ name }) => name));
  const inDictionary = appTables.filter((table) => dictionaryHas.has(table));
  if (inDictionary.length > 0) throw new Error(`app tables in the dictionary database: ${inDictionary.join(", ")}`);
  target.migrateApp(log);

  const release = quoted(report.releaseId);
  /**
   * Mark the loaded release `failed` and stop. A check that fails, or a run
   * killed before the end, can never leave a servable release; `failed` only
   * says why.
   */
  const failVerification = (message: string): never => {
    target.execute(["--command", `UPDATE source_release SET status = 'failed' WHERE release_id = ${release}`], true);
    throw new SeedStopped(`${message}; release ${report.releaseId} marked failed`, target.afterStop());
  };

  // Read the loaded row counts back and hold them against what was generated.
  const tables = Object.keys(report.rows);
  const [counted] = JSON.parse(
    target.execute(["--json", "--command", `SELECT ${tables.map((table) => `(SELECT count(*) FROM ${table}) AS ${table}`).join(", ")}`], true),
  ) as [{ results: [LoadedRows] }];
  const loaded = counted.results[0];
  log(`loaded release ${report.releaseId}:`);
  for (const table of tables) log(`  ${table}: ${loaded[table]}`);
  const mismatched = tables.filter((table) => loaded[table] !== report.rows[table]);
  if (mismatched.length > 0) failVerification(`loaded row counts differ from the generated SQL: ${mismatched.join(", ")}`);

  // `source_release` is written as one row outside the batched tables, so a
  // count would say little. Hold the row itself against the run: exactly one,
  // and it carries the status and line counts the generator reported.
  const [releaseRows] = JSON.parse(
    target.execute(
      ["--json", "--command", `SELECT status, lines_read, admitted, skipped_other_language, malformed_lines, malformed_members, source_url, upstream_release, upstream_release_basis FROM source_release WHERE release_id = ${release}`],
      true,
    ),
  ) as [{ results: Record<string, string | number | null>[] }];
  const expectedRelease = {
    status: "importing",
    lines_read: report.linesRead,
    admitted: report.admitted,
    skipped_other_language: report.skippedOtherLanguage,
    malformed_lines: report.malformed,
    malformed_members: report.malformedMembers,
    source_url: report.archiveFacts?.sourceUrl ?? null,
    upstream_release: report.archiveFacts?.dump.id ?? null,
    upstream_release_basis: report.archiveFacts?.dump.basis ?? null,
  };
  if (releaseRows.results.length !== 1) {
    failVerification(`expected one source_release row for ${report.releaseId}, found ${releaseRows.results.length}`);
  }
  const releaseRow = releaseRows.results[0];
  const releaseMismatch = Object.entries(expectedRelease).filter(([column, value]) => releaseRow[column] !== value);
  if (releaseMismatch.length > 0) {
    failVerification(`source_release differs from the run: ${releaseMismatch.map(([column]) => column).join(", ")}`);
  }

  // Every check passed: only now is the release given its final status, and
  // the write is read back, so a promotion that did not land is reported.
  target.execute(["--command", `UPDATE source_release SET status = '${report.status}' WHERE release_id = ${release}`], true);
  const [promoted] = JSON.parse(
    target.execute(["--json", "--command", `SELECT status FROM source_release WHERE release_id = ${release}`], true),
  ) as [{ results: { status: string }[] }];
  if (promoted.results[0]?.status !== report.status) {
    throw new Error(`release ${report.releaseId} was verified but its status reads ${promoted.results[0]?.status ?? "missing"}, not ${report.status}`);
  }
  log(`  source_release: 1 row, ${report.status}`);
  return loaded;
}
