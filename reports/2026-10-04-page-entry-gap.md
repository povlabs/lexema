# The three page-only entries the shared dictionary does not load

Check for [issue #539](https://github.com/povlabs/lexema/issues/539), run 2026-10-04.
The page-entry load under rules `italian-page-entry/v1` and `v2` writes 186 entries on
169 pages to the shared dictionary
([declaration](../dictionary-changes/2026-10-03-load-page-entries-v2-it-0c432803.json),
[plan run](https://github.com/povlabs/lexema/actions/runs/37157579692)). A local seed of
the same release reads 189 on 172. This report names the three entries and says why.
Everything here comes from public files in `povlabs/lexema-data`. The shared D1 was not
read.

## What was run

| | |
|---|---|
| Master | `it-0c432803`, `source/it-extract.jsonl.gz` (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`), with the raw pages of `source/itwiktionary-20260701-pages-articles.xml.bz2` |
| Feed | `it-78385b62`, `source/it-78385b62.jsonl.gz` (SHA-256 `78385b6229d19ed990ada6f6f33930585701c3bdc146fb1c849818df72a3e8d4`), the 268 changes of [2026-10-01-first-feed-selection.ids](2026-10-01-first-feed-selection.ids) |
| Code | `planPageEntries` in [src/import/loadPageEntries.ts](../src/import/loadPageEntries.ts), `planApply` in [src/update/apply.ts](../src/update/apply.ts), at this PR's head |
| Script | [tools/explainPageEntryGap.ts](../tools/explainPageEntryGap.ts); output [2026-10-04-page-entry-gap.json](2026-10-04-page-entry-gap.json) |

The script builds two local SQLite dictionaries from one seed of the master. The seed
reads record pages and hides by section language, as the shared dictionary's seed did,
but writes no page-only entry. Then:

- **local:** rule v1's 14 entries are loaded, and the load of all 203 entries is planned.
- **shared:** the 268 feed changes are applied first (214 new records, 54 changed), as
  production applied them on 2026-10-01
  ([retention audit](2026-10-02-first-feed-retention.md)). Then rule v1's 14 entries are
  loaded, and the same load is planned.

Re-run it from the repository root. It takes a few minutes and leaves about 4.5 GB in
the work directory, which must not exist yet:

```sh
gh api -H "Accept: application/vnd.github.raw" repos/povlabs/lexema-data/contents/source/it-extract.jsonl.gz > it-extract.jsonl.gz
gh api -H "Accept: application/vnd.github.raw" repos/povlabs/lexema-data/contents/source/itwiktionary-20260701-pages-articles.xml.bz2 > itwiktionary-20260701-pages-articles.xml.bz2
gh api -H "Accept: application/vnd.github.raw" repos/povlabs/lexema-data/contents/source/it-78385b62.jsonl.gz > it-78385b62.jsonl.gz
pnpm exec tsx tools/explainPageEntryGap.ts it-extract.jsonl.gz itwiktionary-20260701-pages-articles.xml.bz2 it-78385b62.jsonl.gz <new work dir> > result.json
```

## The counts

Both plans match their real counterparts exactly: the local one the local seed's
numbers in [docs/PAGE_ENTRIES.md](../docs/PAGE_ENTRIES.md), and the shared one the
merged declaration.

| Rows written | Local plan | Shared plan | Gap | Issue's gap |
|---|---:|---:|---:|---:|
| `raw_page` | 172 | 169 | 3 | 3 |
| `recovered_entry` | 189 | 186 | 3 | 3 |
| `entry_definition` | 219 | 216 | 3 | 3 |
| `entry_label` | 129 | 128 | 1 | 1 |
| `entry_example` | 21 | 21 | 0 | 0 |
| `accent_fold` | 5 | 5 | 0 | 0 |
| `typo_key` | 1,878 | 1,827 | 51 | 51 |
| deleted `accent_fold`, `typo_key` | 1, 100 | 1, 100 | 0 | 0 |

## The three entries

On the shared plan these three get `spelled-by-a-record`. On the local plan they get
`write`. Each is read by rule v2 from line 2 of its page, with one definition.

| Title | Revision | Part of speech | Labels | `typo_key` rows | Record that spells it | Feed change |
|---|---:|---|---:|---:|---|---|
| `antico nordico` | 3909947 | phrase | 1 | 15 | `it-78385b62`, phrase | `new-d570bc0e2af1` |
| `orecchioni` | 3578655 | noun | 0 | 10 | `it-78385b62`, noun | `new-17534afb3882` |
| `piangere sul latte versato` | 4060155 | phrase | 0 | 26 | `it-78385b62`, phrase | `new-bf896a4781b2` |
| **Total** | | | **1** | **51** | | |

Each feed change id is in
[2026-10-01-first-feed-selection.ids](2026-10-01-first-feed-selection.ids). The
`typo_key` rows are each title's key and its one-character-short spellings
(`typoKeyRowsOf`).

The three entries account for the whole gap. Planned on the local dictionary without
them, the load counts exactly what the shared plan counts, in every table
(`gapIsTheSkipped: true` in the output). Nothing is left unexplained.

The `update:auto` run of 2026-10-03
([declaration](../dictionary-changes/2026-10-03-update-auto-it-78385b62.json)) added no
record, so it is not the cause. The script does not replay it, and the counts match
without it. A changed record keeps its word and part of speech, so it cannot stop a
record from spelling one of these titles.

## Are the skips legitimate?

Yes, all three. On the shared dictionary each word has a record from the feed. The
record is not hidden and no change replaced it. Its one gloss is the same text as the
definition the page-only entry would have written:

| Title | Record gloss, and the page's definition |
|---|---|
| `antico nordico` | variante imprecisa di norreno, antica lingua scandinava, progenitrice delle moderne lingue nordiche |
| `orecchioni` | nome comune della parotite, infiammazione delle parotidi causata dal virus specifico |
| `piangere sul latte versato` | lamentarsi di qualcosa in ritardo |

So no definition is lost. A search for these words on the shared dictionary finds the
record, as it finds any record. No bug is filed, and the skip rule is unchanged.
