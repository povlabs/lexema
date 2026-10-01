// What the lookup benchmark measures (#37): resolving a reading's lemma links
// through the `form_of_candidate` view against the inlined join lookup ships
// (docs/LOOKUP_DESIGN.md#the-view-that-costs-four-orders-of-magnitude). Both
// return the same rows, so a rows-only test cannot tell them apart; this times
// them on one seeded database, and refuses to time a pair that disagrees.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import { seedSql } from "../import/seedSql.js";
import { fromNodeSqlite } from "../lookup/database.js";
import { LEMMA_LINK_SQL, SEARCH_SQL, lookup } from "../lookup/lookup.js";
import { servedBy } from "../lookup/served.js";

/**
 * `LEMMA_LINK_SQL` as it read before it was inlined: the same columns, with the
 * edge's candidates read through the view. Lookup never runs this; it is here
 * only to be timed against the form that replaced it.
 */
export const LEMMA_LINK_VIA_VIEW_SQL = `SELECT e.edge_id, e.json_pointer, e.target_word,
            t.record_id   AS candidate_record_id,
            t.release_id  AS candidate_release_id,
            t.line_no     AS candidate_line_no,
            t.line_sha256 AS candidate_line_sha256,
            t.pos         AS candidate_pos,
            t.word        AS candidate_word
       FROM form_of_edge e
       LEFT JOIN form_of_candidate c ON c.edge_id = e.edge_id
       LEFT JOIN source_record t ON t.record_id = c.candidate_record_id
      WHERE e.record_id = ?1 AND e.release_id IN (${servedBy("?2")})
      ORDER BY e.edge_id, t.line_no`;

/**
 * Every searchable key and how many readings a lookup of it finds: distinct
 * records, under the same auxiliary rule `SEARCH_SQL` applies. Probes are
 * picked off this count, never named by hand.
 */
const READING_COUNT_SQL = `SELECT lf.surface_key AS key, min(lf.surface) AS surface, count(DISTINCT lf.record_id) AS readings
       FROM lookup_form lf
      WHERE lf.release_id IN (${servedBy("?1")})
        AND NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')
      GROUP BY lf.surface_key
      ORDER BY readings DESC, lf.surface_key`;

/** Where in the reading-count ranking each probe is taken, most readings first. */
export const PROBE_RANKS = [
  { label: "most", at: 0 },
  { label: "p99", at: 0.01 },
  { label: "p90", at: 0.1 },
  { label: "p50", at: 0.5 },
] as const;

/** A word to look up, and the records a lookup of it reads lemma links for. */
export interface Probe {
  /** The master the lookup reads. */
  releaseId: string;
  label: string;
  word: string;
  key: string;
  records: readonly number[];
  /** How many of `records` declare a form-of edge: only those have lemma links to resolve. */
  withEdges: number;
}

/**
 * The probes for a release: the key at each rank of the reading-count ranking,
 * ties broken by key. A rank that lands on a key already taken is dropped.
 */
export function chooseProbes(db: DatabaseSync, releaseId: string): Probe[] {
  const ranked = db.prepare(READING_COUNT_SQL).all(releaseId) as { key: string; surface: string; readings: number }[];
  if (ranked.length === 0) throw new Error(`release ${releaseId} has no searchable key`);
  const search = db.prepare(SEARCH_SQL);
  const edges = db.prepare("SELECT EXISTS (SELECT 1 FROM form_of_edge WHERE record_id = ?) AS has");
  const probes: Probe[] = [];
  for (const { label, at } of PROBE_RANKS) {
    const { key, surface, readings } = ranked[Math.floor(at * (ranked.length - 1))];
    if (probes.some((probe) => probe.key === key)) continue;
    const records = [...new Set((search.all(releaseId, key) as { record_id: number }[]).map((row) => row.record_id))];
    // Lookup's own search is what decides a reading; the ranking only chose.
    if (records.length !== readings) {
      throw new Error(`'${surface}' ranked at ${readings} reading(s), but the search finds ${records.length}`);
    }
    const withEdges = records.filter((id) => (edges.get(id) as { has: number }).has === 1).length;
    probes.push({ releaseId, label, word: surface, key, records, withEdges });
  }
  return probes;
}

/** The two forms returned different rows for one record: nothing they timed would mean anything. */
export class FormsDisagree extends Error {
  constructor(readonly word: string, readonly recordId: number) {
    super(`the view and the inlined join disagree on record ${recordId}, a reading of '${word}'; no timing is reported`);
    this.name = "FormsDisagree";
  }
}

const rowsOf = (statement: StatementSync, recordId: number, releaseId: string): string =>
  JSON.stringify(statement.all(recordId, releaseId).map((row) => ({ ...row })));

/** Whether each form's query plan materialises a view. */
export function materialises(db: DatabaseSync): { view: boolean; inlined: boolean } {
  const plan = (sql: string) =>
    (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(1, "") as { detail: string }[]).some((row) => row.detail.includes("MATERIALIZE"));
  return { view: plan(LEMMA_LINK_VIA_VIEW_SQL), inlined: plan(LEMMA_LINK_SQL) };
}

/** Both forms over every probe's records; the first record they disagree on throws. */
export function assertFormsAgree(db: DatabaseSync, probes: readonly Probe[], viaView = LEMMA_LINK_VIA_VIEW_SQL): void {
  const view = db.prepare(viaView);
  const inlined = db.prepare(LEMMA_LINK_SQL);
  for (const probe of probes) {
    for (const recordId of probe.records) {
      if (rowsOf(view, recordId, probe.releaseId) !== rowsOf(inlined, recordId, probe.releaseId)) throw new FormsDisagree(probe.word, recordId);
    }
  }
}

export interface Timing {
  iterations: number;
  warmups: number;
}

/** Median of `iterations` timed runs of `run`, after `warmups` untimed ones, in milliseconds. */
async function median(run: () => unknown, { iterations, warmups }: Timing): Promise<number> {
  for (let i = 0; i < warmups; i += 1) await run();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = process.hrtime.bigint();
    await run();
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  return samples.length % 2 === 1 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2;
}

/** One probe's medians: every reading's lemma links through each form, and the whole lookup. */
export interface ProbeTiming {
  probe: Probe;
  viewMs: number;
  inlinedMs: number;
  lookupMs: number;
}

export async function timeProbe(db: DatabaseSync, releaseId: string, probe: Probe, timing: Timing): Promise<ProbeTiming> {
  const view = db.prepare(LEMMA_LINK_VIA_VIEW_SQL);
  const inlined = db.prepare(LEMMA_LINK_SQL);
  const each = (statement: StatementSync) => () => {
    for (const recordId of probe.records) statement.all(recordId, releaseId);
  };
  const reader = fromNodeSqlite(db);
  return {
    probe,
    viewMs: await median(each(view), timing),
    inlinedMs: await median(each(inlined), timing),
    lookupMs: await median(() => lookup({ db: reader, releaseId, query: probe.word }), timing),
  };
}

const SCHEMA = fileURLToPath(new URL("../db/schema.sql", import.meta.url));

/** Seed `archive` through the seed's own SQL generator and load every part into `db`. */
export async function seedInto(
  db: DatabaseSync,
  archive: string,
  outputDir: string,
  releaseId: string | undefined,
): Promise<{ releaseId: string; rows: Record<string, number> }> {
  const report = await seedSql({ input: archive, outputDir, schema: SCHEMA, releaseId, license: "CC-BY-SA-4.0" });
  if (report.status !== "complete") throw new Error(`release ${report.releaseId} seeded ${report.status}, not complete`);
  for (const part of report.parts) db.exec(await readFile(part, "utf8"));
  return { releaseId: report.releaseId, rows: report.rows };
}
