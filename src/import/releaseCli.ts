// `pnpm run release [list | retire | restore | abandon | discard] <release-id>`:
// the moves a person makes on a dictionary's releases once their seed has
// ended (releaseLifecycle.ts). It picks its database the way the seed does:
// the local D1 under `SEED_STATE` (default `.data/seed-state`), or the remote
// D1 `SEED_REMOTE` names. The procedure is docs/UPDATE_A_RELEASE.md.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isReleaseMove, ReleaseMoveRefused, RELEASE_MOVES, servedReleases } from "./releaseLifecycle.js";
import { Releases } from "./releases.js";
import { dictionarySql, seedTargetFrom, type Wrangler } from "./seedTarget.js";

const USAGE = `usage: pnpm run release list | pnpm run release <${RELEASE_MOVES.join(" | ")}> <release-id>`;

// `wrangler` from web/, where its config lives. CI=1 keeps it from prompting.
const wrangler: Wrangler = (args, capture) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: resolve("web"),
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    env: { ...process.env, CI: "1" },
    encoding: "utf8",
  }) ?? "";

const [verb, releaseId, ...extra] = process.argv.slice(2);
if (verb === undefined || extra.length > 0 || (verb === "list") !== (releaseId === undefined) || (verb !== "list" && !isReleaseMove(verb))) {
  process.stderr.write(`${USAGE}\n`);
  process.exit(2);
}

const target = seedTargetFrom({ SEED_REMOTE: process.env.SEED_REMOTE, SEED_STATE: process.env.SEED_STATE }, wrangler, resolve(".data/seed-state"));
const where = process.env.SEED_REMOTE === undefined
  ? `local D1 ${target.dictionary} in ${resolve(process.env.SEED_STATE ?? ".data/seed-state")}`
  : `remote D1 ${target.dictionary}`;
const releases = new Releases(dictionarySql(target), servedReleases(readFileSync(resolve("web/wrangler.jsonc"), "utf8")));

const served = (id: string): string => (releases.served.has(id) ? "  served by web/wrangler.jsonc" : "");
try {
  if (verb === "list") {
    for (const { releaseId: id, status } of releases.list()) process.stdout.write(`${id}\t${status}${served(id)}\n`);
  } else if (isReleaseMove(verb)) {
    process.stderr.write(`${verb} ${releaseId} in ${where}\n`);
    const now = releases.apply(releaseId, verb);
    process.stdout.write(now === "gone" ? `${releaseId}\tdiscarded\n` : `${now.releaseId}\t${now.status}${served(now.releaseId)}\n`);
  }
} catch (error: unknown) {
  if (!(error instanceof ReleaseMoveRefused)) throw error;
  process.stderr.write(`refused: ${error.message}; nothing was written\n`);
  process.exit(1);
}
