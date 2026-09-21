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

That worked on its first run. A Codex reviewer posting as `nothueypov` read four
agent-written pull requests on 2026-09-18 and requested changes on all four:

| PR | Review | Blocking finding |
| --- | --- | --- |
| [#25](https://github.com/hueypov/lexema/pull/25) | [review](https://github.com/hueypov/lexema/pull/25#pullrequestreview-5252986094) | A half-imported release could be read as an unambiguous answer, because only one of the serving queries checked release status. |
| [#26](https://github.com/hueypov/lexema/pull/26) | [review](https://github.com/hueypov/lexema/pull/26#pullrequestreview-5253035881) | Conditional CC licence rules written up as unconditional obligations, and an unverified attribution duty filed as low priority. |
| [#27](https://github.com/hueypov/lexema/pull/27) | [review](https://github.com/hueypov/lexema/pull/27#pullrequestreview-5253035979) | The proof script could pass against a server left running from an earlier spike, so it did not prove what it claimed. |
| [#30](https://github.com/hueypov/lexema/pull/30) | [review](https://github.com/hueypov/lexema/pull/30#pullrequestreview-5253035775) | A usage example counted as a definition, so the headline loss number was wrong; the regression fixture froze the same mislabelling. |

What that run establishes is narrow but real: all four pull requests had been
opened as finished work by their authors, every one of them had CI green — each
review says so — and the reviewer still found something that blocked the merge in
every one. Whether the authors would eventually have caught these themselves is
not knowable and is not the claim. The claim is that they had already stopped
looking.

The same model then got pointed at the repair round, which was a mistake twice
over. It collapses the two roles, so the independent second opinion stops being
independent. And the Codex budget runs out fast: that repair run ended mid-edit
with `The usage limit has been reached`, leaving a half-finished fix in the
working tree. Huey had warned that it would. The exact spend is not recorded
here, because nothing in the repository can be used to check it.

## Decision

**Codex reviews. Claude builds and repairs. The roles do not swap.**

The reviewer runs a Codex model authenticated as a GitHub account other than the
author's, with read-only access to the repository. The rule binds the model
family and the separate account, not any one model version. Building, repairing, and
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
requested changes on four of the four it read, each with at least one blocking
finding — the four reviews are linked above — so that is buying something real.
Four pull requests is a small sample and the rate will not hold, but it is enough
to justify keeping the round.

If the Codex limit is reached mid-review, the review stops and is reported as
incomplete. It is never finished on the builder's model, because a review from
the model that wrote the code is not a review.

## Records

No vocabulary impact.
