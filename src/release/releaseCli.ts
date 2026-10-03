// `pnpm run release:monthly`: the two steps of the monthly release workflow,
// as `.github/workflows/dictionary-release.yml` runs them (#457). The steps
// are src/release/monthlyRelease.ts; this file reads the environment the
// workflow gives them. docs/DEPLOY.md lists the secret and the schedule.
//
//   pnpm run release:monthly prepare
//   pnpm run release:monthly open --release '<release candidate>' --plan '<plan-only answer>'
//
// Both write to GitHub, `prepare` to `povlabs/lexema-data` with its write
// token, so they run only inside GitHub Actions on `main`: no agent and no
// laptop runs them.

import { appendFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CommandResult, finish, flags, isMain, usageError } from "../commandLine.js";
import { gitIn } from "../deploy/pending.js";
import { DeclarationRefused } from "../update/declaration.js";
import { DATA_REPOSITORY_URL, storeFiles, StoreRefused, tokenEnvironment } from "./dataStore.js";
import { openReleasePullRequest, prepareRelease, pullRequestFrom, releaseChange } from "./monthlyRelease.js";
import { ReleaseCandidate, ReleaseRefused } from "./releaseCandidate.js";

const USAGE = `usage:
  pnpm run release:monthly prepare
  pnpm run release:monthly open --release '<release candidate>' --plan '<plan-only answer>'
Both run only in the monthly release workflow on main. Both need GITHUB_TOKEN and GITHUB_REPOSITORY; prepare also needs LEXEMA_DATA_WRITE_TOKEN.`;

/** A refusal the steps name, as the command's answer; anything else is a fault and throws. */
function refusal(error: unknown): CommandResult {
  if (error instanceof ReleaseRefused || error instanceof StoreRefused || error instanceof DeclarationRefused) return { out: error.message, status: 1 };
  throw error;
}

async function output(env: NodeJS.ProcessEnv, values: Record<string, string>): Promise<void> {
  if (env.GITHUB_OUTPUT === undefined) return;
  await appendFile(env.GITHUB_OUTPUT, Object.entries(values).map(([name, value]) => `${name}=${value}\n`).join(""));
}

async function summary(env: NodeJS.ProcessEnv, text: string): Promise<void> {
  if (env.GITHUB_STEP_SUMMARY !== undefined) await appendFile(env.GITHUB_STEP_SUMMARY, text);
}

async function prepareCommand(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<CommandResult> {
  const token = env.LEXEMA_DATA_WRITE_TOKEN;
  if (token === undefined || token === "") return usageError("LEXEMA_DATA_WRITE_TOKEN is not set, so nothing can be stored in povlabs/lexema-data", USAGE);
  const { GITHUB_TOKEN: githubToken, GITHUB_REPOSITORY: repository } = env;
  if (githubToken === undefined || githubToken === "" || repository === undefined) return usageError("prepare needs GITHUB_TOKEN and GITHUB_REPOSITORY", USAGE);
  const workDir = await mkdtemp(join(env.RUNNER_TEMP ?? tmpdir(), "lexema-release-"));
  let outcome;
  try {
    outcome = await prepareRelease({
      fetch: fetchImpl,
      git: gitIn(process.cwd()),
      root: process.cwd(),
      workDir: join(workDir, "downloads"),
      store: (files, message) => storeFiles(DATA_REPOSITORY_URL, join(workDir, "lexema-data"), files, message, tokenEnvironment(token)),
      pullRequestFrom: (branch) => pullRequestFrom(fetchImpl, repository, githubToken, branch),
      onStep: (line) => process.stderr.write(`${line}\n`),
    });
  } catch (error: unknown) {
    return refusal(error);
  }
  if (outcome.kind === "none") {
    await output(env, { release: "" });
    await summary(env, `## Monthly release: nothing new\n\n${outcome.reason}. Nothing was stored and no pull request is opened.\n`);
    return { out: outcome.reason, status: 0 };
  }
  const { candidate, branch, commit, stored } = outcome;
  await output(env, {
    release: candidate.releaseId,
    candidate: JSON.stringify(candidate),
    change: JSON.stringify(releaseChange(candidate)),
    commit,
  });
  const line = `${candidate.releaseId} from ${candidate.dumpId}: ${stored.kind === "stored" ? `stored ${stored.paths.join(", ")}` : "its files were stored already"} in povlabs/lexema-data, and its facts are on ${branch} at ${commit}`;
  await summary(env, `## Monthly release: ${candidate.releaseId}\n\n${line}. The plan-only run and the pull request follow.\n`);
  return { out: line, status: 0 };
}

async function openCommand(args: readonly string[], env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<CommandResult> {
  const options = flags(args, ["release", "plan"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const release = options.get("release");
  const plan = options.get("plan");
  if (release === undefined || plan === undefined) return usageError("open needs --release and --plan", USAGE);
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository } = env;
  if (token === undefined || token === "" || repository === undefined) return usageError("open needs GITHUB_TOKEN and GITHUB_REPOSITORY", USAGE);
  let url;
  try {
    url = await openReleasePullRequest(ReleaseCandidate.parse(release), plan, { fetch: fetchImpl, git: gitIn(process.cwd()), root: process.cwd(), repository, token });
  } catch (error: unknown) {
    return refusal(error);
  }
  await output(env, { "pull-request": url });
  await summary(env, `## Monthly release: pull request\n\nOpened ${url}.\n`);
  return { out: url, status: 0 };
}

export async function main(args: readonly string[], env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<CommandResult> {
  const [verb, ...rest] = args;
  if (verb !== "prepare" && verb !== "open") return usageError(verb === undefined ? "name a step: prepare or open" : `unknown step ${verb}`, USAGE);
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== "refs/heads/main") {
    return usageError("the monthly release writes to GitHub and runs only in the monthly release workflow on main", USAGE);
  }
  if (verb === "prepare") return rest.length === 0 ? prepareCommand(env, fetchImpl) : usageError(`unknown argument ${rest[0]}`, USAGE);
  return openCommand(rest, env, fetchImpl);
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
