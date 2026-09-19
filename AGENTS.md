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

The rest of this file is how to operate: which model does what, and how to run it.
Every command below was run in this repository before being written down. If one
stops working, fix it here rather than inventing a replacement somewhere else.

## Models

pi is the agent runner. What works here was checked by running it, and
`pi auth check` is **not** a reliable answer — it reports `pi-claude` as
`not_ready` and `anthropic` as `ready`, and the truth is the other way round:

| Provider | Model | Works? | Use it for |
| --- | --- | --- | --- |
| `pi-claude` | `claude-opus-5` | yes | building, repairing |
| `openai-codex` | `gpt-5.6-sol` | yes | reviewing |
| `anthropic` | — | **no** | — |

`--provider anthropic` fails with `400 … Third-party apps now draw from your extra
usage`. Use `pi-claude`.

Reviewing runs on Codex, building and repairing run on Claude, and the roles never
swap. That is [`.decisions/0005`](.decisions/0005-codex-reviews-claude-builds.md);
this file only records how to run it.

**Watch the Codex budget.** The pi status line shows it (`Codex #2 · 55% · 5h`).
Reviews are the only thing spending it, and it has run out mid-run before.

## Long-running work goes in its own herdr tab

Anything that takes minutes — a review, a dev server, an import, a benchmark —
runs in its own labelled tab, never in the shell you are holding. A blocked shell
stops you answering Huey, and he cannot see what you started.

```bash
herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label <label>
herdr pane rename <pane_id> <label>
herdr pane run <pane_id> "unsetopt correct correct_all"
herdr pane run <pane_id> "<the long command>"
```

`tab create` prints the new `pane_id` at `.result.root_pane.pane_id`.

**Label the pane as well as the tab.** `--label` on `tab create` names the tab
only; `herdr pane list` still shows the pane unlabelled until you rename it, and
an unlabelled pane is one Huey cannot identify.

**Fire it and move on.** The tab keeps running whether or not you are watching.
Never `sleep` waiting on it — start it, go do the next piece of work, and read it
when you have a reason to:

```bash
herdr pane read <pane_id> --source recent-unwrapped --lines 40
herdr pane list --workspace "$HERDR_WORKSPACE_ID"
```

Close the tab when the work in it is finished.

**A tab is how you delegate.** pi's `subagent` tool is not installed here
(`~/.pi/agent/extensions/` holds only `herdr-agent-state.ts`), so there is no
in-process way to spawn a named agent. A tab running `pi` is the mechanism, and it
is enough: start one per unit of work, read them, start more.

**zsh autocorrect eats commands.** Once a `.wrangler` directory exists, zsh offers
to "correct" `wrangler` to `.wrangler` and silently swallows the line. Send
`unsetopt correct correct_all` as its own pane command first, and confirm with
`setopt | grep -c correct` returning `0`.

## Run pi interactively in a pane — never with `-p`

This is the trap worth knowing. `pi -p` is non-interactive print mode: it buffers
everything and emits it only when the run ends. A review takes minutes, so the pane
sits blank the whole time and looks hung.

Drop `-p` and pi draws its normal TUI in the pane — thinking, tool calls and output
appear as they happen. Pass the prompt as a plain argument, and `-n` to name the
session so the pane footer says what it is doing.

## Reviewing a pull request

The reviewer is a Codex model, running the fabrika `review` skill, posting as
`nothueypov`. Three separate requirements, each one flag:

```bash
herdr pane run <pane_id> 'export GH_TOKEN=$(gh auth token --user nothueypov)
export FABRIKA_GLOBAL_WARNING_DISABLED=1
pi --provider openai-codex --model gpt-5.6-sol \
   --skill /Users/huey/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/review \
   -n "review PR <n>" "review PR #<n>"'
```

One tab per pull request. They run at the same time and you read them as they
finish.

- `GH_TOKEN` is what makes the review a second signature rather than the author
  approving their own work. `gh` has two accounts: `hueypov` (active, the author)
  and `nothueypov` (the reviewer).
- The fabrika `review` skill is the reviewer's whole behaviour. The `reviewer`
  agent shell in `dist/agents/reviewer.md` adds nothing to it — its own text says
  so — which is why preloading the skill is the same thing as spawning the shell.
- The skill drives the `fabrika` CLI, which works here against the global install.
  `FABRIKA_GLOBAL_WARNING_DISABLED=1` silences the no-local-install notice.

**Do not write a review script.** A hand-rolled wrapper around `codex exec` existed
here once and was deleted: it duplicated the fabrika skill, drifted from it, and
sent the reviewer's output to a temp file so the pane looked dead. The skill is the
review process. Use it.

## Other fabrika skills

Same pattern, swap the skill directory:

```bash
ls /Users/huey/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/
```

`build`, `review`, `review-ui`, `ship`, `triage`, `operate`, `adr`, `report`,
`handoff` and the rest live there. Reach for one before writing a script that does
the same job.

pi also auto-discovers every one of them at startup, so a pi session can be asked
for a skill by name without `--skill`. Passing `--skill` preloads it, which is what
makes a tab a dedicated reviewer rather than a general agent that might choose
something else.

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
