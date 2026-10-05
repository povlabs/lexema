// Entry point of `pnpm run preview:prepare`, the first half of the Workers
// Builds preview command (docs/DEPLOY.md). The steps are previewCommand.ts's.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BUILT_CONFIG, preparePreview } from "./previewCommand.ts";
import { DICTIONARY } from "./previewConfig.ts";
import { readBuilt, readDeclared, type SlicePlanner } from "./previewSlice.ts";
import { APP_MIGRATIONS_DIR, appMigrationFiles, buildProduction, WEB_DIR, wrangler, writeMigrationsConfigFile } from "./wrangler.ts";

const log = (line: string) => process.stderr.write(`${line}\n`);

/**
 * The root's `pnpm run preview:slice` (src/deploy/sliceCli.ts), run from the
 * repository root with its output in the build log. Each answer is the JSON
 * file it writes.
 */
function previewSlice(...args: string[]): string {
  const answer = join(mkdtempSync(join(tmpdir(), "lexema-preview-slice-")), "answer.json");
  const ran = spawnSync("pnpm", ["run", "--silent", "preview:slice", ...args, "--answer", answer], { cwd: join(WEB_DIR, ".."), stdio: ["ignore", "inherit", "inherit"] });
  if (ran.status !== 0) throw new Error(`pnpm run preview:slice ${args[0]} failed (${ran.error?.message ?? `exit ${ran.status}`})`);
  return readFileSync(answer, "utf8");
}

const slices: SlicePlanner = {
  declared: () => readDeclared(previewSlice("declared")),
  build: () => readBuilt(previewSlice("build", "--dictionary", DICTIONARY.name, "--sql", join(mkdtempSync(join(tmpdir(), "lexema-preview-slice-")), "slice.sql"))),
};

try {
  preparePreview({
    branch: process.env.WORKERS_CI_BRANCH,
    wrangler,
    build: buildProduction,
    readBuiltConfig: () => JSON.parse(readFileSync(join(WEB_DIR, BUILT_CONFIG), "utf8")),
    writeFile: (path, content) => {
      const absolute = join(WEB_DIR, path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, content);
    },
    writeMigrationsConfig: writeMigrationsConfigFile,
    migrationsDir: APP_MIGRATIONS_DIR,
    migrations: appMigrationFiles(),
    // The same strength as the production one (docs/DEPLOY.md, Turn on sign-in).
    newSecret: () => randomBytes(32).toString("base64"),
    slices,
    log,
  });
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
