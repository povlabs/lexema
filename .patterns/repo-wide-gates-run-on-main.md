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
result as well as on the pull request. [`ci.yml`](../.github/workflows/ci.yml)
carries both triggers for the same reason, since the typecheck and the unit tests
read the whole tree; it declares no `concurrency` block, which never cancels
anything and is the other safe choice.

A gate whose guard reads the pull request's diff stays `pull_request`-only and says
so in a comment at its `on:` block.
[`leak-guard.yml`](../.github/workflows/leak-guard.yml) and
[`gitleaks.yml`](../.github/workflows/gitleaks.yml) both scan
`git diff origin/<base>...HEAD`, and on `main` there is no such diff to read. Their
`cancel-in-progress` is a plain `true`, because there is no `main` run to protect.

## When this applies

Every workflow that carries a `pull_request` trigger. The four here today classify
as:

| Scope | Triggers | Workflows |
|---|---|---|
| repo-wide | `pull_request` and `push: main` | `ci.yml`, `decisions-index.yml` |
| the PR diff | `pull_request` only, with the comment | `gitleaks.yml`, `leak-guard.yml` |

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
