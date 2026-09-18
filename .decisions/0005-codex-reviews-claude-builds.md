---
id: 0005
title: Codex reviews the work, Claude builds and repairs it
status: accepted
date: 2026-09-19
tags: [process, agents]
---

# 0005 — Codex reviews the work, Claude builds and repairs it

**What this decides:** Review runs on a Codex model under a second GitHub account; building and repairing run on Claude.

## Context

Most of this repository is written by agents. An agent reviewing its own work
finds almost nothing, because it re-applies the reasoning that produced the bug.
The fix is a reviewer that differs in two ways at once: a different model, and a
different GitHub account so the review is a real second signature rather than the
author approving themselves.

That worked on its first run. A `gpt-6-astra` reviewer posting as `nothueypov`
read four agent-written pull requests and requested changes on all four,
including a wrong headline number in a measurement, a proof script that could
pass against a stale server, and conditional licence rules written as
unconditional obligations. None of those would have been caught by the authors.

The same model then got pointed at the repair round, which was a mistake twice
over. It collapses the two roles, so the independent second opinion stops being
independent. And Codex burns its usage limit fast: a single repair run spent
about $6 and then died mid-edit with `The usage limit has been reached`, leaving
a half-finished fix in the working tree. Huey had warned that it would.

## Decision

**Codex reviews. Claude builds and repairs. The roles do not swap.**

The reviewer runs a Codex model authenticated as a GitHub account other than the
author's, with read-only access to the repository. Building, repairing, and
answering review findings run on Claude.

**Binding constraints.**

- A reviewer never fixes what it finds, and a builder never reviews its own work.
- The reviewer posts under a different GitHub account from the one that opened
  the pull request.
- The reviewer is read-only: no checkout, no branch switch, no file edits. It
  reads diffs through the API.
- Neither role merges anything. That stays [0001](0001-human-merges-every-pull-request.md).

## Consequences

Two model budgets get spent instead of one, and the Codex budget is the scarce
one — so it is spent on review, where an independent opinion is worth the most,
and not on repair, where Claude is both cheaper and less likely to stop halfway.

A review round costs a full extra pass over every pull request. The first run
found blocking defects in four out of four, so that is buying something real.

If the Codex limit is reached mid-review, the review stops and is reported as
incomplete. It is never finished on the builder's model, because a review from
the model that wrote the code is not a review.

## Records

No vocabulary impact.
