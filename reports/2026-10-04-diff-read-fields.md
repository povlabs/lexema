# The September diff, compared on the fields Lexema reads

Measured 2026-10-04 for [#369](https://github.com/povlabs/lexema/issues/369),
on a laptop. The diff now compares records on the fields Lexema reads
(`READ_FIELDS`, [src/update/content.ts](../src/update/content.ts);
[UPDATES](../docs/UPDATES.md#the-fields-lexema-reads)). This report counts
what that changes in the diff of kaikki's September build against the July
master.

**Result:** ambiguous groups fall from 1,299 to 40, and other changes from
538,858 to 1,864. Changed or fixed senses fall from 693 to 438: 263 of the 693
differed only in sense fields no page shows, and 8 come from groups that were
ambiguous before.

## The command

```sh
pnpm exec tsx tools/measureReadFieldDiff.ts it-extract.jsonl.gz \
  .data/feed/it-extract-20260928.jsonl.gz
```

[tools/measureReadFieldDiff.ts](../tools/measureReadFieldDiff.ts) runs the
update's own matching ([src/update/changes.ts](../src/update/changes.ts)) twice:
once with a record's content taken as its whole line, as before #369, and once
as its read fields. Like
[the v5 measurement](2026-10-03-feed-selection-page-hidden.md), the master is
the seed archive itself, read the way the diff reads a master, so it is the
master [`update:diff` ran against on 2026-10-01](2026-10-01-update-diff-september.md).
The whole-line run gives that report's counts exactly. It reads no database and
writes nothing.

| | |
|---|---|
| Master | `it-0c432803`, SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf` |
| Later release | `it-78385b62`, SHA-256 `78385b6229d19ed990ada6f6f33930585701c3bdc146fb1c849818df72a3e8d4` |

## The diff

| Group | Whole line | Read fields |
|---|---:|---:|
| New words | 259 | 262 |
| Changed or fixed senses | 693 | 438 |
| Other changes, senses the same | 538,858 | 1,864 |
| Lost words | 33 | 33 |
| Ambiguous groups, not matched | 1,299 | 40 |
| Unchanged records | 18,147 | 557,944 |

The 40 ambiguous groups left hold 78 master records and 80 later ones, down
from 2,626 and 2,631. Their records differ in fields Lexema reads, so pairing
them would still be a guess.

## Where the 693 sense changes went

| Under the read fields | Records |
|---|---:|
| Still changed or fixed senses | 430 |
| Other changes: senses the same, another read field not | 96 |
| Unchanged | 167 |

The 263 that left differ only in sense fields Lexema never reads: an example's
fields other than its text (148), and `categories` or `topics` on a sense (115).
Eight sense changes are new: groups that were ambiguous now pair, and their one
real change is left. They are `informatica`, `console`, `botte`, `minerali`
(nouns) and `errare`, `appratire`, `stonare`, `cicchettare` (verbs). One more
formerly ambiguous group gives a change outside the senses, and three give a
new word.

## Other changes, by the read fields that differ

The ten largest of 1,864:

| Fields that differ | Records |
|---|---:|
| translations | 1,067 |
| synonyms | 140 |
| antonyms, synonyms | 140 |
| derived | 56 |
| etymology_texts | 56 |
| antonyms | 49 |
| sounds, translations | 28 |
| proverbs | 26 |
| synonyms, translations | 21 |
| antonyms, hyphenations, synonyms | 20 |

Before, 536,962 of the 538,858 differed in `etymology_links` alone.
