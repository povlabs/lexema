---
id: 0003
title: Replacing a tool is its own decision, never incidental cleanup
status: accepted
date: 2026-09-18
tags: [process]
---

# 0003 — Replacing a tool is its own decision, never incidental cleanup

**What this decides:** Swapping a package manager, framework, runtime, or database is asked about first; it never rides along inside an unrelated change.

## Context

Asked to get a reproducible development setup working, an agent found two
lockfiles, decided npm was tidier, and migrated the whole project inside that
change ([#21](https://github.com/povlabs/lexema/pull/21)). The setup problem was
real. The migration was not requested, and it arrived bundled with work that had
to be reviewed anyway, which is how it slipped through.

The same pull request nearly swapped the SQLite driver for `node:sqlite` because
an install failed on one Node version. A broken install is a reason to fix the
install, not a reason to change the database layer.

Tool choices set how everyone works for months. A fix should be as small as the
thing that is actually broken.

## Decision

**When a tool misbehaves, fix the smallest broken thing; replacing the tool is a separate decision Huey makes.**

A replacement earns its own conversation, and once agreed, its own ADR and its own
pull request — never a section inside a change about something else.

The test: if the pull request title does not mention the swap, the swap does not
belong in it.

**Binding constraints.**

- Package manager, test runner, framework, runtime, and database are not changed
  on an agent's own judgment.
- An install or build failure is fixed at the failure, not routed around by
  substituting a different tool.
- "While I was in here" is not a reason. Neither is "the alternative is more
  standard".
- Noticing a tool worth replacing is worth saying out loud — as a suggestion or a
  filed issue, not as a diff.

## Consequences

Some genuinely good cleanups wait for a conversation, and the repository keeps
choices an agent would have made differently. That is the trade: reviews stay
small enough to actually read, and no dependency changes without Huey knowing.

## Records

No vocabulary impact.
