# Worktree agent constraints

What an agent lane can rely on in its own linked worktree, and what it must not do
there; applies to every agent that works in a tree made by `git worktree add` or the
harness's `WorktreeCreate` hook.

Adapted from phoenix's [worktree-agent-constraints](https://github.com/kamp-us/phoenix/blob/main/.patterns/worktree-agent-constraints.md).

## The shape

A lane works in its own linked worktree, one writer per tree, and leaves the main
checkout's branch where it found it ([AGENTS.md](../AGENTS.md),
[ADR 0022](../.decisions/0022-lefthook-sets-up-agent-worktrees.md)). The tree
arrives set up by one hook, whichever way it was made:

```yaml
post-checkout:
  commands:
    set-up-worktree:
      run: sh tools/set-up-worktree.sh {1}
```

[`tools/set-up-worktree.sh`](../tools/set-up-worktree.sh) acts only when git's
previous HEAD is the all-zero id and `--git-dir` differs from `--git-common-dir`,
which is true only for the first checkout of a linked worktree. It then:

1. **Links the source cache.** `.data/source/` holds the archive and dump
   fetched from `povlabs/lexema-data` ([sourceCache.ts](../src/source/sourceCache.ts))
   and is ignored by Git, so it is symlinked from the main checkout, found
   through `--git-common-dir`. The main checkout's cache is made when it is
   missing, so a file one tree fetches is never fetched again by another. A tree
   that already has one keeps it.
2. **Installs dependencies for real.** It runs `pnpm install --frozen-lockfile` in
   the new tree. `node_modules` is never linked from the main checkout.

A branch switch inside the tree does nothing.
[`test/setUpWorktree.test.ts`](../test/setUpWorktree.test.ts) checks both halves
in a throwaway repository with a fake `pnpm` on `PATH`.

Three constraints follow from what a linked worktree shares with the main checkout:

- **Git hooks are installed from the main checkout only.** `.git/hooks` is shared,
  so [`tools/install-git-hooks.sh`](../tools/install-git-hooks.sh), the `prepare`
  script, returns at once in a linked worktree, in CI and outside Git. A lane
  never runs `lefthook install` itself.
- **`git stash` is shared.** `refs/stash` lives in the common git directory, so
  `git rev-parse --git-path refs/stash` names the main checkout's `.git` from any
  linked tree. A lane's `pop` can restore a sibling lane's entry. To set work
  aside, commit it on the lane branch.
- **Address git and files by the tree's absolute path.** A lane's shell may not
  stay in the tree between calls, and a bare `git checkout` that lands in the main
  checkout moves Huey's branch.

## When this applies

Any agent working in a linked worktree of this repository: fabrika lanes, reviewer
trees and a hand-made `git worktree add`. The main checkout itself is not a lane
tree; the setup script exits there, and only it installs hooks. CI never installs
hooks.

## Why it is not obvious

A fresh worktree looks complete, but `node_modules` and the source file are both
ignored by Git, so it has neither; checks then fail for reasons that have nothing
to do with the change. Symlinking the main checkout's `node_modules` looks like a
shortcut, but it carries the main checkout's dependencies, not the ones this
branch's `pnpm-lock.yaml` names, so a lane that changes a dependency checks the
wrong set.
The shared stash and shared hooks are invisible from inside a tree, because each
tree's `git status` and branch look private.

> Derived from `lefthook@2.1.15` — re-verify on pin bump.
