// Drizzle over a `node:sqlite` DatabaseSync, through drizzle-orm/sqlite-proxy.
// drizzle-orm 0.45.3 ships no node:sqlite driver (#225 R1.3), and this keeps
// Drizzle and better-auth queries on `node --test` with no native build (ADR
// 0017). For tests and local tools; the Worker reaches D1 through drizzle-orm/d1.

import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { AppDatabase, AppTables } from "./database.js";
import * as schema from "./schema.js";

type Method = "run" | "all" | "values" | "get";

/**
 * The proxy hands over one statement, its values and how its rows are wanted:
 * `run` for none, `get` for the first row, `all` and `values` for every row,
 * each row an array of column values in select order. A `get` that finds no row
 * hands over `undefined`: Drizzle maps any truthy value, `[]` included, to a row.
 */
function answer(sqlite: DatabaseSync, sql: string, params: unknown[], method: Method): { rows: unknown[] } {
  const statement = sqlite.prepare(sql);
  const values = params as SQLInputValue[];
  if (method === "run") {
    statement.run(...values);
    return { rows: [] };
  }
  statement.setReturnArrays(true);
  if (method === "get") {
    const row = statement.get(...values) as unknown as unknown[] | undefined;
    return { rows: row as unknown[] };
  }
  return { rows: statement.all(...values) as unknown[] };
}

/** Drizzle over the file; a batch is one transaction, rolled back whole when any statement fails. */
export function drizzleOverNodeSqlite(sqlite: DatabaseSync): AppDatabase {
  return drizzle(
    async (sql, params, method) => answer(sqlite, sql, params, method),
    async (batch) => {
      sqlite.exec("BEGIN");
      try {
        const answers = batch.map(({ sql, params, method }) => answer(sqlite, sql, params, method));
        sqlite.exec("COMMIT");
        return answers;
      } catch (failure) {
        sqlite.exec("ROLLBACK");
        throw failure;
      }
    },
    { schema },
  );
}

/** The app database in a `node:sqlite` file, for tests and local tools. */
export function appTablesOverNodeSqlite(sqlite: DatabaseSync): AppTables {
  return { app: drizzleOverNodeSqlite(sqlite) };
}
