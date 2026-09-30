// The app tables through Drizzle, whichever database holds them (ADR 0017): a
// Worker's D1 through drizzle-orm/d1, or a `node:sqlite` file through
// ./nodeSqlite.ts. src/lookup/database.ts hands one out beside its raw SQL, so
// a caller holding either adapter reaches the same database both ways.

import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema.js";

/** Drizzle over the app tables, on either driver. */
export type AppDatabase = BaseSQLiteDatabase<"async", unknown, typeof schema>;

/** Drizzle over a Worker's D1 binding. */
export function drizzleOverD1(d1: unknown): AppDatabase {
  return drizzle(d1 as Parameters<typeof drizzle>[0], { schema });
}
