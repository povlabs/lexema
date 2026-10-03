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
 * the last change applied to it (#368), its live-hide revision (#408) and its
 * curated-correction revision (#420). A release activation or rollback moves
 * the release, an apply moves the last change, and a nonempty hide or
 * correction run increments its revision in the same transaction.
 *
 * The last change stands for every change before it because changes are only
 * ever added, one apply at a time, and each change's id names its content
 * (src/update/changes.ts).
 */
export interface ServedVersion {
  release: string;
  /** The change applied last, or `null` before the first apply. */
  lastChange: string | null;
  /** Committed live hides; absent on masters seeded before this mechanism. */
  hideRevision?: number;
  /** Committed `correct:records` runs; absent on masters seeded before them. */
  correctionRevision?: number;
}

/**
 * The newest `applied_change` row. Rows are only ever added, so the highest
 * rowid is the last one written; SQLite reads it off the end of the table, so
 * D1 counts one row read however many changes there are.
 */
export const LAST_CHANGE_SQL: DictionaryRead = `SELECT change_id FROM applied_change ORDER BY rowid DESC LIMIT 1`;

/** The page-only entry tables (ADR 0024, #403), in the order their foreign keys need. */
export const PAGE_ENTRY_TABLES = ["recovered_entry", "entry_definition", "entry_label", "entry_example"] as const;

/**
 * Which of the tables an older master may lack it has: `hide_version` (#408),
 * the page-entry tables (#403) and the curated-correction tables (#420,
 * #450). Presence is read from the schema, never inferred from a failed read,
 * so an error on a table that exists still fails.
 */
export const OPTIONAL_TABLES_SQL: DictionaryRead = `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (${["hide_version", "corrected_claim", "correction_version", ...PAGE_ENTRY_TABLES, "corrected_definition"].map((name) => `'${name}'`).join(", ")})`;
export const HIDE_VERSION_SQL: DictionaryRead = `SELECT revision FROM hide_version WHERE singleton = 1`;
export const CORRECTION_VERSION_SQL: DictionaryRead = `SELECT revision FROM correction_version WHERE singleton = 1`;

/** The optional tables a dictionary has. */
export interface DictionaryTables {
  /** Absent until a master's first nonempty live hide. */
  hideVersion: boolean;
  /** All four page-entry tables; absent on a master seeded before #403. */
  pageEntries: boolean;
  /**
   * `corrected_definition`, with every page-entry table it corrects; absent
   * on a master seeded before #450 until `correct:records` writes it.
   */
  definitionCorrections: boolean;
  /** `corrected_claim`; absent on a master seeded before #420 until `correct:records` writes it. */
  corrections: boolean;
  /** `correction_version`; absent on a master seeded before #420 until its first `correct:records` run. */
  correctionVersion: boolean;
}

/**
 * The optional tables the dictionary has, in one statement. Callers send it
 * beside their first read, so on D1 it rides in that same batch (fromD1).
 * Some page-entry tables without the rest is no schema.sql ever wrote, and is
 * refused rather than read as either.
 */
export async function dictionaryTables(db: LookupDatabase): Promise<DictionaryTables> {
  const present = new Set((await db.all<{ name: string }>(OPTIONAL_TABLES_SQL, [])).map((row) => row.name));
  const pages = PAGE_ENTRY_TABLES.filter((name) => present.has(name));
  if (pages.length > 0 && pages.length < PAGE_ENTRY_TABLES.length) {
    throw new Error(`the dictionary has ${pages.join(", ")} but not every page-entry table (${PAGE_ENTRY_TABLES.join(", ")})`);
  }
  const pageEntries = pages.length === PAGE_ENTRY_TABLES.length;
  return {
    hideVersion: present.has("hide_version"),
    pageEntries,
    // Read only beside the entries it corrects.
    definitionCorrections: pageEntries && present.has("corrected_definition"),
    corrections: present.has("corrected_claim"),
    correctionVersion: present.has("correction_version"),
  };
}

/** The version the master `release` serves now, including committed live hides and corrections. */
export async function servedVersion(db: LookupDatabase, release: string): Promise<ServedVersion> {
  const [last, tables] = await Promise.all([db.all<{ change_id: string }>(LAST_CHANGE_SQL, []), dictionaryTables(db)]);
  // An old master has neither table until `update:upgrade` creates them; an
  // absent one reads as revision zero. Do not suppress other database
  // failures: an unread version must not hit a cache.
  const revisionOf = async (present: boolean, sql: DictionaryRead): Promise<number> =>
    present ? ((await db.all<{ revision: number }>(sql, []))[0]?.revision ?? 0) : 0;
  const [hideRevision, correctionRevision] = await Promise.all([
    revisionOf(tables.hideVersion, HIDE_VERSION_SQL),
    revisionOf(tables.correctionVersion, CORRECTION_VERSION_SQL),
  ]);
  return { release, lastChange: last[0]?.change_id ?? null, hideRevision, correctionRevision };
}

/**
 * `it-0c432803.0` before the first apply, `it-0c432803.chg-0123456789ab`
 * after one, with `.hide-N` after live hides and `.fix-N` after correction
 * runs. Web callers also supply the
 * Worker version metadata id: a deploy changes the address even when the data
 * stays the same. Non-web callers can name the data version alone.
 */
export function versionToken({ release, lastChange, hideRevision = 0, correctionRevision = 0 }: ServedVersion, servingCode?: string): string {
  const data =
    `${release}.${lastChange ?? "0"}` +
    (hideRevision === 0 ? "" : `.hide-${hideRevision}`) +
    (correctionRevision === 0 ? "" : `.fix-${correctionRevision}`);
  return servingCode === undefined ? data : `${data}.code-${encodeURIComponent(servingCode)}`;
}

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
