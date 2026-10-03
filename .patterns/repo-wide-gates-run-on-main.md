# A repo-wide gate runs on push to main too

Which trigger set a workflow carries is decided by the scope its guard scans; applies
to every workflow under `.github/workflows/` that runs on pull requests.

## The shape

A gate whose guard scans the whole tree runs on the merged result as well as on
the pull request and on each merge queue entry, and cancels an in-flight run only
off `main`:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  merge_group:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

That is [`ci.yml`](../.github/workflows/ci.yml). Its four gated jobs read the
whole tree: `check` and `test-web` run the typecheck and the unit tests, `d1`
builds both databases in a local D1, and `validate the ADR corpus` reads every
record in `.decisions/` for a duplicate id. They live in one workflow because a
job can only `needs:` a job of its own workflow, and one job needs them all.

No trigger carries a `paths` filter. A `changes` job reads the files the change
touches, with no install, and sets one output per path set; each gated job
`needs: changes` and runs only when its output is `true`. The range is the pull
request's base to its head, `merge_group.base_sha` to `merge_group.head_sha` on a
queue run, and `before` to the pushed commit on `main`. When it cannot read the
range, it marks every gated job as needed, never none. Each path set is what its
job reads: `d1` the schemas and every source directory its seed, sample-row check
and key CLI import, `validate the ADR corpus` the corpus and the guard's version,
and `check` and `test-web` everything but Markdown, save the Markdown files a
unit test reads (#521). A set that leaves out a file its job reads stops checking
the change that can break it, so a new input joins the set in the same change.

```yaml
ci-required:
  if: always()
  needs: [changes, check, test-web, d1, validate]
```

`ci-required` is the one context the merge queue requires from `ci.yml` (#535).
It always runs, and fails when `changes` failed or when a job `changes` marked as
needed did not conclude `success`. A required check that never runs holds a pull
request forever, and a skipped job passes a required check, so neither a
workflow-level `paths` filter nor a gated job can be the required context.

A gate whose guard reads the pull request's diff runs on `pull_request` and
`merge_group`, never `push: main`, and says so in a comment at its `on:` block.
[`secrets.yml`](../.github/workflows/secrets.yml) scans
`git diff origin/<base>...HEAD`, or `<merge_group.base_sha>...HEAD` on a merge
queue run, and on `main` there is no such diff to read. Its
`cancel-in-progress` is a plain `true`, because there is no `main` run to protect.
It carries no `paths` filter, so every pull request head has at least one check.

## When this applies

Every workflow that carries a `pull_request` trigger. The gates here today
classify as:

| Scope | Triggers | Workflows |
|---|---|---|
| repo-wide | `pull_request`, `merge_group` and `push: main`, gated behind `changes` and `ci-required` | `ci.yml` |
| the PR diff | `pull_request` and `merge_group`, with the comment | `secrets.yml` |

A new repo-wide gate is a job in `ci.yml` with its own path set in `changes`,
and joins the `needs` of `ci-required`.

`dictionary-plan.yml` also runs on `pull_request` alone, against the shared
dictionary rather than the tree, and cancels a superseded run with a plain `true`.

A workflow with no `pull_request` trigger at all, such as a schedule or an issue
event, is out of scope. Adapted from
[phoenix's pattern of the same name](https://github.com/kamp-us/phoenix/blob/main/.patterns/repo-wide-gates-run-on-main.md),
where the audit that produced the rule lives, and from phoenix's
[`ci-required`](https://github.com/kamp-us/phoenix/blob/main/.github/workflows/ci.yml).

## Why it is not obvious

Two pull requests can each be green alone and red together: one renames a record,
the other cites the old name, and a `pull_request`-only gate never evaluates the
pair. The break shows up on the next unrelated pull request, whose author did not
cause it, while the author who did never sees a red. A `push: main` run attributes
the break to the commit that landed it. A merge queue that requires
`ci-required` prevents the landing: it runs `ci.yml` on the queued result and
merges only when `ci-required` passes there (#532, #535).

The `cancel-in-progress` expression is the part a copy gets wrong. A plain `true`
on a repo-wide gate cancels the `main` run when the next commit lands, which
silently skips the gate on the earlier commit. The expression keeps `main` runs
alive and still cancels superseded pull-request runs.
