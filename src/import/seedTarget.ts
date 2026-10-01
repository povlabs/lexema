// Where `pnpm run seed:dev` loads the dictionary: the local D1 under a persist
// directory (the default), or a named remote D1 (`SEED_REMOTE`, ADR 0018). Each
// target owns the Wrangler arguments that reach it, so a command can never mix
// `--local` with a remote database or the other way round.
//
// A target either starts from an empty database or, with `SEED_BESIDE=1`,
// keeps the releases its database holds and adds one beside them (#18,
// seedPlacement.ts).

import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { getTableName } from "drizzle-orm";
import * as appSchema from "../db/app/schema.js";
import {
  type DictionarySql,
  FRESH,
  isInternalTable,
  readPlacement,
  type SeedPlacement,
  TABLES_QUERY,
} from "./seedPlacement.js";
import { SEEDED_TABLES } from "./seedSql.js";

/**
 * Runs `wrangler <args>` from `web/` and returns its stdout when `capture` is
 * set. The seed's only side effect on a database goes through it, which is what
 * lets a test build the whole command plan with no network and no credential.
 */
export type Wrangler = (args: readonly string[], capture: boolean) => string;

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

const tableNames = (answer: string): string[] => {
  const [result] = JSON.parse(answer) as [{ results: { name: string }[] }];
  return result.results.map(({ name }) => name);
};

export interface SeedTarget {
  /** The dictionary database's name, as Wrangler is given it. */
  readonly dictionary: string;
  /** Said once before the parts are applied. */
  readonly described: string;
  /**
   * Make the target ready to take a release and say where it goes: into an
   * empty database, or beside the releases it holds when the seed was asked to
   * (`SEED_BESIDE=1`). Refuses before anything is written.
   */
  prepare(): Promise<SeedPlacement>;
  /** What `prepare` answered. */
  readonly placement: SeedPlacement;
  /** `wrangler d1 execute` on the dictionary, aimed at this target. */
  execute(args: readonly string[], capture: boolean): string;
  /** Build the app tables where this target keeps them, and check they are there. */
  migrateApp(log: (line: string) => void): void;
  /** After a run of `releaseId` stopped past its first write: the one next step that makes the target usable. */
  afterStop(releaseId: string): string;
  /** Said once the release is verified and given its final status. */
  finished(log: (line: string) => void): void;
  /** Anything the final report adds about where the release went. */
  readonly reported: Record<string, unknown>;
}

/** The dictionary on `target`, one `wrangler d1 execute --command` per statement. */
export function dictionarySql(target: Pick<SeedTarget, "execute">): DictionarySql {
  return {
    query<Row>(sql: string): Row[] {
      const answers = JSON.parse(target.execute(["--json", "--command", sql], true)) as { results: Row[] }[];
      return answers.at(-1)?.results ?? [];
    },
    run(sql: string): void {
      target.execute(["--json", "--command", sql], true);
    },
  };
}

/** Where a release seeded beside the ones `target` holds goes (seedPlacement.ts). */
const placementBeside = (target: SeedTarget, described: string): SeedPlacement =>
  readPlacement(dictionarySql(target), described, readFileSync(resolve("src/db/schema.sql"), "utf8"), SEEDED_TABLES);

/**
 * After a seed beside other releases stopped. Those releases are untouched and
 * still served, so the stopped one is cleared by name, never by clearing or
 * deleting the database.
 */
const besideStop = (where: string, env: string, releaseId: string): string =>
  `${where} holds part of release ${releaseId}, or marks it failed; every other release in it is untouched. ` +
  `Do not clear or delete the database. Mark the release failed if it still reads importing, discard it, then seed again: ` +
  `${env} pnpm run release abandon ${releaseId}; ${env} pnpm run release discard ${releaseId} ` +
  `(docs/UPDATE_A_RELEASE.md#if-a-seed-stops).`;

/** The local D1 under `persistTo`, holding both the dictionary and the app database. */
export class LocalSeedTarget implements SeedTarget {
  readonly dictionary = LOCAL_DICTIONARY;
  readonly reported = {};
  private prepared: SeedPlacement | undefined;

  /** `beside`: keep the releases `persistTo` holds and seed beside them, instead of clearing it first. */
  constructor(private readonly wrangler: Wrangler, readonly persistTo: string, private readonly beside = false) {}

  get described(): string {
    return `local D1 into ${this.persistTo} (never web/.wrangler)`;
  }

  get placement(): SeedPlacement {
    if (this.prepared === undefined) throw new Error(`local D1 in ${this.persistTo} has not been prepared`);
    return this.prepared;
  }

  async prepare(): Promise<SeedPlacement> {
    if (this.beside) {
      this.prepared = placementBeside(this, `local D1 ${this.dictionary} in ${this.persistTo}`);
    } else {
      await rm(this.persistTo, { recursive: true, force: true });
      this.prepared = FRESH;
    }
    return this.prepared;
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
    const appHas = new Set(tableNames(this.d1(["execute", LOCAL_APP, "--json", "--command", TABLES_QUERY], true)));
    const missing = appTables.filter((table) => !appHas.has(table));
    if (missing.length > 0) throw new Error(`app tables missing from ${LOCAL_APP}: ${missing.join(", ")}`);
    log(`  ${LOCAL_APP}: ${appTables.length} app table(s), none in ${this.dictionary}`);
  }

  finished(): void {}

  afterStop(releaseId: string): string {
    if (this.placement.kind === "beside") return besideStop(this.persistTo, `SEED_STATE=${this.persistTo}`, releaseId);
    return `${this.persistTo} holds a partial database. Reseed into a fresh SEED_STATE (see docs/DEV_SEED.md).`;
  }

  private d1(args: readonly string[], capture: boolean): string {
    return this.wrangler(["d1", ...args, "--local", "--persist-to", this.persistTo], capture);
  }
}

/**
 * A named remote D1, the shared dictionary production and every Preview read
 * (ADR 0018). The seed creates it when absent and loads it while it holds no
 * table, or, asked to seed beside, while it holds the dictionary schema and no
 * release still importing. It never deletes or clears it.
 */
export class RemoteSeedTarget implements SeedTarget {
  readonly dictionary: string;
  private id: string | undefined;
  private prepared: SeedPlacement | undefined;

  constructor(private readonly wrangler: Wrangler, name: string, private readonly beside = false) {
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

  get placement(): SeedPlacement {
    if (this.prepared === undefined) throw new Error(`remote D1 ${this.dictionary} has not been prepared`);
    return this.prepared;
  }

  get reported(): Record<string, unknown> {
    return { remote: { database: this.dictionary, databaseId: this.databaseId } };
  }

  async prepare(): Promise<SeedPlacement> {
    this.id = this.find();
    if (this.id === undefined) {
      this.wrangler(["d1", "create", this.dictionary, "--update-config=false"], false);
      this.id = this.find();
      if (this.id === undefined) throw new Error(`created remote D1 ${this.dictionary}, but wrangler d1 list does not show it`);
    }
    if (this.beside) {
      this.prepared = placementBeside(this, this.described);
      return this.prepared;
    }
    const tables = tableNames(this.execute(["--json", "--command", TABLES_QUERY], true)).filter((name) => !isInternalTable(name));
    if (tables.length > 0) {
      throw new Error(
        `remote D1 ${this.dictionary} (${this.id}) already holds ${tables.length} table(s): ${tables.join(", ")}. ` +
          `The seed loads only an empty database and never clears one; ` +
          `to add a release beside the ones it holds, set SEED_BESIDE=1 (see docs/UPDATE_A_RELEASE.md)`,
      );
    }
    this.prepared = FRESH;
    return this.prepared;
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

  afterStop(releaseId: string): string {
    if (this.placement.kind === "beside") {
      return besideStop(this.described, `SEED_REMOTE=${this.dictionary}`, releaseId);
    }
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
 * local persist directory, and `SEED_BESIDE=1` to keep the releases it holds.
 * `SEED_REMOTE` and `SEED_STATE` together are refused, since a remote run keeps
 * no local state and a `SEED_STATE` beside it would be silently ignored.
 */
export function seedTargetFrom(
  env: { readonly SEED_REMOTE?: string; readonly SEED_STATE?: string; readonly SEED_BESIDE?: string },
  wrangler: Wrangler,
  defaultState: string,
): SeedTarget {
  if (env.SEED_BESIDE !== undefined && env.SEED_BESIDE !== "1") {
    throw new Error(`SEED_BESIDE is 1 or unset, got ${JSON.stringify(env.SEED_BESIDE)}`);
  }
  const beside = env.SEED_BESIDE === "1";
  if (env.SEED_REMOTE === undefined) return new LocalSeedTarget(wrangler, resolve(env.SEED_STATE ?? defaultState), beside);
  if (env.SEED_STATE !== undefined) {
    throw new Error("SEED_REMOTE and SEED_STATE are both set: a remote seed keeps no local state, so unset SEED_STATE");
  }
  return new RemoteSeedTarget(wrangler, env.SEED_REMOTE, beside);
}
