// `pnpm run api-key`: create and revoke API keys in the local D1 (#150).
//
//   pnpm run api-key create --label "learning app" --per-minute 60
//   pnpm run api-key revoke 3
//
// `create` prints the key once; only its hash is stored, so it cannot be shown
// again. It also prints the key's id, which is what `revoke` takes. The
// database is the local D1 the dev seed writes (`SEED_STATE`, default
// `.data/seed-state`), reached through Wrangler as the seed reaches it. A key
// made here is an admin key: it has no owner, no developer account sees it, and
// its per-minute limit is its own.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { AppTables } from "../db/app/database.js";
import * as schema from "../db/app/schema.js";
import { createKey, revokeKey } from "./keys.js";

const USAGE = `usage:
  pnpm run api-key create --label <text> --per-minute <calls>
  pnpm run api-key revoke <key id>`;

/** What a command printed, and the exit status it ends with. */
export interface CommandResult {
  out: string;
  status: 0 | 1;
}

const usage = (problem: string): CommandResult => ({ out: `${problem}\n${USAGE}`, status: 1 });

/** A whole number above zero, or undefined. */
const positive = (text: string | undefined): number | undefined =>
  text !== undefined && /^[1-9]\d*$/.test(text) ? Number(text) : undefined;

/** The value after each `--flag`, for the flags named. */
function flags(args: readonly string[], names: readonly string[]): Map<string, string> | string {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].replace(/^--/, "");
    if (!args[i].startsWith("--") || !names.includes(name)) return `unknown argument ${args[i]}`;
    if (args[i + 1] === undefined) return `--${name} needs a value`;
    values.set(name, args[i + 1]);
  }
  return values;
}

/** Run one command against a database. */
export async function runKeyCommand(args: readonly string[], db: AppTables, now: number): Promise<CommandResult> {
  const [command, ...rest] = args;
  if (command === "create") {
    const given = flags(rest, ["label", "per-minute"]);
    if (typeof given === "string") return usage(given);
    const label = given.get("label")?.trim() ?? "";
    const perMinuteLimit = positive(given.get("per-minute"));
    if (label === "") return usage("create needs --label");
    if (perMinuteLimit === undefined) return usage("create needs --per-minute, a whole number above 0");
    const { keyId, key } = await createKey(db, { label, perMinuteLimit }, now);
    return {
      out: [
        `created key ${keyId} "${label}": ${perMinuteLimit} calls a minute`,
        "",
        `  ${key}`,
        "",
        "This is the only time the key is shown. Only its hash is stored.",
      ].join("\n"),
      status: 0,
    };
  }
  if (command === "revoke") {
    const keyId = positive(rest[0]);
    if (keyId === undefined || rest.length !== 1) return usage("revoke needs one key id");
    const outcome = await revokeKey(db, keyId, now);
    if (outcome === "unknown") return { out: `no key ${keyId}`, status: 1 };
    return { out: outcome === "revoked" ? `revoked key ${keyId}` : `key ${keyId} was already revoked`, status: 0 };
  }
  return usage(command === undefined ? "no command" : `unknown command ${command}`);
}

/** A value written into SQL as a literal, for Wrangler's `--command`, which binds no parameters. */
function sqlLiteral(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`);
    return String(value);
  }
  if (typeof value !== "string") throw new Error(`not a value a key statement binds: ${String(value)}`);
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The local D1 through Wrangler, as src/import/seedDev.ts reaches it, with
 * Drizzle over it. Wrangler answers each row as an object in select order, and
 * Drizzle wants it as an array in that order; no key statement selects two
 * columns of one name. The CLI runs no batch.
 */
function localD1(persistTo: string): AppTables {
  const execute = (sql: string, params: readonly unknown[]): Record<string, unknown>[] => {
    let next = 0;
    const command = sql.replace(/\?/g, () => sqlLiteral(params[next++]));
    if (next !== params.length) throw new Error(`the statement takes ${next} parameter(s), was given ${params.length}`);
    const output = execFileSync(
      "pnpm",
      ["exec", "wrangler", "d1", "execute", "lexema", "--local", "--persist-to", persistTo, "--json", "--command", command],
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const db = localD1(resolve(process.env.SEED_STATE ?? ".data/seed-state"));
  const { out, status } = await runKeyCommand(process.argv.slice(2), db, Date.now());
  (status === 0 ? process.stdout : process.stderr).write(`${out}\n`);
  process.exitCode = status;
}
