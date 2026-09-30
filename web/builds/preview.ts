// Entry point of `pnpm run preview:prepare`, the first half of the Workers
// Builds preview command (docs/DEPLOY.md). The steps are previewCommand.ts's.

import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILT_CONFIG, preparePreview } from "./previewCommand.ts";
import { buildProduction, WEB_DIR, wrangler } from "./wrangler.ts";

const log = (line: string) => process.stderr.write(`${line}\n`);

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
