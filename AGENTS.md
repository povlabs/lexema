# Lexema

An Italian word-search website for meanings, conjugations, articles, and related
forms. The website is not built yet. `src/` holds the Italian source adapter, the
candidate resolver, and the validation CLI; `test/` holds unit tests and the
dataset-backed adapter tests; `fixtures/` holds the checked forms and release
metadata; `docs/` holds the research; `.decisions/` holds the rulings. The source
file `it-extract.jsonl.gz` sits in the repository root, ignored by Git and absent
in CI.

## Working rules

- Use `pnpm`, including `pnpm exec` and `pnpm dlx` instead of `npx`. Commands are
  declared in [package.json](package.json) and explained in [README.md](README.md)
  ([ADR 0002](.decisions/0002-pnpm-is-the-package-manager.md)).
- Source-derived lexical data is read-only: keep it as imported, keep where each
  fact came from, and return every valid candidate. Italian grammar enrichment is
  deterministic and language-specific. AI generation, a product UI, or wider work
  needs an explicit request.
- Make invalid states unrepresentable. Domain logic belongs in domain objects.
- Verify claims in source or a real test and cite the evidence. A document marked
  historical is context, not fact. Older code is not accepted as correct without
  fresh review.
- Replacing a tool is its own decision, never part of another change
  ([ADR 0003](.decisions/0003-tool-replacement-is-its-own-decision.md)).
- Delegated agent work runs through `pi-subagents` from the Pi session talking to
  Huey, never in separate terminal tabs or Herdr panes. The parent routes child
  questions and reports every result. One writer owns the checkout at a time
  ([ADR 0007](.decisions/0007-pi-subagents-runs-agent-work.md)).
- Codex reviews as `nothueypov`; Claude builds and repairs. The roles do not swap.
  A reviewer prefixes each `gh` or `fabrika` call with
  `GH_TOKEN="$(gh auth token --user nothueypov)"` and never changes the active
  account ([ADR 0005](.decisions/0005-codex-reviews-claude-builds.md)).
- A pull request merges when every required verdict is PASS at its head, and only
  the `shipper` merges. `ready-for:human` holds it for Huey
  ([ADR 0006](.decisions/0006-codex-review-is-the-merge-gate.md)).
- All mutation happens in this one checkout: no worktrees, no sibling clones. Check
  `git branch --show-current` before editing, and leave the branch where you found
  it.
- Follow applicable Fabrika skills when using Fabrika. File deferred work through
  the `report` skill when it is found, unless the task excludes filing.

## Discover the context for the task

Read the nearest working code and tests. GitHub milestones and issues hold current
scope, and no Markdown backlog exists ([docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)).

Verify current behavior in source. Check the governing decision before treating a
difference between source and guidance as intended design.

| Home | Owns |
|---|---|
| [README.md](README.md) | Product introduction, repository status, and how to run the checks |
| [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) | Where plans, tasks, and completion checks live |
| [docs/DATASET_SPOT_CHECK.md](docs/DATASET_SPOT_CHECK.md) | Directly observed dataset facts and the checked file's checksum |
| [docs/SOURCE_RESEARCH.md](docs/SOURCE_RESEARCH.md) | Upstream source comparison and licensing limits |
| [docs/LEXEMA_SPEC.md](docs/LEXEMA_SPEC.md) | The original product and API proposal, kept as history |
| [docs/DATASET_FINDINGS.md](docs/DATASET_FINDINGS.md) | Early dataset inspection notes, kept as history |
| [docs/VALIDATION_RESULTS.md](docs/VALIDATION_RESULTS.md) | A past adapter validation run, kept as history |
| [.decisions/](.decisions/) | Decisions, rationale and history |

Use resolvable Markdown links. Keep each fact in its owning document and link to it.

## Decision discovery

List `.decisions/`: filenames identify records, and each record's frontmatter gives
its `id`, `title` and `status`. Read applicable records when changing the choice they
govern or resolving conflicting guidance. Record new decisions with `/adr`.

There is no committed ADR index. Filenames plus frontmatter are the discovery
contract, and CI reds a duplicate id or a filename that disagrees with its
frontmatter.
