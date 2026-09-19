// The identity of what the import *derived*, as opposed to what it downloaded.
//
// `archive_sha256` pins the bytes that went in and `source_record.line_sha256`
// pins each raw line, so the verbatim half of a release is already checkable.
// Neither says anything about the tables the importer builds on top: lookup
// rows, form_of edges, senses, glosses, labels, grammar claims. A projection
// that silently lost a table would still match its archive checksum.
//
// So a release also carries a digest of its derived rows, plus the per-table
// counts the digest was taken over. The two are layered on purpose:
//
//   * counts  — one query per table, cheap enough to run on every gate, catches
//               the whole class of "a table is gone or short".
//   * digest  — a full scan, run when asked, catches a single edited row.
//
// Both are computed by *reading the database back*, never from the importer's
// in-memory counters. A digest taken from what the importer thought it wrote
// would agree with a projection that never landed.

import { createHash } from "node:crypto";
import type { LookupDatabase } from "../lookup/database.js";

/**
 * Bump this when the row stream below changes shape. A digest is only
 * comparable to another digest of the same version, and the version is hashed
 * in, so a digest from an older definition cannot be mistaken for tampering.
 */
export const PROJECTION_DIGEST_VERSION = "it-projection/v2";

/** How many records' worth of rows to pull at a time. Keeps memory flat. */
const WINDOW = 500;

/**
 * One derived table, described once so the row query and the count query cannot
 * drift apart. Both are built from the same `from` and the same filter.
 *
 * Every table is reachable from `source_record`, which is where `release_id` and
 * the window bound live. `release_id` itself is never hashed: it is the same
 * value for every row by construction, and hashing it would make a digest
 * change when a release is renamed.
 *
 * `record_id` is never hashed either, for a sharper reason: it is a surrogate
 * key over the whole database, so a second import of the same archive beside a
 * first one starts counting where the first stopped. Hashing it would make two
 * identical projections digest differently and tell you nothing about their
 * content. Each row identifies its record by `r.line_no` instead — the line's
 * position in the archive, which the same archive reproduces every time.
 */
interface ProjectionTable {
  name: string;
  /** Hashed columns, in order. */
  columns: string;
  /** FROM ... JOIN ..., aliasing the owning record as `r`. */
  from: string;
  /** Unique within one record, so the stream is identical run to run. */
  orderBy: string;
}

const TABLES: readonly ProjectionTable[] = [
  {
    name: "source_record",
    columns: "r.line_no, r.line_sha256, r.word, r.pos, r.pos_title",
    from: "source_record r",
    orderBy: "r.record_id",
  },
  {
    name: "lookup_form",
    columns:
      "r.line_no, f.origin, f.surface, f.surface_key, f.json_pointer, f.form_index, f.form_source",
    from: "lookup_form f JOIN source_record r ON r.record_id = f.record_id",
    orderBy: "f.record_id, f.json_pointer",
  },
  {
    name: "form_of_edge",
    columns:
      "r.line_no, e.sense_index, e.form_of_index, e.json_pointer, e.target_word, e.target_word_key",
    from: "form_of_edge e JOIN source_record r ON r.record_id = e.record_id",
    orderBy: "e.record_id, e.sense_index, e.form_of_index",
  },
  {
    name: "sense",
    columns: "r.line_no, s.sense_index, s.json_pointer",
    from: "sense s JOIN source_record r ON r.record_id = s.record_id",
    orderBy: "s.record_id, s.sense_index",
  },
  {
    name: "sense_gloss",
    columns: "r.line_no, s.sense_index, g.gloss_index, g.text, g.json_pointer",
    from:
      "sense_gloss g JOIN sense s ON s.sense_id = g.sense_id " +
      "JOIN source_record r ON r.record_id = s.record_id",
    orderBy: "s.record_id, s.sense_index, g.gloss_index",
  },
  {
    name: "sense_label",
    columns: "r.line_no, s.sense_index, l.kind, l.label_index, l.label, l.json_pointer",
    from:
      "sense_label l JOIN sense s ON s.sense_id = l.sense_id " +
      "JOIN source_record r ON r.record_id = s.record_id",
    orderBy: "s.record_id, s.sense_index, l.kind, l.label_index",
  },
  {
    name: "grammar_claim",
    columns:
      "r.line_no, c.scope, c.scope_index, c.json_pointer, c.status, c.dimension, c.value, c.source_text",
    from: "grammar_claim c JOIN source_record r ON r.record_id = c.record_id",
    orderBy: "c.record_id, c.json_pointer, ifnull(c.dimension, '*')",
  },
];

/** Params are always (releaseId, lowRecordId, highRecordId). */
const FILTER = "WHERE r.release_id = ? AND r.record_id BETWEEN ? AND ?";

const rowSql = (table: ProjectionTable): string =>
  `SELECT ${table.columns} FROM ${table.from} ${FILTER} ORDER BY ${table.orderBy}`;

const countSql = (table: ProjectionTable): string =>
  `SELECT count(*) AS n FROM ${table.from} ${FILTER}`;

/** Whole-release bounds, for the count queries, which are not windowed. */
const ALL_RECORDS: readonly [number, number] = [0, Number.MAX_SAFE_INTEGER];

export const PROJECTION_TABLES: readonly string[] = TABLES.map((table) => table.name);

/** Row counts per derived table, as recorded at import and as read back. */
export type ProjectionCounts = Readonly<Record<string, number>>;

export interface Projection {
  digest: string;
  counts: ProjectionCounts;
}

export interface CountDifference {
  table: string;
  recorded: number;
  found: number;
}

/**
 * Serialise one row so two different rows can never hash alike. JSON of the
 * value array keeps `null`, `""` and `0` apart, which tab-joining would not.
 */
function encode(table: string, row: Record<string, unknown>): string {
  return `${table}\t${JSON.stringify(Object.values(row))}\n`;
}

/**
 * Hash every derived row of one release, reading it back out of the database.
 *
 * Windowed by `record_id` rather than paged by OFFSET: an OFFSET scan re-reads
 * every earlier row on each page, and every derived row hangs off a record.
 */
export async function computeProjection(
  db: LookupDatabase,
  releaseId: string,
): Promise<Projection> {
  const hash = createHash("sha256").update(`${PROJECTION_DIGEST_VERSION}\n`);
  const counts: Record<string, number> = Object.fromEntries(
    PROJECTION_TABLES.map((name) => [name, 0]),
  );

  let after = -1;
  for (;;) {
    const window = await db.all<{ record_id: number }>(
      `SELECT record_id FROM source_record
        WHERE release_id = ? AND record_id > ?
        ORDER BY record_id LIMIT ?`,
      [releaseId, after, WINDOW],
    );
    if (window.length === 0) break;

    const low = window[0].record_id;
    const high = window[window.length - 1].record_id;
    for (const table of TABLES) {
      const rows = await db.all<Record<string, unknown>>(rowSql(table), [releaseId, low, high]);
      counts[table.name] += rows.length;
      for (const row of rows) hash.update(encode(table.name, row));
    }
    after = high;
  }

  return { digest: hash.digest("hex"), counts };
}

/**
 * Read back only the counts: one query per table, no row transfer. This is what
 * the gate runs every time; {@link computeProjection} is the opt-in.
 */
export async function countProjection(
  db: LookupDatabase,
  releaseId: string,
): Promise<ProjectionCounts> {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = await db.all<{ n: number }>(countSql(table), [releaseId, ...ALL_RECORDS]);
    counts[table.name] = rows[0]?.n ?? 0;
  }
  return counts;
}

export function encodeCounts(counts: ProjectionCounts): string {
  return JSON.stringify(
    Object.fromEntries(PROJECTION_TABLES.map((name) => [name, counts[name] ?? 0])),
  );
}

/**
 * Parse recorded counts. A column that was hand-edited into something that is
 * not a count per table returns `undefined` rather than a plausible-looking
 * zero — the gate has to tell "no record of it" from "recorded as empty".
 */
export function decodeCounts(recorded: string | null): ProjectionCounts | undefined {
  if (recorded === null || recorded === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(recorded);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  const counts: Record<string, number> = {};
  for (const name of PROJECTION_TABLES) {
    const value = (parsed as Record<string, unknown>)[name];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
    counts[name] = value;
  }
  return counts;
}

export function diffCounts(
  recorded: ProjectionCounts,
  found: ProjectionCounts,
): CountDifference[] {
  return PROJECTION_TABLES.flatMap((table) =>
    (recorded[table] ?? 0) === (found[table] ?? 0)
      ? []
      : [{ table, recorded: recorded[table] ?? 0, found: found[table] ?? 0 }],
  );
}
