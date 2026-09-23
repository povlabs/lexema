# Full-release seed measurements, 2026-09-23

Measurement for [#97](https://github.com/hueypov/lexema/issues/97): what it costs
to seed the full release into local D1 in parts, and why the default part
ceiling is 64 MiB. It describes this machine and this release; a different
archive or machine gives different numbers. How the seed works is in
[DEV_SEED.md](../docs/DEV_SEED.md).

## Setup

- Archive `it-extract.jsonl.gz` at the repository root, release `it-0c432803`,
  799,600 lines, 560,357 admitted. The generated SQL is about 1,011 MB.
- Machine: Apple M1 Pro, 16 GB, macOS 27.0. Node v26.2.0, wrangler 4.135.0,
  SQLite 3.54.0.
- Each run seeded a new state directory under `/tmp` with
  `SEED_INPUT=it-extract.jsonl.gz pnpm run seed:dev`, and `SEED_PART_BYTES` for
  the non-default ceilings.
- Time is wall clock for the whole command: generating the SQL, applying every
  part, and reading the counts back. Generating the SQL alone takes about 19 s.
- Peak memory was sampled every 0.25 s as the summed resident size of the
  command's process tree (pnpm, the seeder's Node, Wrangler's Node, `workerd`).
  The largest single process is shown too; at 64 MiB and above it is `workerd`.

## Part size

| ceiling | parts | time | peak, process tree | peak, largest process |
| ---: | ---: | ---: | ---: | ---: |
| 128 MiB | 8 | 399 s | 4.4 GB | 2.2 GB |
| **64 MiB** | **16** | **408 s** | **2.8 GB** | **1.2 GB** |
| 32 MiB | 32 | 447 s | 2.1 GB | 0.9 GB |

A single `wrangler d1 execute --file` on a prefix of the release, into an empty
state directory, peaked at 1.9 GB for 64 MiB, 2.7 GB for 128 MiB and 3.7 GB for
256 MiB, so Wrangler's memory grows with the part it is given.

64 MiB is the default. Halving from 128 MiB cuts the peak by more than a third
for about 2% more time; halving again saves another 0.7 GB but adds 10% more
time, because each Wrangler run starts a fresh `workerd`. 64 MiB is also an
eighth of Node's string limit, so no part comes near it.

## The default run

`SEED_INPUT=it-extract.jsonl.gz pnpm run seed:dev` at the default ceiling, into a
fresh state directory:

- 16 parts, 409 s, peak 2.8 GB for the process tree. `/usr/bin/time -l`
  reports 1.28 GB maximum resident size, which is `workerd`.
- The seeder read back 560,357 `source_record` rows and 1,273,490 `lookup_form`
  rows for release `it-0c432803`, matching the generated SQL for every table.
- Opened read-only with `sqlite3 -readonly`: `form_source` is set on 546,410
  `lookup_form` rows, and the release's status is `complete`.
