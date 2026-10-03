// The one-off update that writes the curated corrections (#420) into a master
// seeded before them, or before an entry was added: each entry keyed to the
// master's release gets the `corrected_claim` rows a seed now writes for it
// (src/import/correctedLayer.ts). Nothing else is touched, the record's line
// in `source_record_json` and its own `grammar_claim` rows least of all.
//
// The SQL is one file, run as one transaction, like a hide
// (src/import/hideRecords.ts). An entry whose rows the master already holds is
// left alone, so a second run plans nothing. An entry is written only to the
// record at its archive line with the digest it names, and never to a record a
// later release replaced: the newer source may say something else, so the run
// reports that entry instead of applying it to the replacement.

import { correctionId, type CuratedCorrection } from "../italian/curatedCorrections.js";
import { createStatement } from "../update/masterUpgrade.js";
import { readMasterRelease, select, type MasterReader } from "../update/master.js";
import { correctedClaimValues } from "./correctedLayer.js";
import { COLUMNS, literal, tupleOf } from "./seedSql.js";

/** What a run does with one entry of the list. */
export type PlannedCorrection =
  | { state: "write"; correction: CuratedCorrection; recordId: number }
  | { state: "already"; correction: CuratedCorrection; recordId: number }
  /** A later release's change replaced the record: reported, never carried over. */
  | { state: "retired"; correction: CuratedCorrection; recordId: number; replacedBy: { recordId: number; changeId: string } }
  | { state: "not-in-master"; correction: CuratedCorrection; why: "no-record-at-line" | "line-digest-differs" }
  /** Keyed to a release this master was not seeded from. */
  | { state: "other-release"; correction: CuratedCorrection };

export interface CorrectionPlan {
  masterReleaseId: string;
  /** Every entry of the list, in list order. */
  entries: PlannedCorrection[];
  /** Empty when there is nothing to write. */
  sql: string;
}

const json = (values: readonly unknown[]): string => literal(JSON.stringify(values));

/** A record's correction rows as one comparable string, in dimension order. */
const rowKey = (rows: readonly (readonly unknown[])[]): string =>
  JSON.stringify([...rows].map((row) => row.map(String)).sort((a, b) => (a[0] < b[0] ? -1 : 1)));

/**
 * Plan writing `corrections` into the master. It reads the master; it writes
 * nothing. `schema` is src/db/schema.sql, whose tables an older master gets.
 */
export function planCorrections(reader: MasterReader, corrections: readonly CuratedCorrection[], schema: string): CorrectionPlan {
  const master = readMasterRelease(reader);
  const release = literal(master.releaseId);
  const keyed = corrections.filter((correction) => correction.record.releaseId === master.releaseId);
  const lines = keyed.map((correction) => correction.record.lineNo);

  const atLine = new Map(
    select<{ record_id: number; line_no: number; line_sha256: string }>(
      reader,
      `SELECT record_id, line_no, line_sha256 FROM source_record WHERE release_id = ${release}
          AND line_no IN (SELECT value FROM json_each(${json(lines)}))`,
    ).map((row) => [row.line_no, row]),
  );
  const ids = [...atLine.values()].map((row) => row.record_id);
  const replaced = new Map(
    (master.upgraded
      ? select<{ replaced_record_id: number; record_id: number; change_id: string }>(
          reader,
          `SELECT replaced_record_id, record_id, change_id FROM applied_change
            WHERE replaced_record_id IN (SELECT value FROM json_each(${json(ids)}))`,
        )
      : []
    ).map((row) => [row.replaced_record_id, { recordId: row.record_id, changeId: row.change_id }]),
  );
  const tables = new Set(
    select<{ name: string }>(reader, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('corrected_claim', 'correction_version')").map((row) => row.name),
  );
  const held = new Map<number, unknown[][]>();
  if (tables.has("corrected_claim")) {
    for (const row of select<{ record_id: number; dimension: string; value: string; correction_id: string; evidence_url: string }>(
      reader,
      `SELECT record_id, dimension, value, correction_id, evidence_url FROM corrected_claim WHERE record_id IN (SELECT value FROM json_each(${json(ids)}))`,
    )) {
      held.set(row.record_id, [...(held.get(row.record_id) ?? []), [row.dimension, row.value, row.correction_id, row.evidence_url]]);
    }
  }

  const entries = corrections.map((correction): PlannedCorrection => {
    if (correction.record.releaseId !== master.releaseId) return { state: "other-release", correction };
    const record = atLine.get(correction.record.lineNo);
    if (record === undefined) return { state: "not-in-master", correction, why: "no-record-at-line" };
    if (record.line_sha256 !== correction.record.lineSha256) return { state: "not-in-master", correction, why: "line-digest-differs" };
    const replacedBy = replaced.get(record.record_id);
    if (replacedBy !== undefined) return { state: "retired", correction, recordId: record.record_id, replacedBy };
    const same = rowKey(held.get(record.record_id) ?? []) === rowKey(correctedClaimValues(correction));
    return { state: same ? "already" : "write", correction, recordId: record.record_id };
  });

  const writes = entries.flatMap((entry) => (entry.state === "write" ? [entry] : []));
  if (writes.length === 0) return { masterReleaseId: master.releaseId, entries, sql: "" };
  const written = json(writes.map((entry) => entry.recordId));
  const tuples = writes.flatMap((entry) =>
    correctedClaimValues(entry.correction).map((values) => tupleOf("corrected_claim", [entry.recordId, master.releaseId, ...values])),
  );
  const ifAbsent = (name: string): string[] =>
    tables.has(name) ? [] : [createStatement(schema, "TABLE", name).replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS")];
  const sql = [
    `-- Generated by src/import/correctRecords.ts: ${writes.length} curated correction(s) of ${master.releaseId}: ${writes.map((entry) => correctionId(entry.correction)).join(", ")}.`,
    ...ifAbsent("corrected_claim"),
    ...ifAbsent("correction_version"),
    `INSERT INTO correction_version (singleton, revision) VALUES (1, 1)
       ON CONFLICT(singleton) DO UPDATE SET revision = revision + 1;`,
    // An entry's rows are replaced whole, so a fact the list no longer sets goes with the rest.
    `DELETE FROM corrected_claim WHERE record_id IN (SELECT value FROM json_each(${written}));`,
    `INSERT INTO corrected_claim (${COLUMNS.corrected_claim}) VALUES\n  ${tuples.join(",\n  ")};`,
  ];
  return { masterReleaseId: master.releaseId, entries, sql: `${sql.join("\n")}\n` };
}

/** Entries the plan writes whose rows the master does not read back exactly. */
export function unwritten(reader: MasterReader, plan: CorrectionPlan): string[] {
  const writes = plan.entries.flatMap((entry) => (entry.state === "write" ? [entry] : []));
  if (writes.length === 0) return [];
  const held = new Map<number, unknown[][]>();
  for (const row of select<{ record_id: number; dimension: string; value: string; correction_id: string; evidence_url: string }>(
    reader,
    `SELECT record_id, dimension, value, correction_id, evidence_url FROM corrected_claim
      WHERE record_id IN (SELECT value FROM json_each(${json(writes.map((entry) => entry.recordId))}))`,
  )) {
    held.set(row.record_id, [...(held.get(row.record_id) ?? []), [row.dimension, row.value, row.correction_id, row.evidence_url]]);
  }
  return writes
    .filter((entry) => rowKey(held.get(entry.recordId) ?? []) !== rowKey(correctedClaimValues(entry.correction)))
    .map((entry) => correctionId(entry.correction));
}

/** One line per entry, for the run's report. */
export function describeEntry(entry: PlannedCorrection): string {
  const { word, lineNo, releaseId } = entry.correction.record;
  const head = `  ${correctionId(entry.correction)} ${word}`;
  switch (entry.state) {
    case "write":
      return `${head} (record ${entry.recordId}): written`;
    case "already":
      return `${head} (record ${entry.recordId}): already written`;
    case "retired":
      return `${head} (record ${entry.recordId}): not written; change ${entry.replacedBy.changeId} replaced the record with record ${entry.replacedBy.recordId}, which the correction does not reach. Check the newer record against the entry's evidence.`;
    case "not-in-master":
      return `${head}: not written; ${entry.why === "no-record-at-line" ? `the master holds no record at line ${lineNo}` : `the record at line ${lineNo} is not the line the entry names`}`;
    case "other-release":
      return `${head}: keyed to ${releaseId}, not this master`;
  }
}
