// How the Workers Builds commands run Wrangler and the build. Every step that
// reaches Cloudflare goes through a `Wrangler`, so the tests drive both
// commands against a fake account with no network and no credential.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** What one Wrangler run gave back. */
export interface WranglerRun {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run `wrangler <args>` from web/, with `input` on stdin when given. */
export type Wrangler = (args: readonly string[], input?: string) => WranglerRun;

/** The `web` package directory, where web/wrangler.jsonc and dist/ live. */
export const WEB_DIR = fileURLToPath(new URL("..", import.meta.url));

/**
 * Run a command in web/ with the build's own environment plus `env`, and
 * return what it gave back. Its output is echoed as it is read, so the build
 * log shows it; stdin is only ever the `input` given, which is never echoed.
 */
function run(command: string, args: readonly string[], input?: string, env: Record<string, string> = {}): WranglerRun {
  const result = spawnSync(command, args, {
    cwd: WEB_DIR,
    input: input ?? "",
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? (result.error ? String(result.error) : "");
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return { ok: result.status === 0, stdout, stderr };
}

/** Wrangler from web/'s own dependency, 4.135.0. */
export const wrangler: Wrangler = (args, input) => run("pnpm", ["exec", "wrangler", ...args], input);

/** `vinext build` with `CLOUDFLARE_ENV=production`, which writes dist/server/wrangler.json. */
export function buildProduction(): void {
  const built = run("pnpm", ["run", "build"], undefined, { CLOUDFLARE_ENV: "production" });
  if (!built.ok) throw new Error("the production build failed");
}

/** Throw unless this Wrangler run succeeded. */
export function required(run: WranglerRun, what: string): WranglerRun {
  if (!run.ok) throw new Error(`${what} failed`);
  return run;
}

/** One D1 database on the account, as `wrangler d1 list --json` lists it. */
export interface D1Database {
  readonly uuid: string;
  readonly name: string;
}

/** Every D1 database on the account: `wrangler d1 list --json`, which pages through them all. */
export function listDatabases(wrangler: Wrangler): D1Database[] {
  const listed = required(wrangler(["d1", "list", "--json"]), "wrangler d1 list");
  const databases: unknown = JSON.parse(listed.stdout);
  if (!Array.isArray(databases) || !databases.every((db) => typeof db?.uuid === "string" && typeof db?.name === "string")) {
    throw new Error("wrangler d1 list --json did not answer a list of databases");
  }
  return databases.map(({ uuid, name }: D1Database) => ({ uuid, name }));
}
