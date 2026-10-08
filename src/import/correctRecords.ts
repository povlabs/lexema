// The one-off update that writes the curated corrections (#420, #450, #722)
// into a master seeded before them, or before an entry was added: each record
// entry keyed to the master's release gets the `corrected_claim` rows a seed
// now writes for it (src/import/correctedLayer.ts), each edge entry its
// `corrected_edge` row, and each definition entry the `corrected_definition`
// row (src/import/correctedDefinitions.ts). Nothing else is touched, the
// record's line in `source_record_json`, its own `grammar_claim` and
// `form_of_edge` rows and the entry's own `entry_definition` rows least of
// all. An edge entry of a hidden record is reported, not written (ADR 0023).
//
// The SQL is one file, run as one transaction, like a hide
// (src/import/hideRecords.ts). It holds no DDL: it writes into the tables
// `update:upgrade` creates (src/update/masterUpgrade.ts), and the command
// refuses to write while one is missing (`missingForCorrections`, #509). An
// entry whose rows the master already holds is
// left alone, so a second run plans nothing. A record entry is written only to
// the record at its archive line with the digest it names, and never to a
// record a later release replaced: the newer source may say something else, so
// the run reports that entry instead of applying it to the replacement. A
// definition entry is written only to the master's page-only entry read from
// the revision it names, quoting its definition; an entry read from another
// revision, or none, is reported the same way (ADR 0025).

import {
  correctionId,
  definitionCorrections,
  definitionMismatch,
  edgeCorrections,
  recordCorrections,
  type CuratedCorrection,
  type DefinitionCorrection,
  type DefinitionMismatch,
  type EdgeCorrection,
  type RecordCorrection,
} from "../italian/curatedCorrections.js";
import { boundedInserts } from "../update/apply.js";
import { PAGE_ENTRY_TABLES } from "../lookup/served.js";
import { CORRECTION_TABLES, PAGE_ENTRY_CORRECTION_TABLES } from "../update/masterUpgrade.js";
import { readMasterRelease, select, upgradeNeededFor, type MasterReader } from "../update/master.js";
import { PlanCounts } from "../update/planCounts.js";
import { correctedDefinitionValues } from "./correctedDefinitions.js";
import { correctedClaimValues, correctedEdgeValues } from "./correctedLayer.js";
import { COLUMNS, literal, tupleOf } from "./seedSql.js";

/** What a run does with one record entry of the list. */
export type PlannedCorrection =
  | { state: "write"; correction: RecordCorrection; recordId: number }
  | { state: "already"; correction: RecordCorrection; recordId: number }
  /** A later release's change replaced the record: reported, never carried over. */
  | { state: "retired"; correction: RecordCorrection; recordId: number; replacedBy: { recordId: number; changeId: string } }
  | { state: "not-in-master"; correction: RecordCorrection; why: "no-record-at-line" | "line-digest-differs" }
  /** Keyed to a release this master was not seeded from. */
  | { state: "other-release"; correction: RecordCorrection };

/** What a run does with one edge entry of the list. */
export type PlannedEdgeCorrection =
  | { state: "write"; correction: EdgeCorrection; recordId: number }
  | { state: "already"; correction: EdgeCorrection; recordId: number }
  /** A later release's change replaced the record: reported, never carried over. */
  | { state: "retired"; correction: EdgeCorrection; recordId: number; replacedBy: { recordId: number; changeId: string } }
  /** The record is hidden (ADR 0023): it declares no edge, and no correction gives it one. */
  | { state: "hidden"; correction: EdgeCorrection; recordId: number }
  | { state: "not-in-master"; correction: EdgeCorrection; why: "no-record-at-line" | "line-digest-differs" }
  /** Keyed to a release this master was not seeded from. */
  | { state: "other-release"; correction: EdgeCorrection };

/** What a run does with one definition entry of the list. */
export type PlannedDefinitionCorrection =
  | { state: "write"; correction: DefinitionCorrection; entryId: number }
  | { state: "already"; correction: DefinitionCorrection; entryId: number }
  /** The master holds no page-only entry of the title, or not the one the entry was checked against: reported, never applied. */
  | { state: "not-in-master"; correction: DefinitionCorrection; why: "no-entry" | DefinitionMismatch };

export interface CorrectionPlan {
  masterReleaseId: string;
  /** Every record entry of the list, in list order. */
  entries: PlannedCorrection[];
  /** Every edge entry of the list, in list order. */
  edges: PlannedEdgeCorrection[];
  /** Every definition entry of the list, in list order. */
  definitions: PlannedDefinitionCorrection[];
  /** Empty when there is nothing to write. */
  sql: string;
  /** What `sql` writes, counted (#490); `PlanCounts.NONE` when it is empty. */
  counts: PlanCounts;
}

const json = (values: readonly unknown[]): string => literal(JSON.stringify(values));

/** A record's correction rows as one comparable string, in dimension order. */
const rowKey = (rows: readonly (readonly unknown[])[]): string =>
  JSON.stringify([...rows].map((row) => row.map(String)).sort((a, b) => (a[0] < b[0] ? -1 : 1)));

/** Which of `names` the master has. */
const tablesIn = (reader: MasterReader, names: readonly string[]): Set<string> =>
  new Set(select<{ name: string }>(reader, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (SELECT value FROM json_each(${json(names)}))`).map((row) => row.name));

/** What the upgrade creates for the corrections to write into: the record facts, their cache revision, and the definition corrections. */
const CORRECTION_UPGRADE: readonly string[] = [...CORRECTION_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES];

/** The upgrade names the corrections write into that the master lacks: run `update:upgrade` before the plan's SQL while any is listed. */
export const missingForCorrections = (reader: MasterReader): string[] => upgradeNeededFor(reader, CORRECTION_UPGRADE);

/**
 * Plan writing `corrections` into the master. It reads the master; it writes
 * nothing. A master without the tables it writes into is read as holding no
 * correction yet, so the plan counts the same before the upgrade as after it.
 */
export function planCorrections(reader: MasterReader, corrections: readonly CuratedCorrection[]): CorrectionPlan {
  const master = readMasterRelease(reader);
  const tables = tablesIn(reader, ["corrected_claim", "corrected_edge", "corrected_definition", "hidden_record", ...PAGE_ENTRY_TABLES]);
  const records = recordCorrections(corrections);
  const edgeEntries = edgeCorrections(corrections);
  const keyed = recordsAt(reader, master, [...records, ...edgeEntries].filter((correction) => correction.record.releaseId === master.releaseId).map((correction) => correction.record.lineNo), tables);
  const entries = planRecords(reader, master.releaseId, keyed, records, tables);
  const edges = planEdges(reader, master.releaseId, keyed, edgeEntries, tables);
  const definitions = planDefinitions(reader, master.releaseId, definitionCorrections(corrections), tables);

  const writes = entries.flatMap((entry) => (entry.state === "write" ? [entry] : []));
  const edgeWrites = edges.flatMap((entry) => (entry.state === "write" ? [entry] : []));
  const definitionWrites = definitions.flatMap((entry) => (entry.state === "write" ? [entry] : []));
  if (writes.length + edgeWrites.length + definitionWrites.length === 0) {
    return { masterReleaseId: master.releaseId, entries, edges, definitions, sql: "", counts: PlanCounts.NONE };
  }
  const written = [...writes, ...edgeWrites, ...definitionWrites].map((entry) => correctionId(entry.correction));
  const sql = [
    `-- Generated by src/import/correctRecords.ts: ${written.length} curated correction(s) of ${master.releaseId}: ${written.join(", ")}.`,
    `INSERT INTO correction_version (singleton, revision) VALUES (1, 1)
       ON CONFLICT(singleton) DO UPDATE SET revision = revision + 1;`,
  ];
  const claimTuples = writes.flatMap((entry) =>
    correctedClaimValues(entry.correction).map((values) => tupleOf("corrected_claim", [entry.recordId, master.releaseId, ...values])),
  );
  const definitionTuples = definitionWrites.map((entry) =>
    tupleOf("corrected_definition", [entry.entryId, entry.correction.replaces.index, ...correctedDefinitionValues(entry.correction)]),
  );
  if (writes.length > 0) {
    sql.push(
      // An entry's rows are replaced whole, so a fact the list no longer sets goes with the rest.
      `DELETE FROM corrected_claim WHERE record_id IN (SELECT value FROM json_each(${json(writes.map((entry) => entry.recordId))}));`,
      `INSERT INTO corrected_claim (${COLUMNS.corrected_claim}) VALUES\n  ${claimTuples.join(",\n  ")};`,
    );
  }
  const edgeTuples = edgeWrites.map((entry) => tupleOf("corrected_edge", [entry.recordId, master.releaseId, ...correctedEdgeValues(entry.correction)]));
  if (edgeWrites.length > 0) {
    sql.push(
      // An edge entry replaces the row its sense holds, if any.
      `DELETE FROM corrected_edge WHERE (record_id, sense_index) IN (SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(${json(edgeWrites.map((entry) => [entry.recordId, entry.correction.edge.sense]))}));`,
      ...boundedInserts("corrected_edge", edgeTuples),
    );
  }
  if (definitionWrites.length > 0) {
    sql.push(
      ...definitionWrites.map((entry) => `DELETE FROM corrected_definition WHERE entry_id = ${entry.entryId} AND definition_index = ${entry.correction.replaces.index};`),
      `INSERT INTO corrected_definition (${COLUMNS.corrected_definition}) VALUES\n  ${definitionTuples.join(",\n  ")};`,
    );
  }
  // Each written record changes in place: its rows already held go with the DELETE, and the INSERT writes them anew.
  // A record whose facts and edges are both written changes once.
  // A definition entry changes no record, so it counts in rows only: the row it replaces, if held, and the row it writes.
  const heldClaimRows = tables.has("corrected_claim") && writes.length > 0 ? heldClaims(reader, writes.map((entry) => entry.recordId)) : new Map<number, unknown[][]>();
  const heldEdgeRows = tables.has("corrected_edge") && edgeWrites.length > 0 ? heldEdges(reader, edgeWrites.map((entry) => entry.recordId)) : new Map<string, string>();
  const heldDefinitionRows = tables.has("corrected_definition") && definitionWrites.length > 0
    ? heldDefinitions(reader, definitionWrites.map((entry) => entry.entryId))
    : new Map<string, string>();
  const counts = new PlanCounts(
    { added: 0, changed: new Set([...writes, ...edgeWrites].map((entry) => entry.recordId)).size, removed: 0 },
    { corrected_claim: claimTuples.length, corrected_edge: edgeTuples.length, corrected_definition: definitionTuples.length, correction_version: 1 },
    {
      corrected_claim: writes.reduce((rows, entry) => rows + (heldClaimRows.get(entry.recordId)?.length ?? 0), 0),
      corrected_edge: edgeWrites.filter((entry) => heldEdgeRows.has(`${entry.recordId}:${entry.correction.edge.sense}`)).length,
      corrected_definition: definitionWrites.filter((entry) => heldDefinitionRows.has(`${entry.entryId}:${entry.correction.replaces.index}`)).length,
    },
  );
  return { masterReleaseId: master.releaseId, entries, edges, definitions, sql: `${sql.join("\n")}\n`, counts };
}

/** What the master holds at the archive lines the list keys to its release. */
interface KeyedRecords {
  /** The master release's record at each line, with its digest. */
  atLine: Map<number, { record_id: number; line_no: number; line_sha256: string }>;
  /** The records a later release's change replaced, and by what. */
  replaced: Map<number, { recordId: number; changeId: string }>;
  /** The hidden records among them (ADR 0023). */
  hidden: Set<number>;
}

function recordsAt(reader: MasterReader, master: ReturnType<typeof readMasterRelease>, lines: readonly number[], tables: ReadonlySet<string>): KeyedRecords {
  const atLine = new Map(
    select<{ record_id: number; line_no: number; line_sha256: string }>(
      reader,
      `SELECT record_id, line_no, line_sha256 FROM source_record WHERE release_id = ${literal(master.releaseId)}
          AND line_no IN (SELECT value FROM json_each(${json([...new Set(lines)])}))`,
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
  const hidden = new Set(
    tables.has("hidden_record")
      ? select<{ record_id: number }>(reader, `SELECT record_id FROM hidden_record WHERE record_id IN (SELECT value FROM json_each(${json(ids)}))`).map((row) => row.record_id)
      : [],
  );
  return { atLine, replaced, hidden };
}

/** Where `correction`'s record stands in the master, before what it holds of the correction is read. */
function standing(
  correction: RecordCorrection | EdgeCorrection,
  releaseId: string,
  keyed: KeyedRecords,
):
  | { state: "other-release" }
  | { state: "not-in-master"; why: "no-record-at-line" | "line-digest-differs" }
  | { state: "retired"; recordId: number; replacedBy: { recordId: number; changeId: string } }
  | { state: "served"; recordId: number } {
  if (correction.record.releaseId !== releaseId) return { state: "other-release" };
  const record = keyed.atLine.get(correction.record.lineNo);
  if (record === undefined) return { state: "not-in-master", why: "no-record-at-line" };
  if (record.line_sha256 !== correction.record.lineSha256) return { state: "not-in-master", why: "line-digest-differs" };
  const replacedBy = keyed.replaced.get(record.record_id);
  if (replacedBy !== undefined) return { state: "retired", recordId: record.record_id, replacedBy };
  return { state: "served", recordId: record.record_id };
}

function planRecords(
  reader: MasterReader,
  releaseId: string,
  keyed: KeyedRecords,
  corrections: readonly RecordCorrection[],
  tables: ReadonlySet<string>,
): PlannedCorrection[] {
  const ids = [...keyed.atLine.values()].map((row) => row.record_id);
  const held = tables.has("corrected_claim") ? heldClaims(reader, ids) : new Map<number, unknown[][]>();
  return corrections.map((correction): PlannedCorrection => {
    const stands = standing(correction, releaseId, keyed);
    if (stands.state !== "served") return { ...stands, correction };
    const same = rowKey(held.get(stands.recordId) ?? []) === rowKey(correctedClaimValues(correction));
    return { state: same ? "already" : "write", correction, recordId: stands.recordId };
  });
}

function planEdges(
  reader: MasterReader,
  releaseId: string,
  keyed: KeyedRecords,
  corrections: readonly EdgeCorrection[],
  tables: ReadonlySet<string>,
): PlannedEdgeCorrection[] {
  const ids = [...keyed.atLine.values()].map((row) => row.record_id);
  const held = tables.has("corrected_edge") && corrections.length > 0 ? heldEdges(reader, ids) : new Map<string, string>();
  return corrections.map((correction): PlannedEdgeCorrection => {
    const stands = standing(correction, releaseId, keyed);
    if (stands.state !== "served") return { ...stands, correction };
    if (keyed.hidden.has(stands.recordId)) return { state: "hidden", correction, recordId: stands.recordId };
    const same = held.get(`${stands.recordId}:${correction.edge.sense}`) === JSON.stringify(correctedEdgeValues(correction));
    return { state: same ? "already" : "write", correction, recordId: stands.recordId };
  });
}

/** The `corrected_edge` rows the master holds on `ids`, by record and sense, as comparable strings. */
function heldEdges(reader: MasterReader, ids: readonly number[]): Map<string, string> {
  return new Map(
    select<{
      record_id: number;
      sense_index: number;
      json_pointer: string;
      target_word: string;
      target_word_key: string;
      correction_id: string;
      lemma_line_no: number;
      lemma_line_sha256: string;
      lemma_pointer: string;
    }>(
      reader,
      `SELECT record_id, sense_index, json_pointer, target_word, target_word_key, correction_id, lemma_line_no, lemma_line_sha256, lemma_pointer
         FROM corrected_edge WHERE record_id IN (SELECT value FROM json_each(${json([...new Set(ids)])}))`,
    ).map((row) => [
      `${row.record_id}:${row.sense_index}`,
      JSON.stringify([row.sense_index, row.json_pointer, row.target_word, row.target_word_key, row.correction_id, row.lemma_line_no, row.lemma_line_sha256, row.lemma_pointer]),
    ]),
  );
}

function heldClaims(reader: MasterReader, ids: readonly number[]): Map<number, unknown[][]> {
  const held = new Map<number, unknown[][]>();
  for (const row of select<{ record_id: number; dimension: string; value: string; correction_id: string; evidence_url: string }>(
    reader,
    `SELECT record_id, dimension, value, correction_id, evidence_url FROM corrected_claim WHERE record_id IN (SELECT value FROM json_each(${json(ids)}))`,
  )) {
    held.set(row.record_id, [...(held.get(row.record_id) ?? []), [row.dimension, row.value, row.correction_id, row.evidence_url]]);
  }
  return held;
}

interface HeldEntry {
  entryId: number;
  revisionId: number;
  definitions: { line: number; wikitext: string; text: string }[];
}

/** The master's page-only entries of `titles` under its release, by title. */
function entriesOf(reader: MasterReader, releaseId: string, titles: readonly string[]): Map<string, HeldEntry> {
  const entries = new Map<number, HeldEntry & { title: string }>();
  for (const row of select<{ entry_id: number; word: string; revision_id: number }>(
    reader,
    `SELECT e.entry_id, e.word, p.revision_id FROM recovered_entry e JOIN raw_page p ON p.page_id = e.page_id
      WHERE e.release_id = ${literal(releaseId)} AND e.word IN (SELECT value FROM json_each(${json(titles)}))`,
  )) {
    entries.set(row.entry_id, { entryId: row.entry_id, title: row.word, revisionId: row.revision_id, definitions: [] });
  }
  for (const row of select<{ entry_id: number; page_line: number; wikitext: string; text: string }>(
    reader,
    `SELECT entry_id, page_line, wikitext, text FROM entry_definition
      WHERE entry_id IN (SELECT value FROM json_each(${json([...entries.keys()])})) ORDER BY entry_id, definition_index`,
  )) {
    entries.get(row.entry_id)?.definitions.push({ line: row.page_line, wikitext: row.wikitext, text: row.text });
  }
  return new Map([...entries.values()].map((entry) => [entry.title, entry]));
}

/** The `corrected_definition` rows the master holds on `entryIds`, by entry and place, as comparable strings. */
function heldDefinitions(reader: MasterReader, entryIds: readonly number[]): Map<string, string> {
  return new Map(
    select<{ entry_id: number; definition_index: number; text: string; correction_id: string; evidence_url: string }>(
      reader,
      `SELECT entry_id, definition_index, text, correction_id, evidence_url FROM corrected_definition
        WHERE entry_id IN (SELECT value FROM json_each(${json(entryIds)}))`,
    ).map((row) => [`${row.entry_id}:${row.definition_index}`, JSON.stringify([row.text, row.correction_id, row.evidence_url])]),
  );
}

function planDefinitions(
  reader: MasterReader,
  releaseId: string,
  corrections: readonly DefinitionCorrection[],
  tables: ReadonlySet<string>,
): PlannedDefinitionCorrection[] {
  // A master seeded before page-only entries (#403) holds none to correct.
  const hasEntries = PAGE_ENTRY_TABLES.every((name) => tables.has(name));
  const entries = hasEntries && corrections.length > 0
    ? entriesOf(reader, releaseId, corrections.map((correction) => correction.entry.title))
    : new Map<string, HeldEntry>();
  const held = tables.has("corrected_definition") && entries.size > 0
    ? heldDefinitions(reader, [...entries.values()].map((entry) => entry.entryId))
    : new Map<string, string>();
  return corrections.map((correction): PlannedDefinitionCorrection => {
    const entry = entries.get(correction.entry.title);
    if (entry === undefined) return { state: "not-in-master", correction, why: "no-entry" };
    const mismatch = definitionMismatch(correction, entry);
    if (mismatch !== undefined) return { state: "not-in-master", correction, why: mismatch };
    const same = held.get(`${entry.entryId}:${correction.replaces.index}`) === JSON.stringify(correctedDefinitionValues(correction));
    return { state: same ? "already" : "write", correction, entryId: entry.entryId };
  });
}

/** Entries the plan writes whose rows the master does not read back exactly. */
export function unwritten(reader: MasterReader, plan: CorrectionPlan): string[] {
  const writes = plan.entries.flatMap((entry) => (entry.state === "write" ? [entry] : []));
  const edgeWrites = plan.edges.flatMap((entry) => (entry.state === "write" ? [entry] : []));
  const definitionWrites = plan.definitions.flatMap((entry) => (entry.state === "write" ? [entry] : []));
  const held = writes.length === 0 ? new Map<number, unknown[][]>() : heldClaims(reader, writes.map((entry) => entry.recordId));
  const heldEdge = edgeWrites.length === 0 ? new Map<string, string>() : heldEdges(reader, edgeWrites.map((entry) => entry.recordId));
  const heldDefinition = definitionWrites.length === 0 ? new Map<string, string>() : heldDefinitions(reader, definitionWrites.map((entry) => entry.entryId));
  return [
    ...writes
      .filter((entry) => rowKey(held.get(entry.recordId) ?? []) !== rowKey(correctedClaimValues(entry.correction)))
      .map((entry) => correctionId(entry.correction)),
    ...edgeWrites
      .filter((entry) => heldEdge.get(`${entry.recordId}:${entry.correction.edge.sense}`) !== JSON.stringify(correctedEdgeValues(entry.correction)))
      .map((entry) => correctionId(entry.correction)),
    ...definitionWrites
      .filter((entry) => heldDefinition.get(`${entry.entryId}:${entry.correction.replaces.index}`) !== JSON.stringify(correctedDefinitionValues(entry.correction)))
      .map((entry) => correctionId(entry.correction)),
  ];
}

/** One line per record or edge entry, for the run's report. */
export function describeEntry(entry: PlannedCorrection | PlannedEdgeCorrection): string {
  const { word, lineNo, releaseId } = entry.correction.record;
  const head = `  ${correctionId(entry.correction)} ${word}`;
  switch (entry.state) {
    case "hidden":
      return `${head} (record ${entry.recordId}): not written; the record is hidden, and a hidden record declares no edge`;
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

/** One line per definition entry, for the run's report. */
export function describeDefinition(entry: PlannedDefinitionCorrection): string {
  const { title, revisionId } = entry.correction.entry;
  const head = `  ${correctionId(entry.correction)} ${title}`;
  switch (entry.state) {
    case "write":
      return `${head} (entry ${entry.entryId}): written`;
    case "already":
      return `${head} (entry ${entry.entryId}): already written`;
    case "not-in-master":
      switch (entry.why) {
        case "no-entry":
          return `${head}: not written; the master holds no page-only entry of ${title}`;
        case "revision-differs":
          return `${head}: not written; the master's entry of ${title} was read from another revision than ${revisionId}, which the correction does not reach. Check the newer page against the entry's evidence.`;
        case "definition-differs":
          return `${head}: not written; the master's entry of ${title} does not hold the definition the entry quotes at place ${entry.correction.replaces.index}`;
      }
  }
}
