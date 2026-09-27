// A random headword, optionally of one part of speech (#152).
//
// The pick is keyed, never a scan and never an OFFSET walk: draw a line number
// between the first and last record of the part of speech, and take the first
// record at or after it. Both reads are one probe of an index on
// `(release_id, pos, line_no)`, or of `(release_id, line_no)` when no part of
// speech is asked for; `test/random.test.ts` asserts the plans.
//
// The draw is uniform over line numbers, not over records: a record that
// follows a long run of other parts of speech is more likely than one that
// follows its own kind. That is the price of a pick that reads two rows.

import type { LookupDatabase } from "./database.js";
import { readRelease } from "./lookup.js";

/** One source record, by the identity lookup gives it. */
export interface RandomHeadword {
  lineNo: number;
  word: string;
  pos: string;
  posTitle: string;
}

/** The first and last line of the records a pick draws among. */
export const RANDOM_BOUNDS_SQL = `SELECT
         (SELECT min(line_no) FROM source_record WHERE release_id = ?1) AS low,
         (SELECT max(line_no) FROM source_record WHERE release_id = ?1) AS high`;

export const RANDOM_BOUNDS_BY_POS_SQL = `SELECT
         (SELECT min(line_no) FROM source_record WHERE release_id = ?1 AND pos = ?2) AS low,
         (SELECT max(line_no) FROM source_record WHERE release_id = ?1 AND pos = ?2) AS high`;

/** The first record at or after the drawn line. */
export const RANDOM_PICK_SQL = `SELECT line_no, word, pos, pos_title
       FROM source_record
      WHERE release_id = ?1 AND line_no >= ?2
      ORDER BY line_no
      LIMIT 1`;

export const RANDOM_PICK_BY_POS_SQL = `SELECT line_no, word, pos, pos_title
       FROM source_record
      WHERE release_id = ?1 AND pos = ?2 AND line_no >= ?3
      ORDER BY line_no
      LIMIT 1`;

export interface RandomOptions {
  db: LookupDatabase;
  releaseId: string;
  /** Only records of this `pos`; any record when absent. */
  pos: string | undefined;
  /** A number in [0, 1), `Math.random` unless a caller fixes it. */
  random?: () => number;
}

/** A random record of the release, or undefined when it has none of that part of speech. */
export async function randomHeadword({ db, releaseId, pos, random = Math.random }: RandomOptions): Promise<RandomHeadword | undefined> {
  const release = await readRelease(db, releaseId);
  if (release === undefined) throw new Error(`no complete release '${releaseId}'`);

  const scope = pos === undefined ? [releaseId] : [releaseId, pos];
  const [bounds] = await db.all<{ low: number | null; high: number | null }>(
    pos === undefined ? RANDOM_BOUNDS_SQL : RANDOM_BOUNDS_BY_POS_SQL,
    scope,
  );
  if (bounds?.low == null || bounds.high == null) return undefined;

  const line = bounds.low + Math.floor(random() * (bounds.high - bounds.low + 1));
  const [row] = await db.all<{ line_no: number; word: string; pos: string; pos_title: string }>(
    pos === undefined ? RANDOM_PICK_SQL : RANDOM_PICK_BY_POS_SQL,
    [...scope, line],
  );
  // `high` is a line of the scope, so a line drawn at or below it always finds one.
  if (row === undefined) throw new Error(`no record at or after line ${line} of '${releaseId}'`);
  return { lineNo: row.line_no, word: row.word, pos: row.pos, posTitle: row.pos_title };
}
