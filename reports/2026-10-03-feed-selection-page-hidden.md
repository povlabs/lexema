# Feed selection and senses the page hides, in it-78385b62

Measured 2026-10-03 for [#422](https://github.com/hueypov/lexema/issues/422),
on a laptop. Up to `feed-selection/v4` the selection rule read a sense as real
from the source text. The word page hides two shapes that text reads as real:
a gloss that only repeats the headword (`presina f`, `latinismo`) and a gender
and number stamp alone (`m sing`). `feed-selection/v5`
([src/update/selection.ts](../src/update/selection.ts)) reads senses the way
the page does. This report counts what that changes in the September release.

**Result: nothing.** No new or changed record of it-78385b62 has a sense the
page hides, so v4 and v5 give the same verdict on all 952 of them. The first
applied selection ([#377](https://github.com/hueypov/lexema/issues/377)) took
no such record.

## The command

```sh
pnpm exec tsx tools/measurePageHiddenSelection.ts it-extract.jsonl.gz \
  .data/feed/it-extract-20260928.jsonl.gz reports/2026-10-01-first-feed-selection.ids
```

[tools/measurePageHiddenSelection.ts](../tools/measurePageHiddenSelection.ts)
diffs the later archive against the seed archive with the update's own diff
([src/update/changes.ts](../src/update/changes.ts)), so the master it reads is
the one #377 selected against. It judges every new record and every record
whose senses changed by v4, frozen in the tool, and by v5. It reads no
database and writes nothing.

| | |
|---|---|
| Master | `it-0c432803`, SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf` |
| Later release | `it-78385b62`, SHA-256 `78385b6229d19ed990ada6f6f33930585701c3bdc146fb1c849818df72a3e8d4` |
| Applied ids | [2026-10-01-first-feed-selection.ids](2026-10-01-first-feed-selection.ids), 268 |

The diff matches [the diff report](2026-10-01-update-diff-september.md): 259
new words, 693 changed senses, 538,858 other changes, 33 lost words, 1,299
ambiguous groups and 18,147 unchanged records. All 268 applied ids are among
its changes.

Two inputs of the full selection are not read: the September dump the
language rule needs, and the master's hidden records. On this diff neither
changes a verdict: the first selection found no new or changed record in
another language and none that would replace a hidden record
([2026-10-01-first-feed-release.md](2026-10-01-first-feed-release.md)).

## Senses the page hides

Counted over every admitted record of each archive, through `PageSenses`
([src/italian/recordQuality.ts](../src/italian/recordQuality.ts)):

| Release | Headword echo | Stamp alone |
|---|---:|---:|
| it-0c432803 | 33 | 1 |
| it-78385b62 | 36 | 1 |

The seed counts are the ones #422 reported. None of these senses is in a new
record or a record whose senses changed.

## Verdicts, v4 and v5

| Candidate | Verdict under v4 and v5 | Records |
|---|---|---:|
| new | take: new-word | 214 |
| new | skip: no-real-gloss | 40 |
| new | skip: form-of-target-missing | 5 |
| changed | take: replaces-definitions | 246 |
| changed | take: fills-gloss | 32 |
| changed | take: adds-sense | 22 |
| changed | take: removes-definitions | 4 |
| changed | skip: glosses-same | 370 |
| changed | skip: formatting-only | 11 |
| changed | skip: no-real-gloss | 5 |
| changed | skip: blank-replaces-definition | 2 |
| changed | skip: no-new-gloss | 1 |

So, for each verdict #422 names, the records it takes where the taken sense is
one the page hides:

| Verdict | Records |
|---|---:|
| `new-word` | 0 |
| `fills-gloss` | 0 |
| `replaces-definitions` | 0 |

No record moves to `hidden-replaces-definition`. Of the 268 ids #377 applied,
v5 takes all 268.

The dictionary now serves those 268 records, so a later selection from
it-78385b62 ([#436](https://github.com/hueypov/lexema/issues/436)) reads a
subset of these candidates, and v5 changes none of its verdicts either.
