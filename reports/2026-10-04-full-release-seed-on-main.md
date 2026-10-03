# Full-release seed on main, 2026-10-04

Measurement for [#540](https://github.com/povlabs/lexema/issues/540): what a
full-release local seed costs on main now that it also reads the Wiktionary
dump's raw pages. It replaces the time and memory figures of
[2026-09-23](2026-09-23-full-release-seed-measurements.md), which predate the
raw-page read, and those of
[2026-10-03 § The local seed](2026-10-03-unrecorded-page-layouts.md#the-local-seed),
which ran with a local patch for
[#489](https://github.com/povlabs/lexema/issues/489). These two runs carry no
patch. They describe this machine and this release; a different archive, dump
or machine gives different numbers. How the seed works is in
[DEV_SEED.md](../docs/DEV_SEED.md).

## Setup

- Commit `a6f4ea8` on main, unpatched.
- Archive `it-extract.jsonl.gz` at the repository root, release `it-0c432803`
  (SHA-256 `0c432803…`), 799,600 lines, 560,357 admitted.
- Dump `itwiktionary-20260701-pages-articles.xml.bz2` at the repository root.
  `RAW_PAGES` unset, so the seed found the dump there and read 758,429 raw
  pages from it.
- Machine: Apple M1 Pro, 16 GB, macOS 27.0. Node v26.2.0, wrangler 4.135.0,
  pnpm 10.13.1.
- `SEED_REMOTE` unset: local D1 only.
- Each run started with `.data/full-sql` and `.data/full-state` removed, then
  ran the full-release command from
  [RUN_AN_IMPORT.md § Run it](../docs/RUN_AN_IMPORT.md#run-it) under
  `/usr/bin/time -l`:

  ```sh
  SEED_INPUT=it-extract.jsonl.gz \
  SEED_SQL=.data/full-sql \
  SEED_STATE=.data/full-state \
  /usr/bin/time -l pnpm run seed:dev
  ```

- Time is wall clock for the whole command: reading the dump, generating the
  SQL, applying every part, and reading the counts back.
- Peak memory was sampled as in the two earlier reports: every 0.25 s, the
  summed resident size of the command's process tree (pnpm, the seeder's Node,
  Wrangler's Node, `workerd`), read with `ps -A -o pid,ppid,rss`. The largest
  single process is shown too; in both runs it is the seeder's Node, which
  holds the dump's pages in memory.

## Results

| Run | Parts | Wall time | Peak, process tree | Peak, largest process | `time -l` maximum resident |
|---|---:|---:|---:|---:|---:|
| 1 | 17 | 544 s | 3.4 GB | 2.4 GB | 2.4 GB |
| 2 | 17 | 591 s | 3.7 GB | 2.6 GB | 2.6 GB |

GB here is 10⁹ bytes. Both runs exited 0 and printed identical loaded counts.
So a full seed now takes nine to ten minutes and peaks at 3.4 to 3.7 GB
for the process tree. The tree peak varies between runs because Wrangler's
`workerd` processes overlap.

Against the 2026-09-23 default run (16 parts, 409 s, 2.8 GB tree, 1.28 GB
`time -l`), the seed now writes one more part, takes about a third longer and
peaks about 1 GB higher. Its largest process is now the seeder's Node, not
`workerd`.

## Printed counts

Both runs printed these lines, the same in each. Absolute paths are shortened
here to repository-relative ones.

```text
raw pages: 758429 from dump itwiktionary-20260701-pages-articles.xml.bz2
seed SQL: 17 part(s) under 67108864 bytes in .data/full-sql
archive: 560357 admitted, 799600 lines, complete
```

```text
part 17 of 17: .data/full-sql/part-017.sql (26670567 bytes)
loaded release it-0c432803:
  source_record: 560357
  source_record_json: 560357
  lookup_form: 1273350
  accent_fold: 44956
  typo_key: 724849
  form_of_edge: 608717
  sense: 714867
  sense_gloss: 714222
  sense_label: 637585
  grammar_claim: 3454684
  raw_page: 653
  recovered_definition: 893
  recovered_label: 57
  recovered_example: 17
  hidden_record: 30
  corrected_claim: 288
  recovered_entry: 203
  entry_definition: 238
  entry_label: 136
  entry_example: 25
  corrected_definition: 2
  release_table_rows: 21
  source_release: 1 row, complete
```

`source_record` is 560,357, as the guide said. `lookup_form` is 1,273,350,
not the 1,273,490 the 2026-09-23 run read back; the guide now says 1,273,350.

The `/usr/bin/time -l` lines and the sampler's summary, per run:

```text
run 1:      543.53 real       403.46 user        67.05 sys
            2387918848  maximum resident set size
       exit=0 wall_s=543.6 tree_peak_kb=3355264 largest_peak_kb=2323696

run 2:      591.49 real       420.23 user        72.36 sys
            2632859648  maximum resident set size
       exit=0 wall_s=591.7 tree_peak_kb=3619584 largest_peak_kb=2565296
```

The sampler's `kb` is the 1024-byte unit `ps` reports.
