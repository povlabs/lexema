// Where a seed puts its release: into an empty dictionary database, schema and
// all, or beside the releases one already holds (#18). A replacement release is
// seeded beside the served one, so the served one stays queryable while the
// replacement loads and is checked, and is still there to roll back to.

import type { DictionarySql } from "./normalizeGlosses.js";
import type { ReleaseStatus } from "./releaseLifecycle.js";

export type { DictionarySql };

/**
 * The highest surrogate ids already in the database. The ids a release seeded
 * beside others gets follow these, since `record_id`, `page_id` and
 * `recovered_id` are unique across releases (src/db/schema.sql).
 */
export interface IdBases {
  readonly record: number;
  readonly page: number;
  readonly recovered: number;
}

/** One release a database holds, and where it stands. */
export interface ReleaseState {
  readonly releaseId: string;
  readonly status: ReleaseStatus;
}

/**
 * An empty database, which the seed's first part gives the schema; or one
 * that already holds the dictionary schema and its releases, which the seed
 * adds one more to and otherwise leaves alone.
 */
export type SeedPlacement =
  | { readonly kind: "fresh" }
  | {
      readonly kind: "beside";
      readonly releases: readonly ReleaseState[];
      readonly bases: IdBases;
      /** Rows each seeded table held before the seed, so the load can check what it added. */
      readonly rowsBefore: Readonly<Record<string, number>>;
    };

export const FRESH: SeedPlacement = { kind: "fresh" };

export const TABLES_QUERY = "SELECT name FROM sqlite_schema WHERE type = 'table'";

/** Tables D1 or SQLite keep for themselves in every database, empty or not. */
export const isInternalTable = (name: string): boolean => name.startsWith("_cf_") || name.startsWith("sqlite_");

/** Every table the dictionary schema creates, in the order it creates them. */
export const schemaTables = (schemaSql: string): string[] =>
  [...schemaSql.matchAll(/^CREATE TABLE (\w+)/gm)].map(([, name]) => name);

export const quoted = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** One row per table: how many rows it holds now. */
export function countRows(sql: DictionarySql, tables: readonly string[]): Record<string, number> {
  const [counted] = sql.query<Record<string, number>>(
    `SELECT ${tables.map((table) => `(SELECT count(*) FROM ${table}) AS ${table}`).join(", ")}`,
  );
  return counted;
}

export function releaseStates(sql: DictionarySql): ReleaseState[] {
  return sql
    .query<{ release_id: string; status: ReleaseStatus }>("SELECT release_id, status FROM source_release ORDER BY release_id")
    .map(({ release_id, status }) => ({ releaseId: release_id, status }));
}

/**
 * Where a seed into this database would go. Refuses a database holding tables
 * that are not exactly the dictionary schema's, and one where an earlier seed
 * is still `importing`: that seed is running, or it stopped without being
 * marked, and either way a second writer must not start beside it.
 */
export function readPlacement(
  sql: DictionarySql,
  described: string,
  schemaSql: string,
  seededTables: readonly string[],
): SeedPlacement {
  const held = sql.query<{ name: string }>(TABLES_QUERY).map(({ name }) => name).filter((name) => !isInternalTable(name));
  if (held.length === 0) return FRESH;
  const expected = schemaTables(schemaSql);
  const missing = expected.filter((table) => !held.includes(table));
  const unexpected = held.filter((table) => !expected.includes(table));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `${described} holds tables that are not the dictionary schema` +
        (missing.length > 0 ? `; missing: ${missing.join(", ")}` : "") +
        (unexpected.length > 0 ? `; not in src/db/schema.sql: ${unexpected.join(", ")}` : "") +
        `. A release is seeded beside others only into a database with the same schema`,
    );
  }
  const releases = releaseStates(sql);
  const importing = releases.filter(({ status }) => status === "importing").map(({ releaseId }) => releaseId);
  if (importing.length > 0) {
    throw new Error(
      `${described} holds release ${importing.join(", ")} still importing: a seed is running, or one stopped unmarked. ` +
        `When none is running, mark it failed and discard it (docs/UPDATE_A_RELEASE.md#if-a-seed-stops)`,
    );
  }
  const [bases] = sql.query<IdBases>(
    "SELECT (SELECT coalesce(max(record_id), 0) FROM source_record) AS record, " +
      "(SELECT coalesce(max(page_id), 0) FROM raw_page) AS page, " +
      "(SELECT coalesce(max(recovered_id), 0) FROM recovered_definition) AS recovered",
  );
  return { kind: "beside", releases, bases, rowsBefore: countRows(sql, seededTables) };
}
