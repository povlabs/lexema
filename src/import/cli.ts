// Offline importer entry point. Per ADR 0004 the import never runs inside a
// request: this is a plain Node program that reads the archive and writes a
// SQLite database, and the Worker only ever reads what it produced.
//
//   pnpm run import -- --release-id it-2026-07-20
//
// Defaults point at the local file and .data/lexema.sqlite, both gitignored.

import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { IMPORTER_VERSION, importRelease } from "./importRelease.js";

function parseArgs(argv: string[]): Map<string, string | true> {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args.set(token.slice(2), true);
    } else {
      args.set(token.slice(2), next);
      i += 1;
    }
  }
  return args;
}

const str = (args: Map<string, string | true>, key: string): string | undefined => {
  const value = args.get(key);
  return typeof value === "string" ? value : undefined;
};

const USAGE = `Usage: pnpm run import -- [options]

  --input <path>        source .jsonl.gz            (default: it-extract.jsonl.gz)
  --database <path>     SQLite file to write        (default: .data/lexema.sqlite)
  --release-id <id>     release identifier          (default: it-local)
  --archive-key <key>   R2 key for the archive      (default: releases/<release-id>.jsonl.gz)
  --source-url <url>    download URL, if known
  --retrieved-at <iso>  ISO-8601 download time, if known
  --upstream <id>       upstream dump id, if known
  --license <spdx>      licence string as found upstream
  --attribution <text>  attribution string
  --limit <n>           stop after n records (for smoke runs)
  --force               overwrite an existing database file
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("help")) {
    process.stdout.write(USAGE);
    return;
  }

  const input = str(args, "input") ?? "it-extract.jsonl.gz";
  const database = str(args, "database") ?? ".data/lexema.sqlite";
  const releaseId = str(args, "release-id") ?? "it-local";
  const limitRaw = str(args, "limit");
  const limit = limitRaw === undefined ? undefined : Number(limitRaw);
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error(`--limit must be a positive integer, got ${limitRaw}`);
  }

  await mkdir(dirname(resolve(database)), { recursive: true });
  if (args.has("force")) {
    // The schema is CREATE TABLE without IF NOT EXISTS, so a re-run against an
    // existing file would fail. Refusing by default is deliberate: silently
    // overwriting an imported release is how you lose one you meant to keep.
    await rm(resolve(database), { force: true });
    await rm(`${resolve(database)}-wal`, { force: true });
    await rm(`${resolve(database)}-shm`, { force: true });
  }

  process.stderr.write(`importing ${input} -> ${database} as ${releaseId}\n`);
  const report = await importRelease({
    input,
    database,
    schema: resolve(dirname(new URL(import.meta.url).pathname), "../db/schema.sql"),
    releaseId,
    archiveR2Key: str(args, "archive-key") ?? `releases/${releaseId}.jsonl.gz`,
    sourceUrl: str(args, "source-url"),
    retrievedAt: str(args, "retrieved-at"),
    upstreamRelease: str(args, "upstream"),
    license: str(args, "license"),
    attribution: str(args, "attribution"),
    limit,
    onProgress: (admitted) =>
      process.stderr.write(`  ${admitted.toLocaleString("en-US")} records\r`),
  });

  const n = (value: number) => value.toLocaleString("en-US");
  const lines = [
    "",
    `release          ${report.releaseId}  (${IMPORTER_VERSION})`,
    `archive sha256   ${report.archiveSha256}`,
    `derived sha256   ${report.projectionSha256}`,
    `archive bytes    ${n(report.archiveBytes)}`,
    `lines read       ${n(report.linesRead)}`,
    `admitted (it)    ${n(report.admitted)}`,
    `skipped (other)  ${n(report.skippedOtherLanguage)}`,
    `malformed        ${n(report.malformed)}`,
    "",
    "rows written",
    ...Object.entries(report.rows).map(([table, count]) => `  ${table.padEnd(20)}${n(count)}`),
    "",
    `elapsed          ${(report.elapsedMs / 1000).toFixed(1)}s`,
    "",
  ];
  process.stdout.write(lines.join("\n"));

  if (report.malformed > 0) {
    const shown = report.malformedLineNumbers.join(", ");
    const more =
      report.malformed > report.malformedLineNumbers.length
        ? ` (first ${report.malformedLineNumbers.length} of ${n(report.malformed)})`
        : "";
    process.stdout.write(`malformed lines${more}: ${shown}\n\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\nimport failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
