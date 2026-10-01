---
id: 0022
title: lefthook runs the git hooks, and a new worktree sets itself up
status: accepted
date: 2026-10-01
tags: [tooling, agents, git-hooks]
---

# 0022 — lefthook runs the git hooks, and a new worktree sets itself up

**What this decides:** lefthook manages this repository's git hooks. Its `post-checkout` hook prepares every new linked worktree: it links the source file from the main checkout and installs dependencies. Claude Code's `WorktreeCreate` hook calls `fabrika hook worktree-create`. Fabrika's `plugin-sync` hook is not used.

## Context

Agents work in their own git worktrees. A new worktree has no `node_modules` and no `it-extract.jsonl.gz`, because both are ignored by Git. Until now an agent had to install and link by hand, or ran checks that could not pass.

Fabrika's own repository solved this with lefthook. [kamp-us/phoenix ADR 0068](https://github.com/kamp-us/phoenix/blob/main/.decisions/0068-adopt-lefthook-at-second-git-hook.md) chose lefthook over husky and over hand-written `.githooks` scripts: one binary, one declarative `lefthook.yml`, and an install step that is safe to repeat. Its `lefthook.yml` has a `post-checkout` command that installs dependencies in a new worktree, and its `.claude/settings.json` sets `WorktreeCreate` to `fabrika hook worktree-create` with a 600-second timeout.

`fabrika hook worktree-create` (fabrika-cli 0.8.0, `dist/hook/worktree-create.js`) adds the worktree with hooks off, then runs the repo's own `post-checkout` hook with the all-zero object id as the previous HEAD. It refuses the spawn if `node_modules/.pnpm` is missing afterwards. So the repo's `post-checkout` is the one place that installs dependencies, whether a person runs `git worktree add` or the harness spawns an agent.

Huey asked for this on [#346](https://github.com/hueypov/lexema/issues/346), split out of [#344](https://github.com/hueypov/lexema/issues/344).

## Decision

**lefthook manages git hooks, installed by `pnpm install`, and its `post-checkout` sets up a new linked worktree.**

- `lefthook` is a root dev dependency, its version in the pnpm catalog ([0002](0002-pnpm-is-the-package-manager.md)).
- The root `prepare` script, [tools/install-git-hooks.sh](../tools/install-git-hooks.sh), runs `lefthook install` in the main checkout only. It does nothing in CI, outside a Git checkout, or in a linked worktree, which shares the main checkout's hooks.
- [lefthook.yml](../lefthook.yml) runs [tools/set-up-worktree.sh](../tools/set-up-worktree.sh) on `post-checkout`. It acts only when the previous HEAD is the all-zero id and the tree is a linked worktree. Then it symlinks `it-extract.jsonl.gz` from the main checkout, found through `git rev-parse --git-common-dir`, and runs `pnpm install --frozen-lockfile`. A branch switch does nothing.
- `.claude/settings.json` gets a `WorktreeCreate` hook running `fabrika hook worktree-create`, timeout 600, as phoenix has it. Huey adds that entry; agents cannot write the file.

**`plugin-sync` is not used.** Phoenix also runs `fabrika hook plugin-sync` at `SessionStart`. It fast-forwards the main checkout to `origin/main` so a plugin served from that checkout stays current. Lexema serves no plugin from its own checkout, so the hook would buy nothing. It would also move Huey's main checkout at every session start, and AGENTS.md says the branch is left where it was found.

## Consequences

- A `git worktree add`, by hand or through the harness, gives a tree with dependencies and the source file, with no step to remember.
- The hooks live in the main checkout's `.git/hooks`. A checkout that has not run `pnpm install` since this landed has none until it does.
- Each new worktree costs one `pnpm install`, a few seconds from the shared store.
- A second hook is now a `lefthook.yml` entry, not a new script and install step.
