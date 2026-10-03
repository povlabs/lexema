// Which change declarations a deploy run applies, and the branch it moves
// after (#456). Workers Builds deploys the site from `production`, and only a
// green dictionary deploy advances it (ADR 0018), so `production` is always
// the last commit whose dictionary changes are in place. A run on `head`
// applies the declarations added in `production..head`, oldest first, and
// then fast-forwards `production` to `head`.

import { execFileSync, spawnSync } from "node:child_process";
import { DECLARATIONS_DIR, parseDeclaration, type ChangeDeclaration } from "../update/declaration.js";

/** The branch Workers Builds deploys the site from. */
export const PRODUCTION_BRANCH = "production";

/** Git in the checkout the run stands in: `run` returns stdout and throws on a non-zero exit; `test` answers whether it exited 0. */
export interface Git {
  run(args: readonly string[]): string;
  test(args: readonly string[]): boolean;
}

/** The `git` command in the checkout at `cwd`. */
export function gitIn(cwd: string): Git {
  return {
    run: (args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }),
    test: (args) => spawnSync("git", args, { cwd, stdio: "ignore" }).status === 0,
  };
}

/** Why a run cannot tell what to apply: nothing was written. */
export class RangeRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RangeRefused";
  }
}

/** What a run on `head` finds: nothing left to do, or the declarations to apply before `production` moves. */
export type DeployRange =
  | { readonly kind: "deployed-already"; readonly production: string; readonly head: string }
  | { readonly kind: "pending"; readonly production: string; readonly head: string; readonly declarations: readonly ChangeDeclaration[] };

const REMOTE_PRODUCTION = `refs/remotes/origin/${PRODUCTION_BRANCH}`;

/**
 * Read `production` from the remote and the declarations `head` adds past it,
 * each parsed. Refuses when `production` is missing, or is not behind `head`
 * on one line, since then no range says what was deployed.
 */
export function deployRange(git: Git, head: string): DeployRange {
  try {
    git.run(["fetch", "--no-tags", "origin", `+refs/heads/${PRODUCTION_BRANCH}:${REMOTE_PRODUCTION}`]);
  } catch (error: unknown) {
    throw new RangeRefused(`could not fetch the ${PRODUCTION_BRANCH} branch; it must exist before a deploy runs (docs/DEPLOY.md): ${error instanceof Error ? error.message : String(error)}`);
  }
  const production = git.run(["rev-parse", "--verify", `${REMOTE_PRODUCTION}^{commit}`]).trim();
  const tip = git.run(["rev-parse", "--verify", `${head}^{commit}`]).trim();
  if (git.test(["merge-base", "--is-ancestor", tip, production])) return { kind: "deployed-already", production, head: tip };
  if (!git.test(["merge-base", "--is-ancestor", production, tip])) {
    throw new RangeRefused(`${PRODUCTION_BRANCH} (${production}) is not an ancestor of ${tip}, so it cannot be fast-forwarded to it`);
  }
  const added = git
    .run(["log", "--reverse", "--first-parent", "--diff-merges=first-parent", "--diff-filter=A", "--name-only", "--format=", `${production}..${tip}`, "--", DECLARATIONS_DIR])
    .split("\n")
    .filter((path) => path.startsWith(`${DECLARATIONS_DIR}/`) && path.endsWith(".json") && !path.slice(DECLARATIONS_DIR.length + 1).includes("/"));
  const paths = [...new Set(added)].filter((path) => git.test(["cat-file", "-e", `${tip}:${path}`]));
  const declarations = paths.map((path) => parseDeclaration(path, git.run(["show", `${tip}:${path}`])));
  return { kind: "pending", production, head: tip, declarations };
}

/** Fast-forward `production` on the remote to `head`; a push that is not a fast-forward is refused by the remote. */
export function advanceProduction(git: Git, head: string): void {
  git.run(["push", "origin", `${head}:refs/heads/${PRODUCTION_BRANCH}`]);
}
