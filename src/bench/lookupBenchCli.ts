// `pnpm run bench:lookup` — time lemma-link resolution through the
// `form_of_candidate` view against the inlined join lookup ships (#37).
//
// By default it needs no download: it writes a seeded synthetic archive at two
// sizes, seeds each through src/import/seedSql.ts into a scratch SQLite file,
// and times the same probes against both. `SEED_INPUT` (and optionally
// `SEED_RELEASE`), the variables `pnpm run seed:dev` reads, point it at a real
// archive instead. The output is Markdown, so a run can be pasted into a report.

import { mkdtemp, rm } from "node:fs/promises";
import { cpus, release, tmpdir, totalmem, type } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { flags, positive } from "../commandLine.js";
import { assertFormsAgree, chooseProbes, FormsDisagree, materialises, seedInto, timeProbe, type Timing } from "./lookupBench.js";
import { writeSyntheticArchive } from "./syntheticCorpus.js";

const USAGE =
  "usage: pnpm run bench:lookup [--records <n>,<n>] [--seed <n>] [--iterations <n>] [--warmups <n>]\n" +
  "       SEED_INPUT=<archive.jsonl.gz> [SEED_RELEASE=<id>] pnpm run bench:lookup [--iterations <n>] [--warmups <n>]";

/** One database to time: a synthetic corpus of a given size, or a real archive. */
type Corpus =
  | { kind: "synthetic"; seed: number; records: number }
  | { kind: "archive"; path: string; releaseId: string | undefined };

const wholeNumber = (text: string | undefined): number | undefined =>
  text !== undefined && /^\d+$/.test(text) ? Number(text) : undefined;

function parse(args: readonly string[], env: NodeJS.ProcessEnv): { corpora: Corpus[]; timing: Timing } | string {
  const values = flags(args, ["records", "seed", "iterations", "warmups"]);
  if (typeof values === "string") return values;
  const iterations = positive(values.get("iterations") ?? "5");
  const warmups = wholeNumber(values.get("warmups") ?? "1");
  if (iterations === undefined) return "--iterations must be a whole number above zero";
  if (warmups === undefined) return "--warmups must be a whole number";
  const timing = { iterations, warmups };
  if (env.SEED_INPUT !== undefined) {
    if (values.has("records") || values.has("seed")) return "--records and --seed describe the synthetic corpus; SEED_INPUT replaces it";
    return { corpora: [{ kind: "archive", path: resolve(env.SEED_INPUT), releaseId: env.SEED_RELEASE }], timing };
  }
  const seed = wholeNumber(values.get("seed") ?? "37");
  if (seed === undefined) return "--seed must be a whole number";
  const records = (values.get("records") ?? "140000,560000").split(",").map(positive);
  if (records.length === 0 || records.some((n) => n === undefined)) return "--records must be whole numbers above zero, comma-separated";
  return { corpora: records.map((n) => ({ kind: "synthetic", seed, records: n as number })), timing };
}

const ms = (value: number): string => (value >= 100 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value.toFixed(3));
const count = (value: number): string => value.toLocaleString("en-US");
const ratio = (value: number): string => (value >= 10 ? count(Math.round(value)) : value.toFixed(1));

async function benchOne(corpus: Corpus, timing: Timing, log: (line: string) => void): Promise<string[]> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-bench-"));
  const db = new DatabaseSync(join(dir, "bench.sqlite"));
  try {
    let archive: string;
    let releaseId: string | undefined;
    let heading: string;
    if (corpus.kind === "synthetic") {
      archive = join(dir, "synthetic.jsonl.gz");
      releaseId = `bench-${corpus.records}`;
      heading = `${count(corpus.records)} synthetic records`;
      log(`writing ${heading}`);
      await writeSyntheticArchive(archive, corpus.seed, corpus.records);
    } else {
      archive = corpus.path;
      releaseId = corpus.releaseId;
      heading = `archive ${corpus.path.split("/").at(-1)}`;
    }
    log(`seeding ${heading}`);
    const seedStart = process.hrtime.bigint();
    const seeded = await seedInto(db, archive, join(dir, "sql"), releaseId);
    const seedSeconds = Number(process.hrtime.bigint() - seedStart) / 1e9;
    const probes = chooseProbes(db, seeded.releaseId);
    // Before any timing: a pair that disagrees is a bug, not a result.
    assertFormsAgree(db, probes);
    const plan = materialises(db);
    const out = [
      `## ${heading}, release \`${seeded.releaseId}\``,
      "",
      `Seeded in ${seedSeconds.toFixed(1)} s: ${count(seeded.rows.source_record)} records, ` +
        `${count(seeded.rows.lookup_form)} lookup rows, ${count(seeded.rows.form_of_edge)} form-of edges. ` +
        `Plan materialises a view: through the view ${plan.view ? "yes" : "no"}, inlined ${plan.inlined ? "yes" : "no"}. ` +
        "Rows agree for every probe's readings.",
      "",
      "| probe | word | readings | with edges | view ms | inlined ms | view ÷ inlined | `lookup()` ms |",
      "|---|---|---:|---:|---:|---:|---:|---:|",
    ];
    for (const probe of probes) {
      log(`timing ${probe.label} '${probe.word}' (${probe.records.length} reading(s), ${probe.withEdges} with edges)`);
      const t = await timeProbe(db, seeded.releaseId, probe, timing);
      out.push(
        `| ${probe.label} | ${probe.word} | ${probe.records.length} | ${probe.withEdges} | ${ms(t.viewMs)} | ${ms(t.inlinedMs)} | ` +
          `${ratio(t.viewMs / t.inlinedMs)} | ${ms(t.lookupMs)} |`,
      );
    }
    return [...out, ""];
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const parsed = parse(process.argv.slice(2), process.env);
if (typeof parsed === "string") {
  process.stderr.write(`${parsed}\n${USAGE}\n`);
  process.exit(1);
}
const { corpora, timing } = parsed;
const probe = new DatabaseSync(":memory:");
const sqlite = (probe.prepare("SELECT sqlite_version() AS v").get() as { v: string }).v;
probe.close();
const [cpu] = cpus();
const lines = [
  `# bench:lookup, ${new Date().toISOString()}`,
  "",
  `- Node ${process.version}, SQLite ${sqlite} (node:sqlite)`,
  `- ${cpu?.model ?? "unknown CPU"}, ${cpus().length} cores, ${Math.round(totalmem() / 2 ** 30)} GB, ${type()} ${release()}`,
  corpora[0].kind === "synthetic" ? `- Synthetic corpus, seed ${corpora[0].seed}` : "- Real archive (SEED_INPUT)",
  `- ${timing.iterations} timed iteration(s) after ${timing.warmups} warmup(s); every figure is a median in ms`,
  "- `view` and `inlined`: one lemma-link query per reading of the word, all of them; `lookup()`: the whole lookup of the word",
  "",
];
try {
  for (const corpus of corpora) lines.push(...(await benchOne(corpus, timing, (line) => process.stderr.write(`${line}\n`))));
} catch (error: unknown) {
  if (!(error instanceof FormsDisagree)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
process.stdout.write(lines.join("\n"));
