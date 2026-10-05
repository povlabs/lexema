// A branch's app database on the account (ADR 0018): found or created, and
// reset when its applied migrations have left the tree's (#589).
//
// Before the migrations run, the prepare step reads what the reused app
// database applied (web/builds/appMigrations.ts says why). When that is the
// tree's list so far, in its order, the database is kept and only the new
// files run. Otherwise its history has left the tree's: the database is
// deleted and created again empty, and every migration runs on it. A
// Preview's app data is for review only, and the test developer is made again
// at its next sign-in (web/worker/developers/testSignIn.ts). Production's app
// database is never reset (web/builds/productionAppDatabase.ts). Every step
// that touches a D1 refuses the shared dictionary, by name or id, first.

import type { AppMigrationsConfig, D1Target } from "./appMigrations.ts";
import { compareHistory, divergence } from "./appMigrations.ts";
import { type AppDatabase, refuseDictionary } from "./previewConfig.ts";
import type { PreviewName } from "./previewName.ts";
import { listDatabases, required, type Wrangler } from "./wrangler.ts";

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

/** A branch's app database and the migrations config that names it. */
export interface PreparedAppDatabase {
  readonly database: AppDatabase;
  readonly migrations: AppMigrationsConfig;
}

/** The `D1Target` a branch's app database is addressed by. */
const targetOf = (database: AppDatabase): D1Target => ({ name: database.preview.appDatabase, id: database.id });

/**
 * This branch's app database, ready for its config's `apply` with
 * `treeMigrations`, the app migration file names in the tree: a new one; the
 * one already on the account, kept with its rows when what it applied is the
 * tree's list so far; or that one deleted and created again when its history
 * left the tree's. `configFor` writes the migrations config for a database.
 * Each case logs one `app database:` line saying which.
 */
export function prepareAppDatabase(
  wrangler: Wrangler,
  preview: PreviewName,
  treeMigrations: readonly string[],
  configFor: (database: D1Target) => AppMigrationsConfig,
  log: (line: string) => void,
): PreparedAppDatabase {
  const existing = findAppDatabase(wrangler, preview);
  if (existing === undefined) {
    const created = createAppDatabase(wrangler, preview);
    log(`app database: created ${preview.appDatabase} (${created.id})`);
    return { database: created, migrations: configFor(targetOf(created)) };
  }
  const migrations = configFor(targetOf(existing));
  const history = compareHistory(migrations.applied(wrangler), treeMigrations);
  if (history.state === "prefix") {
    log(`app database: reusing ${preview.appDatabase} (${existing.id}); ${history.pending.length} new migration(s) to apply`);
    return { database: existing, migrations };
  }
  const reset = resetAppDatabase(wrangler, existing);
  log(
    `app database: reset ${preview.appDatabase}: ${divergence(history)}, so its history has left the tree's;` +
      ` deleted ${existing.id} and created ${reset.id}, and every migration runs on it`,
  );
  return { database: reset, migrations: configFor(targetOf(reset)) };
}
