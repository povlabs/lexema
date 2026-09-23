# Autocomplete measurements, 2026-09-23

Measurement for [#15](https://github.com/hueypov/lexema/issues/15): what the
suggestion query returns and costs on the full release. It describes this
machine and this release; a different archive gives different rows. The rule
being measured is in [LOOKUP.md § Suggestions](../docs/LOOKUP.md#suggestions).

## Setup

- Release `it-0c432803`, 560,357 records, imported into local D1 at
  `/tmp/full-state` and read only: SQLite opened with `?immutable=1`, the Worker
  through `wrangler dev`.
- Machine: Apple M1 Pro, 16 GB, macOS 27.0. Node v26.2.0, SQLite 3.54.0,
  wrangler 4.135.0.
- Branch `huey/15-bounded-autocomplete`, exported with `git archive` and built
  with `vinext build`.

## The plan

`EXPLAIN QUERY PLAN` for `SUGGEST_SQL` on the full release:

```
SEARCH lf USING INDEX lookup_form_headword_by_key (release_id=? AND surface_key>? AND surface_key<?)
USE TEMP B-TREE FOR GROUP BY
CORRELATED SCALAR SUBQUERY 2
  SEARCH s USING COVERING INDEX sqlite_autoindex_sense_1 (record_id=?)
  CORRELATED SCALAR SUBQUERY 1
    SEARCH e USING COVERING INDEX sqlite_autoindex_form_of_edge_1 (record_id=? AND sense_index=?)
USE TEMP B-TREE FOR ORDER BY
```

The prefix is a range on the existing partial index; no index was added. The
rank reads every headword in the range, because the best spelling can sort
anywhere in it, so cost grows with how many headwords share the prefix:

| prefix | headword rows in range |
| --- | ---: |
| `a` | 59,642 |
| `ri` (largest two-letter) | 51,867 |
| `ca` | 10,295 |
| `dis` (largest three-letter) | 19,293 |
| `cas` | 575 |

## Before and after

Before is the alphabetical order the issue measured: `DISTINCT surface`,
ordered by key. After is `suggest()`.

| prefix | before (alphabetical) | after (ranked) |
| --- | --- | --- |
| `ess` | essa, essacerbare, essalta, essaltai, essaltammo, essaltando, essaltano, essaltante, essaltanti, essaltarono | esse, essi, esso, Essen, esseno, **essere**, essivo, essente, essenza, esserci |
| `and` | and, anda, andai, Andalusia, andaluso, andamenti, andamento, andammo, andana, andando | and, anda, Ande, andor, andana, **andare**, andata, andato, Andrea, Andria |
| `cas` | casa, casa alloggio, casa cantoniera, casa colonica, casa d'abitazione, casa popolare, casabase, casabasi, casacca, casacche | casa, cash, caso, cast, casco, cassa, casta, casto, casale, casaro |
| `sal` | sala, salacca, salace, salaci, salacità, salafita, salafite, salafiti, salamandra, salamandre | sala, sale, sali, saldo, salma, Salmi, salmo, salsa, salto, Salva |
| `man` | manachini, Manaen, management, manager, manageriale, managerialità, managing director, Manasse, manata, manate | mani, mano, manca, manco, manga, mango, mania, manna, Manno, manso |

`essere` and `andare` enter the ten. What the rank cannot do without frequency
data is prefer a common word over a rare one of the same length: `man` gives
`manna` and `Manno` rather than `mangiare`, which is longer. `mangi` does
suggest it.

## Timing

**The query alone**, `sqlite3` on the release file, warm, two runs each:

| prefix | ranked query |
| --- | ---: |
| `ess` | 13 ms (first run) |
| `cas` | 27 ms (first run) |
| `dis` | 47–49 ms |
| `ri` | 123–125 ms |

**End to end**, `curl` against `GET /suggest` on `localhost:8791`, the Worker
serving the full release. Cold is the first request for that prefix after the
Worker started; warm is the next five.

| prefix | cold | warm (5 runs) |
| --- | ---: | ---: |
| `ri` | 487 ms | 76–80 ms |
| `ca` | 209 ms | 22–23 ms |
| `dis` | 158 ms | 31–33 ms |
| `con` | 111 ms | 21–22 ms |
| `pre` | 70 ms | 13–14 ms |
| `tra` | 75 ms | 15–16 ms |
| `ess` | 16 ms | 6–7 ms |
| `and` | 13 ms | 6–7 ms |
| `cas` | 8 ms | 7–8 ms |
| `sal` | 22 ms | 8–9 ms |
| `man` | 41 ms | 9–10 ms |
| `citt` | 6 ms | 6 ms |
| `anda` | 6 ms | 5–7 ms |
| `mangi` | 6 ms | 6–8 ms |

A three-letter prefix answers warm in 6–33 ms; the worst two-letter prefix,
`ri`, in about 80 ms.

## The two choices this backs

- **Minimum prefix: 2 characters.** One letter reads a tenth of the release
  and names nothing; two is the length of real Italian words (`io`, `tu`, `re`,
  `va`) that come back first as the exact match. The worst two-letter cost,
  `ri` at ~80 ms warm, was judged acceptable; three letters would cap it near
  33 ms at the cost of never suggesting a two-letter word.
- **Debounce: 150 ms.** With the field in a browser, typing `andare` at 90 ms a
  key sent one request, for `andare`. A slow answer for `ca` held back 1.5 s
  after `s` was typed was aborted, and the list showed `cas`'s answer.

## Superseded ordering, 2026-09-23

Huey tried the ranked list and rejected it: "it should show alphabetical order
like the first 10, if i write a it should show words from letter a from
database". The shipped order is alphabetical by normalized key, and the
minimum prefix is one character. The ranked measurements above are kept as a
record of what was tried. The alphabetical query needs no sort, so it walks the
index in order and stops early; one-letter prefixes are measured below.
