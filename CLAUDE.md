# Lexema

Read every file in [`.decisions/`](.decisions) before you start. Those are settled
rulings and they bind you. Four that catch agents out:

- [0001](.decisions/0001-human-merges-every-pull-request.md) — you never merge a pull request. Open it, report the URL, stop.
- [0002](.decisions/0002-pnpm-is-the-package-manager.md) — pnpm only. Never add `package-lock.json`.
- [0003](.decisions/0003-tool-replacement-is-its-own-decision.md) — never swap a tool as a side-effect of other work.
- [0005](.decisions/0005-codex-reviews-claude-builds.md) — Codex reviews, Claude builds and repairs. Roles never swap.

Then read these documents in order:

1. [`docs/LEXEMA_SPEC.md`](docs/LEXEMA_SPEC.md) — product, architecture, API, provenance, and MVP boundaries.
2. [`docs/DATASET_FINDINGS.md`](docs/DATASET_FINDINGS.md) — verified facts about the Italian Kaikki/Wiktextract dataset.
3. [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) — decisions, open questions, and the exact first implementation milestone.

Do not invent or overwrite source-derived lexical data. Preserve provenance, return all valid candidates, and keep Italian grammar enrichment deterministic and language-specific. Do not add AI generation, a full product UI, or broader implementation work unless explicitly requested.
