# Lookup benchmark: the candidate view against the inlined join, 2026-10-01

Measurement. `pnpm run bench:lookup` (#37) times how lemma links are resolved,
two ways, for the same readings. One way goes through the `form_of_candidate`
view. The other is the inlined join that
[`LEMMA_LINK_SQL`](../src/lookup/lookup.ts) ships. It backs the timing claim in
[LOOKUP_DESIGN.md](../docs/LOOKUP_DESIGN.md#the-view-that-costs-four-orders-of-magnitude).
The figures describe this machine and these corpora.

## Setup

- Machine: Apple M1 Pro, 8 cores, 16 GB, macOS (Darwin 27.0.0).
- Node v26.2.0. SQLite 3.53.1, through `node:sqlite`.
- Code: the #37 branch, cut from `main` at `eeb6da0`.
- Each corpus is seeded through [`seedSql`](../src/import/seedSql.ts), the same
  SQL generator `pnpm run seed:dev` uses. The parts are loaded into a scratch
  SQLite file, and every probe is timed against that one file.
- Probes are picked off a ranking of every searchable key by reading count. The
  ranking uses the same auxiliary rule as lookup's own search, and ties are
  broken by key. The probes are the keys at the top and at the 1%, 10% and 50%
  ranks. No probe is named by hand.
- Before any timing, both forms run over every reading of every probe. A run
  stops with no table if the two return different rows. Both runs below passed.

## Synthetic corpus, two sizes

Default run: `pnpm run bench:lookup`. That is seed 37, 140,000 and 560,000
records, 5 timed iterations after 1 warmup. Output, verbatim:

```
# bench:lookup, 2026-10-01T09:54:52.703Z

- Node v26.2.0, SQLite 3.53.1 (node:sqlite)
- Apple M1 Pro, 8 cores, 16 GB, Darwin 27.0.0
- Synthetic corpus, seed 37
- 5 timed iteration(s) after 1 warmup(s); every figure is a median in ms
- `view` and `inlined`: one lemma-link query per reading of the word, all of them; `lookup()`: the whole lookup of the word

## 140,000 synthetic records, release `bench-140000`

Seeded in 14.3 s: 140,000 records, 382,139 lookup rows, 112,460 form-of edges. Plan materialises a view: through the view yes, inlined no. Rows agree for every probe's readings.

| probe | word | readings | with edges | view ms | inlined ms | view ÷ inlined | `lookup()` ms |
|---|---|---:|---:|---:|---:|---:|---:|
| most | bebalai | 8 | 1 | 278 | 0.055 | 5,088 | 1.0 |
| p99 | curacai | 5 | 0 | 0.027 | 0.026 | 1.0 | 1.2 |
| p90 | mitufai | 3 | 1 | 279 | 0.021 | 13,427 | 0.494 |
| p50 | rivegaeremo | 2 | 1 | 277 | 0.015 | 17,906 | 0.399 |

## 560,000 synthetic records, release `bench-560000`

Seeded in 63.6 s: 560,000 records, 1,530,441 lookup rows, 450,578 form-of edges. Plan materialises a view: through the view yes, inlined no. Rows agree for every probe's readings.

| probe | word | readings | with edges | view ms | inlined ms | view ÷ inlined | `lookup()` ms |
|---|---|---:|---:|---:|---:|---:|---:|
| most | baguvai | 8 | 1 | 1309 | 0.052 | 25,266 | 1.1 |
| p99 | cimebea | 5 | 1 | 1282 | 0.034 | 38,230 | 0.718 |
| p90 | mipaleo | 3 | 1 | 1297 | 0.021 | 62,110 | 0.507 |
| p50 | rogefaava | 2 | 1 | 1298 | 0.016 | 80,694 | 0.447 |
```

## The real archive

`SEED_INPUT=it-extract.jsonl.gz pnpm run bench:lookup --iterations 3 --warmups 1`.
That is the archive `it-0c432803`, SHA-256
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`, the same
file as [the lookup measurements](2026-09-21-lookup-measurements.md). Output,
verbatim:

```
# bench:lookup, 2026-10-01T09:57:10.024Z

- Node v26.2.0, SQLite 3.53.1 (node:sqlite)
- Apple M1 Pro, 8 cores, 16 GB, Darwin 27.0.0
- Real archive (SEED_INPUT)
- 3 timed iteration(s) after 1 warmup(s); every figure is a median in ms
- `view` and `inlined`: one lemma-link query per reading of the word, all of them; `lookup()`: the whole lookup of the word

## archive it-extract.jsonl.gz, release `it-0c432803`

Seeded in 124.4 s: 560,357 records, 1,273,490 lookup rows, 608,726 form-of edges. Plan materialises a view: through the view yes, inlined no. Rows agree for every probe's readings.

| probe | word | readings | with edges | view ms | inlined ms | view ÷ inlined | `lookup()` ms |
|---|---|---:|---:|---:|---:|---:|---:|
| most | inserisci qui voce al plurale | 110 | 0 | 0.571 | 0.569 | 1.0 | 22.5 |
| p99 | addopate | 4 | 4 | 3990 | 0.064 | 62,064 | 0.975 |
| p90 | allegorizzaste | 2 | 1 | 996 | 0.022 | 45,964 | 1.3 |
| p50 | avevo olezzato | 1 | 0 | 0.005 | 0.005 | 1.0 | 1.2 |
```

## What it says

**The view's cost follows the size of the release. The inlined join's cost
follows the readings.** In the synthetic runs, a reading with a form-of edge
costs about 280 ms through the view at 140,000 records. At 560,000 records it
costs about 1,300 ms, which is 4.7 times as much for 4 times the records. The
inlined join stays between 0.015 and 0.055 ms at both sizes. It rises with a
word's reading count, not with the corpus.

**Only readings with lemma links pay.** A reading whose record declares no
form-of edge costs the same both ways. Examples are `curacai` at 140,000 records
and both edge-less real probes. So through the view, a word costs about one
release-sized query per reading that has an edge.

**On the real archive, one such reading costs about one second through the
view.** That is 996 ms for `allegorizzaste`'s one reading with an edge, and
3,990 ms for `addopate`'s four. The inlined join answers the same readings in
0.02 to 0.06 ms. Wherever a reading has an edge, the ratio here runs from about
1.3 × 10⁴ to 8 × 10⁴. The one exception is 5,088, at the smaller synthetic size,
for a word with one reading with an edge out of eight.

**This is not the deleted benchmark's figure.** The page used to quote 6722.0 ms
against 0.03 ms, at a 560,357-record synthetic corpus. That came from PR #38's
branch, which was closed unmerged, and its harness and corpus are gone. This
harness measures about 1.0 s per reading with an edge on the real release, and
about 1.3 s on its own 560,000-record corpus. Its synthetic corpus has more
lookup rows than the real archive (1,530,441 against 1,273,490) and fewer
form-of edges (450,578 against 608,726).

**The real archive's top probe is a template sentence, not a word.**
"inserisci qui voce al plurale" is listed as a form by 110 records, so it ranks
first. None of those records declares an edge, so its row only times `lookup()`
over many readings. Filed as #342.
