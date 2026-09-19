# Working on Lexema as an agent

Read [`CLAUDE.md`](CLAUDE.md) first — it holds the product rules. This file holds
the operating rules: which model does what, and how to actually run it.

Every command here was run in this repository before being written down. If one
stops working, fix it here rather than inventing a replacement somewhere else.

## Long-running work goes in its own herdr pane

Anything that takes minutes — a review, a dev server, a full import, a benchmark —
runs in a labelled pane, never in the shell you are holding. A blocked shell stops
you answering Huey, and he cannot see what you started.

```bash
herdr pane split --current --direction right --ratio 0.6 --cwd "$PWD" --no-focus
herdr pane rename <pane_id> <label>
herdr pane run <pane_id> "unsetopt correct correct_all"   # see the zsh note below
herdr pane run <pane_id> "<the long command>"
```

**Fire it and move on.** The pane keeps running whether or not you are watching.
Do not `sleep` waiting on it — go do the next piece of work and read the pane when
you have a reason to:

```bash
herdr pane read <pane_id> --source recent-unwrapped --lines 40
herdr pane list --workspace "$HERDR_WORKSPACE_ID"
```

Close the pane when the work in it is finished.

**Panes are how you delegate.** pi's `subagent` tool is not installed here
(`~/.pi/agent/extensions/` holds only `herdr-agent-state.ts`), so there is no
in-process way to spawn a named agent. A pane running `pi` is the delegation
mechanism, and it is enough: you can start one, read its output, and start another.

**zsh autocorrect eats commands in panes.** Once a `.wrangler` directory exists,
zsh offers to "correct" `wrangler` to `.wrangler` and silently swallows the line.
Send `unsetopt correct correct_all` as its own pane command first, and confirm with
`setopt | grep -c correct` returning `0`.

## Models

pi is the agent runner. Two providers are authenticated here — check with
`pi auth check --provider <name>`:

| Provider | Use it for |
| --- | --- |
| `openai-codex` | reviewing |
| `anthropic` | building and repairing |

Reviewing runs on Codex, building and repairing run on Claude, and the roles never
swap. That is [`.decisions/0005`](.decisions/0005-codex-reviews-claude-builds.md);
this file only records how to run it.

## Reviewing a pull request

The reviewer is a Codex model, running the fabrika `review` skill, posting as
`nothueypov`. Those are three separate requirements and each is one flag:

```bash
export GH_TOKEN=$(gh auth token --user nothueypov)
export FABRIKA_GLOBAL_WARNING_DISABLED=1

pi --provider openai-codex --model gpt-5.6-sol \
   --skill /Users/huey/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/review \
   --no-session \
   -p "review PR #<n>"
```

Run it in a pane, per the rule above.

- `GH_TOKEN` is what makes the review a second signature rather than the author
  approving their own work. `gh` has two accounts: `hueypov` (active, the author)
  and `nothueypov` (the reviewer).
- The fabrika `review` skill is the reviewer's whole behaviour. The `reviewer`
  agent shell in `dist/agents/reviewer.md` adds nothing to it — its own text says
  so — which is why preloading the skill is the same thing as spawning the shell.
- The skill drives the `fabrika` CLI, which works here against the global install.

**Do not write a review script.** A hand-rolled wrapper around `codex exec` existed
in this repository once and was deleted: it duplicated the fabrika skill, drifted
from it, and hid the reviewer's output in a temp file so the pane looked dead. The
skill is the review process. Use it.

## Other fabrika skills

The same pattern runs any of them — swap the skill directory:

```
/Users/huey/.pi/agent/npm/node_modules/@kampus/fabrika-pi/dist/skills/
```

`build`, `review`, `review-ui`, `ship`, `triage`, `operate`, `adr`, `report`,
`handoff` and the rest live there. Reach for one before writing a script that does
the same job.

## Package manager

`pnpm`, always. Never create `package-lock.json`. See
[`.decisions/0002`](.decisions/0002-pnpm-is-the-package-manager.md).

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
```

`npx` resolves a different `wrangler` and triggers a Cloudflare login prompt — use
`pnpm exec wrangler`.

## Merging

You never merge. Huey reviews and merges every pull request himself, and green CI
is not approval. See [`.decisions/0001`](.decisions/0001-human-merges-every-pull-request.md).

## One checkout

All work happens in `/Users/huey/Documents/projects/lexema`. No git worktrees, no
sibling directories. Work branches serially in this one checkout, and clean up
anything you leave behind.
