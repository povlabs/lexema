# Autocomplete measurements, 2026-09-23

Measurement for [#15](https://github.com/povlabs/lexema/issues/15): what the
suggestion query returns and costs on the full release. It describes this
machine and this release; a different archive gives different rows. The rule
being measured is in [LOOKUP.md § Suggestions](../docs/LOOKUP.md#suggestions).

The order shipped is alphabetical, from one letter, by Huey's ruling. An earlier
ranked order was built, measured and rejected; its numbers are kept at the end
as a record and describe nothing the site does now.

## Setup

- Release `it-0c432803`, 560,357 records, imported into local D1 at
  `/tmp/full-state` and read only: SQLite opened with `?immutable=1`, the Worker
  through `wrangler dev`.
- Machine: Apple M1 Pro, 16 GB, macOS 27.0. Node v26.2.0, SQLite 3.54.0,
  wrangler 4.135.0.
- Branch `huey/15-bounded-autocomplete`, exported and built with `vinext build`.

## The plan

`EXPLAIN QUERY PLAN` for `SUGGEST_SQL` on the full release:

```
SEARCH lookup_form USING INDEX lookup_form_headword_by_key (release_id=? AND surface_key>? AND surface_key<?)
```

One step. The prefix is a range on the existing partial index, rows come back
in key order, and there is no sort, so `LIMIT` stops the walk after the first
rows. How many headwords share the prefix no longer matters: `a` has 59,642 in
range and costs what `cas`, with 575, does.

`suggest()` reads the first 22 rows and keeps the first ten distinct
spellings. Only if a full read holds fewer than ten does it read again with
twice as many, so ten are found whenever ten exist.

22 is the fewest rows that answer every prefix in one read. Measured over every
prefix of every headword in this release, 1,132,910 of them, and separately
over the 14,162 of one to four letters, which are the ones typed first:

| first read | prefixes needing a second read (all) | (1–4 letters) | rows read, average (1–4 letters) |
| ---: | ---: | ---: | ---: |
| 20 | 5 | 2 | 9.7 |
| 21 | 2 | 1 | 10.0 |
| **22** | **0** | **0** | **10.4** |
| 25 | 0 | 0 | 11.5 |
| 40 | 0 | 0 | 16.7 |

Below 22, some prefixes cost a second round trip to the database, worth more
than the row saved. No spelling in the release heads more than six records
(`rosa`, `pizzicato`, `walser`). Longer prefixes have fewer headwords under them
and only get cheaper: over all prefixes the average read is 2.6 rows.

An earlier commit on this branch set 25 and called it the minimum; review found
22 suffices, because the measurement had skipped from 20 to 25.

## What it returns

| prefix | first ten |
| --- | --- |
| `a` | a, A, a battuta, a bella posta, a bizzeffe, a breve, a bronconi, a bruciapelo, a buon mercato, a campana |
| `c` | c, C, c'è mancato poco, c.c., CA, cabala, cabalai, cabalammo, cabalando, cabalano |
| `and` | and, anda, andai, Andalusia, andaluso, andamenti, andamento, andammo, andana, andando |
| `ess` | essa, essacerbare, essalta, essaltai, essaltammo, essaltando, essaltano, essaltante, essaltanti, essaltarono |
| `z` | z, Z, zabaglione, zabaione, zabaioni, zabattiera, zabattiere, zabattieri, zabattiero, zabibo |

Keys compare by code point, so an accented letter sorts after every unaccented
one at the same position: `citt` gives `cittadino` before `città`.

## Timing

**The query alone**, timed inside `sqlite3` with `.timer on` on the release
file, first run then second:

| prefix | query |
| --- | ---: |
| `a` | 0.66 / 0.13 ms |
| `c` | 0.64 / 0.13 ms |
| `ri` | 0.59 / 0.14 ms |
| `dis` | 0.60 / 0.13 ms |
| `ess` | 0.63 / 0.14 ms |
| `and` | 0.66 / 0.13 ms |
| `cas` | 0.66 / 0.13 ms |
| `sal` | 0.54 / 0.12 ms |
| `man` | 0.60 / 0.13 ms |

Timing the `sqlite3` command from outside gives about 29 ms for every prefix;
that is the program starting, not the query.

**End to end**, `curl` against `GET /suggest` on `localhost:8791`, the Worker
serving the full release, restarted just before. Cold is the first request for
that prefix after the restart; warm is the next five.

| prefix | cold | warm (5 runs) |
| --- | ---: | ---: |
| `a` | 11 ms | 5–6 ms |
| `c` | 5 ms | 5–7 ms |
| `ri` | 5 ms | 5 ms |
| `dis` | 6 ms | 4–6 ms |
| `ess` | 6 ms | 4–6 ms |
| `and` | 5 ms | 4–6 ms |
| `cas` | 6 ms | 5–6 ms |
| `sal` | 6 ms | 4–6 ms |
| `man` | 5 ms | 5–6 ms |

Every prefix, one letter included, answers in 4–11 ms. What a reader feels is
the round trip and the 150 ms debounce, not the query.

## Caching

The browser keeps an answer five minutes, so a reader retyping a prefix sends
no request; it helps that reader only. An edge cache through the Workers Cache
API was built, measured working (`miss` then `hit` on repeats) and removed:
Cloudflare's pricing bills a cache hit as a request, so it cut no billed
request, and the D1 reads it skipped — about 10 rows on average — are far inside
the 25 billion a month the Workers Paid plan includes. A failed lookup is never
cached.

## The choices this backs

- **Minimum prefix: 1 character.** Huey's ruling: "if i write a it should show
  words from letter a from database". With no sort, one letter costs what four
  do.
- **Debounce: 150 ms.** With the field in a browser, typing `andare` at 90 ms a
  key sent one request, for `andare`. A slow answer for `ca` held back 1.5 s
  after `s` was typed was aborted, and the list showed `cas`'s answer.

## Rejected: the ranked order

Not what the site does. The first version of this branch ranked suggestions:
the exact spelling first, then spellings with a definition of their own, then
the shorter spelling, then alphabetical, with a two-letter minimum. Huey tried
it and rejected it: "it should show alphabetical order like the first 10, if i
write a it should show words from letter a from database".

It was also the slower design. Ranking needs every headword under the prefix
read and sorted before the first ten are known, so its plan carried two
temporary B-trees and correlated subqueries into `sense` and `form_of_edge`,
and its cost grew with the prefix's range: 13 ms for `ess`, 123–125 ms for
`ri` as a bare query; end to end 6–33 ms warm for three letters, about 80 ms
warm and 487 ms cold for `ri`. One letter was refused because it would have
read a tenth of the release.

What it returned, for the record:

| prefix | ranked |
| --- | --- |
| `ess` | esse, essi, esso, Essen, esseno, essere, essivo, essente, essenza, esserci |
| `and` | and, anda, Ande, andor, andana, andare, andata, andato, Andrea, Andria |
| `man` | mani, mano, manca, manco, manga, mango, mania, manna, Manno, manso |

A signal that did put the expected word first was the number of translations a
record carries — `essere` 156, `andare` 108, `casa` 110, `mangiare` 140 — which
stands in for how common a word is. It was measured and not adopted, since the
ruling was alphabetical.
