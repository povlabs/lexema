// Build a small development release and load it into the Worker's local D1.
//
//   pnpm run seed:dev
//
// A few thousand records is enough to build a page against and loads in
// seconds. The full release is 560,357 records and 1.3 GB, which is a
// deployment problem (#18), not a development one.
//
// The seed gets that smallness by importing a smaller *archive*, never by
// stopping the importer early. A run stopped by `--limit` ends as `partial`,
// and every canonical read hides a release that is not `complete`, so the page
// answered every query with "the lookup failed" (#47). Cutting the prefix into
// its own file instead leaves the release honestly complete for the file it
// names, and its checksum describes exactly the bytes that were imported.

import { execFileSync } from "node:child_process";
import { closeSync, openSync, writeSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { exportSql } from "./exportSql.js";
import { writeHandWrittenExplanations } from "./handWrittenText.js";
import { importRelease } from "./importRelease.js";
import { writeKnownDisputes } from "./knownDisputes.js";
import { writePrefixArchive } from "./prefixArchive.js";

// 25,000 records reaches source line 60,501, which is where the words this
// page is built against stop being absent: `sale`, `sala`, `salire`, `casa`,
// `studenti`, `bella`, `città`. A smaller default makes the page's own
// suggested searches find nothing.
const RECORDS = Number(process.env.SEED_RECORDS ?? 25000);
const RELEASE = process.env.SEED_RELEASE ?? "it-dev";
const SOURCE = "it-extract.jsonl.gz";
const ARCHIVE = resolve(`.data/${RELEASE}.jsonl.gz`);
const DB = resolve(".data/dev.sqlite");
const SQL = resolve(".data/dev.sql");
const REJECTIONS = resolve(".data/dev-rejections.tsv");
const STATE = resolve("web/.wrangler/state");

await mkdir(".data", { recursive: true });
for (const path of [ARCHIVE, DB, `${DB}-wal`, `${DB}-shm`, SQL, REJECTIONS])
  await rm(path, { force: true });

// The generated SQL creates the schema and inserts the release, so loading it
// into a database that already holds a seed collides on duplicate rows. Local
// D1 is a miniflare SQLite file under the persist directory, and it holds
// nothing this script cannot rebuild, so the seed drops it and starts clean.
// That is what makes `pnpm run seed:dev` repeatable.
process.stderr.write(`clearing local D1 under ${STATE}\n`);
await rm(resolve(STATE, "v3/d1"), { recursive: true, force: true });

process.stderr.write(`cutting the first ${RECORDS} records of ${SOURCE} into ${ARCHIVE}\n`);
const prefix = await writePrefixArchive({ input: SOURCE, output: ARCHIVE, records: RECORDS });
if (prefix.exhausted) {
  process.stderr.write(`  ${SOURCE} holds only ${prefix.records} records; the prefix is all of it\n`);
}
process.stderr.write(`  ${prefix.records} records in ${prefix.lines} source lines\n`);

// No `limit`: the importer reads this archive to its last line, which is what
// makes the release `complete` rather than `partial`. The importer requires a
// home for every rejected line rather than letting one be dropped in silence,
// so the seed gives it a file beside the database.
process.stderr.write(`importing ${ARCHIVE} whole as ${RELEASE}\n`);
const rejectionsFd = openSync(REJECTIONS, "w");
let report;
try {
  report = await importRelease({
    input: ARCHIVE,
    database: DB,
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    sourceUrl: "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz",
    license: "CC-BY-SA-4.0",
    onRejection: ({ lineNo, kind, reason }) =>
      writeSync(rejectionsFd, `${lineNo}\t${kind}\t${reason}\n`),
  });
} finally {
  closeSync(rejectionsFd);
}
process.stderr.write(
  `  ${report.admitted} records, ${report.rows.lookup_form} lookup rows, release ${report.status}\n`,
);

// Review verdicts are not import output: the importer copies the source and
// says nothing about whether it is right. They are written after it, over the
// release it just made, so the page can show the one claim this repository has
// already contradicted as disputed instead of as an ordinary fact.
const reviewDb = new DatabaseSync(DB);
try {
  const disputes = writeKnownDisputes(reviewDb, RELEASE);
  process.stderr.write(
    disputes === 0
      ? "  no known disputed claim is inside this prefix\n"
      : `  flagged ${disputes} known disputed claim(s)\n`,
  );

  // Lexema's own explanations are not import output either, and for the same
  // reason: the importer copies the source and writes nothing of its own. The
  // twelve hand-written ones land here, over the release just imported, so the
  // page can show the label and the layout before any model is paid (#72).
  const explanations = writeHandWrittenExplanations(reviewDb, RELEASE);
  process.stderr.write(
    explanations === 0
      ? "  none of the hand-written explanations is inside this prefix\n"
      : `  wrote ${explanations} hand-written explanation(s)\n`,
  );
} finally {
  reviewDb.close();
}

const { statements } = await exportSql({ database: DB, schema: "src/db/schema.sql", output: SQL });
process.stderr.write(`wrote ${statements} statements to ${SQL}\n`);

// Wrangler resolves --persist-to relative to the config file, so it must be
// absolute; the spike lost an afternoon to exactly that.
process.stderr.write("loading into local D1\n");
execFileSync(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "lexema", "--local",
   "--persist-to", resolve("web/.wrangler/state"), "--file", SQL, "--yes"],
  { cwd: resolve("web"), stdio: "inherit", env: { ...process.env, CI: "1" } },
);
process.stderr.write("\nseeded. run `pnpm --filter @lexema/web dev`\n");
