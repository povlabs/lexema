// Where `pnpm run seed:dev` loads the dictionary: the local D1 under a persist
// directory (the default), or a named remote D1 (`SEED_REMOTE`, ADR 0018). Each
// target owns the Wrangler arguments that reach it, so a command can never mix
// `--local` with a remote database or the other way round.

import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { getTableName } from "drizzle-orm";
import * as appSchema from "../db/app/schema.js";
import { readD1, type D1Executor } from "../db/d1Command.js";

/**
 * Runs `wrangler <args>` from `web/` and returns its stdout when `capture` is
 * set. The seed's only side effect on a database goes through it, which is what
 * lets a test build the whole command plan with no network and no credential.
 */
export type Wrangler = (args: readonly string[], capture: boolean) => string;

/** The most of each captured stream a `WranglerFailed` message quotes, from its end. */
const QUOTED_OUTPUT = 4000;
/** The most of each argument a `WranglerFailed` message quotes; SQL can run to 100,000 bytes. */
const QUOTED_ARGUMENT = 200;

const clipped = (text: string, limit: number, keep: "head" | "tail"): string =>
  text.length <= limit ? text : keep === "head" ? `${text.slice(0, limit)}… (${text.length} chars)` : `… ${text.slice(-limit)}`;

/**
 * A `wrangler` run that failed, with what it said. With `--json`, Wrangler
 * writes its own error to stdout, which a captured run reads and would
 * otherwise drop, so the message quotes both streams it captured.
 */
export class WranglerFailed extends Error {
  constructor(args: readonly string[], cause: string, stdout: string, stderr: string) {
    const said = [
      ["stdout", stdout],
      ["stderr", stderr],
    ]
      .filter(([, text]) => text.trim() !== "")
      .map(([stream, text]) => `\nwrangler ${stream}: ${clipped(text.trim(), QUOTED_OUTPUT, "tail")}`);
    super(`wrangler ${args.map((arg) => clipped(arg, QUOTED_ARGUMENT, "head")).join(" ")} failed (${cause})${said.join("")}`);
    this.name = "WranglerFailed";
  }
}

/**
 * The real `wrangler`, run from web/, where its config lives. CI=1 keeps it
 * from prompting. A captured answer may be large: the diff of a later release
 * reads the master's records fifty thousand at a time (src/update/master.ts),
 * well past Node's default 1 MiB. A captured run's stderr is passed on once it
 * ends; a failed run throws `WranglerFailed` quoting what it captured.
 */
export const webWrangler: Wrangler = (args, capture) => {
  const run = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: resolve("web"),
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, CI: "1" },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
  });
  const stdout = run.stdout ?? "";
  const stderr = run.stderr ?? "";
  if (stderr !== "") process.stderr.write(stderr);
  if (run.error !== undefined) throw new WranglerFailed(args, run.error.message, stdout, stderr);
  if (run.status !== 0) throw new WranglerFailed(args, run.status === null ? `signal ${run.signal}` : `exit ${run.status}`, stdout, stderr);
  return stdout;
};

/** The two local databases, by their `database_name` in web/wrangler.jsonc. */
export const LOCAL_DICTIONARY = "lexema";
export const LOCAL_APP = "lexema-app";
/**
 * Names Wrangler resolves out of web/wrangler.jsonc before it asks the API: a
 * remote run under one of them would reach the configured id, not a database
 * of that name, so a remote target refuses them.
 */
const CONFIGURED_NAMES: ReadonlySet<string> = new Set([LOCAL_DICTIONARY, LOCAL_APP, "DB", "APP_DB"]);
const D1_NAME = /^[a-z0-9][a-z0-9_-]*$/;

/** Tables D1 or SQLite keep for themselves in every database, empty or not. */
const isInternalTable = (name: string): boolean => name.startsWith("_cf_") || name.startsWith("sqlite_");

/** Every table `database` holds, D1's and SQLite's own included. */
const tableNames = (database: D1Executor): string[] =>
  (readD1<{ name: string }>(database, "SELECT name FROM sqlite_schema WHERE type = 'table'")[0] ?? []).map(({ name }) => name);

export interface SeedTarget extends D1Executor {
  /** The dictionary database's name, as Wrangler is given it. */
  readonly dictionary: string;
  /** Said once before the parts are applied. */
  readonly described: string;
  /** Make the target ready to take a fresh release, or refuse before anything is written. */
  prepare(): Promise<void>;
  /** `wrangler d1 execute` on the dictionary, aimed at this target. */
  execute(args: readonly string[], capture: boolean): string;
  /** Build the app tables where this target keeps them, and check they are there. */
  migrateApp(log: (line: string) => void): void;
  /** After a run stopped past its first write: the one next step that makes the target usable. */
  afterStop(): string;
  /** Said once the release is verified and given its final status. */
  finished(log: (line: string) => void): void;
  /** Anything the final report adds about where the release went. */
  readonly reported: Record<string, unknown>;
}

/** The local D1 under `persistTo`, holding both the dictionary and the app database. */
export class LocalSeedTarget implements SeedTarget {
  readonly dictionary = LOCAL_DICTIONARY;
  readonly reported = {};

  constructor(private readonly wrangler: Wrangler, readonly persistTo: string) {}

  get described(): string {
    return `local D1 into ${this.persistTo} (never web/.wrangler)`;
  }

  async prepare(): Promise<void> {
    await rm(this.persistTo, { recursive: true, force: true });
  }

  execute(args: readonly string[], capture: boolean): string {
    return this.d1(["execute", this.dictionary, ...args, "--yes"], capture);
  }

  // The app tables are Drizzle's (src/db/app/schema.ts, ADR 0017) and go to
  // their own database, through drizzle-kit's migrations and the
  // `migrations_dir` web/wrangler.jsonc names.
  migrateApp(log: (line: string) => void): void {
    log(`app migrations: into ${LOCAL_APP}`);
    this.d1(["migrations", "apply", LOCAL_APP], false);
    const appTables = Object.values(appSchema).map((table) => getTableName(table));
    const appHas = new Set(tableNames({ execute: (args, capture) => this.d1(["execute", LOCAL_APP, ...args], capture) }));
    const missing = appTables.filter((table) => !appHas.has(table));
    if (missing.length > 0) throw new Error(`app tables missing from ${LOCAL_APP}: ${missing.join(", ")}`);
    log(`  ${LOCAL_APP}: ${appTables.length} app table(s), none in ${this.dictionary}`);
  }

  finished(): void {}

  afterStop(): string {
    return `${this.persistTo} holds a partial database. Reseed into a fresh SEED_STATE (see docs/DEV_SEED.md).`;
  }

  private d1(args: readonly string[], capture: boolean): string {
    return this.wrangler(["d1", ...args, "--local", "--persist-to", this.persistTo], capture);
  }
}

/**
 * A named remote D1, the shared dictionary production and every Preview read
 * (ADR 0018). The seed creates it when absent and loads it only while it holds
 * no table. It never deletes or clears it: a run that stops leaves that to Huey.
 */
export class RemoteSeedTarget implements SeedTarget {
  readonly dictionary: string;
  private id: string | undefined;

  constructor(private readonly wrangler: Wrangler, name: string) {
    if (!D1_NAME.test(name)) {
      throw new Error(`SEED_REMOTE must be a D1 database name (lowercase letters, digits, - and _), got ${JSON.stringify(name)}`);
    }
    if (CONFIGURED_NAMES.has(name)) {
      throw new Error(
        `SEED_REMOTE=${name} names a database in web/wrangler.jsonc, which Wrangler would resolve to its local id; ` +
          `name the remote dictionary D1, for example lexema-dictionary`,
      );
    }
    this.dictionary = name;
  }

  /** The remote database's id, known once `prepare` has found or created it. */
  get databaseId(): string {
    if (this.id === undefined) throw new Error(`remote D1 ${this.dictionary} has not been prepared`);
    return this.id;
  }

  get described(): string {
    return `remote D1 ${this.dictionary} (${this.databaseId})`;
  }

  get reported(): Record<string, unknown> {
    return { remote: { database: this.dictionary, databaseId: this.databaseId } };
  }

  async prepare(): Promise<void> {
    this.id = this.find();
    if (this.id === undefined) {
      this.wrangler(["d1", "create", this.dictionary, "--update-config=false"], false);
      this.id = this.find();
      if (this.id === undefined) throw new Error(`created remote D1 ${this.dictionary}, but wrangler d1 list does not show it`);
    }
    const tables = tableNames(this).filter((name) => !isInternalTable(name));
    if (tables.length > 0) {
      throw new Error(
        `remote D1 ${this.dictionary} (${this.id}) already holds ${tables.length} table(s): ${tables.join(", ")}. ` +
          `The seed loads only an empty database and never clears one; ` +
          `to reload it, delete and recreate it (see docs/RUN_AN_IMPORT.md)`,
      );
    }
  }

  execute(args: readonly string[], capture: boolean): string {
    return this.wrangler(["d1", "execute", this.dictionary, ...args, "--remote", "--yes"], capture);
  }

  // Production's and each Preview's APP_DB are not the seed's (ADR 0018), so a
  // remote run builds no app table anywhere.
  migrateApp(): void {}

  finished(log: (line: string) => void): void {
    log(`remote D1 ${this.dictionary} database id: ${this.databaseId}`);
  }

  afterStop(): string {
    return (
      `remote D1 ${this.dictionary} (${this.databaseId}) holds part of a release, or one marked failed, and is not usable. ` +
      `The seed never deletes a remote database: delete and recreate it before retrying (see docs/RUN_AN_IMPORT.md).`
    );
  }

  private find(): string | undefined {
    const databases = JSON.parse(this.wrangler(["d1", "list", "--json"], true)) as { uuid: string; name: string }[];
    return databases.find(({ name }) => name === this.dictionary)?.uuid;
  }
}

/**
 * The target the environment names: `SEED_REMOTE` for a remote D1, else the
 * local persist directory. Both at once is refused, since a remote run keeps no
 * local state and a `SEED_STATE` beside it would be silently ignored.
 */
export function seedTargetFrom(
  env: { readonly SEED_REMOTE?: string; readonly SEED_STATE?: string },
  wrangler: Wrangler,
  defaultState: string,
): SeedTarget {
  if (env.SEED_REMOTE === undefined) return new LocalSeedTarget(wrangler, resolve(env.SEED_STATE ?? defaultState));
  if (env.SEED_STATE !== undefined) {
    throw new Error("SEED_REMOTE and SEED_STATE are both set: a remote seed keeps no local state, so unset SEED_STATE");
  }
  return new RemoteSeedTarget(wrangler, env.SEED_REMOTE);
}
