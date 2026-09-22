# Development seed

`pnpm run seed:dev` ([`src/import/seedDev.ts`](../src/import/seedDev.ts)) streams the
committed fixture through the archive parser, writes D1 SQL, and applies it with
Wrangler. It does not create a converted content tree or an intermediate
SQLite database. The same path can seed a release archive with `SEED_INPUT`.

## Environment and paths

| Variable | Default | Meaning |
|---|---|---|
| `SEED_INPUT` | `fixtures/dev-seed.jsonl` | plain JSONL fixture; a `.jsonl.gz` archive is also accepted |
| `SEED_RELEASE` | `it-dev` | release id written |
| `SEED_SQL` | `.data/dev.sql` | generated SQL text |
| `SEED_STATE` | `.data/seed-state` | isolated Wrangler D1 persist directory |

The demo's `web/.wrangler` directory is never touched. The seed clears only
`SEED_STATE`, so repeated runs rebuild the same local database. The fixture is
about fifty source records and includes every required word plus every declared
form-of target, including `andare` for `andavano`. A missing required word or
fixture target stops the run with that word's name.

## What is emitted

For each admitted Italian archive record, the seeder preserves the raw JSONL
line and emits source, lookup, form-of, sense, and grammar rows. `forms[].source`
is bound to its own `lookup_form.form_source` column. Form-of rows retain word
keys and do not resolve a target id; the schema's `form_of_candidate` view keeps
all matching candidates and dangling edges.

SQL is emitted in parent-before-child table order. INSERT statements are batched
by a 64 KiB byte budget, matching the limit used by the previous SQL exporter.
The release is marked complete only after all rows are present. Rejections are
written beside the generated SQL as `.rejections.tsv`.

The archive is the only production input. This development fixture exists so a
fresh clone can seed without `it-extract.jsonl.gz` or a data-repository checkout.
Loading a complete release into deployed D1 remains #18.
