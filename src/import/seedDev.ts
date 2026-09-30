// Build the committed development fixture (or a release archive) directly into
// D1 SQL. There is deliberately no SQLite staging database and no review pass.
// The SQL is written as numbered parts and applied in order (see sqlParts.ts).
// The dictionary goes into the local `DB`; the app tables are migrated into
// the local `APP_DB`, never into the dictionary (ADR 0018).

import { execFileSync } from "node:child_process";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getTableName } from "drizzle-orm";
import * as appSchema from "../db/app/schema.js";
import { openRawPages } from "../source/wiktionaryDump.js";
import { seedSql } from "./seedSql.js";
import { applyParts, DEFAULT_PART_CEILING_BYTES, PartFailure } from "./sqlParts.js";

const input = resolve(process.env.SEED_INPUT ?? "fixtures/dev-seed.jsonl");
const outputDir = resolve(process.env.SEED_SQL ?? ".data/dev-sql");
const persistTo = resolve(process.env.SEED_STATE ?? ".data/seed-state");
const isArchive = input.endsWith(".gz");
// The fixture is always `it-dev`; an archive is named by its own digest
// (`it-<first 8 hex of its sha256>`) unless SEED_RELEASE says otherwise.
const releaseId = process.env.SEED_RELEASE ?? (isArchive ? undefined : "it-dev");
const partCeilingBytes = process.env.SEED_PART_BYTES === undefined
  ? DEFAULT_PART_CEILING_BYTES
  : Number(process.env.SEED_PART_BYTES);
// This is Huey's fifty-word development list from #81. The fixture also carries
// the transitive form_of closure (currently `sola` and `solo`).
const requiredWords = [
  "acqua", "albero", "amica", "amico", "andare", "andavano", "avere", "bella", "bello",
  "cane", "casa", "case", "casetta", "città", "dire", "dormire", "essere", "fare",
  "fine", "finire", "gatto", "grande", "librare", "libro", "luna", "mangiare", "mare",
  "parlare", "parlerei", "partire", "ragazza", "ragazzo", "rosso", "sala", "salare", "sale",
  "salire", "scuola", "sole", "strada", "studente", "studentessa", "studenti", "studiare",
  "tavolo", "vado", "vedere", "venire", "vivere", "zaino",
] as const;

/** The two local databases, by their `database_name` in web/wrangler.jsonc. */
const DICTIONARY = "lexema";
const APP = "lexema-app";

const d1 = (args: readonly string[], capture: boolean): string =>
  execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", ...args, "--local", "--persist-to", persistTo],
    { cwd: resolve("web"), stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", env: { ...process.env, CI: "1" }, encoding: "utf8" },
  ) ?? "";
const wrangler = (args: readonly string[], capture: boolean): string => d1(["execute", DICTIONARY, ...args, "--yes"], capture);

await mkdir(resolve(".data"), { recursive: true });
await rm(persistTo, { recursive: true, force: true });
const rawPages = await openRawPages();
process.stderr.write(`raw pages: ${rawPages.pages.size} from ${rawPages.described}\n`);
const rejectionLines: string[] = [];
const report = await seedSql({
  input,
  outputDir,
  schema: resolve("src/db/schema.sql"),
  releaseId,
  license: "CC-BY-SA-4.0",
  requiredWords,
  validateFixtureClosure: !isArchive,
  // The dump the archive was built from when it is in the repository root,
  // else the pages committed under fixtures/ (#28). A word without a page is
  // seeded as it always was.
  rawPages: rawPages.pages,
  onRejection: ({ lineNo, kind, reason }) => rejectionLines.push(`${lineNo}\t${kind}\t${reason}`),
  partCeilingBytes,
  // Marked servable below, only after the loaded database is verified.
  leaveImporting: true,
});
const rejectionPath = join(outputDir, "rejections.tsv");
await writeFile(rejectionPath, rejectionLines.length > 0 ? `${rejectionLines.join("\n")}\n` : "");

process.stderr.write(`seed SQL: ${report.parts.length} part(s) under ${partCeilingBytes} bytes in ${outputDir}\n`);
process.stderr.write(`archive: ${report.admitted} admitted, ${report.linesRead} lines, ${report.status}\n`);
for (const [table, count] of Object.entries(report.rows)) process.stderr.write(`  ${table}: ${count}\n`);
process.stderr.write(
  report.archiveFacts === undefined
    ? `archive facts: none for SHA-256 ${report.archiveSha256}; download URL, download time and source dump left unrecorded\n`
    : `archive facts: ${report.archiveFacts.sourceUrl}, downloaded ${report.archiveFacts.retrievedAt}, ` +
        `dump ${report.archiveFacts.dump.id} (${report.archiveFacts.dump.basis})\n`,
);
const { recovery } = report;
process.stderr.write(
  `recovered layer: ${recovery.definitions} definition(s) and ${recovery.examples} example(s) for ` +
    `${recovery.fullLoss + recovery.partialLoss} record(s) (${recovery.fullLoss} with no definition of their own, ` +
    `${recovery.partialLoss} missing some), from ${recovery.recordsWithAPage} record(s) with a raw page ` +
    `of ${recovery.rawPages}; ${recovery.unrendered} line(s) not rendered\n`,
);
process.stderr.write(`loading local D1 into ${persistTo} (never web/.wrangler)\n`);
try {
  await applyParts(report.parts, async (part, index, total) => {
    process.stderr.write(`part ${index} of ${total}: ${part} (${(await stat(part)).size} bytes)\n`);
    wrangler(["--file", part], false);
  });
} catch (error: unknown) {
  if (!(error instanceof PartFailure)) throw error;
  process.stderr.write(`seed stopped: ${error.message}\n`);
  process.stderr.write(`${persistTo} holds a partial database. Reseed into a fresh SEED_STATE (see docs/DEV_SEED.md).\n`);
  process.exit(1);
}
// The dictionary schema came with the first part. The app tables are Drizzle's
// (src/db/app/schema.ts, ADR 0017) and go to their own database, through
// drizzle-kit's migrations and the `migrations_dir` web/wrangler.jsonc names.
process.stderr.write(`app migrations: into ${APP}\n`);
d1(["migrations", "apply", APP], false);
const appTables = Object.values(appSchema).map((table) => getTableName(table));
const tablesIn = (database: string): Set<string> => {
  const [answer] = JSON.parse(
    d1(["execute", database, "--json", "--command", "SELECT name FROM sqlite_schema WHERE type = 'table'"], true),
  ) as [{ results: { name: string }[] }];
  return new Set(answer.results.map(({ name }) => name));
};
const dictionaryHas = tablesIn(DICTIONARY);
const inDictionary = appTables.filter((table) => dictionaryHas.has(table));
if (inDictionary.length > 0) throw new Error(`app tables in the dictionary database: ${inDictionary.join(", ")}`);
const appHas = tablesIn(APP);
const missing = appTables.filter((table) => !appHas.has(table));
if (missing.length > 0) throw new Error(`app tables missing from ${APP}: ${missing.join(", ")}`);
process.stderr.write(`  ${APP}: ${appTables.length} app table(s), none in ${DICTIONARY}\n`);

/**
 * Mark the loaded release `failed` and stop. The SQL leaves the release
 * `importing`, which is never served, so a check that fails, or a run killed
 * before the end, can never leave a servable release; `failed` only says why.
 */
function failVerification(message: string): never {
  wrangler(
    ["--command", `UPDATE source_release SET status = 'failed' WHERE release_id = '${report.releaseId.replace(/'/g, "''")}'`],
    true,
  );
  throw new Error(`${message}; release ${report.releaseId} marked failed`);
}

// Read the loaded row counts back and hold them against what was generated.
const tables = Object.keys(report.rows);
const [counted] = JSON.parse(
  wrangler(["--json", "--command", `SELECT ${tables.map((table) => `(SELECT count(*) FROM ${table}) AS ${table}`).join(", ")}`], true),
) as [{ results: [Record<string, number>] }];
const loaded = counted.results[0];
process.stderr.write(`loaded release ${report.releaseId}:\n`);
for (const table of tables) process.stderr.write(`  ${table}: ${loaded[table]}\n`);
const mismatched = tables.filter((table) => loaded[table] !== report.rows[table as keyof typeof report.rows]);
if (mismatched.length > 0) failVerification(`loaded row counts differ from the generated SQL: ${mismatched.join(", ")}`);

// `source_release` is written as one row outside the batched tables, so a count
// would say little. Hold the row itself against the run: exactly one, and it
// carries the status and line counts the generator reported.
const [releaseRows] = JSON.parse(
  wrangler(
    ["--json", "--command", `SELECT status, lines_read, admitted, skipped_other_language, malformed_lines, malformed_members, source_url, upstream_release, upstream_release_basis FROM source_release WHERE release_id = '${report.releaseId.replace(/'/g, "''")}'`],
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

// Every check passed: only now is the release given its final status, and the
// write is read back, so a promotion that did not land is reported, not assumed.
const quotedRelease = `'${report.releaseId.replace(/'/g, "''")}'`;
wrangler(["--command", `UPDATE source_release SET status = '${report.status}' WHERE release_id = ${quotedRelease}`], true);
const [promoted] = JSON.parse(
  wrangler(["--json", "--command", `SELECT status FROM source_release WHERE release_id = ${quotedRelease}`], true),
) as [{ results: { status: string }[] }];
if (promoted.results[0]?.status !== report.status) {
  throw new Error(`release ${report.releaseId} was verified but its status reads ${promoted.results[0]?.status ?? "missing"}, not ${report.status}`);
}
process.stderr.write(`  source_release: 1 row, ${report.status}\n`);
process.stdout.write(JSON.stringify({ ...report, rejectionPath, loaded }) + "\n");
