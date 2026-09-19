// The lookup benchmark: generate a synthetic release at two scales, import
// both, and time the same queries against each. How to run it, what the flags
// do and the captured output are in docs/LOOKUP_BENCHMARK.md.
//
// Everything it prints is markdown, so that captured output is exactly what the
// command emits.

import { mkdir, rm, stat } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { importRelease } from "../src/import/importRelease.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { LEMMA_LINK_SQL, lookup } from "../src/lookup/lookup.js";
import { REAL_RELEASE, writeCorpus } from "./corpus.js";

const BENCH_DIR = ".data/bench";
const DEFAULT_SCALES = [140_000, REAL_RELEASE.records];
const DEFAULT_ITERATIONS = 25;
const WARMUP = 5;

// --- args -------------------------------------------------------------------

interface Args {
  scales: number[];
  iterations: number;
  seed: number;
  rebuild: boolean;
  /** Set together, these bench an existing database instead of a synthetic one. */
  database?: string;
  release?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { scales: [], iterations: DEFAULT_ITERATIONS, seed: 20260919, rebuild: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const value = argv[i + 1];
    switch (token) {
      case "--records":
        args.scales.push(Number(value));
        i += 1;
        break;
      case "--iterations":
        args.iterations = Number(value);
        i += 1;
        break;
      case "--seed":
        args.seed = Number(value);
        i += 1;
        break;
      case "--database":
        args.database = value;
        i += 1;
        break;
      case "--release":
        args.release = value;
        i += 1;
        break;
      case "--rebuild":
        args.rebuild = true;
        break;
      default:
        break;
    }
  }
  if (args.scales.length === 0) args.scales = [...DEFAULT_SCALES];
  return args;
}

// --- timing -----------------------------------------------------------------

/**
 * Median of `iterations` runs after `WARMUP` untimed ones.
 *
 * Median rather than mean: one GC pause should not become the headline number.
 * Min and max come back too, because a wide spread means the median is not
 * telling the whole story and the reader should know that.
 */
async function time(iterations: number, run: () => Promise<unknown>): Promise<{ median: number; min: number; max: number }> {
  for (let i = 0; i < WARMUP; i += 1) await run();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    await run();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return {
    median: samples[Math.floor(samples.length / 2)],
    min: samples[0],
    max: samples[samples.length - 1],
  };
}

const ms = (value: number): string => (value < 10 ? value.toFixed(2) : value.toFixed(1));

// --- the database under test ------------------------------------------------

interface Subject {
  label: string;
  releaseId: string;
  db: DatabaseSync;
  path: string;
}

async function buildSynthetic(records: number, seed: number, rebuild: boolean): Promise<Subject> {
  await mkdir(BENCH_DIR, { recursive: true });
  const releaseId = `bench-${records}-${seed}`;
  const archive = join(BENCH_DIR, `${releaseId}.jsonl.gz`);
  const database = join(BENCH_DIR, `${releaseId}.sqlite`);

  const built = await stat(database).then(() => true, () => false);
  if (rebuild || !built) {
    await rm(database, { force: true });
    await rm(`${database}-wal`, { force: true });
    await rm(`${database}-shm`, { force: true });
    process.stderr.write(`building ${releaseId}…\n`);
    const shape = await writeCorpus({ records, output: archive, seed });
    await importRelease({
      input: archive,
      database,
      schema: "src/db/schema.sql",
      releaseId,
      archiveR2Key: `bench/${releaseId}.jsonl.gz`,
      license: "CC-BY-SA-4.0",
    });
    process.stderr.write(
      `  ${shape.records} records, ${shape.embeddedForms} embedded forms, ${shape.formOfEdges} form_of edges\n`,
    );
  }

  return { label: `${records.toLocaleString("en-US")} records`, releaseId, db: new DatabaseSync(database), path: database };
}

interface Counts {
  records: number;
  lookupRows: number;
  edges: number;
  bytes: number;
}

async function counts(subject: Subject): Promise<Counts> {
  const one = (sql: string): number => (subject.db.prepare(sql).get() as { n: number }).n;
  return {
    records: one("SELECT COUNT(*) AS n FROM source_record"),
    lookupRows: one("SELECT COUNT(*) AS n FROM lookup_form"),
    edges: one("SELECT COUNT(*) AS n FROM form_of_edge"),
    bytes: (await stat(subject.path)).size,
  };
}

// --- probes -----------------------------------------------------------------

/**
 * Queries chosen from the database itself rather than hard-coded.
 *
 * A hard-coded word list would not survive a change of seed or scale, and — the
 * real problem — it would let someone quietly pick the easy words. These are
 * picked by how many readings they have, which is the variable under test.
 */
function probes(subject: Subject): { key: string; readings: number }[] {
  const rows = subject.db
    .prepare(
      `SELECT surface_key, COUNT(DISTINCT record_id) AS readings
         FROM lookup_form
        WHERE release_id = ?
        GROUP BY surface_key
        ORDER BY readings`,
    )
    .all(subject.releaseId) as { surface_key: string; readings: number }[];

  const chosen: { key: string; readings: number }[] = [];
  for (const wanted of [1, 2, 4, 8]) {
    // The first key with at least this many readings, so a corpus that cannot
    // reach 8 still yields a row rather than an error.
    const row = rows.find((candidate) => candidate.readings >= wanted && !chosen.some((c) => c.key === candidate.surface_key));
    if (row) chosen.push({ key: row.surface_key, readings: row.readings });
  }
  return chosen;
}

/** A record with an outgoing edge, for the view-versus-inlined comparison. */
function edgeRecord(subject: Subject): number | undefined {
  const row = subject.db
    .prepare(`SELECT record_id FROM form_of_edge WHERE release_id = ? LIMIT 1`)
    .get(subject.releaseId) as { record_id: number } | undefined;
  return row?.record_id;
}

/**
 * The shape the lemma-link query was rewritten away from: `form_of_candidate`
 * LEFT JOINed rather than its join inlined. Kept here, and only here, so the
 * cost of the mistake stays measurable without shipping it.
 */
const VIEW_LEMMA_LINK_SQL = `SELECT e.edge_id, e.json_pointer, e.target_word,
            c.candidate_record_id, c.candidate_line_no, c.candidate_pos
       FROM form_of_edge e
       JOIN source_release rel
         ON rel.release_id = e.release_id AND rel.status = 'complete'
       LEFT JOIN form_of_candidate c ON c.edge_id = e.edge_id
      WHERE e.record_id = ?`;

// --- report -----------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const subjects: Subject[] =
    args.database !== undefined && args.release !== undefined
      ? [{ label: "real release", releaseId: args.release, db: new DatabaseSync(args.database), path: args.database }]
      : await Promise.all(args.scales.map((records) => buildSynthetic(records, args.seed, args.rebuild)));

  const sqliteVersion = (subjects[0].db.prepare("SELECT sqlite_version() AS v").get() as { v: string }).v;

  const out: string[] = [];
  out.push("### Environment", "");
  out.push(`- Node ${process.version}, SQLite ${sqliteVersion}, \`node:sqlite\``);
  out.push(`- ${cpus()[0]?.model ?? "unknown cpu"}, ${cpus().length} cores, ${Math.round(totalmem() / 1e9)} GB, ${process.platform}-${process.arch}`);
  out.push(`- ${args.iterations} timed iterations after ${WARMUP} warmup runs; median reported`);
  out.push("");

  out.push("### Corpus", "");
  out.push("| Release | Records | Lookup rows | form_of edges | Database |");
  out.push("| --- | ---: | ---: | ---: | ---: |");
  const subjectCounts = new Map<string, Counts>();
  for (const subject of subjects) {
    const c = await counts(subject);
    subjectCounts.set(subject.label, c);
    out.push(
      `| ${subject.label} | ${c.records.toLocaleString("en-US")} | ${c.lookupRows.toLocaleString("en-US")} | ${c.edges.toLocaleString("en-US")} | ${(c.bytes / 1e9).toFixed(2)} GB |`,
    );
  }
  out.push("");

  out.push("### Lookup", "");
  out.push(`| Readings | ${subjects.map((s) => s.label).join(" | ")} |`);
  out.push(`| ---: | ${subjects.map(() => "---:").join(" | ")} |`);

  // Probes are chosen per database, so the rows line up on reading count rather
  // than on a word that may not exist in both.
  const perSubject = subjects.map((subject) => ({ subject, probes: probes(subject) }));
  const rowCount = Math.max(...perSubject.map((entry) => entry.probes.length));

  for (let row = 0; row < rowCount; row += 1) {
    const cells: string[] = [];
    let readings = 0;
    for (const { subject, probes: list } of perSubject) {
      const probe = list[row];
      if (probe === undefined) {
        cells.push("—");
        continue;
      }
      readings = probe.readings;
      const result = await time(args.iterations, () =>
        lookup({ db: fromNodeSqlite(subject.db), releaseId: subject.releaseId, query: probe.key }),
      );
      cells.push(`${ms(result.median)} ms`);
    }
    out.push(`| ${readings} | ${cells.join(" | ")} |`);
  }

  // A word in no record at all: the floor, and the case a release-size-bound
  // cost would show up in most clearly.
  const missCells: string[] = [];
  for (const subject of subjects) {
    const result = await time(args.iterations, () =>
      lookup({ db: fromNodeSqlite(subject.db), releaseId: subject.releaseId, query: "zzzznonesuchzzzz" }),
    );
    missCells.push(`${ms(result.median)} ms`);
  }
  out.push(`| 0 (miss) | ${missCells.join(" | ")} |`);
  out.push("");

  out.push("### Lemma links: view LEFT JOINed vs. its join inlined", "");
  out.push("| Release | Via `form_of_candidate` | Inlined | Rows |");
  out.push("| --- | ---: | ---: | ---: |");
  for (const subject of subjects) {
    const recordId = edgeRecord(subject);
    if (recordId === undefined) continue;
    const viaView = await time(args.iterations, async () => subject.db.prepare(VIEW_LEMMA_LINK_SQL).all(recordId));
    const inlined = await time(args.iterations, async () => subject.db.prepare(LEMMA_LINK_SQL).all(recordId));
    const rows = subject.db.prepare(LEMMA_LINK_SQL).all(recordId).length;
    const viewRows = subject.db.prepare(VIEW_LEMMA_LINK_SQL).all(recordId).length;
    if (rows !== viewRows) throw new Error(`the two lemma-link queries disagree: ${rows} vs ${viewRows}`);
    out.push(`| ${subject.label} | ${ms(viaView.median)} ms | ${ms(inlined.median)} ms | ${rows} |`);
  }

  for (const subject of subjects) subject.db.close();
  process.stdout.write(out.join("\n") + "\n");
}

await main();
