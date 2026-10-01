# D1 viability for the Italian release, 2026-10-01

Measurement and recommendation for [#3](https://github.com/hueypov/lexema/issues/3).
It answers where the entry payloads live: all in D1, or D1 as the index with
`source_record_json` in R2.

**Recommendation: keep everything in D1.** One release is 1.49 GB on real D1,
and two at once are about 3.0 GB, against a 10 GB database limit. D1's own SQL
time per word lookup is small, 3 to 68 ms. What a lookup costs is the number of
statements it runs, and moving the JSON to R2 does not lower that. The details
and the headroom are [below](#recommendation).

## Setup

- Release `it-0c432803`, from `it-extract.jsonl.gz`, SHA-256
  `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`.
- Code: `main` at `acadfd3`.
- Machine: Apple M1 Pro, 16 GB, macOS (Darwin 27.0.0). Node v26.2.0,
  wrangler 4.135.0, SQLite 3.53.1 through `node:sqlite`.
- Real D1: the shared dictionary `lexema-dictionary`
  (`b07d3441-91c6-4f94-8ae3-fe8c7088f21d`), region EEUR, served from MXP, read
  replication off. Only read. Huey allowed read-only timing queries and ruled
  out any write, migration or import there
  ([ruling](https://github.com/hueypov/lexema/issues/3#issuecomment-5934052971)).
- The two-release test ran on a scratch local SQLite file only, per the same
  ruling.

## Plan limits measured against

Read from Cloudflare's docs on 2026-10-01
([D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), both
"last updated Apr 21, 2026";
[R2 pricing](https://developers.cloudflare.com/r2/pricing/)).

| Limit | Workers Paid | Free |
| --- | ---: | ---: |
| D1 maximum database size | 10 GB, cannot be raised | 500 MB |
| D1 storage included | 5 GB, then $0.75 / GB-month | 5 GB total |
| D1 rows read included | 25 billion / month, then $0.001 / million | 5 million / day |
| D1 rows written included | 50 million / month, then $1.00 / million | 100,000 / day |
| D1 queries per Worker invocation | 1,000 | 50 |
| R2 storage free | 10 GB-month | |
| R2 reads (Class B) free | 10 million / month, then $0.36 / million | |

D1 counts one extra written row per index entry a write touches (pricing
page, definition 6).

## Query cost on real D1

Method: the site's own code, `searchAttempt` (exact lookup, then the "nearby"
offer when nothing is found) and `suggest` (autocomplete), over `fromD1`, run
from the laptop through a remote binding (`getPlatformProxy`, `remote: true`).
A wrapper read each statement's `meta` on the way back. Each row is the median
of 5 timed runs after 1 warmup. "D1 SQL ms" is the sum of
`meta.timings.sql_duration_ms`, the time D1 spent running SQL. "Wall ms" is the
laptop's view, and includes one round trip to MXP per statement (about 50 ms
here), so it is far above what a Worker near D1 would see.

Measured 2026-10-01T15:11Z. Every statement was served by the primary in EEUR,
colo MXP.

| Kind | Query | Answer | Statements | `raw_json` reads | `raw_json` KB | Rows read | D1 SQL ms | Wall ms |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| one statement | `release row` | 1 row | 1 | 0 | 0.0 | 1 | 0.16 | 60 |
| exact | `casa` | 1 reading | 15 | 1 | 20.0 | 170 | 4.40 | 1,013 |
| exact | `sale` | 3 readings | 45 | 6 | 46.3 | 1,583 | 13.09 | 1,227 |
| exact | `andare` | 2 readings | 24 | 2 | 42.0 | 1,918 | 8.15 | 766 |
| exact | `essere` | 3 readings | 35 | 3 | 59.7 | 4,013 | 16.54 | 927 |
| exact | `avere` | 3 readings | 35 | 3 | 51.0 | 12,572 | 68.45 | 902 |
| exact | `andavano` | 1 reading | 18 | 3 | 43.8 | 1,358 | 6.14 | 881 |
| exact | `andare via` | 1 reading | 11 | 1 | 0.8 | 41 | 2.67 | 616 |
| exact | `vado via` | 1 reading | 15 | 1 | 0.8 | 84 | 4.26 | 874 |
| exact | `addopate` | 4 readings | 38 | 4 | 2.6 | 237 | 8.92 | 818 |
| exact | `allegorizzaste` | 1 reading | 16 | 3 | 16.1 | 985 | 5.22 | 857 |
| exact | `avevo olezzato` | 1 reading | 12 | 1 | 13.8 | 1,292 | 4.99 | 741 |
| exact | `inserisci qui voce al plurale` | 110 readings | 993 | 110 | 64.7 | 3,452 | 242.51 | 11,963 |
| exact | `casz` | not found; nearby typo | 5 | 0 | 0.0 | 30 | 1.18 | 371 |
| exact | `xqzwv` | not found; nearby none | 6 | 0 | 0.0 | 11 | 1.39 | 455 |
| suggest | `a` | 10 words, 0 phrases | 2 | 0 | 0.0 | 23 | 0.51 | 127 |
| suggest | `ca` | 10 words, 0 phrases | 2 | 0 | 0.0 | 23 | 0.54 | 132 |
| suggest | `cas` | 10 words, 0 phrases | 2 | 0 | 0.0 | 23 | 0.48 | 111 |
| suggest | `and` | 10 words, 0 phrases | 2 | 0 | 0.0 | 23 | 0.56 | 118 |
| suggest | `z` | 10 words, 0 phrases | 2 | 0 | 0.0 | 23 | 0.48 | 113 |
| suggest | `vado v` | 0 words, 1 phrase | 6 | 0 | 0.0 | 35 | 1.59 | 312 |
| suggest | `xqz` | 0 words, 0 phrases | 2 | 0 | 0.0 | 2 | 0.40 | 130 |

The first row is one indexed statement, added by the desk as a baseline.

What it says:

- **D1's SQL time is small.** One indexed statement takes 0.16 ms. An ordinary
  word takes 3 to 17 ms of SQL in total. `avere` is the costliest real word at
  68 ms, because its readings read 12,572 rows.
- **Autocomplete is cheap.** Every one-word prefix runs 2 statements and reads
  23 rows, about 0.5 ms of SQL. A phrase prefix (`vado v`) runs 6.
- **The cost is the statement count.** A word runs 11 to 45 statements, about
  9 to 18 per reading, and lookup awaits many of them in turn: `casa`'s 15
  statements took about 17 round trips' worth of wall time. The one search
  near a limit is the template sentence `inserisci qui voce al plurale`
  ([#342](https://github.com/hueypov/lexema/issues/342)): 993 statements, 7
  below the 1,000-query cap, and 12 s from the laptop.
- **The verbatim JSON is read on every lookup that finds something**: once per
  reading and once per lemma a reading names (the `raw_json` columns). That is
  1 to 6 reads and 1 to 60 KB for a real word.

Statement counts and rows read are identical to the read-only figures in
[an earlier comment on #3](https://github.com/hueypov/lexema/issues/3#issuecomment-5933139971),
taken the same day by the same method. The SQL times are close but not
identical: `avere` took 68 ms here against 79 ms there, and the template
sentence 243 ms against 261 ms.

## Two releases at once

Method: on a scratch SQLite file,

1. Seed `it-0c432803` through the seed's own SQL generator
   ([`seedSql`](../src/import/seedSql.ts), with the raw pages
   `pnpm run seed:dev` reads) and load every part. Measure with `dbstat`.
2. Copy every row of that release under a second release id, `it-staged01`,
   in one transaction. `record_id`, `page_id` and `recovered_id` are shifted by
   1,000,000 and `sense_id` by 10⁹ (it is `record_id × 1000 + sense_index`).
   Every other integer key takes a fresh rowid. That is the same rows and the
   same index entries a second import would write. Measure again.
3. Look up words and prefixes in both releases and compare the answers.

Why a copy and not a second import: a second import of the same archive cannot
go into the same database today. Every release numbers its records from 1
([`importRelease.ts`](../src/import/importRelease.ts), `recordId = admitted`),
and `record_id` is a global primary key, so the second release collides on its
first row. Giving a staged release its own id range is for
[#18](https://github.com/hueypov/lexema/issues/18).

Results:

| | bytes | |
| --- | ---: | --- |
| one release, local | 1,484,251,136 | 1.48 GB |
| one release, real D1 (`wrangler d1 info`, today) | 1,486,446,592 | 1.49 GB |
| two releases, local | 2,978,697,216 | 2.98 GB, 2.007 × one |
| two releases, real D1, projected | about 2,983,000,000 | 2.98 GB × 1.0015 |

The local single release is within 0.15% of the real D1 file. The only content
difference is the recovered layer: the real D1 was seeded with the full
Wiktionary dump, which holds 443 raw pages, and this machine has only the
fixture pages, which give 21. That is 1,315 rows of 9,293,720, a few hundred KB.

Per table, with its indexes, local:

| Table | One release MB | Two releases MB | Ratio |
| --- | ---: | ---: | ---: |
| `source_record_json` | 436.9 | 873.9 | 2.00 |
| `grammar_claim` | 407.0 | 819.1 | 2.01 |
| `lookup_form` | 238.1 | 476.9 | 2.00 |
| `source_record` | 119.7 | 243.7 | 2.04 |
| `form_of_edge` | 85.0 | 169.8 | 2.00 |
| `sense_gloss` | 79.4 | 158.8 | 2.00 |
| `sense_label` | 40.9 | 81.8 | 2.00 |
| `sense` | 39.7 | 80.0 | 2.01 |
| `typo_key` | 35.3 | 70.3 | 1.99 |
| `accent_fold` | 2.2 | 4.4 | 2.02 |
| everything else | under 0.1 | under 0.1 | |

So the 2.8 GB guess in the issue holds, at 2.98 GB on today's schema: the
second release costs its own size and nothing more. Every table's live rows
matched between the two releases, and so did `release_table_rows`.

Lookups answer the same from both releases with both present: for `casa`,
`sale`, `andare`, `essere`, `avere`, `andavano`, `andare via`, `vado via` and
`inserisci qui voce al plurale`, the readings match once ids are set aside, and
`suggest` gives the same list for `a`, `cas` and `vado v`. Every query is keyed
by `release_id`, so a second release does not change what a lookup reads.

Then the first release was deleted, through `ON DELETE CASCADE` from its
`source_release` row, in 43 s. The second release's rows all stayed. The file
stayed at 2,978,697,216 bytes, with 1,446,375,424 bytes (1.45 GB) of it now
free pages inside the file. SQLite does not shrink a file on delete; it reuses
the free pages for the next writes. So swapping releases in one database holds
the size of two releases from then on, which still fits. Whether D1's reported
size drops after such a delete was not tested, since that needs a write to a
remote database.

## Cost

No remote write ran, so this round cost $0 in D1 writes. The reads were a few
thousand statements and well under a million rows, against 25 billion included.

Per release on real D1:

| | One release | Two releases | Included in Workers Paid |
| --- | ---: | ---: | ---: |
| Storage | 1.49 GB | about 2.98 GB | 5 GB |
| Data rows written by an import | 9,293,720 | 18,587,440 | 50 M / month |
| Rows written, counting index entries (estimate) | about 27.6 M | about 55.2 M | 50 M / month |

The rows-written estimate counts one row per table row plus one per index entry,
from the schema's own index list (`PRAGMA index_list`) and the real release's
`release_table_rows`; the two `WITHOUT ROWID` tables count once. It is not a
measurement. So one import a month fits the included writes, if nothing else
large is written that month; two do not, by about 5 M rows, about $5.

D1 bills a `DELETE` as written rows too. So swapping releases inside one
database writes the new release *and* deletes the old one, likely about 55 M
rows, over the included 50 M in that month. Loading each release into a fresh
database and deleting the old database would not delete its rows one by one;
whether that is billed as written rows was not checked. That choice belongs to
[#18](https://github.com/hueypov/lexema/issues/18).

## Recommendation

**Keep the entry payloads in D1. Do not move `source_record_json` to R2.**
Confidence: high on size, medium on latency, because no timing here is from a
Worker sitting next to D1.

Why:

- **Size has room.** Two releases at once are about 3.0 GB, 30% of the 10 GB
  limit. Moving the JSON out would save about 0.44 GB a release (0.87 GB with
  two), and the database would still be about 2.1 GB, so it buys headroom D1
  does not need yet. A release would have to grow about 3.3 times before two of
  them stopped fitting.
- **Storage stays in the included 5 GB** with two releases, so moving the JSON
  saves no money today.
- **R2 would make lookups slower and more complex, not faster.** The JSON is
  read on every lookup, once per reading and per lemma. On D1 that read is one
  more indexed statement, under 1 ms of SQL. In R2 it is one GET per record,
  each a separate subrequest, plus the second store to keep in step with the
  release (writes, activation, rollback). The cost here is statement count, and
  the move does not reduce it.
- **The free plan is out either way.** Without the JSON, one release is still
  about 1.05 GB against Free's 500 MB.

When to revisit:

- **A release grows past about 4 GB on D1**, so that two take more than 80% of
  the 10 GB limit. Moving the JSON then saves about 30% per release; the schema
  keeps it in its own table, so that is a small change.
- **Storage across all databases passes 5 GB.** Then each extra GB costs $0.75
  a month on D1 against $0.015 on R2.

Two things this measurement found that are not the size question:

- **The statement count is the real risk.** A word with many readings runs
  close to the 1,000-query cap; #342 is that case. Fewer, batched statements
  per lookup would lower both the cap risk and the latency, whichever store
  holds the JSON.
- **A second release cannot be loaded beside the first today**, because record
  ids restart at 1 in every release. That belongs to #18.

## What this does not settle

- **Latency inside a Worker.** The wall times are from a laptop, about 50 ms
  per round trip. A Worker in Italy near MXP pays a much shorter round trip per
  statement, which was not measured.
- **Real D1 with two releases.** Only one release is on real D1. The
  two-release figure is local, projected with the measured 0.15% local-to-D1
  ratio.
- **Import time and write cost on real D1.** Nothing was written remotely.
