// What a lookup reads from (#18). The dictionary database is a master: the
// release it was seeded from, plus the changes applied from later releases,
// each change's rows written under its own release (docs/UPDATES.md).
// `LEXEMA_RELEASE` names the master, and every serving read keys on the
// releases it serves (`served_release` in src/db/schema.sql), never on that one
// release_id alone, so a record a change wrote is found beside the records it
// did not touch. What a cache keys on is the served version below.

import type { DictionaryRead, LookupDatabase, SqlValue } from "./database.js";

/** A numbered SQL parameter. */
type Parameter = `?${number}`;

/**
 * The releases the master bound at `master` serves, as the operand of an
 * `IN`: `lf.release_id IN (${servedBy("?1")})`. Equality probes of an index
 * that leads with `release_id` stay probes, one per served release.
 */
export const servedBy = (master: Parameter): string =>
  `SELECT release_id FROM served_release WHERE master_release_id = ${master}`;

/**
 * The record bound at `record` and every record it replaced, through
 * `applied_change`, as the operand of an `IN`. The rows written by hand beside
 * a record (`recovered_*`, `claim_review`) stay attached to the record they
 * were written for; a lookup reads them for the record that replaced it.
 */
export const lineageOf = (record: Parameter): string =>
  `WITH RECURSIVE lineage(record_id) AS (
              SELECT ${record}
              UNION ALL
              SELECT a.replaced_record_id
                FROM applied_change a
                JOIN lineage l ON a.record_id = l.record_id
               WHERE a.replaced_record_id IS NOT NULL)
            SELECT record_id FROM lineage`;

/** Every release a master serves, in id order. Exported so a test can name the statement. */
export const SERVED_RELEASES_SQL: DictionaryRead = `SELECT release_id FROM served_release WHERE master_release_id = ?1 ORDER BY release_id`;

/** The releases the master `masterId` serves: none when it is not a complete release. */
export async function servedReleases(db: LookupDatabase, masterId: string): Promise<string[]> {
  return (await db.all<{ release_id: string }>(SERVED_RELEASES_SQL, [masterId])).map((row) => row.release_id);
}

/**
 * What a reader is served, as of now: the master `LEXEMA_RELEASE` names, and
 * the last change applied to it (#368). A release activation or rollback moves
 * the release, and an apply moves the last change, so a cache keyed on this
 * version is never answered from data an apply or a flip has since replaced.
 *
 * The last change stands for every change before it because changes are only
 * ever added, one apply at a time, and each change's id names its content
 * (src/update/changes.ts).
 */
export interface ServedVersion {
  release: string;
  /** The change applied last, or `null` before the first apply. */
  lastChange: string | null;
}

/**
 * The newest `applied_change` row. Rows are only ever added, so the highest
 * rowid is the last one written; SQLite reads it off the end of the table, so
 * D1 counts one row read however many changes there are.
 */
export const LAST_CHANGE_SQL: DictionaryRead = `SELECT change_id FROM applied_change ORDER BY rowid DESC LIMIT 1`;

/** The version the master `release` serves now. */
export async function servedVersion(db: LookupDatabase, release: string): Promise<ServedVersion> {
  const [last] = await db.all<{ change_id: string }>(LAST_CHANGE_SQL, []);
  return { release, lastChange: last?.change_id ?? null };
}

/**
 * `it-0c432803.0` before the first apply, `it-0c432803.chg-0123456789ab`
 * after one: the version as an address names it.
 */
export const versionToken = ({ release, lastChange }: ServedVersion): string => `${release}.${lastChange ?? "0"}`;

/**
 * A range read in key order, over every release a master serves: `sql` reads
 * one release (`release_id = ?1`) in `surface_key` order with `LIMIT` last, and
 * runs once per release; the rows are merged in key order and cut at `limit`.
 * One `IN` over the releases would sort the whole range before the `LIMIT`
 * applied, so a one-letter prefix would cost every headword it begins.
 */
export async function inKeyOrder<Row extends { surface_key: string }>(
  db: LookupDatabase,
  releases: readonly string[],
  sql: DictionaryRead,
  params: readonly SqlValue[],
  limit: number,
): Promise<Row[]> {
  const read = await Promise.all(releases.map((release) => db.all<Row>(sql, [release, ...params, limit])));
  // A stable sort keeps each release's own order among equal keys.
  return read.flat().sort((a, b) => byCodePoint(a.surface_key, b.surface_key)).slice(0, limit);
}

/**
 * SQLite's order for text: UTF-8 bytes, which is code point order. JavaScript's
 * `<` compares UTF-16 units, which puts a character past U+FFFF before U+E000.
 */
function byCodePoint(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const difference = (left[i].codePointAt(0) as number) - (right[i].codePointAt(0) as number);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}
