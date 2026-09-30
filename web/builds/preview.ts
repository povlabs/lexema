// Entry point of `pnpm run preview:workers-builds`, the Workers Builds preview
// command (docs/DEPLOY.md). The steps are previewCommand.ts's.

import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILT_CONFIG, runPreviewCommand } from "./previewCommand.ts";
import { buildProduction, WEB_DIR, wrangler } from "./wrangler.ts";

const log = (line: string) => process.stderr.write(`${line}\n`);
const builtConfig = join(WEB_DIR, BUILT_CONFIG);

try {
  runPreviewCommand({
    branch: process.env.WORKERS_CI_BRANCH,
    wrangler,
    build: buildProduction,
    readBuiltConfig: () => JSON.parse(readFileSync(builtConfig, "utf8")),
    writeBuiltConfig: (config) => writeFileSync(builtConfig, `${JSON.stringify(config, null, 2)}\n`),
    writeMigrationsConfig: (config) => {
      const path = join(mkdtempSync(join(tmpdir(), "lexema-preview-app-")), "wrangler.json");
      writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
      return path;
    },
    migrationsDir: fileURLToPath(new URL("../../src/db/app/migrations", import.meta.url)),
    // The same strength as the production one (docs/DEPLOY.md, Turn on sign-in).
    newSecret: () => randomBytes(32).toString("base64"),
    log,
  });
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
