// Entry point of `pnpm run deploy:workers-builds`, the Workers Builds deploy
// command on the `production` branch (docs/DEPLOY.md). The steps are
// productionCommand.ts's.

import { spawnSync } from "node:child_process";
import { migrateProductionAppDatabase, PRODUCTION_APP_DATABASE } from "./productionAppDatabase.ts";
import { runProductionCommand } from "./productionCommand.ts";
import { sweep } from "./sweep.ts";
import { APP_MIGRATIONS_DIR, appMigrationFiles, WEB_DIR, wrangler, writeMigrationsConfigFile } from "./wrangler.ts";

const log = (line: string) => process.stderr.write(`${line}\n`);

try {
  await runProductionCommand({
    sweep: () => sweep({ wrangler, token: process.env.GITHUB_PR_READ_TOKEN, fetchPage: fetch, log }),
    migrate: () =>
      migrateProductionAppDatabase(PRODUCTION_APP_DATABASE, {
        wrangler,
        migrationsDir: APP_MIGRATIONS_DIR,
        migrations: appMigrationFiles(),
        writeMigrationsConfig: writeMigrationsConfigFile,
        log,
      }),
    // The same script as a deploy by hand (docs/DEPLOY.md, Deploy by hand).
    deploy: () => {
      const deployed = spawnSync("pnpm", ["run", "deploy:production"], { cwd: WEB_DIR, stdio: "inherit" });
      if (deployed.status !== 0) throw new Error("pnpm run deploy:production failed");
    },
    log,
  });
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
