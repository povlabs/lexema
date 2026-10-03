---
id: 0006
title: A passing Codex review is the merge gate; the shipper merges
status: accepted
date: 2026-09-19
supersedes: 0001
tags: [process, agents]
---

# 0006 — A passing Codex review is the merge gate; the shipper merges

**What this decides:** A pull request merges when every required review verdict is PASS at its current head. The fabrika `ship` skill does the merge. Huey merges only what carries `ready-for:human`.

## Context

[0001](0001-human-merges-every-pull-request.md) made Huey the merge gate after an agent merged an unreviewed pull request on a green build. The problem it fixed was a missing review, and the fix was the only reviewer available: a human.

Since then [0005](0005-codex-reviews-claude-builds.md) put a second model on review, under a second GitHub account. Every pull request now gets a written verdict from a reviewer that is not its author. On 2026-09-19 that reviewer failed nine of ten open pull requests on real findings. The review 0001 was protecting exists, and it is not Huey's time anymore.

Keeping the human gate on top of it means every pull request waits for Huey twice: once for a verdict he did not write, once to click merge.

## Decision

**A pull request merges when its Codex review passes. The shipper merges it.**

- The gate is `fabrika ship gate <n> --sha <head>`: every required verdict namespace reads `pass` at the current head. CI green is a separate, required check. Nothing else opens it.
- Only the `ship` skill merges. A builder, reviewer, or driver still stops at the PR URL. On `main` the shipper enqueues the PR into GitHub's merge queue, which merges it once the required checks pass on the queued result (#532).
- A FAIL goes back to a builder for repair. The shipper never overrides a verdict.
- **`ready-for:human` holds the merge.** A PR carrying that label waits for Huey even with every verdict PASS. The shipper reports it and stops. Put the label on anything that changes money or what gets published. Since [#532](https://github.com/povlabs/lexema/issues/532) a change to a decision record or a guard no longer needs it: it merges through the shipper once governance and the other required verdicts pass (amended by #532).
- Huey can still merge by hand.

**Still binding from 0001.** A green CI run alone is not approval. A push straight to `main` is not a route. An agent that merged says so plainly.

## Consequences

Throughput no longer waits on Huey. It waits on the Codex budget, which the driver watches.

The reviewer is now the last look before `main`. A weak review lands a weak change, so review findings are the thing to keep sharp.

## Records

No vocabulary impact.

## Amendments

- **[#532](https://github.com/povlabs/lexema/issues/532) — Merge queue, and the shipper merges decision records (2026-10-03).** The repositories moved to the `povlabs` organization and went public, so GitHub's merge queue is available. Huey asked "can we make merge queue so that you can merge those", and, asked whether pull requests that change ADRs or workflows should still wait for him, answered "yes let the shipper merge". After Fabrika's control-plane boundary was explained (`ship cp-approval` holds every `.github/CODEOWNERS` path, and with every pull request authored by `hueypov` only his `control-plane-self-approval` comment discharges it; removing a path from CODEOWNERS is the lever; the tradeoff is that only reviews, not a hard stop, guard those files) he answered "ok good". So `.decisions/`, `AGENTS.md`, `.fabrika.jsonc` and `design-system-manifest.md` leave CODEOWNERS and merge through the shipper once their required verdicts, governance included, pass at head. Fabrika's own fixed control-plane paths (`.github/`, `.claude/`, lefthook files and the fabrika-cli list) stay owned, because its `codeowners-cp` guard requires them, so workflow and agent-setting changes still need Huey's sign-off. `ready-for:human` remains Huey's hold on any pull request, and still goes on changes to money or to what gets published; the ruling covered decision records and guards only. The queue requires one status check, the secret scan in `secrets.yml`, which runs on every pull request and on `merge_group`. CI, `d1` and the ADR check skip pull requests outside their paths since #521, so requiring them would hold a pull request they never ran on; the shipper still reads their results at head. Asked whether to add Phoenix's always-running `ci-required` gate here or later, Huey answered "yes file all, and queue the follow up after 534" (2026-10-03): that gate, and requiring it in the queue, is [#535](https://github.com/povlabs/lexema/issues/535).
