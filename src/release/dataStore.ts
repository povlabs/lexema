// Storing a new release's files in `povlabs/lexema-data` (#457), the one write
// the monthly release workflow makes there. It pushes one commit with Git,
// which takes a file of any size up to GitHub's 100 MB limit, where the
// contents API would carry a dump base64-encoded. The clone is shallow and
// holds no file contents, so the run never downloads what the repository
// already keeps.
//
// A file already there with the same bytes is left alone, so a re-run after a
// failure stores only what is missing. A file already there with other bytes
// is refused: a release's files never change once stored.

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type Git, gitIn } from "../deploy/pending.js";

/** The data repository the monthly job writes, over HTTPS. */
export const DATA_REPOSITORY_URL = "https://github.com/povlabs/lexema-data.git";

/** Who the release commits are made as. */
export const RELEASE_COMMITTER = ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "-c", "commit.gpgsign=false"] as const;

/** One file to keep: its path in the data repository, and where it is on disk. */
export interface StoredFile {
  readonly path: string;
  readonly from: string;
}

/** Why a file cannot be stored: nothing was pushed. */
export class StoreRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreRefused";
  }
}

/** What a store did: pushed one commit, or found every file already there. */
export type StoreOutcome =
  | { readonly kind: "stored"; readonly commit: string; readonly paths: readonly string[] }
  | { readonly kind: "stored-already"; readonly commit: string };

/**
 * The Git environment that authenticates to github.com with `token`, sent as a
 * header so it is never written into a URL or a remote's config.
 */
export function tokenEnvironment(token: string): NodeJS.ProcessEnv {
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
    GIT_TERMINAL_PROMPT: "0",
  };
}

/**
 * Push `files` to the default branch of the repository at `remote` as one
 * commit with `message`, cloning it into `dir`. `env` carries the credential.
 */
export async function storeFiles(remote: string, dir: string, files: readonly StoredFile[], message: string, env: NodeJS.ProcessEnv = {}): Promise<StoreOutcome> {
  await mkdir(dirname(dir), { recursive: true });
  gitIn(dirname(dir), env).run(["clone", "--quiet", "--depth", "1", "--filter=blob:none", "--no-checkout", remote, dir]);
  const git: Git = gitIn(dir, env);
  const branch = git.run(["symbolic-ref", "--short", "HEAD"]).trim();
  // The index from HEAD's tree, which needs no file contents.
  git.run(["reset", "--quiet"]);
  const added: string[] = [];
  for (const file of files) {
    const held = /^\d+ blob ([0-9a-f]+)\t/.exec(git.run(["ls-tree", "HEAD", "--", file.path]))?.[1];
    const local = git.run(["hash-object", "--", file.from]).trim();
    if (held === local) continue;
    if (held !== undefined) throw new StoreRefused(`${file.path} is already in ${remote} with other bytes; a release's files never change once stored`);
    await mkdir(dirname(join(dir, file.path)), { recursive: true });
    await copyFile(file.from, join(dir, file.path));
    git.run(["add", "--", file.path]);
    added.push(file.path);
  }
  if (added.length === 0) return { kind: "stored-already", commit: git.run(["rev-parse", "HEAD"]).trim() };
  git.run([...RELEASE_COMMITTER, "commit", "--quiet", "-m", message]);
  git.run(["push", "--quiet", "origin", `HEAD:refs/heads/${branch}`]);
  return { kind: "stored", commit: git.run(["rev-parse", "HEAD"]).trim(), paths: added };
}
