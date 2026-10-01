---
id: 0014
title: Agent work may run in any harness, never with the builder reviewing its own work
status: amended-in-part by [0021](0021-agents-post-as-one-account.md), [0022](0022-lefthook-sets-up-agent-worktrees.md)
date: 2026-09-27
supersedes: 0007
tags: [process, agents, tooling]
---

# 0014 — Agent work may run in any harness, never with the builder reviewing its own work

**What this decides:** Any agent harness may launch Lexema's builders, reviewers and shipper; the rules about who does what stay the same.

## Context

[0007](0007-pi-subagents-runs-agent-work.md) tied delegated agent work to one named harness and its subagent package. The fabrika agents ship for more than one harness, and on 2026-09-27 Huey asked for them to run from whichever session he is working in. He asked that no decision record name a tool, so that changing harness never needs a new record. This supersedes 0007 outright, and [0003](0003-tool-replacement-is-its-own-decision.md) is why it stands as its own record.

[0005](0005-codex-reviews-claude-builds.md) names one harness's settings file as the place where each role's model is set. That part no longer holds, so this record amends 0005 in part. The rest of 0005 still binds.

## Decision

**Agent work may run in any harness, as long as the reviewer is never the agent that built the work.**

The session talking to Huey is the parent. It launches the named fabrika agents, routes their questions, and reports every result. Which harness hosts the parent or a child is not a decision.

Which model fills each role is configuration in the harness that runs it.

**Binding constraints.**

- The reviewer runs apart from the builder, as a separate agent, and posts under the `nothueypov` account ([0005](0005-codex-reviews-claude-builds.md)).
- A builder never reviews its own work, a reviewer never fixes what it finds, and only the shipper merges ([0006](0006-codex-review-is-the-merge-gate.md)).
- One agent that can change files owns the checkout at a time. Read-only agents may run together.

## Consequences

Huey can drive the pipeline from any session, and a harness outage no longer blocks agent work.

## Records

no vocabulary impact

## Amendments

- **The reviewer posts as `hueypov` (2026-10-01).** [0021](0021-agents-post-as-one-account.md) replaces the `nothueypov` account in the first binding constraint: every agent posts as `hueypov`. The reviewer still runs apart from the builder, as a separate agent.
- **"The checkout" means one worktree (2026-10-02).** Since [0022](0022-lefthook-sets-up-agent-worktrees.md), each agent works in its own git worktree. In the third binding constraint, "the checkout" now means one worktree: one agent that can change files owns each worktree at a time. Read-only agents may still run together.
