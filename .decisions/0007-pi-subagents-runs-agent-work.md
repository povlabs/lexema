---
id: 0007
title: Agent work runs through pi-subagents, never Herdr tabs
status: superseded by [0014](0014-agent-work-runs-in-any-harness.md)
date: 2026-09-20
tags: [process, agents, tooling]
---

# 0007 — Agent work runs through pi-subagents, never Herdr tabs

**What this decides:** Delegated agents run as pi-subagents children coordinated by the parent Pi session.

## Context

The agent workflow added in [#36](https://github.com/povlabs/lexema/pull/36) starts each worker as a separate Pi process in a Herdr tab. Those processes cannot use pi-subagents' supervisor channel. Coordination instead depends on terminal callbacks, pane reads, and manual routing through Herdr.

Pi now has a working `pi-subagents` package. It keeps child requests and results in the parent session, supplies named fabrika agent profiles, and supports bounded parallel read-only work without opening more terminal sessions. Replacing Herdr for agent execution is a tool replacement, so [0003](0003-tool-replacement-is-its-own-decision.md) requires this decision to stand on its own.

## Decision

**Delegated agent work runs through `pi-subagents`, never through separate Pi processes in Herdr tabs.**

The Pi session talking to Huey is the parent. It launches named fabrika agents, owns shared decisions, and routes child questions through the supervisor channel. Children do not coordinate through terminal callbacks. Read-only jobs may run in parallel. Mutation jobs are serialized because Lexema keeps one checkout and one writer.

Herdr panes remain available for visible long-running non-agent processes such as development servers. A pi-subagents launch failure stops the lane; it does not trigger a fallback to a terminal tab.

The model and GitHub-account split in [0005](0005-codex-reviews-claude-builds.md) remains binding. The review and merge gate in [0006](0006-codex-review-is-the-merge-gate.md) also remains binding. This decision changes how agents run, not who builds, reviews, or merges.

**Binding constraints.**

- The parent works directly unless delegated agent work is requested or a fabrika lane calls for a named agent.
- Named fabrika agents are launched through `pi-subagents` with a bounded task and explicit completion checks.
- Child questions and progress updates return through the supervisor channel.
- One mutation-capable agent owns the checkout at a time; read-only agents may run together.
- Herdr tabs and panes do not host agent sessions.

## Consequences

Agent status, questions, and results stay in one Pi session. Huey no longer needs to watch several tabs or rely on callbacks typed into the parent pane.

Sibling children still do not talk directly; the parent or an authorized nested coordinator routes shared decisions. The one-checkout rule limits parallel writing, and a pi-subagents outage now blocks delegated work instead of falling back to Herdr.

## Records

no vocabulary impact
