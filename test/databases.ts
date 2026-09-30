// The two databases a test stands up, split as the Worker's bindings are (ADR
// 0018): the dictionary, which code only reads, and the app database.

import { DatabaseSync } from "node:sqlite";
import type { MeterSql, SqlValue } from "../src/api/accountMeter.js";
import type { AppTables } from "../src/db/app/database.js";
import { applyAppMigrations } from "../src/db/app/migrations.js";
import { appTablesOverNodeSqlite } from "../src/db/app/nodeSqlite.js";
import { fromNodeSqlite, type LookupDatabase } from "../src/lookup/database.js";

/**
 * The dictionary over a seeded file, locked the way no code path can unlock:
 * SQLite's `query_only` refuses every INSERT, UPDATE, DELETE and DDL statement,
 * whichever path sends it, so a test that writes through it fails.
 */
export function readOnlyDictionary(sqlite: DatabaseSync): LookupDatabase {
  sqlite.exec("PRAGMA query_only = ON");
  return fromNodeSqlite(sqlite);
}

/** A fresh app database, as `APP_DB` is built: the app migrations over an empty one. */
export function freshAppDatabase(): { sqlite: DatabaseSync; appDb: AppTables } {
  const sqlite = new DatabaseSync(":memory:");
  applyAppMigrations(sqlite);
  return { sqlite, appDb: appTablesOverNodeSqlite(sqlite) };
}

/** An account meter's storage over a `node:sqlite` database, as a Durable Object's `ctx.storage.sql` is (src/api/accountMeter.ts). */
export function meterSqlOver(sqlite: DatabaseSync): MeterSql {
  return <Row extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) => sqlite.prepare(query).all(...bindings) as Row[];
}
