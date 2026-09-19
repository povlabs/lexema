# Lexema

`CLAUDE.md` is a symlink to this file. One set of rules, whichever agent reads it.

## Read first

Read every file in [`.decisions/`](.decisions) before you start. Those are settled
rulings and they bind you. Three that catch agents out:

- [0001](.decisions/0001-human-merges-every-pull-request.md) — you never merge a pull request. Open it, report the URL, stop. Green CI is not approval.
- [0002](.decisions/0002-pnpm-is-the-package-manager.md) — pnpm only. Never add `package-lock.json`.
- [0003](.decisions/0003-tool-replacement-is-its-own-decision.md) — never swap a tool as a side-effect of other work.

Then these, in order:

1. [`docs/LEXEMA_SPEC.md`](docs/LEXEMA_SPEC.md) — product, architecture, API, provenance, and MVP boundaries.
2. [`docs/DATASET_FINDINGS.md`](docs/DATASET_FINDINGS.md) — verified facts about the Italian Kaikki/Wiktextract dataset.
3. [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) — decisions, open questions, and the exact first implementation milestone.

## The product rule

Do not invent or overwrite source-derived lexical data. Preserve provenance,
return all valid candidates, and keep Italian grammar enrichment deterministic and
language-specific. Do not add AI generation, a full product UI, or broader
implementation work unless explicitly requested.

## Which role are you in?

- **Worker** — you were started in a herdr pane with one job in your prompt
  (`review PR #33`, `build #14`). Do that job in this pane, in this session, and
  finish it. Your tools are the skill you were given, `git`, `gh` and `fabrika`.
  Leave `herdr` alone: a worker that opens another pane hands its job to a session
  nobody is watching, and a worker that lists panes sees itself and stops as a
  "duplicate". Both have happened.
- **Driver** — you are talking to Huey and handing work out. Read
  [`docs/DRIVER.md`](docs/DRIVER.md) before you open a tab or start a review.

## Models

pi is the agent runner. `pi auth check` is **not** a reliable answer — it reports
`pi-claude` as `not_ready` and `anthropic` as `ready`, and the truth is the other
way round:

| Provider | Model | Works? | Use it for |
| --- | --- | --- | --- |
| `pi-claude` | `claude-opus-5` | yes | building, repairing |
| `openai-codex` | `gpt-5.6-sol` | yes | reviewing |
| `anthropic` | — | **no** | — |

`--provider anthropic` fails with `400 … Third-party apps now draw from your extra
usage`. Use `pi-claude`.

Codex reviews, Claude builds and repairs, and the roles never swap. That is
[`.decisions/0005`](.decisions/0005-codex-reviews-claude-builds.md).

## Package manager

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
```

`npx` resolves a different `wrangler` and triggers a Cloudflare login prompt — use
`pnpm exec wrangler`.

## One checkout

All work happens in `/Users/huey/Documents/projects/lexema`. No git worktrees, no
sibling directories. Other sessions share this working tree and may switch its
branch while you work, so check `git branch --show-current` before you edit and
never switch it back under them. Clean up anything you leave behind.
