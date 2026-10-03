// `pnpm run deploy:dictionary`: the dictionary deploy run and its plan-only
// entry, as `.github/workflows/dictionary-deploy.yml` runs them (#456). The
// run itself is src/deploy/dictionaryDeploy.ts; this file reads the
// environment the workflow gives it. docs/DEPLOY.md lists every secret and
// setting.
//
//   pnpm run deploy:dictionary
//   pnpm run deploy:dictionary --plan-only --change '{"command":"update:auto","inputs":{"feedRelease":"it-78385b62"}}'
//   pnpm run deploy:dictionary --plan-only --change '<change>' --release '<release candidate>'
//   pnpm run deploy:dictionary --plan-only --added-since <base commit>
//
// `--added-since` is the pull request plan check (#494,
// `.github/workflows/dictionary-plan.yml`): it plans the declarations the
// checked-out commit adds past the base and holds them to `expected`
// (pullRequestPlan.ts). It writes nothing, like every plan-only run.
//
// `--release` plans against a kaikki release the repository does not record
// yet: the monthly release workflow passes the archive facts and dump it found
// (src/release/releaseCandidate.ts), so the plan reads them as data and the
// files fetched are still held to them. An empty value is no release.
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
import { ReleaseCandidate, ReleaseRefused } from "../release/releaseCandidate.js";
import { DeclarationRefused, parseChange } from "../update/declaration.js";
import { masterReaderOf } from "../update/updateCli.js";
import { type DataFetcher, lexemaDataFetcher } from "./dataFiles.js";
import { type DeployDeps, deployDictionary, deploySummary, planOnly, restoreCommand } from "./dictionaryDeploy.js";
import { type Git, gitIn } from "./pending.js";
import { addedDeclarations, planPullRequest, pullRequestPlanReport } from "./pullRequestPlan.js";

const USAGE = `usage:
  pnpm run deploy:dictionary
  pnpm run deploy:dictionary --plan-only --change '<{"command": ..., "inputs": {...}}>' [--release '<release candidate>']
  pnpm run deploy:dictionary --plan-only --added-since <base commit>
The run needs GITHUB_ACTIONS, GITHUB_REF refs/heads/main, GITHUB_SHA and SEED_REMOTE. povlabs/lexema-data is public and is read without a token.`;

/** A Time Travel bookmark of `dictionary` as it is now, through Wrangler. */
export function bookmarkOf(wrangler: Wrangler, dictionary: string): string {
  const answer = JSON.parse(wrangler(["d1", "time-travel", "info", dictionary, "--json"], true)) as { bookmark?: unknown };
  if (typeof answer.bookmark !== "string" || answer.bookmark === "") throw new Error(`wrangler d1 time-travel info ${dictionary} gave no bookmark`);
  return answer.bookmark;
}

/**
 * What the run writes to its log: each step as it starts, and the bookmark
 * with its restore command the moment it is taken, before the first write. A
 * job killed mid-apply writes no summary, so the log is where its restore
 * point survives.
 */
export function deployLog(write: (line: string) => void, dictionary: string): Pick<DeployDeps, "onStep" | "onBookmark"> {
  return {
    onStep: (step, detail) => write(`${step}: ${detail}\n`),
    onBookmark: (bookmark) => write(`bookmark: ${bookmark} (restore with: ${restoreCommand(dictionary, bookmark)})\n`),
  };
}


/**
 * `--plan-only --added-since <base>`: the pull request plan check (#494).
 * Plans the declaration the checked-out commit adds past `base` and holds it
 * to `expected` (pullRequestPlan.ts). Red when a count differs, `expected` is
 * missing, a hard limit is crossed, or a later declaration cannot be counted.
 */
async function pullRequestPlanCommand(base: string, env: NodeJS.ProcessEnv, wrangler: Wrangler, git: Git): Promise<CommandResult> {
  let declarations;
  try {
    declarations = addedDeclarations(git, base, "HEAD");
  } catch (error: unknown) {
    if (error instanceof DeclarationRefused) return { out: error.message, status: 1 };
    throw error;
  }
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const fetcher = lexemaDataFetcher();
  const outcomes = await planPullRequest(declarations, {
    plan: async (change) => planOnly(change, { reader, fetcher, workDir: await mkdtemp(join(env.RUNNER_TEMP ?? tmpdir(), "lexema-plan-")) }),
  });
  const { markdown, green } = pullRequestPlanReport(outcomes, target.dictionary);
  if (env.GITHUB_STEP_SUMMARY !== undefined) await appendFile(env.GITHUB_STEP_SUMMARY, markdown);
  return { out: markdown, status: green ? 0 : 1 };
}

async function planOnlyCommand(args: readonly string[], env: NodeJS.ProcessEnv, wrangler: Wrangler, git: Git): Promise<CommandResult> {
  const options = flags(args, ["change", "release", "added-since"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const base = options.get("added-since");
  if (base !== undefined) {
    if (options.has("change") || options.has("release")) return usageError("--added-since plans what the commit adds, so it takes no --change or --release", USAGE);
    return pullRequestPlanCommand(base, env, wrangler, git);
  }
  const text = options.get("change");
  if (text === undefined) return usageError("--plan-only needs --change, the command and inputs to plan", USAGE);
  const release = options.get("release") ?? "";
  let change;
  let catalogs;
  try {
    change = parseChange("--change", text);
    catalogs = release === "" ? {} : ReleaseCandidate.parse(release).catalogs();
  } catch (error: unknown) {
    if (error instanceof DeclarationRefused) return { out: error.message, status: 1 };
    if (error instanceof ReleaseRefused) return { out: `--release is not a release to plan against:\n${error.message}`, status: 1 };
    throw error;
  }
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const answer = await planOnly(change, {
    ...catalogs,
    reader: masterReaderOf(target),
    fetcher: lexemaDataFetcher(),
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
    fetcher: lexemaDataFetcher(),
    workDir: await mkdtemp(join(env.RUNNER_TEMP ?? tmpdir(), "lexema-deploy-")),
    ...deployLog((line) => process.stderr.write(line), target.dictionary),
  });
  const summary = deploySummary(outcome, target.dictionary);
  if (env.GITHUB_STEP_SUMMARY !== undefined) await appendFile(env.GITHUB_STEP_SUMMARY, summary);
  return { out: summary, status: outcome.kind === "red" ? 1 : 0 };
}

export async function main(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  wrangler: Wrangler = webWrangler,
  git: Git = gitIn(process.cwd()),
): Promise<CommandResult> {
  const [first, ...rest] = args;
  if (first === "--plan-only") return planOnlyCommand(rest, env, wrangler, git);
  if (first !== undefined) return usageError(`unknown argument ${first}`, USAGE);
  return deployCommand(env, wrangler);
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
