// `pnpm run seed:state <directory>`: put a seeded local development state at
// `<directory>`, which must not exist yet, for `wrangler dev --persist-to`
// (#843). The state is a copy of one kept for the seed's inputs
// (src/import/seededStates.ts); when none is kept, `pnpm run seed:dev` seeds
// one first. The kept states live in the main checkout's `.data/seeded-states/`,
// so every linked worktree reuses them, unless `SEED_STATES` names another
// directory.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { finish, isMain, usageError, type CommandResult } from "../commandLine.js";
import { type Seeder, SeededStates, SeedInputs } from "./seededStates.js";

const USAGE = "usage: pnpm run seed:state <directory>";

/** `.data/seeded-states/` of the main checkout this checkout belongs to. */
function mainCheckoutStates(): string {
  const run = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git rev-parse --git-common-dir failed: ${run.stderr.trim()}`);
  return join(dirname(run.stdout.trim()), ".data", "seeded-states");
}

/** `pnpm run seed:dev` into `state`, its SQL under `scratch`, its report on stderr. */
const seedDev: Seeder = (state, scratch) =>
  new Promise((done, failed) => {
    const child = spawn("pnpm", ["run", "seed:dev"], {
      stdio: ["ignore", process.stderr, process.stderr],
      env: { ...process.env, SEED_SQL: join(scratch, "dev-sql"), SEED_STATE: state },
    });
    child.on("error", failed);
    child.on("exit", (code, signal) =>
      code === 0 ? done() : failed(new Error(`pnpm run seed:dev failed (${code === null ? `signal ${signal}` : `exit ${code}`})`)),
    );
  });

export async function main(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  seed: Seeder = seedDev,
): Promise<CommandResult> {
  if (args.length !== 1) return usageError("name one directory", USAGE);
  const destination = resolve(args[0]);
  if (existsSync(destination)) return usageError(`${destination} already exists`, USAGE);
  const states = new SeededStates(env.SEED_STATES === undefined ? mainCheckoutStates() : resolve(env.SEED_STATES));
  const inputs = await SeedInputs.of(process.cwd(), env);
  const origin = await states.copyTo(inputs, destination, seed);
  return {
    out: `${origin === "reused" ? "reused the state seeded" : "seeded a state"} for inputs ${inputs.digest.slice(0, 12)}; copied to ${destination}`,
    status: 0,
  };
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
