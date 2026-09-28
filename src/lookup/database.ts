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

/** One statement and the values bound to its `?`s. */
export interface Statement {
  readonly sql: string;
  readonly params: readonly SqlValue[];
}

/**
 * A database that can also run several statements as one transaction, for a
 * change that must land whole or not at all (deleting a developer account,
 * src/accounts/accounts.ts). Both adapters below provide it.
 */
export interface TransactionalDatabase extends LookupDatabase {
  /**
   * Run the statements in order as one transaction and answer each one's rows.
   * When any statement fails, none of them has changed anything.
   */
  batch(statements: readonly Statement[]): Promise<unknown[][]>;
}

/** The shape of `node:sqlite`'s DatabaseSync that this adapter uses. */
interface SyncSqlite {
  prepare(sql: string): { all(...params: SqlValue[]): unknown[] };
  exec(sql: string): void;
}

/** Local SQLite, for the importer's output and for tests. */
export function fromNodeSqlite(db: SyncSqlite): TransactionalDatabase {
  return {
    all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
      return Promise.resolve(db.prepare(sql).all(...params) as T[]);
    },
    batch(statements: readonly Statement[]): Promise<unknown[][]> {
      db.exec("BEGIN");
      try {
        const rows = statements.map(({ sql, params }) => db.prepare(sql).all(...params));
        db.exec("COMMIT");
        return Promise.resolve(rows);
      } catch (failure) {
        db.exec("ROLLBACK");
        return Promise.reject(failure);
      }
    },
  };
}

/** The slice of Cloudflare's D1Database this adapter uses. */
interface D1Like {
  prepare(sql: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<{ results: unknown[] }[]>;
}
interface D1StatementLike {
  bind(...params: SqlValue[]): D1StatementLike;
  all<T>(): Promise<{ results: T[] }>;
}

/**
 * Cloudflare D1, reached from a Worker as `env.DB`.
 *
 * `bind()` is skipped when there are no parameters: D1 rejects a `bind()` call
 * with zero arguments on some statements, and binding nothing is meaningless
 * anyway.
 *
 * `batch` is D1's own: its statements run as one SQL transaction, and a failing
 * one rolls back the whole sequence
 * (https://developers.cloudflare.com/d1/worker-api/d1-database/#batch; local
 * D1 runs it in `transactionSync`, miniflare's workers/d1/database.worker.js).
 */
export function fromD1(db: D1Like): TransactionalDatabase {
  const prepared = (sql: string, params: readonly SqlValue[]): D1StatementLike => {
    const statement = db.prepare(sql);
    return params.length === 0 ? statement : statement.bind(...params);
  };
  return {
    async all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
      const { results } = await prepared(sql, params).all<T>();
      return results;
    },
    async batch(statements: readonly Statement[]): Promise<unknown[][]> {
      const answers = await db.batch(statements.map(({ sql, params }) => prepared(sql, params)));
      return answers.map(({ results }) => results);
    },
  };
}
