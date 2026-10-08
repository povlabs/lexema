// Writes the curated corrections (#420, #723) beside the records a seed streams.
//
// Each entry of the committed list (src/italian/curatedCorrections.ts) keyed
// to a record names it by release, archive line and line digest. When the seed
// writes that line with that digest, each fact the entry sets becomes one
// `corrected_claim` row, and each cell it sets one `corrected_form` row, naming
// the entry and the revision it cites. A line whose digest differs is another
// record, and gets none: the list was checked against those bytes and no
// others. The record's own rows, its line in `source_record_json` least of
// all, are written by `writeRecord` and are not touched here.

import {
  correctedFacts,
  correctionId,
  evidenceUrl,
  isCellCorrection,
  lineCorrections,
  type CellCorrection,
  type CuratedCorrection,
  type LineCorrection,
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

/** Why an entry keyed to the seeded release was not written. */
export type UnappliedReason = "line-digest-differs" | "line-not-seeded";

/** What one seed did with the list: the count reported after every run. */
export interface CorrectionSummary {
  /** Entries keyed to the seeded release. */
  keyed: number;
  /** Entries written, each as one row per fact or cell it sets. */
  applied: number;
  /** Entries keyed to the seeded release that were not written, and why. */
  unapplied: { id: string; reason: UnappliedReason }[];
}

export class CorrectedLayer {
  /** The entries keyed to each `<release>:<line>`: at most one of each kind. */
  private readonly byLine = new Map<string, LineCorrection[]>();
  private readonly applied = new Set<string>();
  private readonly differing = new Set<string>();
  private releaseId: string | undefined;

  constructor(
    corrections: readonly CuratedCorrection[],
    private readonly insert: { claim: ImportStatement; form: ImportStatement },
    private readonly rows: { corrected_claim: number; corrected_form: number },
  ) {
    for (const correction of lineCorrections(corrections)) {
      const line = `${correction.record.releaseId}:${correction.record.lineNo}`;
      this.byLine.set(line, [...(this.byLine.get(line) ?? []), correction]);
    }
  }

  /** Write the corrections keyed to this record's line, when its digest is the one they were checked against. */
  add(record: { releaseId: string; recordId: number; lineNo: number; line: string; lineSha256: string }): void {
    this.releaseId = record.releaseId;
    for (const correction of this.byLine.get(`${record.releaseId}:${record.lineNo}`) ?? []) {
      const id = correctionId(correction);
      if (correction.record.lineSha256 !== record.lineSha256) {
        this.differing.add(id);
        continue;
      }
      if (isCellCorrection(correction)) {
        const misquoted = misquotedCells(correction, record.line);
        if (misquoted.length > 0) throw new Error(`curated correction ${id} misquotes the cells at forms ${misquoted.join(", ")} of its own line`);
        for (const values of correctedFormValues(correction)) {
          this.insert.form.run(record.recordId, record.releaseId, ...values);
          this.rows.corrected_form += 1;
        }
      } else {
        for (const values of correctedClaimValues(correction)) {
          this.insert.claim.run(record.recordId, record.releaseId, ...values);
          this.rows.corrected_claim += 1;
        }
      }
      this.applied.add(id);
    }
  }

  get summary(): CorrectionSummary {
    const keyed = [...this.byLine.values()].flat().filter((correction) => correction.record.releaseId === this.releaseId).map(correctionId);
    return {
      keyed: keyed.length,
      applied: this.applied.size,
      unapplied: keyed
        .filter((id) => !this.applied.has(id))
        .map((id) => ({ id, reason: this.differing.has(id) ? "line-digest-differs" : "line-not-seeded" })),
    };
  }
}
