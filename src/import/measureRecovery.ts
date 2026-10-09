// `pnpm run measure:recovery` — how many archive records lose definitions their
// raw page states (#28).
//
// Streams `it-extract.jsonl.gz` once. Every Italian record whose word has a raw
// page is matched to its section of that page and run through the same
// recovery the seed runs, so the counts here are the counts a seed recovers.
// The raw pages are the Wiktionary dump the archive was built from (`RAW_PAGES`,
// default its copy in `.data/source/`), or the pages committed under
// `fixtures/` with `RAW_PAGES=fixtures`. Over the dump the counts are exact for
// the whole release.
// The uniformly sampled records in `fixtures/definition-loss-samples/` are
// counted again on their own: they are the only records whose rate may be
// projected onto the release from the fixtures alone.
//
// Reads the archive `RECOVERY_INPUT` names, default the master's in
// `.data/source/`. A file the cache lacks is fetched from `povlabs/lexema-data`
// (src/source/sourceCache.ts); the cache is gitignored and absent in CI.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { recordText, recoverDefinitions, type RecordRecovery, type RecoveredDefinition } from "../italian/recovery.js";
import { SourceCache } from "../source/sourceCache.js";
import { parseArchive } from "./importRelease.js";
import { readSectionRecords } from "./recoveredLayer.js";

const source = new SourceCache();
const input = process.env.RECOVERY_INPUT === undefined ? await source.archive() : resolve(process.env.RECOVERY_INPUT);
/**
 * When Wiktextract wrote the archive (gzip header mtime, docs/LICENSING.md §1.1).
 * A page revised after this cannot be the revision the record was read from.
 */
const ARCHIVE_BUILT = "2026-07-16T03:17:09Z";
const output = resolve(process.env.RECOVERY_OUTPUT ?? "artifacts/recovery-measure.json");

interface Sample {
  stratum: string;
  population: number;
  records: { word: string; pos_title: string; line: number }[];
}

const readSample = async (name: string): Promise<Sample> =>
  JSON.parse(await readFile(resolve("fixtures/definition-loss-samples", name), "utf8")) as Sample;

/** Counts over one set of records. */
class Tally {
  records = 0;
  outcomes: Record<RecordRecovery["outcome"], number> = {
    "no-italian-section": 0,
    "no-matching-section": 0,
    "ambiguous-section": 0,
    matched: 0,
  };
  loss = { none: 0, partial: 0, full: 0 };
  definitions = 0;
  byRoute: Record<string, number> = {};
  examples = 0;
  heldAsExample = 0;
  /** Recovered items in a lead-in's list, by where the lead-in is kept; `unplaced` when the lead-in is not matched. */
  listedUnder = { sense: 0, recovered: 0, unplaced: 0 };
  alreadyGlossed = 0;
  /** Definitions of a record's section that sit in a verb-type part another record of it was extracted from (#775). */
  otherParts = 0;
  unrendered = 0;

  add(recovery: RecordRecovery): void {
    this.records += 1;
    this.outcomes[recovery.outcome] += 1;
    if (recovery.outcome !== "matched") return;
    this.loss[recovery.loss] += 1;
    this.alreadyGlossed += recovery.alreadyGlossed.length;
    this.otherParts += recovery.otherParts.length;
    this.unrendered += recovery.unrendered.length;
    for (const definition of recovery.recovered) {
      this.definitions += 1;
      this.byRoute[definition.route] = (this.byRoute[definition.route] ?? 0) + 1;
      this.examples += definition.examples.length;
      if (definition.heldAsExample !== null) this.heldAsExample += 1;
      if (definition.listedUnder !== null) this.listedUnder[definition.listedUnder.in] += 1;
      else if (definition.leadIn !== null) this.listedUnder.unplaced += 1;
    }
  }
}

/** Wilson score interval, 95%, for k of n. */
function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}

const { pages, described } = await source.rawPages();
const sections = await readSectionRecords(input);
const samples = await Promise.all([readSample("sample-lemma.json"), readSample("sample-inflected.json")]);
const sampledStratum = new Map<number, string>();
for (const sample of samples) for (const record of sample.records) sampledStratum.set(record.line, sample.stratum);

const all = new Tally();
const byStratum = new Map(samples.map((sample) => [sample.stratum, new Tally()]));
const losses: {
  line: number;
  word: string;
  posTitle: string;
  revisionId: number;
  loss: string;
  stratum: string | null;
  recovered: {
    route: string;
    line: number;
    text: string;
    examples: number;
    heldAsExample: boolean;
    leadInLine: number | null;
    listedUnder: RecoveredDefinition["listedUnder"];
  }[];
  unrendered: { line: number; template: string }[];
}[] = [];
const unrendered: { word: string; line: number; template: string }[] = [];
/** Italian records whose word has no raw page at all. */
const withoutAPage: { line: number; word: string; posTitle: string }[] = [];
/** Pages a record was matched to whose revision is newer than the archive. */
const revisedAfterArchive = new Map<string, { revisionId: number; timestamp: string }>();

const report = await parseArchive({
  input,
  onRejection: () => {},
  onRecord: ({ lineNo, record }) => {
    const page = pages.page(record.word);
    if (page === undefined) {
      withoutAPage.push({ line: lineNo, word: record.word, posTitle: record.pos_title });
      return;
    }
    if (page.timestamp > ARCHIVE_BUILT) revisedAfterArchive.set(page.title, { revisionId: page.revisionId, timestamp: page.timestamp });
    const recovery = recoverDefinitions(recordText(record, sections.siblingsOf(lineNo, record)), page);
    all.add(recovery);
    const stratum = sampledStratum.get(lineNo);
    if (stratum !== undefined) byStratum.get(stratum)?.add(recovery);
    if (recovery.outcome !== "matched") return;
    for (const line of recovery.unrendered) unrendered.push({ word: record.word, line: line.ref.line, template: line.template });
    if (recovery.loss === "none" && recovery.unrendered.length === 0) return;
    losses.push({
      line: lineNo,
      word: record.word,
      posTitle: record.pos_title,
      revisionId: page.revisionId,
      loss: recovery.loss,
      stratum: stratum ?? null,
      recovered: recovery.recovered.map((definition) => ({
        route: definition.route,
        line: definition.ref.line,
        text: definition.text,
        examples: definition.examples.length,
        heldAsExample: definition.heldAsExample !== null,
        leadInLine: definition.leadIn?.ref.line ?? null,
        listedUnder: definition.listedUnder,
      })),
      unrendered: recovery.unrendered.map((line) => ({ line: line.ref.line, template: line.template })),
    });
  },
});

const projections = samples.map((sample) => {
  const tally = byStratum.get(sample.stratum) ?? new Tally();
  const scored = tally.outcomes.matched;
  const lossy = tally.loss.partial + tally.loss.full;
  const [low, high] = wilson(lossy, scored);
  return {
    stratum: sample.stratum,
    population: sample.population,
    sampled: sample.records.length,
    scored,
    lossy,
    full: tally.loss.full,
    partial: tally.loss.partial,
    definitions: tally.definitions,
    rate: scored === 0 ? 0 : lossy / scored,
    rateCi95: [low, high],
    projectedRecords: scored === 0 ? 0 : Math.round((lossy / scored) * sample.population),
    projectedRecordsCi95: [Math.round(low * sample.population), Math.round(high * sample.population)],
    tally,
  };
});

const result = {
  archiveSha256: report.archiveSha256,
  italianRecords: report.admitted,
  rawPageInput: described,
  rawPages: pages.size,
  archiveBuilt: ARCHIVE_BUILT,
  allRecordsWithAPage: all,
  recordsWithoutAPage: withoutAPage.length,
  pagesRevisedAfterArchive: [...revisedAfterArchive].map(([title, revision]) => ({ title, ...revision })),
  projections,
  losses,
  unrendered,
  withoutAPage,
};
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);

const line = (text: string) => process.stdout.write(`${text}\n`);
line(`archive ${report.archiveSha256.slice(0, 12)}…, ${report.admitted} Italian records, ${pages.size} raw pages from ${described}`);
line(`records with a raw page: ${all.records}; without one: ${withoutAPage.length}`);
line(`  pages revised after the archive was built (${ARCHIVE_BUILT}): ${revisedAfterArchive.size}`);
line(`  matched to one section: ${all.outcomes.matched}; no Italian section: ${all.outcomes["no-italian-section"]}; ` +
  `no matching section: ${all.outcomes["no-matching-section"]}; ambiguous: ${all.outcomes["ambiguous-section"]}`);
line(`  loss: full ${all.loss.full}, partial ${all.loss.partial}, none ${all.loss.none}`);
line(`  definitions recovered: ${all.definitions} (${Object.entries(all.byRoute).map(([route, n]) => `${route} ${n}`).join(", ")})`);
line(`  examples recovered with them: ${all.examples}; held by the record as an example: ${all.heldAsExample}`);
line(`  in a lead-in's list: under a record sense ${all.listedUnder.sense}, under a recovered definition ` +
  `${all.listedUnder.recovered}, lead-in not matched ${all.listedUnder.unplaced}`);
line(`  already a gloss: ${all.alreadyGlossed}; marked a definition but not rendered: ${all.unrendered}`);
for (const projection of projections) {
  line(`sample ${projection.stratum}: ${projection.lossy}/${projection.scored} scored records lose a definition ` +
    `(full ${projection.full}, partial ${projection.partial}), ${projection.definitions} definitions; ` +
    `rate ${(projection.rate * 100).toFixed(2)}% [${(projection.rateCi95[0] * 100).toFixed(2)}%, ${(projection.rateCi95[1] * 100).toFixed(2)}%] ` +
    `of ${projection.population} → ${projection.projectedRecords} [${projection.projectedRecordsCi95.join("–")}]`);
}
line(`details: ${output}`);
