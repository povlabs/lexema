// The local D1 the dev seed writes, reached through Wrangler as
// src/import/seedDev.ts reaches it, for the CLIs that change it by hand
// (`pnpm run api-key`, `pnpm run plan`).

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { LookupDatabase, SqlValue } from "../lookup/database.js";

/** A value written into SQL as a literal, for Wrangler's `--command`, which binds no parameters. */
function sqlLiteral(value: SqlValue): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`);
    return String(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/** The local D1 whose state is at `persistTo`. */
export function localD1(persistTo: string): LookupDatabase {
  return {
    async all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
      let next = 0;
      const command = sql.replace(/\?/g, () => sqlLiteral(params[next++]));
      if (next !== params.length) throw new Error(`the statement takes ${next} parameter(s), was given ${params.length}`);
      const output = execFileSync(
        "pnpm",
        ["exec", "wrangler", "d1", "execute", "lexema", "--local", "--persist-to", persistTo, "--json", "--command", command],
        { cwd: resolve("web"), stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, CI: "1" }, encoding: "utf8" },
      );
      const [answer] = JSON.parse(output) as [{ results: T[] }];
      return answer.results;
    },
  };
}

/** The local D1 the CLIs write: `SEED_STATE`, default `.data/seed-state`, the one `pnpm run seed:dev` loads. */
export const seededD1 = (): LookupDatabase => localD1(resolve(process.env.SEED_STATE ?? ".data/seed-state"));
