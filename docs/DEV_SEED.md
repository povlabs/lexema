# Development seed

`pnpm run seed:dev` ([`src/import/seedDev.ts`](../src/import/seedDev.ts)) streams the
committed fixture through the archive parser, writes D1 SQL in numbered parts, and
applies them in order with Wrangler. The same path seeds a full release archive
with `SEED_INPUT`.

## Environment and paths

| Variable | Default | Meaning |
|---|---|---|
| `SEED_INPUT` | `fixtures/dev-seed.jsonl` | plain JSONL fixture; a `.jsonl.gz` archive is also accepted |
| `SEED_RELEASE` | `it-dev` for the fixture; `it-` and the first 8 hex digits of the archive's SHA-256 for a `.jsonl.gz` | release id written |
| `SEED_SQL` | `.data/dev-sql` | directory for the SQL parts and `rejections.tsv` |
| `SEED_STATE` | `.data/seed-state` | isolated Wrangler D1 persist directory |
| `SEED_PART_BYTES` | `67108864` (64 MiB) | byte ceiling for one SQL part |

The demo's `web/.wrangler` directory is never touched. The seed clears only
`SEED_STATE`, so repeated runs rebuild the same local database. Nothing else is
written to: no other state directory, and in `SEED_SQL` only its own
`part-NNN.sql` files and `rejections.tsv`. Point `SEED_STATE` at an existing
database only when you mean to replace it. The fixture covers
Huey's fifty required words and their `form_of` closure: 83 source records across
52 words, including `andare` for `andavano`. A missing required word or fixture
target stops the run with that word's name.

## What is emitted

For each admitted Italian archive record, the seeder preserves the raw JSONL
line and emits source, lookup, form-of, sense, and grammar rows. `forms[].source`
is bound to its own `lookup_form.form_source` column. Form-of rows retain word
keys and do not resolve a target id; the schema's `form_of_candidate` view returns
every matching headword candidate, with no row for a dangling target. The original
edge remains in `form_of_edge`.

SQL is emitted in parent-before-child table order. INSERT statements are batched
by a 64 KiB byte budget, matching the limit used by the previous SQL exporter.
The release is marked complete only after all rows are present. Rejections are
written to `rejections.tsv` in `SEED_SQL`.

## Parts

Wrangler reads a `--file` into one JavaScript string, and Node caps a string at
0x1fffffe8 characters, about 512 MiB. A full release is about 1 GB of SQL, so the
seeder writes `part-001.sql`, `part-002.sql`, and so on, each at most
`SEED_PART_BYTES`, and runs `wrangler d1 execute --file` once per part, in order.
A part ends only between two statements; a statement is never split, and one
larger than the ceiling stops the seed with its size. Starting a seed removes
the parts an earlier seed left in `SEED_SQL`.

The fifty-word fixture is 1.9 MB of SQL, so it is one part, byte for byte the
single file the seeder wrote before parts existed.

After the last part, the seeder counts every table in the loaded database and
stops with an error if any count differs from the generated SQL.

The 64 MiB default keeps Wrangler's memory down for little extra time;
[the measurements](../reports/2026-09-23-full-release-seed-measurements.md)
compare 32, 64 and 128 MiB.

## Seed the full release

```sh
SEED_INPUT=it-extract.jsonl.gz \
SEED_SQL=.data/full-sql \
SEED_STATE=.data/full-state \
pnpm run seed:dev
```

On an Apple M1 Pro with 16 GB this takes about seven minutes (409 s) and peaks at
about 2.8 GB across the seeder, Wrangler and `workerd`. It writes 16 parts,
about 1 GB, and the database is about 1.4 GB. It ends by printing the loaded
counts for release `it-0c432803`: 560,357 `source_record` rows and 1,273,490
`lookup_form` rows.

## When a part fails

The seed stops at the first part that fails, names it and its number, and lists
the parts applied before it. No later part runs. The state directory then holds
a partial release, marked `importing`, and is not safe to use.

To recover, fix the cause and seed again into a fresh state directory: a new
`SEED_STATE` path, or the same one, which the seed clears before loading. Do not
apply the remaining parts by hand; a part that failed may have applied some of
its statements.

The archive is the only production input. This development fixture exists so a
fresh clone can seed without `it-extract.jsonl.gz` or a data-repository checkout.
Loading a complete release into deployed D1 remains #18.
