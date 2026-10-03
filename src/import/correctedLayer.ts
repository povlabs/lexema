// Writes the curated corrections (#420) beside the records a seed streams.
//
// Each entry of the committed list (src/italian/curatedCorrections.ts) names
// one record by release, archive line and line digest. When the seed writes
// that line with that digest, each fact the entry sets becomes one
// `corrected_claim` row, naming the entry and the revision it cites. A line
// whose digest differs is another record, and gets none: the list was checked
// against those bytes and no others. The record's own rows, its line in
// `source_record_json` least of all, are written by `writeRecord` and are not
// touched here.

import { correctedFacts, correctionId, evidenceUrl, type CuratedCorrection } from "../italian/curatedCorrections.js";
import type { ImportStatement } from "./importRelease.js";

/** One `corrected_claim` row's values after its record id and release, in `COLUMNS` order. */
export function correctedClaimValues(correction: CuratedCorrection): [dimension: string, value: string, correctionId: string, evidenceUrl: string][] {
  return correctedFacts(correction).map((fact) => [fact.dimension, fact.value, correctionId(correction), evidenceUrl(correction.evidence[0])]);
}

/** Why an entry keyed to the seeded release was not written. */
export type UnappliedReason = "line-digest-differs" | "line-not-seeded";

/** What one seed did with the list: the count reported after every run. */
export interface CorrectionSummary {
  /** Entries keyed to the seeded release. */
  keyed: number;
  /** Entries written, each as one row per fact it sets. */
  applied: number;
  /** Entries keyed to the seeded release that were not written, and why. */
  unapplied: { id: string; reason: UnappliedReason }[];
}

export class CorrectedLayer {
  private readonly byLine = new Map<string, CuratedCorrection>();
  private readonly applied = new Set<string>();
  private readonly differing = new Set<string>();
  private releaseId: string | undefined;

  constructor(
    corrections: readonly CuratedCorrection[],
    private readonly insert: ImportStatement,
    private readonly rows: { corrected_claim: number },
  ) {
    for (const correction of corrections) this.byLine.set(correctionId(correction), correction);
  }

  /** Write the corrections keyed to this record's line, when its digest is the one they were checked against. */
  add(record: { releaseId: string; recordId: number; lineNo: number; lineSha256: string }): void {
    this.releaseId = record.releaseId;
    const id = `${record.releaseId}:${record.lineNo}`;
    const correction = this.byLine.get(id);
    if (correction === undefined) return;
    if (correction.record.lineSha256 !== record.lineSha256) {
      this.differing.add(id);
      return;
    }
    for (const values of correctedClaimValues(correction)) {
      this.insert.run(record.recordId, record.releaseId, ...values);
      this.rows.corrected_claim += 1;
    }
    this.applied.add(id);
  }

  get summary(): CorrectionSummary {
    const keyed = [...this.byLine.values()].filter((correction) => correction.record.releaseId === this.releaseId).map(correctionId);
    return {
      keyed: keyed.length,
      applied: this.applied.size,
      unapplied: keyed
        .filter((id) => !this.applied.has(id))
        .map((id) => ({ id, reason: this.differing.has(id) ? "line-digest-differs" : "line-not-seeded" })),
    };
  }
}
