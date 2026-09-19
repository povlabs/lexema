# Run the lookup benchmark

Measures what a lookup costs and what the `form_of_candidate` view would cost if
it came back. Why that matters is in
[the lookup design notes](LOOKUP_DESIGN.md#the-view-that-costs-four-orders-of-magnitude).

## Against a synthetic release

No dictionary download needed:

```sh
pnpm run bench:lookup
```

The first run generates two seeded corpora and imports them, which takes about
five minutes. Later runs reuse the databases under `.data/bench/`.

To regenerate them:

```sh
pnpm run bench:lookup -- --rebuild
```

## Against the real archive

Import it first per [the import guide](IMPORT.md), then:

```sh
pnpm run bench:lookup -- --database .data/lexema.sqlite --release it-local
```

## Flags

| Flag | Default | Effect |
| --- | --- | --- |
| `--records <n>` | `140000` and `560357` | a scale to bench; repeat for more |
| `--iterations <n>` | `25` | timed runs per probe, after 5 warmups |
| `--seed <n>` | `20260919` | corpus seed |
| `--rebuild` | off | discard and regenerate the corpora |
| `--database <path>` | — | bench an existing database instead |
| `--release <id>` | — | the release in that database |

Output is markdown on stdout; progress goes to stderr.

## What the corpus is

Generated from a seed, so the same command produces the same corpus anywhere. It
matches the real release's *shape* — 560,357 records, ~1.27 M lookup rows,
~609 K `form_of` edges, homographs skewed so some keys reach eight readings. It
is not Italian and does not pretend to be; lookup cost depends on how many rows
a key matches, not on what the letters mean.

Two scales rather than one, because a single column cannot show whether cost
follows the number of readings or the size of the release.

Probe words are picked out of the corpus by reading count rather than
hard-coded, so a change of seed or scale cannot quietly select the easy words.

## Captured output

Verbatim from `pnpm run bench:lookup` on 2026-09-19. Local SQLite is not D1, so
these predict nothing about production latency — they show the shape of the
cost.

### Environment

- Node v26.2.0, SQLite 3.53.1, `node:sqlite`
- Apple M1 Pro, 8 cores, 17 GB, darwin-arm64
- 25 timed iterations after 5 warmup runs; median reported

### Corpus

| Release | Records | Lookup rows | form_of edges | Database |
| --- | ---: | ---: | ---: | ---: |
| 140,000 records | 140,000 | 318,407 | 152,184 | 0.25 GB |
| 560,357 records | 560,357 | 1,274,725 | 609,161 | 0.99 GB |

### Lookup

| Readings | 140,000 records | 560,357 records |
| ---: | ---: | ---: |
| 1 | 0.18 ms | 0.17 ms |
| 2 | 0.31 ms | 0.35 ms |
| 4 | 0.61 ms | 0.63 ms |
| 8 | 1.23 ms | 1.28 ms |
| 0 (miss) | 0.03 ms | 0.03 ms |

Four times the release, the same cost per reading.

### Lemma links: view LEFT JOINed vs. its join inlined

| Release | Via `form_of_candidate` | Inlined | Rows |
| --- | ---: | ---: | ---: |
| 140,000 records | 981.1 ms | 0.03 ms | 1 |
| 560,357 records | 6722.0 ms | 0.03 ms | 1 |

Same rows. The view form is the one that gets worse as the release grows.
