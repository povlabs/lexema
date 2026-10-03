// A `corrected_claim` row (#420), as every lookup read of that table returns it,
// and the correction it carries.

import type { CorrectedClaim } from "./types.js";

export interface CorrectionRow {
  record_id: number;
  dimension: "gender" | "number";
  value: string;
  correction_id: string;
  evidence_url: string;
}

export const correctionOf = (row: CorrectionRow): Omit<CorrectedClaim, "status" | "replaces"> => ({
  dimension: row.dimension,
  value: row.value,
  correction: { id: row.correction_id, evidenceUrl: row.evidence_url },
});

/** Each record's corrections, keyed by its id. */
export function correctionsByRecord(rows: readonly CorrectionRow[]): Map<number, CorrectionRow[]> {
  const byRecord = new Map<number, CorrectionRow[]>();
  for (const row of rows) byRecord.set(row.record_id, [...(byRecord.get(row.record_id) ?? []), row]);
  return byRecord;
}
