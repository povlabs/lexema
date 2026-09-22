// Build the committed development fixture (or a release archive) directly into
// D1 SQL. There is deliberately no SQLite staging database and no review pass.

import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { seedSql } from "./seedSql.js";

const input = resolve(process.env.SEED_INPUT ?? "fixtures/dev-seed.jsonl");
const output = resolve(process.env.SEED_SQL ?? ".data/dev.sql");
const persistTo = resolve(process.env.SEED_STATE ?? ".data/seed-state");
const releaseId = process.env.SEED_RELEASE ?? "it-dev";
const requiredWords = [
  "casa", "case", "studente", "studenti", "sale", "andare", "andavano",
  "parlare", "parlerei", "bello", "bella", "città", "fine", "grande", "vado",
  "finire", "studentessa", "casetta", "zaino",
] as const;

await mkdir(resolve(".data"), { recursive: true });
await rm(output, { force: true });
await rm(persistTo, { recursive: true, force: true });
const rejectionPath = `${output}.rejections.tsv`;
const rejectionLines: string[] = [];
const report = await seedSql({
  input,
  output,
  schema: resolve("src/db/schema.sql"),
  releaseId,
  archiveR2Key: `releases/${releaseId}.jsonl.gz`,
  sourceUrl: "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz",
  license: "CC-BY-SA-4.0",
  requiredWords,
  validateFixtureClosure: !input.endsWith(".gz"),
  onRejection: ({ lineNo, kind, reason }) => rejectionLines.push(`${lineNo}\t${kind}\t${reason}`),
});
await writeFile(rejectionPath, rejectionLines.length > 0 ? `${rejectionLines.join("\n")}\n` : "");

process.stderr.write(`seed SQL: ${report.output}\n`);
process.stderr.write(`archive: ${report.admitted} admitted, ${report.linesRead} lines, ${report.status}\n`);
for (const [table, count] of Object.entries(report.rows)) process.stderr.write(`  ${table}: ${count}\n`);
process.stderr.write(`loading local D1 into ${persistTo} (never web/.wrangler)\n`);
execFileSync(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "lexema", "--local", "--persist-to", persistTo, "--file", output, "--yes"],
  { cwd: resolve("web"), stdio: "inherit", env: { ...process.env, CI: "1" } },
);
process.stdout.write(JSON.stringify({ ...report, rejectionPath }) + "\n");
