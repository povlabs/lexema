# Development seed

`pnpm run seed:dev` builds a small local D1 release directly from the committed
content fixtures under [`fixtures/content/it`](../fixtures/content/it). It does
not need `it-extract.jsonl.gz`, a data-repository checkout, or a SQLite working
database.

The fixture contract is the `FIXTURE_WORDS` list in
[`src/import/seedDev.ts`](../src/import/seedDev.ts): it contains fifty words,
including the required spot checks and awkward records from the local
development ruling on #81. The seeder fails with the missing word's name when a
listed file is absent, and also rejects unlisted JSON files. The fixture test
keeps the list and files in sync.

## Paths and environment

| Variable | Default | Meaning |
|---|---|---|
| `SEED_RELEASE` | `it-dev` | release id written to D1 |
| `SEED_SQL` | `.data/dev.sql` | generated schema and data SQL |
| `SEED_D1_PERSIST_TO` | `.data/dev-d1` | Wrangler's separate local D1 persistence directory |

The command clears only `SEED_D1_PERSIST_TO`, generates schema-respecting SQL
(parent tables before children), then runs `wrangler d1 execute --local`.
Repeating it rebuilds the same local release. The default deliberately does not
use `web/.wrangler`; do not point it at the demo server's D1.

The SQL preserves source words, forms, senses, labels, grammar claims and
form-of edges. `source_record_json` is a deterministic reconstruction of those
content-file fields, because the original archive line is not part of a
content-file release. The content files and their source line references remain
the release source.

## Offline conversion

A real release is still converted from the archive with:

```sh
pnpm run convert -- --input it-extract.jsonl.gz --output content \
  --release-id it-<release-id>
```

Conversion uses the archive parser and writes content files; it does not write
SQLite. Production release loading is outside this development seed.
