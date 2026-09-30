// Entry point of `pnpm run deploy:workers-builds`, the Workers Builds deploy
// command on `main` (docs/DEPLOY.md). The steps are productionCommand.ts's.

import { spawnSync } from "node:child_process";
import { runProductionCommand } from "./productionCommand.ts";
import { sweep } from "./sweep.ts";
import { WEB_DIR, wrangler } from "./wrangler.ts";

const log = (line: string) => process.stderr.write(`${line}\n`);

try {
  await runProductionCommand({
    sweep: () => sweep({ wrangler, token: process.env.GITHUB_PR_READ_TOKEN, fetchPage: fetch, log }),
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
