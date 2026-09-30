// The local app database, `APP_DB`, reached through Wrangler as
// src/import/seedDev.ts reaches it, with Drizzle over it, for the CLIs that
// change it by hand (`pnpm run api-key`, `pnpm run plan`).

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { AppTables } from "./app/database.js";
import * as schema from "./app/schema.js";

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
 * The local app database whose state is at `persistTo`. Wrangler answers each
 * row as an object in select order, and Drizzle wants it as an array in that
 * order, so no CLI statement selects two columns of one name. The CLIs run no
 * batch.
 */
export function localD1(persistTo: string): AppTables {
  const execute = (sql: string, params: readonly unknown[]): Record<string, unknown>[] => {
    let next = 0;
    const command = sql.replace(/\?/g, () => sqlLiteral(params[next++]));
    if (next !== params.length) throw new Error(`the statement takes ${next} parameter(s), was given ${params.length}`);
    const output = execFileSync(
      "pnpm",
      ["exec", "wrangler", "d1", "execute", "lexema-app", "--local", "--persist-to", persistTo, "--json", "--command", command],
      { cwd: resolve("web"), stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, CI: "1" }, encoding: "utf8" },
    );
    const [answer] = JSON.parse(output) as [{ results: Record<string, unknown>[] }];
    return answer.results;
  };
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

/** The local app database the CLIs write: the one in `SEED_STATE`, default `.data/seed-state`, which `pnpm run seed:dev` migrates. */
export const seededAppDatabase = (): AppTables => localD1(resolve(process.env.SEED_STATE ?? ".data/seed-state"));
