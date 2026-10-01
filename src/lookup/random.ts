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
//
// The lines are the master's own release's (#18). A record a change from a
// later release replaced is answered with the record that replaced it, which
// has its word and part of speech; a word only a later release added is not
// drawn, since its line numbers count in another file.
//
// A record no search reaches is passed over for the next one that a search
// does: a hidden record (ADR 0023) has no headword row, so the pick walks past
// it, and a draw past the last such record wraps to the first.

import type { DictionaryRead, LookupDatabase } from "./database.js";
import { readRelease } from "./lookup.js";

/** One source record, by the identity lookup gives it. */
export interface RandomHeadword {
  /** The release whose file `lineNo` counts in: the master's, or the feed a change came from. */
  releaseId: string;
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

/** Whether a change applied from a later release replaced the record. */
const REPLACED = "EXISTS (SELECT 1 FROM applied_change a WHERE a.replaced_record_id = source_record.record_id)";

/**
 * Whether a search reaches the record: by its own headword row, or, once a
 * change replaced it and took that row away, through the record that replaced
 * it. A hidden record has neither, so it is never drawn.
 */
const REACHED = `(EXISTS (SELECT 1 FROM lookup_form lf WHERE lf.record_id = source_record.record_id AND lf.origin = 'headword') OR ${REPLACED})`;

/** The first record a search reaches at or after the drawn line. */
export const RANDOM_PICK_SQL = `SELECT record_id, release_id, line_no, word, pos, pos_title, ${REPLACED} AS replaced
       FROM source_record
      WHERE release_id = ?1 AND line_no >= ?2 AND ${REACHED}
      ORDER BY line_no
      LIMIT 1`;

export const RANDOM_PICK_BY_POS_SQL = `SELECT record_id, release_id, line_no, word, pos, pos_title, ${REPLACED} AS replaced
       FROM source_record
      WHERE release_id = ?1 AND pos = ?2 AND line_no >= ?3 AND ${REACHED}
      ORDER BY line_no
      LIMIT 1`;

/**
 * The record that stands for the drawn one now: itself, or the last of the
 * records that replaced it, one change after another (`applied_change`).
 * Exported so a test can assert the plan.
 */
export const CURRENT_RECORD_SQL: DictionaryRead = `SELECT r.record_id, r.release_id, r.line_no, r.word, r.pos, r.pos_title
       FROM source_record r
      WHERE r.record_id IN (
              WITH RECURSIVE version(record_id) AS (
                SELECT ?1
                UNION ALL
                SELECT a.record_id FROM applied_change a JOIN version v ON a.replaced_record_id = v.record_id)
              SELECT record_id FROM version)
        AND NOT EXISTS (SELECT 1 FROM applied_change a WHERE a.replaced_record_id = r.record_id)`;

interface RecordRow {
  record_id: number;
  release_id: string;
  line_no: number;
  word: string;
  pos: string;
  pos_title: string;
}

interface DrawnRow extends RecordRow {
  replaced: number;
}

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
  const pick = (from: number) => db.all<DrawnRow>(pos === undefined ? RANDOM_PICK_SQL : RANDOM_PICK_BY_POS_SQL, [...scope, from]);
  // Past the last record a search reaches, the draw wraps to the first.
  const [ahead] = await pick(line);
  const [drawn] = ahead !== undefined ? [ahead] : await pick(bounds.low);
  // No record of the scope is one a search reaches.
  if (drawn === undefined) return undefined;
  const [row] = drawn.replaced === 0 ? [drawn] : await db.all<RecordRow>(CURRENT_RECORD_SQL, [drawn.record_id]);
  if (row === undefined) throw new Error(`record ${drawn.record_id} has no current record`);
  return { releaseId: row.release_id, lineNo: row.line_no, word: row.word, pos: row.pos, posTitle: row.pos_title };
}
