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

## Your role

Decide this first.

- **Worker** — you were started in a herdr pane with one job in the prompt (`review PR #33`, `build #14`). Do that job here, in this session, to the end. Your tools are the skill you were given, `git`, `gh` and `fabrika`. The one `herdr` command you run is the callback at the end of your prompt, after the job is done. Everything else in `herdr` is the driver's: a worker that opens a pane loses its job to a session nobody watches, and a worker that lists panes sees itself and quits as a duplicate.
- **Driver** — you are talking to Huey and handing work out. Every job that takes minutes runs in its own herdr tab. Your own shell stays free for short commands.

## Driver: spawn a worker

One tab per job, labelled so Huey can see who started it.

```bash
herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label <label> --no-focus   # pane id at .result.root_pane.pane_id
herdr pane rename <pane_id> <label>                       # --label names the tab only
herdr pane run <pane_id> "unsetopt correct correct_all"   # zsh otherwise "corrects" wrangler to .wrangler and drops the line
herdr pane run <pane_id> "<the pi command>"
```

Fire it and move on. The worker calls you back: the last line of its prompt tells it to submit a prompt to your pane, which arrives as a new turn in your chat. Your `HERDR_PANE_ID` is the driver pane. The callback goes in the prompt, not after the pi command: pi stays open when the job ends, so a shell line after it never runs. `agent prompt`, not `pane run`: `pane run` types raw keys and joins whatever Huey is typing.

```
<job>. When done, run: herdr agent prompt <driver_pane_id> "<label> finished in pane <pane_id>. Read it and report."
```

When that turn arrives, read the pane and report the result to Huey:

```bash
herdr pane read <pane_id> --source recent-unwrapped --lines 40
```

Your task is not done until you have reported the result of every worker you started.

Run pi interactively: prompt as a plain argument, `-n` to name the session. Then the pane shows thinking and tool calls live. `-p` buffers everything until the end and the pane looks hung.

Close the tab after reporting.

## Driver: start a review

The reviewer is Codex running the fabrika `review` skill, posting as `nothueypov` so the author is not approving their own work. Label the tab `pr-<n>`.

```bash
DRIVER=$HERDR_PANE_ID
herdr pane run <pane_id> "export GH_TOKEN=\$(gh auth token --user nothueypov)
export FABRIKA_GLOBAL_WARNING_DISABLED=1
pi --provider openai-codex --model gpt-5.6-sol \\
   --skill ~/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/review \\
   -n 'review PR <n>' 'review PR #<n>. When your verdict is posted, run: herdr agent prompt $DRIVER \"pr-<n> review finished in pane <pane_id>. Read it and report the verdict.\"'"
```

Reviews run in parallel, one tab each. A review is done when `fabrika review verdicts <n>` lists every namespace that `fabrika review scope <n>` asks for, at the PR's current head. Report the verdict URL to Huey. Hold pushes to that branch until then: a new head restarts the review.

## Driver: the other agents

Same command, different skill directory and model. Skills live in `~/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/`.

| Agent | `--skill` | Provider | Job | Tab label |
| --- | --- | --- | --- | --- |
| reviewer | `review` | `openai-codex` | judge one PR's code and docs | `pr-<n>` |
| ui-reviewer | `review-ui` | `openai-codex` | judge one PR's rendered UI | `ui-<n>` |
| builder | `build` | `pi-claude` | build one issue, or repair one PR | `build-<n>` |
| ui-builder | `build-ui` | `pi-claude` | build one issue whose deliverable is UI | `build-<n>` |
| triager | `triage` | `pi-claude` | make one raw issue pickable | `triage-<n>` |
| shipper | `ship` | `pi-claude` | merge one PR whose verdicts all PASS | `ship-<n>` |
| operator | `operate` | `pi-claude` | drive one issue through all of the above | `op-<n>` |

A builder starts like this:

```bash
herdr pane run <pane_id> "pi --provider pi-claude --model claude-opus-5 \\
   --skill ~/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/build \\
   -n 'build <n>' 'build #<n>. When the PR is open, run: herdr agent prompt $DRIVER \"build-<n> finished in pane <pane_id>. Read it and report.\"'"
```

Repair is the builder again, with `repair PR #<n>` as the prompt. Only the shipper merges, and only after every required verdict is PASS at the current head. A PR labelled `ready-for:human` waits for Huey instead ([0006](.decisions/0006-codex-review-is-the-merge-gate.md)).

## Driver: models

| Provider | Model | Use for |
| --- | --- | --- |
| `pi-claude` | `claude-opus-5` | building, repairing |
| `openai-codex` | `gpt-5.6-sol` | reviewing (Codex plan 1) |
| `openai-codex-2` | `gpt-5.6-sol` | reviewing (Codex plan 2) |
| `anthropic` | — | never. Use `pi-claude`. |

There are two different Codex plans, each its own provider. The pi status line shows which one a pane is on and what is left (`Codex #2 · 55% · 5h`). When one runs low, start the next review on the other.

`pi auth check` lies: it reports `pi-claude` not ready and `anthropic` ready. The reverse is true. `anthropic` fails with `400 … Third-party apps now draw from your extra usage`.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm exec wrangler ...   # npx picks another wrangler and prompts for login
```

## One checkout

All work happens in `~/Documents/projects/lexema`. No worktrees, no sibling clones. Other sessions share this tree and may switch its branch while you work: check `git branch --show-current` before you edit, and leave it where you find it. Clean up anything you leave behind.
