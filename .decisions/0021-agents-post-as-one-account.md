---
id: 0021
title: Every agent posts as hueypov, and the reviewer stays a different agent from the builder
status: accepted
date: 2026-10-01
tags: [process, agents]
---

# 0021 — Every agent posts as hueypov, and the reviewer stays a different agent from the builder

**What this decides:** Builders, reviewers and the shipper all post to GitHub as `hueypov`. The separate `nothueypov` account is retired. A review is still written by a different agent from the one that built the work.

## Context

[0005](0005-codex-reviews-claude-builds.md) made the reviewer post under a second GitHub account, `nothueypov`, so a review was "a real second signature". [0014](0014-agent-work-runs-in-any-harness.md) repeated that as a binding constraint, and AGENTS.md told every reviewer to prefix each `gh` or `fabrika` call with `GH_TOKEN="$(gh auth token --user nothueypov)"`.

That prefix is refused by Claude Code's auto-mode check, so a reviewer lane either parks or routes around the refusal ([kamp-us/phoenix#10308](https://github.com/kamp-us/phoenix/issues/10308)). Fabrika's own repository runs with one account: its verdicts are posted by the pull request author's account ([kamp-us/phoenix#10300](https://github.com/kamp-us/phoenix/pull/10300)).

Huey ruled on 2026-10-01, recorded on [#333](https://github.com/hueypov/lexema/issues/333): every agent role posts as `hueypov`, the reviewer is still a different agent from the builder, never fixes what it finds and never merges, and only the separate account goes.

What made the review worth having was never the account. 0005's own evidence is four pull requests their authors had called finished, each failed by a reviewer that had not written them. That is independence of the agent, and it survives one account.

This record amends 0005 in part: its binding constraint "the reviewer posts under a different GitHub account from the one that opened the pull request", and the same words in its 2026-09-22 amendment, no longer bind. It amends 0014 in part: its constraint that the reviewer "posts under the `nothueypov` account" no longer binds. Everything else in both records stands.

## Decision

**Every agent role posts to GitHub as `hueypov`, and a review is always written by a different agent from the one that built the work.**

- Builders, reviewers, triagers and the shipper all use the active `gh` account, `hueypov`. No agent switches account or sets `GH_TOKEN` to reach another one.
- The reviewer is a separate agent in its own session, never the agent that built or repaired the work.
- A reviewer never fixes what it finds, a builder never reviews its own work, and only the shipper merges ([0006](0006-codex-review-is-the-merge-gate.md)).
- The `nothueypov` account is not used by any agent.

**How Huey's own control-plane sign-off stays apart: fabrika does not tell it apart; only this rule does.** `fabrika ship cp-approval` (fabrika-cli 0.8.0, `dist/ship/cp-approval-verb.js`) identifies people by GitHub login and nothing else. The control-plane roster is the owners [.github/CODEOWNERS](../.github/CODEOWNERS) names, which is `@hueypov` alone. When that sole owner is also the pull request's author — every agent-opened pull request here — the verb skips GitHub reviews and discharges only on a pull request comment whose author is `hueypov` and whose body carries `control-plane-self-approval @<sha>` for the current head (lines 140–158). The other route, an `APPROVED` review, needs a reviewer whose login differs from the author's (lines 168–171), so it is closed when the author is `hueypov`. An agent posting as `hueypov` that wrote that marker would pass the check exactly as Huey does; the verb cannot see the difference.

This was already true before this record. Builders and the shipper have always posted as `hueypov`, and only review verdicts used `nothueypov`, so retiring that account opens no route that was closed. The sign-off stays Huey's because of the constraint below, not because of any check.

**Binding constraints.**

- No agent posts as an account other than the active `hueypov`, and no agent prefixes a call with `GH_TOKEN` to change account.
- A reviewer is never the agent that built or repaired the work it reviews.
- No agent ever writes a `control-plane-self-approval` marker. That marker is Huey's act alone.

## Consequences

- Reviewer lanes run under auto mode without a refused prefix, so they no longer park on it.
- A comment's author no longer shows which role wrote it; every one reads `hueypov`.
- Huey's control-plane sign-off is protected by a rule agents follow, not by a check fabrika runs. Separating them by check would need a second account for Huey's sign-off or a fabrika change, and neither is decided here.
