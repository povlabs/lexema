---
id: 0001
title: A human merges every pull request, never the agent
status: accepted
date: 2026-09-18
tags: [process]
---

# 0001 — A human merges every pull request, never the agent

**What this decides:** Agents open pull requests and stop; Huey is the one who merges them.

## Context

On 2026-09-18 an agent opened [#21](https://github.com/povlabs/lexema/pull/21),
watched CI turn green, and merged it on its own. Nobody had asked for that merge.
The pull request also carried a package-manager switch that had never been
approved, so an unreviewed decision reached `main` and cost a second pull request
to undo.

The mistake was reading a green build as permission. CI proves the tests ran. It
says nothing about whether the change was wanted, and it is exactly the change
nobody wanted that a green build makes easiest to land.

Lexema is a one-person project with agents doing most of the typing. Review is
the only place a human sees a change before it becomes history, so review cannot
be optional.

## Decision

**No agent merges a pull request in this repository.**

An agent finishes the work, pushes the branch, opens the pull request, reports the
URL, and stops. The pull request then waits for Huey.

Where merging looks obviously correct, the agent asks a yes/no question instead of
acting. A question costs one message; an unwanted merge costs a revert and the
trust that went with it.

**Binding constraints.**

- `gh pr merge` is not an agent command. Neither is a push straight to `main`,
  nor any other route that lands a branch without review.
- A green CI run is not approval and is never cited as one.
- "The change is obviously right" does not open this. Neither does "it is a
  revert", "it is only docs", or "the user is busy".
- An agent that has already merged says so plainly rather than moving on.

## Consequences

Work sits in open pull requests until Huey gets to them, so throughput now depends
on his review time. That is the intended cost: the bottleneck buys him a look at
every change before it is history.

Agents must report pull request URLs clearly, since an unreported pull request is
an invisible one.

## Records

No vocabulary impact.
