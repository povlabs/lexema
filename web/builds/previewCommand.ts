// The Workers Builds preview command (ADR 0018, docs/DEPLOY.md): what runs on
// every push to a branch that is not `main`. It builds, gives the branch its
// own app database, migrates it, and only then runs `wrangler preview`, which
// Workers Builds requires a custom preview command to run
// (https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

import { type AppDatabase, type BuiltConfig, migrationsConfig, withAppDatabase } from "./previewConfig.ts";
import { PreviewName } from "./previewName.ts";
import { listDatabases, required, type Wrangler } from "./wrangler.ts";

/** The built config `wrangler preview` reads, relative to web/. */
export const BUILT_CONFIG = "dist/server/wrangler.json";
/** The secret better-auth signs the session cookie with (web/worker/signIn.ts). */
const AUTH_SECRET = "BETTER_AUTH_SECRET";

export interface PreviewCommandSteps {
  /** `WORKERS_CI_BRANCH`: the pushed branch. */
  readonly branch: string | undefined;
  readonly wrangler: Wrangler;
  /** The production build, which writes the built config. */
  build(): void;
  readBuiltConfig(): BuiltConfig;
  writeBuiltConfig(config: BuiltConfig): void;
  /** Write the app database's migrations config and return its path. */
  writeMigrationsConfig(config: Record<string, unknown>): string;
  /** The app migrations directory, absolute. */
  readonly migrationsDir: string;
  /** A fresh random secret. */
  newSecret(): string;
  log(line: string): void;
}

/**
 * This branch's app database: the one already on the account, so every push
 * to a branch reuses it, or a new one. A create that loses a race with a
 * concurrent build of the same branch still finds the winner's database.
 */
export function findOrCreateAppDatabase(wrangler: Wrangler, preview: PreviewName, log: (line: string) => void): AppDatabase {
  const find = () => listDatabases(wrangler).find(({ name }) => name === preview.appDatabase)?.uuid;
  const existing = find();
  if (existing !== undefined) {
    log(`app database: reusing ${preview.appDatabase} (${existing})`);
    return { preview, id: existing };
  }
  wrangler(["d1", "create", preview.appDatabase, "--update-config=false"]);
  const created = find();
  if (created === undefined) throw new Error(`could not create the app database ${preview.appDatabase}`);
  log(`app database: created ${preview.appDatabase} (${created})`);
  return { preview, id: created };
}

/** Run the preview command for one branch; returns the Preview's name. */
export function runPreviewCommand(steps: PreviewCommandSteps): PreviewName {
  const { wrangler, log } = steps;
  if (steps.branch === undefined) throw new Error("WORKERS_CI_BRANCH is not set; the preview command runs in Workers Builds");
  const preview = PreviewName.ofBranch(steps.branch);
  log(`Preview ${preview} for branch ${steps.branch}`);

  steps.build();
  const database = findOrCreateAppDatabase(wrangler, preview, log);
  steps.writeBuiltConfig(withAppDatabase(steps.readBuiltConfig(), database));

  // Migrations before the Preview, so no deployment ever runs on a database
  // older than its code ("Resources and isolation", D1 migrations).
  const migrations = steps.writeMigrationsConfig(migrationsConfig(database, steps.migrationsDir));
  required(wrangler(["d1", "migrations", "apply", preview.appDatabase, "--remote", "--config", migrations]), "wrangler d1 migrations apply");

  required(wrangler(["preview", "--name", preview.value, "--config", BUILT_CONFIG]), "wrangler preview");

  // A Preview secret is set on its latest deployment, so only once one exists
  // (`preview secret put` refuses a Preview with none, Wrangler 4.135.0). It is
  // set when the Preview lacks it, which is on its first deployment.
  const listed = required(
    wrangler(["preview", "secret", "list", "--name", preview.value, "--json", "--config", BUILT_CONFIG]),
    "wrangler preview secret list",
  );
  const secrets = JSON.parse(listed.stdout) as { name: string }[];
  if (!secrets.some(({ name }) => name === AUTH_SECRET)) {
    required(
      wrangler(["preview", "secret", "put", AUTH_SECRET, "--name", preview.value, "--config", BUILT_CONFIG], steps.newSecret()),
      "wrangler preview secret put",
    );
    log(`${AUTH_SECRET}: set a new random one on Preview ${preview}`);
  }
  return preview;
}
