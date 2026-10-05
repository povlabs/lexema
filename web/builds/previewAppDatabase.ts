// A branch's app database on the account (ADR 0018): found or created, and
// reset when its applied migrations have left the tree's (#589).
//
// Wrangler 4.135.0 decides which migrations to run by file name alone. Its
// `d1_migrations` table keeps an id, the name and the time it was applied,
// and no SQL or hash (`getCreateMigrationsTableQuery` in wrangler-dist/cli.js),
// and it runs every tree file whose name is not in that table, in the tree's
// order (`getUnappliedMigrationNames`, `compareMigrationPaths`). drizzle-kit
// numbers app migrations in sequence (ADR 0017), so two open pull requests
// that each add one take the same number, and the later one renames its file
// after merging `main`. Its Preview's app database already ran that file
// under the old name, so Wrangler would run the same SQL again and fail.
//
// So before the migrations run, the prepare step reads what the reused app
// database applied. When that is the tree's list so far, in its order, the
// database is kept and only the new files run. Otherwise its history has left
// the tree's: the database is deleted and created again empty, and every
// migration runs on it. A Preview's app data is for review only, and the test
// developer is made again at its next sign-in (web/worker/developers/testSignIn.ts).
// Every step that touches a D1 refuses the shared dictionary, by name or id, first.

import { type AppDatabase, refuseDictionary } from "./previewConfig.ts";
import type { PreviewName } from "./previewName.ts";
import { listDatabases, required, type Wrangler, type WranglerRun } from "./wrangler.ts";

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
 * The migrations `database` applied, oldest first. A database with no
 * `d1_migrations` table has applied none; any other failed read stops the
 * build, since what was applied is then unknown. Never the dictionary.
 */
export function appliedMigrations(wrangler: Wrangler, database: AppDatabase): string[] {
  const name = database.preview.appDatabase;
  refuseDictionary({ name, id: database.id }, "read the applied migrations of");
  const read = wrangler(["d1", "execute", name, "--remote", "--json", `--command=${APPLIED_MIGRATIONS_QUERY}`]);
  if (read.ok) return namesIn(read, name);
  if (answeredNoSuchTable(read, MIGRATIONS_TABLE)) return [];
  throw new Error(`could not read the applied migrations of ${name}`);
}

/** This branch's app database on the account, or none. */
function findAppDatabase(wrangler: Wrangler, preview: PreviewName): AppDatabase | undefined {
  const found = listDatabases(wrangler).find(({ name }) => name === preview.appDatabase);
  return found === undefined ? undefined : { preview, id: found.uuid };
}

/** Create this branch's app database. A create that loses a race with a concurrent build of the same branch still finds the winner's. */
function createAppDatabase(wrangler: Wrangler, preview: PreviewName): AppDatabase {
  refuseDictionary({ name: preview.appDatabase }, "create");
  wrangler(["d1", "create", preview.appDatabase, "--update-config=false"]);
  const created = findAppDatabase(wrangler, preview);
  if (created === undefined) throw new Error(`could not create the app database ${preview.appDatabase}`);
  return created;
}

/** Delete `database` and create this branch's app database again, empty. Never the dictionary. */
function resetAppDatabase(wrangler: Wrangler, database: AppDatabase): AppDatabase {
  refuseDictionary({ name: database.preview.appDatabase, id: database.id }, "reset");
  required(wrangler(["d1", "delete", database.preview.appDatabase, "--skip-confirmation"]), "wrangler d1 delete");
  return createAppDatabase(wrangler, database.preview);
}

/**
 * This branch's app database, ready for `wrangler d1 migrations apply` with
 * `treeMigrations`, the app migration file names in the tree: a new one; the
 * one already on the account, kept with its rows when what it applied is the
 * tree's list so far; or that one deleted and created again when its history
 * left the tree's. Each case logs one `app database:` line saying which.
 */
export function prepareAppDatabase(wrangler: Wrangler, preview: PreviewName, treeMigrations: readonly string[], log: (line: string) => void): AppDatabase {
  const existing = findAppDatabase(wrangler, preview);
  if (existing === undefined) {
    const created = createAppDatabase(wrangler, preview);
    log(`app database: created ${preview.appDatabase} (${created.id})`);
    return created;
  }
  const history = compareHistory(appliedMigrations(wrangler, existing), treeMigrations);
  if (history.state === "prefix") {
    log(`app database: reusing ${preview.appDatabase} (${existing.id}); ${history.pending.length} new migration(s) to apply`);
    return existing;
  }
  const reset = resetAppDatabase(wrangler, existing);
  log(
    `app database: reset ${preview.appDatabase}: ${divergence(history)}, so its history has left the tree's;` +
      ` deleted ${existing.id} and created ${reset.id}, and every migration runs on it`,
  );
  return reset;
}
