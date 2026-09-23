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

The seed also writes the recovered layer ([#28](https://github.com/hueypov/lexema/issues/28)):
for a record whose word has a raw Wiktionary page under `fixtures/`, the
definitions the page states and the record does not carry go to
`recovered_definition`, with their labels and examples, beside the record and
naming the page revision and line each was read from. The record's own rows are
the same with or without it. The run prints how many definitions and examples
it recovered, for how many records; for the fifty-word fixture that is `casa`'s
seven definitions and seven examples. How the lines are chosen, and how much
the extraction loses, is in
[the measurement](../reports/2026-09-23-recovered-definitions.md).

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

After the last part, the seeder counts the rows of every table the batches
wrote and checks them against the generated SQL. It then reads the one
`source_release` row, which is written outside the batches, and checks that
exactly one exists and that its status and line counts match what the run
reported, which at that point is `importing`. If either check fails, it marks
the release `failed` and stops. Only when both pass does it set the release's
final status and read it back.

The 64 MiB default keeps Wrangler's memory down for little extra time;
[the measurements](../reports/2026-09-23-full-release-seed-measurements.md)
compare 32, 64 and 128 MiB.

## Failure states

What a stopped seed leaves in its `SEED_STATE`. The recovery steps are in
[RUN_AN_IMPORT.md § If a seed stops](RUN_AN_IMPORT.md#if-a-seed-stops).

| Where it stopped | Release status left | Usable |
| --- | --- | --- |
| A part failed to apply, or the run was killed before every check passed | `importing`: the SQL never writes a servable status, and a failed part may have applied some of its statements | No |
| All parts applied, then a row count or the `source_release` row differed from the run | `failed`, set by the seeder before it stops; if that write itself fails the release stays `importing` | No |
| Every check passed and the final status was written, whether or not the read-back that follows it completed | `complete` | Yes: it was verified before the write |

`complete` therefore always means verified. The SQL leaves the release
`importing`, and only the seeder, after every check, writes the final status.
It then reads the status back and reports an error if it disagrees; a run
stopped between that write and its read-back leaves a verified `complete`
release, whose status the seeder did not get to confirm. Lookup serves only a `complete` release, so no interruption at
any point can leave an unverified database servable.

The seeder stops at the first failing part, names it and its number, and lists
the parts applied before it. No later part runs.

The archive is the only production input. This development fixture exists so a
fresh clone can seed without `it-extract.jsonl.gz` or a data-repository checkout.
Loading a complete release into deployed D1 remains #18.
