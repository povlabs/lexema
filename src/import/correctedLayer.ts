// Writes the curated corrections (#420, #722, #723) beside the records a seed streams.
//
// Each entry of the committed list (src/italian/curatedCorrections.ts) keyed
// to a record names it by release, archive line and line digest. When the seed
// writes that line with that digest, each fact the entry sets becomes one
// `corrected_claim` row and each cell one `corrected_form` row, naming the
// entry and the revision it cites, and each edge one `corrected_edge` row,
// naming the entry and the two page revisions it cites. A line whose digest
// differs is another record, and gets none: the list was checked against those
// bytes and no others. A hidden record gets no edge (ADR 0023), as it gets no
// `form_of_edge` row. The record's own rows, its line in `source_record_json`
// least of all, are written by `writeRecord` and are not touched here.

import { normalizeItalianExact } from "../italian/normalize.js";
import {
  cellCorrections,
  correctedFacts,
  correctionId,
  edgeCorrections,
  evidenceUrl,
  recordCorrections,
  type CellCorrection,
  type CuratedCorrection,
  type EdgeCorrection,
  type RecordCorrection,
} from "../italian/curatedCorrections.js";
import type { ImportStatement } from "./importRelease.js";

/** One `corrected_claim` row's values after its record id and release, in `COLUMNS` order. */
export function correctedClaimValues(correction: RecordCorrection): [dimension: string, value: string, correctionId: string, evidenceUrl: string][] {
  return correctedFacts(correction).map((fact) => [fact.dimension, fact.value, correctionId(correction), evidenceUrl(correction.evidence[0])]);
}

/** One `corrected_form` row's values after its record id and release, in `COLUMNS` order, one per cell. */
export function correctedFormValues(correction: CellCorrection): [formIndex: number, surface: string, correctionId: string, evidenceUrl: string][] {
  return correction.cells.map((cell) => [cell.index, cell.surface, correctionId(correction), evidenceUrl(correction.evidence[0])]);
}

/**
 * The cells of `correction` whose text on `line` is not the one it replaces.
 * The digest already pins the line, so a cell named here is a list entry that
 * misquotes its own record.
 */
export function misquotedCells(correction: CellCorrection, line: string): number[] {
  const forms = (JSON.parse(line) as { forms?: { form?: unknown }[] }).forms ?? [];
  return correction.cells.filter((cell) => forms[cell.index]?.form !== cell.replaces).map((cell) => cell.index);
}

/** One `corrected_edge` row's values after its record id and release, in `COLUMNS` order. */
export function correctedEdgeValues(
  correction: EdgeCorrection,
): [senseIndex: number, jsonPointer: string, targetWord: string, targetWordKey: string, correctionId: string, evidenceUrl: string, baseEvidenceUrl: string] {
  const { edge, evidence } = correction;
  return [edge.sense, edge.gloss.pointer, edge.target, normalizeItalianExact(edge.target), correctionId(correction), evidenceUrl(evidence.form), evidenceUrl(evidence.base)];
}

/** Why an entry keyed to the seeded release was not written. */
export type UnappliedReason = "line-digest-differs" | "line-not-seeded" | "record-hidden";

/** What one seed did with the list: the count reported after every run. */
export interface CorrectionSummary {
  /** Entries keyed to the seeded release. */
  keyed: number;
  /** Entries written, each as one row per fact, cell or edge it sets. */
  applied: number;
  /** Entries keyed to the seeded release that were not written, and why. */
  unapplied: { id: string; reason: UnappliedReason }[];
}

/** A record's entries of the list: its facts, its cells, and its edges by sense. */
interface EntriesOfLine {
  facts?: RecordCorrection;
  cells?: CellCorrection;
  edges: EdgeCorrection[];
}

/** Every entry of a record's line: facts, then cells, then edges. */
const allOf = ({ facts, cells, edges }: EntriesOfLine): (RecordCorrection | CellCorrection | EdgeCorrection)[] => [
  ...(facts === undefined ? [] : [facts]),
  ...(cells === undefined ? [] : [cells]),
  ...edges,
];

export class CorrectedLayer {
  private readonly byLine = new Map<string, EntriesOfLine>();
  private readonly applied = new Set<string>();
  private readonly unapplied = new Map<string, UnappliedReason>();
  private releaseId: string | undefined;

  constructor(
    corrections: readonly CuratedCorrection[],
    private readonly insert: { claim: ImportStatement; form: ImportStatement; edge: ImportStatement },
    private readonly rows: { corrected_claim: number; corrected_form: number; corrected_edge: number },
  ) {
    const entriesOf = (correction: RecordCorrection | CellCorrection | EdgeCorrection): EntriesOfLine => {
      const key = `${correction.record.releaseId}:${correction.record.lineNo}`;
      const entries = this.byLine.get(key) ?? { edges: [] };
      this.byLine.set(key, entries);
      return entries;
    };
    for (const correction of recordCorrections(corrections)) entriesOf(correction).facts = correction;
    for (const correction of cellCorrections(corrections)) entriesOf(correction).cells = correction;
    for (const correction of edgeCorrections(corrections)) entriesOf(correction).edges.push(correction);
  }

  /** Write the corrections keyed to this record's line, when its digest is the one they were checked against. */
  add(record: { releaseId: string; recordId: number; lineNo: number; line: string; lineSha256: string }, hidden: boolean): void {
    this.releaseId = record.releaseId;
    const entries = this.byLine.get(`${record.releaseId}:${record.lineNo}`);
    if (entries === undefined) return;
    const { facts, cells, edges } = entries;
    for (const correction of allOf(entries)) {
      if (correction.record.lineSha256 !== record.lineSha256) this.unapplied.set(correctionId(correction), "line-digest-differs");
    }
    if (facts !== undefined && facts.record.lineSha256 === record.lineSha256) {
      for (const values of correctedClaimValues(facts)) {
        this.insert.claim.run(record.recordId, record.releaseId, ...values);
        this.rows.corrected_claim += 1;
      }
      this.applied.add(correctionId(facts));
    }
    if (cells !== undefined && cells.record.lineSha256 === record.lineSha256) {
      const id = correctionId(cells);
      const misquoted = misquotedCells(cells, record.line);
      if (misquoted.length > 0) throw new Error(`curated correction ${id} misquotes the cells at forms ${misquoted.join(", ")} of its own line`);
      for (const values of correctedFormValues(cells)) {
        this.insert.form.run(record.recordId, record.releaseId, ...values);
        this.rows.corrected_form += 1;
      }
      this.applied.add(id);
    }
    for (const edge of edges) {
      if (edge.record.lineSha256 !== record.lineSha256) continue;
      if (hidden) {
        this.unapplied.set(correctionId(edge), "record-hidden");
        continue;
      }
      this.insert.edge.run(record.recordId, record.releaseId, ...correctedEdgeValues(edge));
      this.rows.corrected_edge += 1;
      this.applied.add(correctionId(edge));
    }
  }

  get summary(): CorrectionSummary {
    const keyed = [...this.byLine.values()]
      .flatMap(allOf)
      .filter((correction) => correction.record.releaseId === this.releaseId)
      .map(correctionId);
    return {
      keyed: keyed.length,
      applied: this.applied.size,
      unapplied: keyed.filter((id) => !this.applied.has(id)).map((id) => ({ id, reason: this.unapplied.get(id) ?? "line-not-seeded" })),
    };
  }
}
