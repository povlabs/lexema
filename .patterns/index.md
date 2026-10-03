# Lexema patterns

This is the task-to-pattern map for the source adapter, the resolver and the
tooling around them. Read the rows that match the change. A row routes you to its
owning guide; it does not copy that guide's rules. Read representative code and
tests alongside the guide.

## Source adapter

For `src/source/` and `src/italian/`, the code that reads the Kaikki file and turns
records into candidates.

| Pattern | Topic / scope | Read when |
|---|---|---|
| [source-record-admission-and-provenance.md](./source-record-admission-and-provenance.md) | Admitting a record from the Kaikki file and attaching provenance to every derived value | Reading the source file, adding a derived field to a candidate, or deciding what a provenance ref must carry |

## CI workflows

For `.github/workflows/`. Adapted from phoenix's pattern library where lexema's own
workflows already show the same shape; each doc cites the workflow here that does.

| Pattern | Topic / scope | Read when |
|---|---|---|
| [repo-wide-gates-run-on-main.md](./repo-wide-gates-run-on-main.md) | Which trigger set a workflow carries, decided by the scope its guard scans | Adding a CI workflow or a gated job in `ci.yml`, or changing a workflow's triggers, path sets or concurrency block |
| [workflow-shell-fails-closed.md](./workflow-shell-fails-closed.md) | The shape of a run: block whose exit status is a verdict | Writing or editing a shell step that scans something and reports clean or red |

## Dictionary database

For `src/lookup/`, `src/import/` and `src/db/schema.sql`: how the dictionary is
read and how its stored rows change.

| Pattern | Topic / scope | Read when |
|---|---|---|
| [d1-lookup-starts-from-the-record.md](./d1-lookup-starts-from-the-record.md) | Join order and full-key index probes for every lookup that reads through servedBy | Adding or changing a lookup statement in src/lookup/, or an index on lookup_form or form_of_edge |
| [data-fixes-are-named-versioned-rules.md](./data-fixes-are-named-versioned-rules.md) | Fixing stored dictionary rows with a named, versioned rule the seed and a one-off update both apply | Changing what the dictionary stores from a release, or adding a pnpm command that rewrites or hides rows |

## Accounts

For `src/accounts/` and the Worker routes that sign in, read a session or bill.

| Pattern | Topic / scope | Read when |
|---|---|---|
| [better-auth-with-plugins-on-d1.md](./better-auth-with-plugins-on-d1.md) | Building better-auth per request over the app tables, with one plugin set per builder | Changing sign-in, sessions or billing through better-auth, or adding a better-auth plugin |

## Web pages

For `web/components/`, `web/app/` and the words the Worker answers with.

| Pattern | Topic / scope | Read when |
|---|---|---|
| [base-ui-widgets-on-role-tokens.md](./base-ui-widgets-on-role-tokens.md) | Interactive parts from Base UI, styled with role-token classes, with no hand-built or no-JavaScript copy | Adding or changing a tab, dialog, menu, collapsible or any other widget, or picking a component's classes |
| [error-copy-law.md](./error-copy-law.md) | The words a reader sees when something fails, is refused or is not found | Writing an error, refusal or not-found message, or catching a failure in a route |

## Tests and fixtures

For `test/`, `web/test/` and `fixtures/`.

| Pattern | Topic / scope | Read when |
|---|---|---|
| [unconditional-test-assertions.md](./unconditional-test-assertions.md) | Asserting a union's case or a loop's reach so no assertion is skipped silently | Writing a test over an outcome or kind union, or asserting inside a loop or an if |
| [golden-real-payload-fixtures.md](./golden-real-payload-fixtures.md) | Real archive lines and Wiktionary pages, committed verbatim, as test input | Adding a test input built from a Kaikki record or a Wiktionary page, or a regression case |

## Tooling and agent lanes

For the typecheck scripts, the git hooks and agent worktrees.

| Pattern | Topic / scope | Read when |
|---|---|---|
| [typecheck-two-step.md](./typecheck-two-step.md) | The Worker typecheck generates binding types from wrangler.jsonc, then runs tsc; the root has its own | Changing a typecheck script, a tsconfig, wrangler.jsonc, or a src/ module web/ imports |
| [worktree-agent-constraints.md](./worktree-agent-constraints.md) | What a linked worktree gets from the post-checkout hook, and what it shares with the main checkout | Starting work in an agent worktree, or changing lefthook.yml or the worktree setup scripts |

## When to add a new pattern doc here

A pattern may enter through either source-backed path:

- **Current shape:** in-repo source and tests demonstrate a reusable shape that
  future agents need. Cite representative paths and state where the shape stops
  applying; no fixed call-site count is an admission prerequisite.
- **Prospective shape:** a cited binding decision names the technology or shape
  before its first implementation, and authoritative dependency source or docs
  ground every rule. State the intended scope without inventing current call
  sites.

Both paths must also clear the same two bars:

- The pattern is **non-obvious** — it codifies a choice rather than narrating code
  or generic framework guidance.
- A future agent would otherwise **invent a foreseeable worse version**.

Do not add obvious descriptions, generic framework advice, speculative or
undocumented conventions, intuition-only rules, one-off implementation details, or
migration steps. Every claim must trace to the cited current source and tests or to
authoritative dependency source; if that evidence is unusable, decline rather than
fall back to intuition. The *why* behind a shape belongs in `.decisions/`, a term's
meaning in `.glossary/`, and a dated measurement in `reports/`.
