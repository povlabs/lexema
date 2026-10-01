// Build the committed development fixture (or a release archive) directly into
// D1 SQL. There is deliberately no SQLite staging database and no review pass.
// The SQL is written as numbered parts and applied in order (see sqlParts.ts).
// The dictionary goes into the local `DB`; the app tables are migrated into
// the local `APP_DB`, never into the dictionary (ADR 0018). `SEED_REMOTE`
// loads the dictionary into a named remote D1 instead (seedTarget.ts).

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { openRawPages } from "../source/wiktionaryDump.js";
import { readLanguageHeadings } from "../italian/sectionLanguage.js";
import { type LoadedRows, loadSeed, SeedStopped } from "./seedLoad.js";
import { seedSql } from "./seedSql.js";
import { seedTargetFrom, webWrangler } from "./seedTarget.js";
import { DEFAULT_PART_CEILING_BYTES } from "./sqlParts.js";

const input = resolve(process.env.SEED_INPUT ?? "fixtures/dev-seed.jsonl");
const outputDir = resolve(process.env.SEED_SQL ?? ".data/dev-sql");
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

// Local by default; `SEED_REMOTE=<name>` loads a remote D1 instead (ADR 0018).
const target = seedTargetFrom(process.env, webWrangler, resolve(".data/seed-state"));

await mkdir(resolve(".data"), { recursive: true });
// Before the SQL is generated, so a remote database that already holds tables
// is refused before a release is read.
await target.prepare();
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
  // The dump's language headings, checked against the dump by
  // `pnpm run measure:section-language`; with the raw pages they let the seed
  // hide another language's entries filed as Italian (ADR 0023).
  languageHeadings: await readLanguageHeadings(resolve("fixtures/section-language/regressions.json")),
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
process.stderr.write(`source text rules: ${report.sourceTextRules.join(", ")}\n`);
const { recovery } = report;
process.stderr.write(
  `recovered layer: ${recovery.definitions} definition(s) and ${recovery.examples} example(s) for ` +
    `${recovery.fullLoss + recovery.partialLoss} record(s) (${recovery.fullLoss} with no definition of their own, ` +
    `${recovery.partialLoss} missing some), from ${recovery.recordsWithAPage} record(s) with a raw page ` +
    `of ${recovery.rawPages}; ${recovery.unrendered} line(s) not rendered\n`,
);
const { hidden } = report;
process.stderr.write(
  hidden.ran
    ? `hidden records (${hidden.rule}): ${hidden.hidden} (${hidden.languageLine} by a language line, ${hidden.lateHeading} by a late heading)\n`
    : `hidden records (${hidden.rule}): not judged, no raw pages\n`,
);
let loaded: LoadedRows;
try {
  loaded = await loadSeed(target, report, (line) => process.stderr.write(`${line}\n`));
} catch (error: unknown) {
  if (!(error instanceof SeedStopped)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
target.finished((line) => process.stderr.write(`${line}\n`));
process.stdout.write(JSON.stringify({ ...report, rejectionPath, loaded, ...target.reported }) + "\n");
