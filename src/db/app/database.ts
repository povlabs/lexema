// The app tables through Drizzle, whichever database holds them (ADR 0017): a
// Worker's D1 through drizzle-orm/d1, or a `node:sqlite` file through
// ./nodeSqlite.ts. src/lookup/database.ts hands one out beside its raw SQL, so
// a caller holding either adapter reaches the same database both ways.

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

/** A database that reaches the app tables through Drizzle: both adapters in src/lookup/database.ts. */
export interface AppTables {
  readonly app: AppDatabase;
}

/** Drizzle over a Worker's D1 binding. */
export function drizzleOverD1(d1: unknown): AppDatabase {
  return drizzle(d1 as Parameters<typeof drizzle>[0], { schema });
}
