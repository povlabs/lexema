// The local app database, `APP_DB`, reached through Wrangler as
// src/import/seedDev.ts reaches it, with Drizzle over it, for the CLIs that
// change it by hand (`pnpm run api-key`, `pnpm run plan`, `pnpm run account`,
// `pnpm run report`).
// `pnpm run report` also reads the local dictionary, `DB`, the same way and
// only through `readOnly` (ADR 0018).

import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { LOCAL_APP, LOCAL_DICTIONARY, webWrangler } from "../import/seedTarget.js";
import { readOnly, type LookupDatabase } from "../lookup/database.js";
import type { AppTables } from "./app/database.js";
import * as schema from "./app/schema.js";
import { readD1, type D1Executor } from "./d1Command.js";

/** A value written into SQL as a literal, for Wrangler's `--command`, which binds no parameters. */
function sqlLiteral(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`);
    return String(value);
  }
  if (typeof value !== "string") throw new Error(`not a value a CLI statement binds: ${String(value)}`);
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Run one statement on the local database `name` whose state is at
 * `persistTo`, and answer its rows. Wrangler answers each row as an object in
 * select order.
 */
function executor(persistTo: string, name: string) {
  const database: D1Executor = {
    execute: (args, capture) => webWrangler(["d1", "execute", name, "--local", "--persist-to", persistTo, ...args], capture),
  };
  return (sql: string, params: readonly unknown[]): Record<string, unknown>[] => {
    let next = 0;
    const command = sql.replace(/\?/g, () => sqlLiteral(params[next++]));
    if (next !== params.length) throw new Error(`the statement takes ${next} parameter(s), was given ${params.length}`);
    return readD1<Record<string, unknown>>(database, command)[0] ?? [];
  };
}

/**
 * The local app database whose state is at `persistTo`. Drizzle wants each
 * row as an array in select order, so no CLI statement selects two columns of
 * one name. The CLIs run no batch.
 */
export function localD1(persistTo: string): AppTables {
  const execute = executor(persistTo, LOCAL_APP);
  const app = drizzle(
    async (sql, params, method) => {
      const rows = execute(sql, params).map((row) => Object.values(row));
      if (method === "run") return { rows: [] };
      return { rows: method === "get" ? (rows[0] as unknown[]) : rows };
    },
    { schema },
  );
  return { app };
}

/** The local dictionary whose state is at `persistTo`, read one SELECT at a time. */
export function localDictionary(persistTo: string): LookupDatabase {
  const execute = executor(persistTo, LOCAL_DICTIONARY);
  return {
    all: <T>(sql: string, params: readonly unknown[]) => Promise.resolve(execute(readOnly(sql), params) as T[]),
  };
}

const seedState = (): string => resolve(process.env.SEED_STATE ?? ".data/seed-state");

/** The local app database the CLIs write: the one in `SEED_STATE`, default `.data/seed-state`, which `pnpm run seed:dev` migrates. */
export const seededAppDatabase = (): AppTables => localD1(seedState());

/** The local dictionary `pnpm run seed:dev` loads, in the same `SEED_STATE`. */
export const seededDictionary = (): LookupDatabase => localDictionary(seedState());
