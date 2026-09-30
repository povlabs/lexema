// The app tables through Drizzle (ADR 0017), in the app database: a Worker's
// `APP_DB` D1 through drizzle-orm/d1, or a `node:sqlite` file through
// ./nodeSqlite.ts. The dictionary is another database, `DB`, which code only
// reads (src/lookup/database.ts, ADR 0018); nothing here reaches it.

import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema.js";

/**
 * Drizzle over the app tables, on either driver. `batch` runs its statements
 * as one transaction, and a failing one rolls back the whole sequence: on D1
 * it is D1's own batch
 * (https://developers.cloudflare.com/d1/worker-api/d1-database/#batch; local
 * D1 runs it in `transactionSync`, miniflare's workers/d1/database.worker.js),
 * and on `node:sqlite` one transaction (./nodeSqlite.ts).
 */
export type AppDatabase = BaseSQLiteDatabase<"async", unknown, typeof schema> & Pick<DrizzleD1Database<typeof schema>, "batch">;

/** The app database, reached through Drizzle. */
export interface AppTables {
  readonly app: AppDatabase;
}

/** Drizzle over a Worker's D1 binding. */
export function drizzleOverD1(d1: unknown): AppDatabase {
  return drizzle(d1 as Parameters<typeof drizzle>[0], { schema });
}

/** The app database a Worker binds as `APP_DB`. */
export function appTablesOverD1(d1: unknown): AppTables {
  return { app: drizzleOverD1(d1) };
}
