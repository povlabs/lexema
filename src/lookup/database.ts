// The one database capability lookup needs, and the two adapters that provide
// it: a Worker's D1 (async) and a local `node:sqlite` file (sync). One query
// layer instead of two — see docs/LOOKUP_DESIGN.md.
//
// Each adapter also hands out the same database through Drizzle, for the app
// tables better-auth reads and writes (src/db/app, ADR 0017).

import type { DatabaseSync } from "node:sqlite";
import { drizzleOverD1, type AppTables } from "../db/app/database.js";
import { drizzleOverNodeSqlite } from "../db/app/nodeSqlite.js";

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

/**
 * A database that also reaches the app tables through Drizzle, for the key,
 * usage and account code and for better-auth (src/db/app, ADR 0017). Both
 * adapters below provide it; a change that must land whole, like deleting a
 * developer account, runs as one Drizzle batch (src/accounts/accounts.ts).
 */
export interface TransactionalDatabase extends LookupDatabase, AppTables {}

/** Local SQLite, for the importer's output and for tests. */
export function fromNodeSqlite(db: DatabaseSync): TransactionalDatabase {
  return {
    app: drizzleOverNodeSqlite(db),
    all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
      return Promise.resolve(db.prepare(sql).all(...(params as SqlValue[])) as T[]);
    },
  };
}

/** The slice of Cloudflare's D1Database this adapter uses. */
interface D1Like {
  prepare(sql: string): D1StatementLike;
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
 */
export function fromD1(db: D1Like): TransactionalDatabase {
  const prepared = (sql: string, params: readonly SqlValue[]): D1StatementLike => {
    const statement = db.prepare(sql);
    return params.length === 0 ? statement : statement.bind(...params);
  };
  return {
    app: drizzleOverD1(db),
    async all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
      const { results } = await prepared(sql, params).all<T>();
      return results;
    },
  };
}
