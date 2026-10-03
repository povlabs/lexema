// `pnpm run deploy:dictionary`: the dictionary deploy run and its plan-only
// entry, as `.github/workflows/dictionary-deploy.yml` runs them (#456). The
// run itself is src/deploy/dictionaryDeploy.ts; this file reads the
// environment the workflow gives it. docs/DEPLOY.md lists every secret and
// setting.
//
//   pnpm run deploy:dictionary
//   pnpm run deploy:dictionary --plan-only --change '{"command":"update:auto","inputs":{"feedRelease":"it-78385b62"}}'
//
// The run writes the shared dictionary and pushes `production`, so it runs
// only inside GitHub Actions on `main`, against the remote D1 `SEED_REMOTE`
// names: no agent and no laptop runs it (ADR 0018). The plan-only entry writes
// nothing and moves no branch; it reads the database the way the write
// commands do, the local D1 under `SEED_STATE` or the remote `SEED_REMOTE`.

import { appendFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { seedTargetFrom, webWrangler, type Wrangler } from "../import/seedTarget.js";
import { DeclarationRefused, parseChange } from "../update/declaration.js";
import { masterReaderOf } from "../update/updateCli.js";
import { type DataFetcher, lexemaDataFetcher } from "./dataFiles.js";
import { deployDictionary, deploySummary, planOnly } from "./dictionaryDeploy.js";
import { gitIn } from "./pending.js";

const USAGE = `usage:
  pnpm run deploy:dictionary
  pnpm run deploy:dictionary --plan-only --change '<{"command": ..., "inputs": {...}}>'
The run needs GITHUB_ACTIONS, GITHUB_REF refs/heads/main, GITHUB_SHA, SEED_REMOTE and LEXEMA_DATA_TOKEN.`;

/** A Time Travel bookmark of `dictionary` as it is now, through Wrangler. */
export function bookmarkOf(wrangler: Wrangler, dictionary: string): string {
  const answer = JSON.parse(wrangler(["d1", "time-travel", "info", dictionary, "--json"], true)) as { bookmark?: unknown };
  if (typeof answer.bookmark !== "string" || answer.bookmark === "") throw new Error(`wrangler d1 time-travel info ${dictionary} gave no bookmark`);
  return answer.bookmark;
}

/** The data repository's fetcher, or a fetcher that refuses when no token was given. */
function fetcherFrom(env: NodeJS.ProcessEnv): DataFetcher {
  const token = env.LEXEMA_DATA_TOKEN;
  if (token !== undefined && token !== "") return lexemaDataFetcher(token);
  return async (path) => {
    throw new Error(`LEXEMA_DATA_TOKEN is not set, so ${path} cannot be read from hueypov/lexema-data`);
  };
}

async function planOnlyCommand(args: readonly string[], env: NodeJS.ProcessEnv, wrangler: Wrangler): Promise<CommandResult> {
  const options = flags(args, ["change"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const text = options.get("change");
  if (text === undefined) return usageError("--plan-only needs --change, the command and inputs to plan", USAGE);
  let change;
  try {
    change = parseChange("--change", text);
  } catch (error: unknown) {
    if (error instanceof DeclarationRefused) return { out: error.message, status: 1 };
    throw error;
  }
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const answer = await planOnly(change, {
    reader: masterReaderOf(target),
    fetcher: fetcherFrom(env),
    workDir: await mkdtemp(join(env.RUNNER_TEMP ?? tmpdir(), "lexema-plan-")),
  });
  const out = JSON.stringify({ ...answer, planOnly: true });
  if (env.GITHUB_OUTPUT !== undefined) await appendFile(env.GITHUB_OUTPUT, `counts=${out}\n`);
  if (env.GITHUB_STEP_SUMMARY !== undefined) {
    await appendFile(env.GITHUB_STEP_SUMMARY, `## Dictionary plan-only run\n\nNothing was written.\n\n\`\`\`json\n${JSON.stringify(answer, null, 2)}\n\`\`\`\n`);
  }
  return { out, status: 0 };
}

async function deployCommand(env: NodeJS.ProcessEnv, wrangler: Wrangler): Promise<CommandResult> {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== "refs/heads/main") {
    return usageError("the deploy writes the shared dictionary and runs only in the dictionary deploy workflow on main", USAGE);
  }
  if (env.SEED_REMOTE === undefined) return usageError("SEED_REMOTE must name the shared dictionary D1", USAGE);
  if (env.GITHUB_SHA === undefined) return usageError("GITHUB_SHA must name the commit to deploy", USAGE);
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const outcome = await deployDictionary({
    git: gitIn(process.cwd()),
    head: env.GITHUB_SHA,
    target,
    reader: masterReaderOf(target),
    bookmark: () => bookmarkOf(wrangler, target.dictionary),
    fetcher: fetcherFrom(env),
    workDir: await mkdtemp(join(env.RUNNER_TEMP ?? tmpdir(), "lexema-deploy-")),
    onStep: (step, detail) => process.stderr.write(`${step}: ${detail}\n`),
  });
  const summary = deploySummary(outcome, target.dictionary);
  if (env.GITHUB_STEP_SUMMARY !== undefined) await appendFile(env.GITHUB_STEP_SUMMARY, summary);
  return { out: summary, status: outcome.kind === "red" ? 1 : 0 };
}

export async function main(args: readonly string[], env: NodeJS.ProcessEnv = process.env, wrangler: Wrangler = webWrangler): Promise<CommandResult> {
  const [first, ...rest] = args;
  if (first === "--plan-only") return planOnlyCommand(rest, env, wrangler);
  if (first !== undefined) return usageError(`unknown argument ${first}`, USAGE);
  return deployCommand(env, wrangler);
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
