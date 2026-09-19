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

---

The rest of this file is how to operate. Every command below was run in this
repository before being written down. If one stops working, fix it here.

## Which role are you in?

Decide this first. It changes what the rest of this file asks of you.

- **Worker** — you were started in a herdr pane with one job in your prompt
  (`review PR #33`, `build #14`). Do that job in this pane, in this session, and
  finish it. Your tools are the skill you were given, `git`, `gh` and `fabrika`.
  Skip the "Driver" section and every `herdr` command in it: a worker that opens
  another pane hands its job to a session nobody is watching, and a worker that
  lists panes sees itself and stops as a "duplicate". Both have happened.
- **Driver** — you are talking to Huey and handing work out. Anything that takes
  minutes runs in its own labelled tab, never in the shell you are holding.

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
[`.decisions/0005`](.decisions/0005-codex-reviews-claude-builds.md); this file only
records how to run it.

**Watch the Codex budget.** The pi status line shows it (`Codex #2 · 55% · 5h`).
Reviews are the only thing spending it, and it has run out mid-run before.

## Driver: one tab per unit of work

A tab is how you delegate. pi's `subagent` tool is not installed here, so a tab
running `pi` is the mechanism, and it is enough: start one per unit of work, read
them, start more.

```bash
herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label <label> --no-focus
herdr pane rename <pane_id> <label>
herdr pane run <pane_id> "unsetopt correct correct_all"
herdr pane run <pane_id> "<the long command>"
```

`tab create` prints the new `pane_id` at `.result.root_pane.pane_id`.

- **Label the pane as well as the tab.** `--label` names the tab only; the pane
  stays unlabelled until you rename it, and an unlabelled pane is one Huey cannot
  identify. Use `pr-<n>` for reviews.
- **`unsetopt correct correct_all` goes first, as its own command.** Once a
  `.wrangler` directory exists, zsh offers to "correct" `wrangler` to `.wrangler`
  and silently swallows the line. `setopt | grep -c correct` prints `0` when it
  worked.
- **Run pi interactively.** Pass the prompt as a plain argument and `-n` to name
  the session, so the pane shows thinking and tool calls as they happen. `-p` is
  the trap: it buffers everything until the run ends, so a review pane sits blank
  for minutes and looks hung.
- **Fire it and move on.** Never `sleep` on a tab. Do the next piece of work and
  read the pane when you have a reason to:

  ```bash
  herdr pane read <pane_id> --source recent-unwrapped --lines 40
  herdr pane list --workspace "$HERDR_WORKSPACE_ID"
  ```

- **Check it posted.** A review is done when `fabrika review verdicts <n>` lists a
  `review-code` and a `review-doc` verdict for the PR's current head, not when the
  pane goes quiet. Close the tab after that.

## Driver: starting a review

The reviewer is a Codex model, running the fabrika `review` skill, posting as
`nothueypov`. Three requirements, each one flag:

```bash
herdr pane run <pane_id> 'export GH_TOKEN=$(gh auth token --user nothueypov)
export FABRIKA_GLOBAL_WARNING_DISABLED=1
pi --provider openai-codex --model gpt-5.6-sol \
   --skill /Users/huey/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/review \
   -n "review PR <n>" "review PR #<n>"'
```

One tab per pull request. They run at the same time.

- `GH_TOKEN` makes the review a second signature rather than the author approving
  their own work. `gh` has two accounts: `hueypov` (active, the author) and
  `nothueypov` (the reviewer).
- The `review` skill is the reviewer's whole behaviour. The `reviewer` agent shell
  in `dist/agents/reviewer.md` adds nothing to it — its own text says so.
- `FABRIKA_GLOBAL_WARNING_DISABLED=1` silences the no-local-install notice from
  the global `fabrika` CLI.

The skill is the review process. A hand-rolled wrapper around `codex exec` existed
here once and was deleted: it drifted from the skill and hid the reviewer's output
in a temp file.

## Other fabrika skills

Same pattern, swap the skill directory:

```bash
ls /Users/huey/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/
```

pi auto-discovers all of them, so a session can be asked for a skill by name.
Passing `--skill` preloads it, which makes a tab a dedicated worker for that skill
rather than a general agent that might choose something else.

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
sibling directories. Work branches serially in this one checkout, and clean up
anything you leave behind.
