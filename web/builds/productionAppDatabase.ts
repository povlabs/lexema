// Production's app database, `lexema-app` (#611, ADR 0018): the production
// command applies the app migrations it has not run yet, before
// `wrangler deploy`, so the deployed code never runs on an older schema.
//
// Unlike a Preview's, this database holds real accounts, keys, usage and
// reader reports. So the step only ever moves it forward: it never creates,
// deletes or resets it. It refuses the shared dictionary by name or id, a
// database the account does not hold under the expected id, and a history
// that has left the tree's (web/builds/appMigrations.ts); each refusal stops
// the deploy.

import { AppMigrationsConfig, compareHistory, type D1Target, divergence } from "./appMigrations.ts";
import { refuseDictionary } from "./previewConfig.ts";
import { listDatabases, type Wrangler } from "./wrangler.ts";

/** Production's `APP_DB` (web/wrangler.jsonc, `env.production`), made empty by Huey on 2026-10-05 (#611). */
export const PRODUCTION_APP_DATABASE: D1Target = { name: "lexema-app", id: "e77ba8e9-f4da-45fe-9b8c-322904054edc" };

export interface ProductionMigrationSteps {
  readonly wrangler: Wrangler;
  /** The app migrations directory, absolute. */
  readonly migrationsDir: string;
  /** The app migration file names in that directory, which `wrangler d1 migrations apply` runs. */
  readonly migrations: readonly string[];
  /** Write the app database's migrations config and return its path. */
  writeMigrationsConfig(config: Record<string, unknown>): string;
  log(line: string): void;
}

/**
 * Apply the app migrations `database` has not run, or throw. Every refusal
 * comes before anything is written, and the database is never deleted,
 * created again or reset. Logs one `app database:` line saying what it did.
 */
export function migrateProductionAppDatabase(database: D1Target, steps: ProductionMigrationSteps): void {
  const { wrangler, log } = steps;
  refuseDictionary(database, "migrate");
  const onAccount = listDatabases(wrangler).find(({ name }) => name === database.name);
  if (onAccount === undefined) {
    throw new Error(`refusing to migrate ${database.name}: it is not on the account, and the production command never creates it`);
  }
  if (onAccount.uuid !== database.id) {
    throw new Error(`refusing to migrate ${database.name}: the account holds it as ${onAccount.uuid}, not ${database.id}`);
  }

  // The read and the apply both name lexema-app's real id through this file,
  // never web/wrangler.jsonc's local placeholder for the same name.
  const config = AppMigrationsConfig.write(database, steps.migrationsDir, steps.writeMigrationsConfig);
  const history = compareHistory(config.applied(wrangler), steps.migrations);
  if (history.state === "diverged") {
    throw new Error(
      `refusing to migrate ${database.name}: ${divergence(history)}, so its history has left the tree's;` +
        " production's app database is never deleted or reset, so a person decides how to bring it back",
    );
  }
  if (history.pending.length === 0) {
    log(`app database: ${database.name} (${database.id}) has run every app migration; nothing to apply`);
    return;
  }
  log(`app database: applying ${history.pending.length} new migration(s) to ${database.name} (${database.id}): ${history.pending.join(", ")}`);
  config.apply(wrangler);
}
