// The post-checkout script (#346, ADR 0022): a new linked worktree gets the
// source-file link and one `pnpm install --frozen-lockfile`; a branch switch
// gets nothing. A throwaway repository stands in for the main checkout, and a
// fake `pnpm` on PATH records what it was asked to do.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, readFile, readlink, realpath, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const SCRIPT = resolve("tools/set-up-worktree.sh");

const git = (cwd: string, env: NodeJS.ProcessEnv, ...args: string[]): string =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, env, encoding: "utf8" });

test("a new worktree is linked and installed; a branch switch does nothing", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "lexema-worktree-")));
  try {
    const main = join(root, "main");
    const bin = join(root, "bin");
    const hooks = join(root, "hooks");
    const log = join(root, "pnpm.log");
    await mkdir(main);
    await mkdir(bin);
    await mkdir(hooks);

    await writeFile(join(bin, "pnpm"), `#!/bin/sh\necho "$PWD $*" >> "${log}"\n`);
    await chmod(join(bin, "pnpm"), 0o755);
    await writeFile(join(hooks, "post-checkout"), `#!/bin/sh\nexec sh "${SCRIPT}" "$1"\n`);
    await chmod(join(hooks, "post-checkout"), 0o755);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

    git(root, env, "init", "--quiet", "--initial-branch=main", main);
    await writeFile(join(main, "README.md"), "x\n");
    git(main, env, "add", "README.md");
    git(main, env, "commit", "--quiet", "-m", "init");
    git(main, env, "config", "core.hooksPath", hooks);
    await writeFile(join(main, "it-extract.jsonl.gz"), "source\n");

    const tree = join(root, "tree");
    git(main, env, "worktree", "add", "--quiet", "-b", "lane", tree);

    assert.equal(await readlink(join(tree, "it-extract.jsonl.gz")), join(main, "it-extract.jsonl.gz"));
    assert.equal(await readFile(log, "utf8"), `${tree} install --frozen-lockfile\n`);

    git(tree, env, "checkout", "--quiet", "-b", "other");
    git(tree, env, "checkout", "--quiet", "lane");
    assert.equal(await readFile(log, "utf8"), `${tree} install --frozen-lockfile\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
