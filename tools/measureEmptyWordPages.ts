// The word pages where no reading has anything to show (#699), and what each
// one's raw page holds.
//
// Three steps, so the slow ones run once:
//
//   pnpm exec tsx tools/measureEmptyWordPages.ts seed <it-extract.jsonl.gz> <itwiktionary-20260701 dump> <new work dir>
//   TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureEmptyWordPages.ts search <it-extract.jsonl.gz> <itwiktionary-20260701 dump> <work dir>
//   TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureEmptyWordPages.ts classify <it-extract.jsonl.gz> <itwiktionary-20260701 dump> <work dir> > result.json
//
// `seed` builds the release into <work dir>/release.sqlite with `seedSql`, as a
// full-release `pnpm run seed:dev` does: the dump's raw pages, the recovered
// layer (#28), the page-only entries of every record-less page (ADR 0024, ADR
// 0028), both hiding rules and the curated corrections. No feed is applied.
// The work dir must not exist yet.
//
// `search` opens that file read-only, searches every headword the way the page
// does (`searchAttempt`) and builds its page with `wordPage()`, the rule #694
// set. A headword counts when its page's readings are all bare. It writes them
// to <work dir>/bare-readings.json; about 20 minutes.
//
// `classify` reads each one's raw page: by the existing rules' readers, and by
// `definitionTextLines` (tools/emptyWordPages/pageText.ts), a measurement's
// detector that finds Italian definition text in any layout and names the
// layout.
//
// reports/2026-10-06-empty-word-pages.md is its first run, and
// reports/2026-10-06-empty-word-pages.json its output.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sha256Of } from "../src/deploy/dataFiles.js";
import { PageOnlyCandidates } from "../src/import/pageOnlyCandidates.js";
import { seedSql } from "../src/import/seedSql.js";
import { readLanguageHeadings } from "../src/italian/sectionLanguage.js";
import { archiveFactsFor } from "../src/source/archiveFacts.js";
import { KNOWN_DUMPS, loadDumpPages } from "../src/source/wiktionaryDump.js";

const [step, archive, dumpPath, workArg] = process.argv.slice(2);
if ((step !== "seed" && step !== "search" && step !== "classify") || !archive || !dumpPath || !workArg) {
  throw new Error("usage: tools/measureEmptyWordPages.ts seed|search|classify <archive.jsonl.gz> <dump.xml.bz2> <work dir>");
}
const work = resolve(workArg);
const database = join(work, "release.sqlite");
const bareReadings = join(work, "bare-readings.json");
const log = (line: string): void => void process.stderr.write(`${line}\n`);

const archiveSha256 = await sha256Of(archive);
const dumpId = archiveFactsFor(archiveSha256)?.dump.id;
if (dumpId === undefined || !Object.hasOwn(KNOWN_DUMPS, dumpId)) throw new Error(`no dump is known for ${archive}`);
const releaseId = `it-${archiveSha256.slice(0, 8)}`;

if (step === "seed") {
  log(`reading ${dumpPath}`);
  const pages = await loadDumpPages(dumpPath, KNOWN_DUMPS[dumpId]);
  // A new directory, so a run never overwrites one it did not make.
  await mkdir(work);
  log(`seeding ${releaseId}`);
  const seeded = await seedSql({
    input: archive,
    outputDir: join(work, "sql"),
    schema: resolve("src/db/schema.sql"),
    rawPages: pages,
    pageOnly: PageOnlyCandidates.everyUnrecordedPage(),
    languageHeadings: await readLanguageHeadings(resolve("fixtures/section-language/regressions.json")),
  });
  const db = new DatabaseSync(database);
  for (const part of seeded.parts) db.exec(await readFile(part, "utf8"));
  db.close();
  await rm(join(work, "sql"), { recursive: true, force: true });
  log(`seeded ${database}: ${JSON.stringify(seeded.rows)}`);
} else if (step === "search") {
  // Imported here: the word page's modules resolve through web/tsconfig.json.
  const { search } = await import("./emptyWordPages/measure.ts");
  await writeFile(bareReadings, JSON.stringify(await search(database, releaseId, log)));
} else {
  const { classify } = await import("./emptyWordPages/measure.ts");
  const searched = JSON.parse(await readFile(bareReadings, "utf8"));
  if (searched.release !== releaseId) throw new Error(`${bareReadings} is a search of ${searched.release}, not ${releaseId}`);
  log(`reading ${dumpPath}`);
  const pages = await loadDumpPages(dumpPath, KNOWN_DUMPS[dumpId]);
  const { list, ...counts } = classify(database, searched, pages);
  // The counts indented, and one headword per line, so a reader can grep the list.
  const head = JSON.stringify({ archive: { sha256: archiveSha256 }, dump: dumpId, ...counts }, null, 2);
  console.log(`${head.slice(0, -2)},\n  "list": [\n${list.map((headword) => `    ${JSON.stringify(headword)}`).join(",\n")}\n  ]\n}`);
}
