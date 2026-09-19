# Driving work from a pi session

How-to for the **driver**: the session talking to Huey that hands work out. A
worker started in a pane with one job never needs this file (see
[`AGENTS.md`](../AGENTS.md), "Which role are you in?").

Every command here was run in this repository before being written down. If one
stops working, fix it here.

## One tab per unit of work

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

- **Close the tab** once its work is done and checked.

## Starting a review

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
- **A review is done when it posted**, not when the pane goes quiet:
  `fabrika review verdicts <n>` lists a `review-code` and a `review-doc` verdict at
  the PR's current head.
- **Hold pushes while a review runs.** A new head makes fabrika refuse the verdict
  and the reviewer starts over at the new head, spending Codex budget twice.
- **Push with git, not the GitHub contents API.** A commit made through the API
  got no CI run here, and the reviewer then reports CI as unknown.

**Watch the Codex budget.** The pi status line shows it (`Codex #2 · 55% · 5h`).
Reviews are the only thing spending it, and it has run out mid-run before.

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
