# Searching a word without its final accent or apostrophe

Measurement for [issue #468](https://github.com/hueypov/lexema/issues/468), run 2026-10-03.
A reader types `citta` for `città`, or `dell` for `dell'`. This report counts, for every
served one-word headword that ends in an accented vowel or an apostrophe, what a search
for that spelling without the final mark answers, before and after the fix.

## What was measured

| | |
|---|---|
| Release | `it-0c432803`, `it-extract.jsonl.gz` (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`), seeded fresh with `pnpm run seed:dev` into a local D1, with the raw pages of `itwiktionary-20260701-pages-articles.xml.bz2`: 560,357 records, 1,273,350 `lookup_form` rows, 44,952 `accent_fold` rows. No feed applied |
| Headwords | every distinct `surface_key` of a served `lookup_form` row with `origin = 'headword'` that holds no space and ends in an accented vowel or an apostrophe: 32,734 of 539,864 |
| Search | the page's: `lookup()`, then `findNearby()` when it finds nothing (src/lookup/nearby.ts) |
| Before | `findNearby` at `origin/main` `cc52f0b`, with the same database and script |
| After | `findNearby` at this PR's head |
| Script | [`src/lookup/measureBareSpellings.ts`](../src/lookup/measureBareSpellings.ts), read-only |

Re-run it with:

```sh
SEED_INPUT=it-extract.jsonl.gz SEED_SQL=.data/full-sql SEED_STATE=.data/full-state pnpm run seed:dev
SEED_STATE=.data/full-state pnpm run measure:bare-spellings
```

Each headword falls in one group:

- **Found:** the exact lookup finds the bare spelling, because it is a word of its own
  (`abbandono` for `abbandonò`). Nothing is offered. This is the ambiguous case the issue
  leaves for Huey's ruling.
- **Best offer:** not found, and the headword leads "Did you mean".
- **Offered, not first:** not found, and the headword is offered after another spelling.
- **Not offered:** not found, and the headword is not offered at all.

## Results

Before, at `origin/main`:

| Outcome | Final accent | Final apostrophe | All |
|---|---:|---:|---:|
| Found (ambiguous) | 10,146 | 12 | 10,158 |
| Best offer | 22,564 | 1 | 22,565 |
| Offered, not first | 5 | 6 | 11 |
| Not offered | 0 | 0 | 0 |
| Total | 32,715 | 19 | 32,734 |

After, at this PR's head:

| Outcome | Final accent | Final apostrophe | All |
|---|---:|---:|---:|
| Found (ambiguous) | 10,146 | 12 | 10,158 |
| Best offer | 22,564 | 4 | 22,568 |
| Offered, not first | 5 | 3 | 8 |
| Not offered | 0 | 0 | 0 |
| Total | 32,715 | 19 | 32,734 |

The accent case already worked at `origin/main`: no headword with a final accent goes
unoffered. `perche`, `piu` and `caffe` lead with `perché`, `più` and `caffè`. Only 19
Italian headwords end in an apostrophe.

**`citta` is in the ambiguous group on the full release.** The exact lookup finds it as a
form in the table of `citto` (noun), so the page shows that and offers no `città`. The
issue's own example therefore needs the ruling below. In the committed fixtures, where no
record names `citta`, it offers `città` first.

## What changed

Three apostrophe words moved from "offered, not first" to "best offer". Before, the
accent step did not reach them, so the one-edit step led with a shorter word:

| Query | Before | After |
|---|---|---|
| `dall` | led with `dal`, `dall'` later | `dall'` |
| `dell` | led with `del`, `dell'` later | `dell'` |
| `nell` | led with `nel`, `nell'` later | `nell'` |

`oblast` → `oblast'` was already the best offer, through the one-edit step.

## The eight still offered second

Each shares its bare spelling with another headword, and both are offered as the same
letters. The more common one leads (`rankCandidates`). None is the only headword with
those letters:

- final accent: `ahime` → `ahimé` (led with `ahimè`), `démode` → `démodé` (led with
  `demodé`), `piu` → `piú` (led with `più`), `voro` → `vorò` (led with `võro`), `xche` →
  `xchè` (led with `xché`);
- final apostrophe: `addi` → `addi'` (led with `addì`), `sdi` → `sdi'` (led with `sdì`),
  `tumefa` → `tumefa'` (led with `tumefà`).

## The ambiguous group, left for a ruling

10,158 bare spellings are words of their own, so the search finds them and offers nothing.
"Word" here means any served spelling, a form in a table included, as `citta` is. Many are
a verb's past and its first person present (`abbandonò` and `abbandono`); the counts do
not split them further. The 12
apostrophe words are `contraffa'`, `d'`, `di'`, `fa'`, `l'`, `mo'`, `po'`, `ridi'`, `t'`,
`un'`, `va'` and `xk'`. Whether to offer the written form beside the found word is not
yet ruled (#468, "Out of scope").
