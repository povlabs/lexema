// The disputes this repository has evidence for, as `claim_review` rows.
//
// A dispute is not a correction. The imported claim stays exactly as the source
// wrote it and a row here hangs a verdict off it, which is the whole shape
// `claim_review` exists for (src/db/schema.sql). Writing one is what stops a
// claim the research already contradicted from rendering as an ordinary fact.
//
// Everything here is transcribed from a dated report under reports/, never
// judged in this file. Who reviews and on what evidence is #12; until that
// lands, this is the one verdict the repository can already show its work for.

import type { DatabaseSync } from "node:sqlite";

/** One recorded verdict, located by the record it is about within a release. */
export interface KnownDispute {
  /** The record's own headword and part of speech, as the source spells them. */
  word: string;
  pos: string;
  /** The exact claim under review, as a pointer into that record's line. */
  jsonPointer: string;
  note: string;
  evidenceUrl: string;
  /** ISO-8601 date the verdict was reached. */
  reviewedAt: string;
  /** What reached it — here, the dated report that holds the evidence. */
  reviewedBy: string;
}

export const KNOWN_DISPUTES: readonly KnownDispute[] = [
  {
    // reports/2026-09-18-source-research.md: "The `studente` verb claim is
    // disputed by other source evidence." Wiktionary's own `studiare`
    // conjugation table and Treccani both give `studiante` as the present
    // participle. The research does not prove no such verb form ever existed,
    // so the verdict is 'disputed' and not 'wrong'.
    word: "studente",
    pos: "verb",
    jsonPointer: "/senses/0/glosses/0",
    note:
      "Disputed: Wiktionary's own studiare conjugation table and Treccani both give " +
      "studiante as the present participle of studiare. The claim is recorded, not corrected.",
    evidenceUrl: "https://it.wiktionary.org/wiki/Appendice:Coniugazioni/Italiano/studiare",
    reviewedAt: "2026-09-18",
    reviewedBy: "reports/2026-09-18-source-research.md",
  },
];

/**
 * Write every known dispute whose record is in this release, and report how
 * many landed.
 *
 * A dispute whose record the release does not hold writes nothing: a prefix
 * seed stops at a line number, so the `studente` verb record is simply absent
 * from a short one. That is a smaller release, not a missing review.
 */
export function writeKnownDisputes(db: DatabaseSync, releaseId: string): number {
  const find = db.prepare(
    `SELECT record_id FROM source_record
      WHERE release_id = ? AND word = ? AND pos = ?
      ORDER BY line_no`,
  );
  const insert = db.prepare(
    `INSERT OR IGNORE INTO claim_review
       (record_id, json_pointer, status, note, evidence_url, reviewed_at, reviewed_by)
     VALUES (?, ?, 'disputed', ?, ?, ?, ?)`,
  );

  let written = 0;
  for (const dispute of KNOWN_DISPUTES) {
    const records = find.all(releaseId, dispute.word, dispute.pos) as { record_id: number }[];
    for (const { record_id } of records) {
      insert.run(
        record_id,
        dispute.jsonPointer,
        dispute.note,
        dispute.evidenceUrl,
        dispute.reviewedAt,
        dispute.reviewedBy,
      );
      written += 1;
    }
  }
  return written;
}
