---
id: 0014
title: Agent work may run in any harness, never with the builder reviewing its own work
status: accepted
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

Which model fills each role is configuration in the harness that runs it, and Huey changes it whenever he likes. When a harness would start a child on the parent's model, the parent starts the reviewer through a harness that runs the configured reviewer model instead. It never lets the reviewer inherit the builder's model.

**Binding constraints.**

- The reviewer runs apart from the builder, on the model configured for review, and posts under the `nothueypov` account ([0005](0005-codex-reviews-claude-builds.md)).
- A builder never reviews its own work, a reviewer never fixes what it finds, and only the shipper merges ([0006](0006-codex-review-is-the-merge-gate.md)).
- One agent that can change files owns the checkout at a time. Read-only agents may run together.
- If the reviewer model cannot run, the review stops and is reported as incomplete. It is never finished on the builder's model.

## Consequences

Huey can drive the pipeline from any session, and a harness outage no longer blocks agent work. The cost is one check the harness used to do for us: the parent must confirm the reviewer is really running on the review model, because some harnesses start every child on the parent's model.

## Records

no vocabulary impact

## Amendments

- **Builder and reviewer may share a model (2026-09-27).** Huey moved both roles to the same model after the Codex sandbox could not reach GitHub. The rule that the reviewer never inherits the builder's model, in the Decision and the first binding constraint, no longer holds. By default the reviewer runs on the same model as the builder, unless Huey asks for a different one. What still binds is that the reviewer is a separate agent from the builder, reviews under `nothueypov`, never fixes what it finds, and never merges.
