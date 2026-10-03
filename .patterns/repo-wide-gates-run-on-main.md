# A repo-wide gate runs on push to main too

Which trigger set a workflow carries is decided by the scope its guard scans; applies
to every workflow under `.github/workflows/` that runs on pull requests.

## The shape

A gate whose guard scans the whole tree carries both triggers, and cancels an
in-flight run only off `main`:

```yaml
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

That is [`decisions-index.yml`](../.github/workflows/decisions-index.yml): the
duplicate-id check reads every record in `.decisions/`, so it runs on the merged
result as well as on the pull request. [`ci.yml`](../.github/workflows/ci.yml) and
[`d1.yml`](../.github/workflows/d1.yml) carry both triggers and the same block for
the same reason, since the typecheck, the unit tests and the local D1 build read
the whole tree.

A `paths` filter narrows which changes start a run; it sits under both triggers
alike, so `main` is checked on exactly the changes a pull request is. Every one of
these gates checks something a matching change can break: `decisions-index.yml`
runs on `.decisions/` and the guard's version, `d1.yml` on the schemas and every
source directory its seed, sample-row check and key CLI import, and `ci.yml` on
everything but Markdown, save the Markdown files a unit test reads (#521). A
filter that leaves out a file its job reads stops checking the change that can
break it, so a new input joins the list in the same change.

A gate whose guard reads the pull request's diff runs on `pull_request` and
`merge_group`, never `push: main`, and says so in a comment at its `on:` block.
[`secrets.yml`](../.github/workflows/secrets.yml) scans
`git diff origin/<base>...HEAD`, or `<merge_group.base_sha>...HEAD` on a merge
queue run, and on `main` there is no such diff to read. Its
`cancel-in-progress` is a plain `true`, because there is no `main` run to protect.
It carries no `paths` filter, so every pull request head has at least one check.

## When this applies

Every workflow that carries a `pull_request` trigger. The four gates here today
classify as:

| Scope | Triggers | Workflows |
|---|---|---|
| repo-wide | `pull_request` and `push: main` | `ci.yml`, `d1.yml`, `decisions-index.yml` |
| the PR diff | `pull_request` and `merge_group`, with the comment | `secrets.yml` |

`dictionary-plan.yml` also runs on `pull_request` alone, against the shared
dictionary rather than the tree, and cancels a superseded run with a plain `true`.

A workflow with no `pull_request` trigger at all, such as a schedule or an issue
event, is out of scope. Adapted from
[phoenix's pattern of the same name](https://github.com/kamp-us/phoenix/blob/main/.patterns/repo-wide-gates-run-on-main.md),
where the audit that produced the rule lives.

## Why it is not obvious

Two pull requests can each be green alone and red together: one renames a record,
the other cites the old name, and a `pull_request`-only gate never evaluates the
pair. The break shows up on the next unrelated pull request, whose author did not
cause it, while the author who did never sees a red. A `push: main` run attributes
the break to the commit that landed it. It does not prevent the landing; that would
need a merge queue and a required check, which this repository does not have.

The `cancel-in-progress` expression is the part a copy gets wrong. A plain `true`
on a repo-wide gate cancels the `main` run when the next commit lands, which
silently skips the gate on the earlier commit. The expression keeps `main` runs
alive and still cancels superseded pull-request runs.
