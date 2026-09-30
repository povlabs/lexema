// `pnpm run normalize:glosses`: the one-off update of an already seeded
// dictionary (normalizeGlosses.ts). It picks its database the way the seed
// does: the local D1 under `SEED_STATE` (default `.data/seed-state`), or the
// remote D1 `SEED_REMOTE` names. See docs/RUN_AN_IMPORT.md.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { type DictionarySql, normalizeStoredGlosses } from "./normalizeGlosses.js";
import { seedTargetFrom, type Wrangler } from "./seedTarget.js";

// `wrangler` from web/, where its config lives. CI=1 keeps it from prompting.
const wrangler: Wrangler = (args, capture) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: resolve("web"),
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    env: { ...process.env, CI: "1" },
    encoding: "utf8",
  }) ?? "";
const target = seedTargetFrom(process.env, wrangler, resolve(".data/seed-state"));

const dictionary: DictionarySql = {
  query<Row>(sql: string): Row[] {
    const answers = JSON.parse(target.execute(["--json", "--command", sql], true)) as { results: Row[] }[];
    return answers.at(-1)?.results ?? [];
  },
  run(sql: string): void {
    target.execute(["--json", "--command", sql], true);
  },
};

const where = process.env.SEED_REMOTE === undefined
  ? `local D1 ${target.dictionary} in ${resolve(process.env.SEED_STATE ?? ".data/seed-state")}`
  : `remote D1 ${target.dictionary}`;
process.stderr.write(`normalizing glosses in ${where}\n`);
const report = normalizeStoredGlosses(dictionary);
process.stderr.write(`sense_gloss: ${report.changed} row(s) changed, ${report.candidates} candidate(s) read\n`);
process.stdout.write(JSON.stringify({ database: where, ...report }) + "\n");
