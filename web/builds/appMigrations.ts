// What an app database applied, against the app migrations in the tree
// (ADR 0018). Both Workers Builds commands read it: the preview command on a
// branch's own app database (web/builds/previewAppDatabase.ts), and the
// production command on `lexema-app` (web/builds/productionAppDatabase.ts).
//
// Wrangler 4.135.0 decides which migrations to run by file name alone. Its
// `d1_migrations` table keeps an id, the name and the time it was applied,
// and no SQL or hash (`getCreateMigrationsTableQuery` in wrangler-dist/cli.js),
// and it runs every tree file whose name is not in that table, in the tree's
// order (`getUnappliedMigrationNames`, `compareMigrationPaths`). drizzle-kit
// numbers app migrations in sequence (ADR 0017), so two open pull requests
// that each add one take the same number, and the later one renames its file
// after merging `main`. A database that already ran that file under the old
// name would run the same SQL again and fail. So each command reads the
// history first, and runs the migrations only on a history that is the tree's
// list so far.
//
// Both the read and the apply go through an `AppMigrationsConfig`, a config
// file that names the one database by name and id. With no `--config`,
// Wrangler 4.135.0 reads web/wrangler.jsonc, and when a top-level entry has
// the same `database_name` and an id, it uses that id
// (`getDatabaseInfoFromConfig` in wrangler-dist/cli.js). The top level binds
// `lexema-app` to a local placeholder id, so a read of production's
// `lexema-app` with no config would ask D1 for the placeholder (#611).

import { appMigrationsConfig, refuseDictionary } from "./previewConfig.ts";
import { required, type Wrangler, type WranglerRun } from "./wrangler.ts";

/** One D1 on the account, by the name Wrangler addresses it by and its id. */
export interface D1Target {
  readonly name: string;
  readonly id: string;
}

/** Wrangler's table of applied migrations, `DEFAULT_MIGRATION_TABLE` in Wrangler 4.135.0. */
const MIGRATIONS_TABLE = "d1_migrations";
/** What reads an app database's applied migrations, oldest first. */
export const APPLIED_MIGRATIONS_QUERY = `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`;

/** A migration file's leading number, as Wrangler reads it: the digits before the first `_`. */
const leadingNumber = (name: string): number => Number.parseInt(name.split("_")[0], 10);

/**
 * Migration file names in the order Wrangler runs them: by leading number,
 * then by name (`compareMigrationPaths` in Wrangler 4.135.0).
 */
export function inApplyOrder(names: readonly string[]): string[] {
  return [...names].sort((a, b) => {
    const [an, bn] = [leadingNumber(a), leadingNumber(b)];
    if (an !== bn && Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    if (an !== bn && Number.isFinite(an) !== Number.isFinite(bn)) return Number.isFinite(an) ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * What an app database applied, against the tree's migrations: the tree's
 * list so far, in its order, with the files still to run; or a history that
 * left it, at the first applied name that differs from the tree's there.
 */
export type MigrationHistory =
  | { readonly state: "prefix"; readonly pending: readonly string[] }
  | { readonly state: "diverged"; readonly applied: string; readonly tree: string | undefined; readonly gone: readonly string[] };

/** Compare `applied`, oldest first, with the tree's migration file names. */
export function compareHistory(applied: readonly string[], treeNames: readonly string[]): MigrationHistory {
  const tree = inApplyOrder(treeNames);
  const at = applied.findIndex((name, index) => name !== tree[index]);
  if (at < 0) return { state: "prefix", pending: tree.slice(applied.length) };
  return { state: "diverged", applied: applied[at], tree: tree[at], gone: applied.filter((name) => !tree.includes(name)) };
}

/** Why a diverged history cannot be migrated forward, in one clause. */
export function divergence(history: Extract<MigrationHistory, { state: "diverged" }>): string {
  if (history.gone.length > 0) return `it applied ${history.gone.join(", ")}, which the tree no longer has (renamed or removed)`;
  if (history.tree === undefined) return `it applied ${history.applied} past the tree's last migration`;
  return `it applied ${history.applied} where the tree runs ${history.tree}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The names in `wrangler d1 execute --json`'s answer to `APPLIED_MIGRATIONS_QUERY`, or a throw. */
function namesIn(run: WranglerRun, database: string): string[] {
  const answer: unknown = JSON.parse(run.stdout);
  const rows = Array.isArray(answer) && isRecord(answer[0]) ? answer[0].results : undefined;
  if (!Array.isArray(rows) || !rows.every((row) => isRecord(row) && typeof row.name === "string")) {
    throw new Error(`${database} did not answer its applied migrations as a list of names`);
  }
  return rows.map((row: { name: string }) => row.name);
}

/**
 * Whether a failed `wrangler d1 execute --json` answered that `table` does not
 * exist. Wrangler 4.135.0 catches the query's error and, under `--json`, throws
 * it as a `JsonFriendlyFatalError` whose message is `{"error": ...}`, which its
 * top-level handler prints with `logger.log`: so the answer is that JSON on
 * stdout, not text on stderr. A remote query's error is an `APIError` whose
 * notes carry D1's own words, `no such table: <table>: SQLITE_ERROR`; the
 * colon after the name keeps `d1_migrations` from matching a longer name.
 */
function answeredNoSuchTable(run: WranglerRun, table: string): boolean {
  let answer: unknown;
  try {
    answer = JSON.parse(run.stdout);
  } catch {
    return false;
  }
  return isRecord(answer) && "error" in answer && JSON.stringify(answer.error).includes(`no such table: ${table}:`);
}

/**
 * A Wrangler config file that names one app database by name and id, with the
 * app migrations as its `migrations_dir` (`appMigrationsConfig`). It is the
 * only way to read or apply an app database's migrations, so neither call can
 * resolve the name through web/wrangler.jsonc instead. Never the dictionary.
 */
export class AppMigrationsConfig {
  private constructor(
    readonly database: D1Target,
    readonly path: string,
  ) {}

  /** Write the config for `database` with `write`, which returns the file's path. */
  static write(database: D1Target, migrationsDir: string, write: (config: Record<string, unknown>) => string): AppMigrationsConfig {
    return new AppMigrationsConfig(database, write(appMigrationsConfig(database, migrationsDir)));
  }

  /**
   * The migrations the database applied, oldest first. A database with no
   * `d1_migrations` table has applied none; any other failed read stops the
   * build, since what was applied is then unknown.
   */
  applied(wrangler: Wrangler): string[] {
    const { name } = this.database;
    refuseDictionary(this.database, "read the applied migrations of");
    const read = wrangler(["d1", "execute", name, "--remote", "--config", this.path, "--json", `--command=${APPLIED_MIGRATIONS_QUERY}`]);
    if (read.ok) return namesIn(read, name);
    if (answeredNoSuchTable(read, MIGRATIONS_TABLE)) return [];
    throw new Error(`could not read the applied migrations of ${name}`);
  }

  /** Run every app migration the database has not applied, or throw. */
  apply(wrangler: Wrangler): void {
    refuseDictionary(this.database, "migrate");
    required(wrangler(["d1", "migrations", "apply", this.database.name, "--remote", "--config", this.path]), "wrangler d1 migrations apply");
  }
}
