// The one database capability lookup needs, and the two adapters that provide
// it: a Worker's D1 (async) and a local `node:sqlite` file (sync). One query
// layer instead of two — see docs/LOOKUP_DESIGN.md.

/** A value bound to a `?`; `null` is SQL NULL. */
export type SqlValue = string | number | null;

/**
 * Every statement lookup performs, and the report store's insert, which runs
 * through the same call as `INSERT … RETURNING`. Deliberately the smallest
 * surface that works.
 */
export interface LookupDatabase {
  all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]>;
}

/** The shape of `node:sqlite`'s DatabaseSync that this adapter uses. */
interface SyncSqlite {
  prepare(sql: string): { all(...params: SqlValue[]): unknown[] };
}

/** Local SQLite, for the importer's output and for tests. */
export function fromNodeSqlite(db: SyncSqlite): LookupDatabase {
  return {
    all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
      return Promise.resolve(db.prepare(sql).all(...params) as T[]);
    },
  };
}

/** The slice of Cloudflare's D1Database this adapter uses. */
interface D1Like {
  prepare(sql: string): {
    bind(...params: SqlValue[]): { all<T>(): Promise<{ results: T[] }> };
    all<T>(): Promise<{ results: T[] }>;
  };
}

/**
 * Cloudflare D1, reached from a Worker as `env.DB`.
 *
 * `bind()` is skipped when there are no parameters: D1 rejects a `bind()` call
 * with zero arguments on some statements, and binding nothing is meaningless
 * anyway.
 */
export function fromD1(db: D1Like): LookupDatabase {
  return {
    async all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
      const statement = db.prepare(sql);
      const { results } =
        params.length === 0
          ? await statement.all<T>()
          : await statement.bind(...params).all<T>();
      return results;
    },
  };
}
