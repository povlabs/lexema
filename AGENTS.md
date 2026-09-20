# Lexema

The one rules file. Every agent, every session.

## Read first

Read every file in [`.decisions/`](.decisions). They bind you.

Then, in order:

1. [`docs/LEXEMA_SPEC.md`](docs/LEXEMA_SPEC.md) — product, architecture, API, provenance, MVP boundaries.
2. [`docs/DATASET_FINDINGS.md`](docs/DATASET_FINDINGS.md) — verified facts about the Italian Kaikki/Wiktextract dataset.
3. [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) — decisions, open questions, the first milestone.

## The product rule

Source-derived lexical data is read-only: keep it as imported, keep where each fact came from, return every valid candidate. Italian grammar enrichment is deterministic and language-specific. AI generation, a product UI, or wider work needs an explicit request.

## Agent work

The Pi session talking to Huey is the parent. Delegated agent work runs through the installed `pi-subagents` package, not through separate Pi processes in terminal tabs or Herdr panes.

The parent works directly unless Huey asks for delegation or a fabrika lane calls for a named agent. Before the first launch, list executable agents and their capabilities. Then use the smallest launch that fits:

- one bounded job: launch one named agent;
- independent read-only jobs: run them in parallel;
- ordered or multi-agent work: use one top-level workflow call;
- mutation work: run one writer at a time in the shared checkout.

Use async runs by default. Let native completion notices wake the parent. The parent owns shared decisions, reports every result to Huey, and answers child requests through the supervisor channel. Sibling children do not talk directly; the parent or an authorized nested coordinator routes their decisions.

Every child brief names the objective, issue or PR, repository and branch, read or edit boundary, completion checks, validation, expected report, and when to stop and ask. A child launch or tooling failure blocks that lane. Report it; do not fall back to a terminal tab.

## Named agents

Use the fabrika package agent whose name matches the stage. Its preloaded skill owns the procedure.

| Agent | Job | Model family |
| --- | --- | --- |
| `reviewer` | judge one PR's code and docs | Codex |
| `ui-reviewer` | judge one PR's rendered UI | Codex |
| `builder` | build one issue, or repair one PR | Claude |
| `ui-builder` | build one UI issue, or repair one UI PR | Claude |
| `mixed-builder` | build work spanning code and rendered UI | Claude |
| `triager` | make one raw issue pickable | Claude |
| `shipper` | merge one PR whose required verdicts pass | Claude |
| `operator` | drive one issue through the fabrika states | Claude |

Model selection follows [0005](.decisions/0005-codex-reviews-claude-builds.md). Query the subagent model registry before an explicit override and pass an exact provider/model. A required model family that is unavailable blocks the lane; never substitute the builder for the reviewer or the reviewer for the builder.

A reviewer posts as `nothueypov`. It verifies that identity before posting and prefixes each `gh` or `fabrika` command with `GH_TOKEN="$(gh auth token --user nothueypov)"`; it never changes the machine's active GitHub account. Read-only reviews may run together. Hold pushes to a branch under review because a new head restarts the gate.

Repair is `builder` again with `repair PR #<n>`. Only `shipper` merges, and only after every required verdict passes at the current head. A PR labelled `ready-for:human` waits for Huey ([0006](.decisions/0006-codex-review-is-the-merge-gate.md)).

## Commands

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm exec wrangler ...   # npx picks another wrangler and prompts for login
```

## One checkout

All mutation happens in `~/Documents/projects/lexema`. No worktrees or sibling clones. One mutation-capable parent or child owns the checkout at a time; read-only reviewers use the GitHub API. Check `git branch --show-current` before editing or launching a writer, and leave the branch where the parent found it. Clean up anything you leave behind.
