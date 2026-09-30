// Drizzle over a `node:sqlite` DatabaseSync, through drizzle-orm/sqlite-proxy.
// drizzle-orm 0.45.3 ships no node:sqlite driver (#225 R1.3), and this keeps
// Drizzle and better-auth queries on `node --test` with no native build (ADR
// 0017). For tests and local tools; the Worker reaches D1 through drizzle-orm/d1.

import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema.js";

export type AppDatabase = SqliteRemoteDatabase<typeof schema>;

/**
 * The proxy hands over one statement, its values and how its rows are wanted:
 * `run` for none, `get` for the first row, `all` and `values` for every row,
 * each row an array of column values in select order.
 */
export function drizzleOverNodeSqlite(sqlite: DatabaseSync): AppDatabase {
  return drizzle(
    async (sql, params, method) => {
      const statement = sqlite.prepare(sql);
      const values = params as SQLInputValue[];
      if (method === "run") {
        statement.run(...values);
        return { rows: [] };
      }
      statement.setReturnArrays(true);
      if (method === "get") return { rows: (statement.get(...values) ?? []) as unknown[] };
      return { rows: statement.all(...values) as unknown[] };
    },
    { schema },
  );
}
