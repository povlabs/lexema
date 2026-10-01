// `pnpm run db:check-d1`: build the app database in a throwaway local D1 and
// write one valid row to every table in it (#330), so each CHECK runs on D1.
// CI's `d1` job runs it. It needs no Cloudflare account and no dataset, and it
// never touches `SEED_STATE`.
//
// It stops, exiting 1, when a table the migrations create has no sample row or
// a sample row names a table they do not create (./sampleRows.ts), or when D1
// refuses a write.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalSeedTarget, webWrangler } from "../../import/seedTarget.js";
import { localD1 } from "../localD1.js";
import { tablesTheMigrationsCreate } from "./migrations.js";
import { sampleCoverage, writeSampleRows } from "./sampleRows.js";

const log = (line: string) => process.stderr.write(`${line}\n`);

/**
 * Wrangler's own answer to a refused write: `--json` prints it to the stdout
 * localD1 captures, which the failed process carries, under Drizzle's error.
 */
function wranglerAnswer(failure: unknown): string | undefined {
  for (let at = failure; at instanceof Error; at = at.cause) {
    const { stdout } = at as { stdout?: unknown };
    if (typeof stdout === "string") return stdout.trim();
  }
  return undefined;
}

const { unwritten, uncreated } = sampleCoverage(tablesTheMigrationsCreate());
if (unwritten.length > 0 || uncreated.length > 0) {
  if (unwritten.length > 0) log(`no sample row in src/db/app/sampleRows.ts for: ${unwritten.join(", ")}`);
  if (uncreated.length > 0) log(`sample rows for tables no migration creates: ${uncreated.join(", ")}`);
  process.exit(1);
}

const state = await mkdtemp(join(tmpdir(), "lexema-check-d1-"));
try {
  new LocalSeedTarget(webWrangler, state).migrateApp(log);
  log("sample rows:");
  await writeSampleRows(localD1(state).app, log);
  log("every app table took its sample row on local D1");
} catch (failure) {
  log((failure as Error).message);
  const answer = wranglerAnswer(failure);
  if (answer !== undefined) log(answer);
  process.exitCode = 1;
} finally {
  await rm(state, { recursive: true, force: true });
}
