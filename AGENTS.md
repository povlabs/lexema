# Lexema

An Italian word-search website, not built yet. `src/` holds the Italian source
adapter, the candidate resolver and the validation CLI; `test/` and `fixtures/`
hold their checks; `reports/` holds dated findings; `.decisions/` holds the
rulings. The source file `it-extract.jsonl.gz` sits in the repository root,
ignored by Git and absent in CI.

## Working rules

- Use `pnpm`, including `pnpm exec` and `pnpm dlx` instead of `npx`. Commands are
  declared in [package.json](package.json) and explained in
  [DEVELOPMENT.md](DEVELOPMENT.md)
  ([ADR 0002](.decisions/0002-pnpm-is-the-package-manager.md)).
- Source-derived lexical data is read-only: keep it as imported, keep where each
  fact came from, and return every valid candidate. Italian grammar enrichment is
  deterministic and language-specific. AI generation, a product UI, or wider work
  needs an explicit request.
- Make invalid states unrepresentable. Domain logic belongs in domain objects.
- Verify claims about the dataset, the platform, and dependencies in source or a
  real test, and cite the evidence. A report marked historical is context, not
  fact; existing code is not accepted as correct without fresh review.
- Replacing a tool is its own decision, never part of another change
  ([ADR 0003](.decisions/0003-tool-replacement-is-its-own-decision.md)).
- Delegated agent work runs through `pi-subagents` from the Pi session talking to
  Huey, never in separate terminal tabs or Herdr panes. The parent routes child
  questions and reports every result
  ([ADR 0007](.decisions/0007-pi-subagents-runs-agent-work.md)).
- A reviewer is never the agent that wrote the work, and reviews under a different
  account. A builder does not review its own change, a reviewer does not fix what
  it finds, and neither merges. A reviewer prefixes each `gh` or `fabrika` call
  with `GH_TOKEN="$(gh auth token --user nothueypov)"` and never changes the
  active account. Which model fills a role is configuration in `.pi/settings.json`,
  and Huey changes it whenever he likes
  ([ADR 0005](.decisions/0005-codex-reviews-claude-builds.md)).
- A pull request merges when every required verdict is PASS at its head, and only
  the `shipper` merges. `ready-for:human` holds it for Huey
  ([ADR 0006](.decisions/0006-codex-review-is-the-merge-gate.md)).
- All mutation happens in this one checkout: no worktrees, no sibling clones, one
  writer at a time. Check `git branch --show-current` before editing, and leave
  the branch where you found it.
- Use the definitions in [.glossary/TERMS.md](.glossary/TERMS.md) and
  [.glossary/LANGUAGE.md](.glossary/LANGUAGE.md) when naming or changing a
  concept. Technical identifiers and prose are English; source text stays Italian.
- Follow applicable Fabrika skills when using Fabrika. File deferred work through
  the `report` skill when it is found, unless the task explicitly excludes filing.

## Discover the context for the task

Read the nearest working code and tests. [.patterns/index.md](.patterns/index.md)
is the one task-to-pattern map; read the rows relevant to the change, not every
linked document. Add or extend a pattern only when it meets that index's admission
rules.

Verify current behavior in source. Check the governing decision before treating a
difference between source and guidance as intended design.

| Home | Owns |
|---|---|
| [README.md](README.md) | Product introduction and ethos |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup, commands and current development state |
| [design-system-manifest.md](design-system-manifest.md) | Rendered UI design law |
| [.patterns/](.patterns/index.md) | Current implementation guidance and when to read it |
| [.glossary/](.glossary/LANGUAGE.md) | Canonical terms and necessary distinctions |
| [.decisions/](.decisions/) | Decisions, rationale and history |
| [reports/](reports/) | Dated findings and measurements |

Use resolvable Markdown links. Keep each fact in its owning document and link to it.

## Decision discovery

List `.decisions/`: filenames identify records, and each record's frontmatter gives
its `id`, `title` and `status`. Read applicable records when changing the choice they
govern or resolving conflicting guidance. Record new decisions with `/adr`.

There is no committed ADR index. Filenames plus frontmatter are the discovery
contract, and CI reds a duplicate id or a filename that disagrees with its
frontmatter ([decisions-index.yml](.github/workflows/decisions-index.yml)).
