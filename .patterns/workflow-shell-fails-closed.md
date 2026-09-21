# Workflow shell fails closed

The shape of a `run:` block whose exit status is a verdict; applies to every shell
step under `.github/workflows/` that scans something and reports clean or red.

## The shape

The scan step in [`leak-guard.yml`](../.github/workflows/leak-guard.yml) is the
reference. It reads the changed-file list, refuses when that read fails, treats an
empty list as a fact, and only then hands the list to the scanner:

```sh
set -uo pipefail
git fetch --no-tags origin "$BASE_REF"
if ! diff_out="$(git diff --name-only --diff-filter=ACMR "origin/$BASE_REF...HEAD")"; then
  echo "::error::could not diff origin/$BASE_REF...HEAD — refusing to report clean over nothing."
  exit 1
fi
changed=()
while IFS= read -r f; do [ -n "$f" ] && changed+=("$f"); done <<< "$diff_out"
if [ "${#changed[@]}" -eq 0 ]; then
  echo "No changed files — nothing to scan."
  exit 0
fi
pnpm dlx @kampus/fabrika-cli@0.7.1 guard leak-guard scan "${changed[@]}"
```

Four rules, each visible above:

1. **A read the verdict rests on is checked explicitly**, in an `if`, and its
   failure exits non-zero with a named `::error::`. A scan over a list that could not
   be read is not clean; it is unknown, and unknown is red.
2. **An empty scope is a fact and exits 0** with a message saying so. A pull request
   that changes no scannable file is different from a diff that could not be
   computed, and the two must not look alike.
3. **The list is tested for emptiness before it is expanded into arguments.** On
   macOS bash 3.2 an empty array expands to one empty-string argument, so a scanner
   handed `""` reads a file named nothing; the `-eq 0` gate keeps that path closed
   on every bash.
4. **The status a later line depends on is read where the command runs.** GitHub
   runs an unspecified `run:` block under `bash -e`, and `set -uo pipefail` does not
   turn `-e` off. A non-zero command therefore aborts the step at that line, so a
   `code=$?` on the next line never executes. Read the status inside an `if`, as
   rule 1 does, or write `set +e` first.

## When this applies

Every `run:` block that produces a verdict: today the scan steps of
[`leak-guard.yml`](../.github/workflows/leak-guard.yml) and
[`gitleaks.yml`](../.github/workflows/gitleaks.yml). An install step that only
fetches a pinned binary may keep `set -euo pipefail`, because any failure there is
the right red and nothing after it needs the status. Adapted from phoenix's
[shell shape](https://github.com/kamp-us/phoenix/blob/main/.patterns/skill-script-shell-shape.md)
and [stdout contract](https://github.com/kamp-us/phoenix/blob/main/.patterns/skill-script-io-contract.md)
patterns, kept to the rules lexema's own workflows exhibit.

## Why it is not obvious

A green gate is trusted precisely because it is green, so the cheapest mistake is a
step that goes green over nothing: a failed `git diff` yields an empty list, an empty
list yields "nothing to scan", and the scanner never runs. Rule 1 and rule 2 exist to
keep "empty" and "unreadable" on different exit codes.

Rule 4 is the one a careful reader still gets wrong, because the YAML never shows
the `-e`. The tail of `gitleaks.yml` records the scanner's status into `code=$?` and
branches on it to print a specific remediation. With `-e` inherited from the runner,
an exit 3 aborts the step before that line, so the step is red for the right reason
and the message is dead code. The gate is still fail-closed; only the explanation is
lost, which is why it is filed as a follow-up ([#43](https://github.com/hueypov/lexema/issues/43)) rather than a bug in the verdict.
