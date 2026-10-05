# Lexema

An Italian word-search website, not built yet. `src/` holds the Italian source
adapter, the candidate resolver and the validation CLI; `test/` and `fixtures/`
hold their checks; `reports/` holds dated findings; `.decisions/` holds the
rulings. The source file `it-extract.jsonl.gz` and the dump it was built from
live in `source/` of `povlabs/lexema-data`. Local commands fetch them into
`.data/source/` on first use and check them there; that cache is ignored by Git
and absent in CI. The release id is `it-` plus the first eight hex digits of
the archive's SHA-256, `it-0c432803`.

## Working rules

- Use `pnpm`, including `pnpm exec` and `pnpm dlx` instead of `npx`. Commands are
  declared in [package.json](package.json) and explained in
  [DEVELOPMENT.md](DEVELOPMENT.md)
  ([ADR 0002](.decisions/0002-pnpm-is-the-package-manager.md)).
- Source-derived lexical data is read-only: keep it as imported, keep where each
  fact came from, and return every valid candidate. There are two exceptions, and
  both keep `source_record_json` byte-for-byte: a small, rule-based rewrite for
  consistency ([ADR 0019](.decisions/0019-source-text-may-be-normalized.md)), and
  curated corrections, single facts set right beside the record, each cited and
  added only on a ruling
  ([ADR 0027](.decisions/0027-curated-corrections-are-cited-exceptions.md)).
  Italian grammar enrichment is deterministic and language-specific. AI generation, a product UI, or wider work
  needs an explicit request.
- Make invalid states unrepresentable. Domain logic belongs in domain objects.
- Verify claims about the dataset, the platform, and dependencies in source or a
  real test, and cite the evidence. A report marked historical is context, not
  fact; existing code is not accepted as correct without fresh review.
- Replacing a tool is its own decision, never part of another change
  ([ADR 0003](.decisions/0003-tool-replacement-is-its-own-decision.md)).
- Delegated agent work may run in any harness. The session talking to Huey is the
  parent: it routes child questions and reports every result
  ([ADR 0014](.decisions/0014-agent-work-runs-in-any-harness.md)).
- Every agent posts from the active `hueypov` account, reviews included, and
  never switches account. A reviewer is never the agent that wrote the work: it
  is a different agent from the builder. A builder does not review its own
  change, a reviewer does not fix what it finds, and neither merges. No agent
  writes a `control-plane-self-approval` marker; that is Huey's sign-off. Which
  model fills a role is configuration in the harness that runs it
  ([ADR 0021](.decisions/0021-agents-post-as-one-account.md),
  [ADR 0005](.decisions/0005-codex-reviews-claude-builds.md)).
- A pull request merges when every required verdict is PASS at its head, and only
  the `shipper` merges. `ready-for:human` holds it for Huey
  ([ADR 0006](.decisions/0006-codex-review-is-the-merge-gate.md)).
- An agent lane works in its own linked worktree, which sets itself up
  ([ADR 0022](.decisions/0022-lefthook-sets-up-agent-worktrees.md)). No sibling
  clones, and one writer per worktree. Check `git branch --show-current` before
  editing, and leave the main checkout's branch where you found it.
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
frontmatter (the `validate the ADR corpus` job of [ci.yml](.github/workflows/ci.yml)).
