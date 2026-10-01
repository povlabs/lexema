# The two-step typecheck

How the Worker's typecheck generates its binding types before it checks, and why
the repository has two typechecks; applies to `package.json` scripts, the
tsconfigs and the CI `check` job.

Adapted from phoenix's [typecheck-two-step](https://github.com/kamp-us/phoenix/blob/main/.patterns/typecheck-two-step.md).

## The shape

There are two typecheck scripts, and CI runs both
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)):

| Script | Checks | tsconfig |
|---|---|---|
| `pnpm run typecheck` | `src/` and `test/`, against Node's types | [`tsconfig.json`](../tsconfig.json) |
| `pnpm --filter @lexema/web typecheck` | `web/` and the `src/` modules it imports | [`web/tsconfig.json`](../web/tsconfig.json) |

The Worker's is two steps, in this order
([`web/package.json`](../web/package.json)):

```json
"typecheck": "wrangler types --env-file typecheck.env && tsc --noEmit"
```

1. **Generate.** `wrangler types` writes `web/worker-configuration.d.ts` from
   [`web/wrangler.jsonc`](../web/wrangler.jsonc): the bindings, vars and the
   `process.env` keys a Worker sees. The file is ignored by Git, and
   `web/tsconfig.json` names it in `types`, so `tsc` cannot run without it.
2. **Check.** `tsc --noEmit` over the files `web/tsconfig.json` includes.

`--env-file typecheck.env` points the generator at
[`web/typecheck.env`](../web/typecheck.env), which is empty on purpose. Without
it, `wrangler types` reads secret names from a local `web/.dev.vars` and types
them as required strings, so a laptop with that file gave a different answer from
CI ([#295](https://github.com/hueypov/lexema/issues/295)).

## When this applies

Changing a typecheck script, a tsconfig, `web/wrangler.jsonc`, or a `src/` module
that `web/tsconfig.json` includes (`src/lookup`, `src/italian`, `src/api`,
`src/accounts`, `src/db/app`). Those modules are checked twice, once under each
tsconfig, so a change there runs both scripts. A new binding goes in
`wrangler.jsonc`, never typed by hand. The root typecheck has no generate step: code
under `src/` declares the slice of a binding it uses itself, as
[`src/lookup/database.ts`](../src/lookup/database.ts) does for D1, and never reads
the generated types.

## Why it is not obvious

`tsc --noEmit` alone looks like the whole check. Run in `web/` without the first
step, it reads whatever `worker-configuration.d.ts` the last run left, or fails
on a missing file, so it answers for an older `wrangler.jsonc`. Committing the
generated file looks like the fix, but it then drifts from `wrangler.jsonc` with
nothing to catch it. Dropping `--env-file` looks harmless because CI has no
`.dev.vars` and stays green; only laptops break.

> Derived from `wrangler@4.135.0` — re-verify on pin bump.
