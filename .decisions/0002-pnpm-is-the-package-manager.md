---
id: 0002
title: pnpm is the package manager, and no other lockfile is committed
status: accepted
date: 2026-09-18
tags: [tooling]
---

# 0002 — pnpm is the package manager, and no other lockfile is committed

**What this decides:** Lexema installs with pnpm, and `pnpm-lock.yaml` is the only lockfile in the repository.

## Context

The repository carried both `package-lock.json` and `pnpm-lock.yaml` for a while.
Two lockfiles drift apart without anyone noticing: whichever one you did not run
goes stale, and the next person installs a different dependency tree from yours.

An agent resolved the duplication by deleting the pnpm lockfile and moving the
project to npm ([#21](https://github.com/hueypov/lexema/pull/21)). The
duplication needed fixing; the direction was wrong. Huey uses pnpm.
[#22](https://github.com/hueypov/lexema/pull/22) put it back.

## Decision

**Lexema is a pnpm project, and `pnpm-lock.yaml` is the only lockfile committed to it.**

`package.json` declares `packageManager: pnpm@<version>`, which makes the wrong
package manager refuse to run rather than quietly produce a second lockfile.
CI installs with `pnpm install --frozen-lockfile`, so a lockfile that does not
match `package.json` fails the build instead of being silently rewritten.

**Binding constraints.**

- Commands in docs, scripts, and CI use `pnpm`.
- A dependency change commits the updated `pnpm-lock.yaml` with it.
- `package-lock.json` and `yarn.lock` are never added back.
- Moving off pnpm is a tool replacement and goes through [0003](0003-tool-replacement-is-its-own-decision.md).

## Consequences

Contributors need pnpm installed; `npm install` will refuse. That refusal is the
point — it is what stops the second lockfile from reappearing.

## Records

No vocabulary impact.
