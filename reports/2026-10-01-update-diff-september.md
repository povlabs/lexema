# What kaikki's September build would change in the July master

Measured 2026-10-01 for [#18](https://github.com/povlabs/lexema/issues/18), on
a laptop, with `pnpm run update:diff` and `pnpm run update:apply`
([the runbook](../docs/UPDATE_THE_DICTIONARY.md)).

## The two files

| | Master | Later build |
|---|---|---|
| Release | `it-0c432803` | `it-78385b62` |
| SHA-256 | `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf` | `78385b6229d19ed990ada6f6f33930585701c3bdc146fb1c849818df72a3e8d4` |
| Source | `it-extract.jsonl.gz`, downloaded 2026-07-20 | kaikki.org, `last-modified: Mon, 28 Sep 2026 15:24:26 GMT`, 43,612,281 bytes, downloaded 2026-10-01 |
| Dump | `itwiktionary-20260701` (inferred) | `itwiktionary-20260901`, named by its build log |
| Italian records | 560,357 | 560,588 in 801,663 lines |

The master was a local full seed of the July file, made with the schema from
before #18, so the diff read it without the update tables, as it would read the
shared dictionary today.

## The diff

| Group | Count |
|---|---:|
| New words | 259 |
| Changed or fixed senses | 693 |
| Other changes, senses the same | 538,858 |
| Lost words | 33 |
| Ambiguous groups, not matched | 1,299 |
| Unchanged records | 18,147 |

It ran in about five minutes and wrote nothing to the master.

Almost every record changed because the later extractor added a field:
`etymology_links` differs on 539,406 of the 539,551 changed records, and is the
only difference on 536,962. After it, the fields that differ most often are
`translations` (1,464 records), `senses` (693), `synonyms` (429) and
`categories` (319).

The 1,299 ambiguous groups follow from the same field: a word with two to five
records of one part of speech has every record changed, so none pairs by
content ([#369](https://github.com/povlabs/lexema/issues/369)).

## An apply

Three changes applied to the same local master:

| Id | Change | Record |
|---|---|---|
| `chg-2268f0bddfb8` | `casa` (noun): `etymology_links`, `translations` | 560358, replacing 1 |
| `chg-c6a71a3abae2` | `abbandonare` (verb): senses | 560359, replacing 414 |
| `new-49041f266972` | `antifurto` (noun), new | 560360 |

The apply added the update tables and views to the master in the same
transaction, wrote 3 records with 99 `lookup_form`, 18 `sense`, 18
`sense_gloss`, 3 `sense_label` and 417 `grammar_claim` rows and 15 `typo_key`
rows, all under `it-78385b62`, and read itself back.

`casa` carries 7 recovered definitions and, added for this check, one review.
A digest of every row of `raw_page`, `recovered_definition`,
`recovered_label`, `recovered_example` and `claim_review` was the same before
and after. A lookup of `casa` then answered from `it-78385b62:1` with its 7
recovered definitions and the review, which still names `it-0c432803:1`.
`abbandonato`, a form of `abbandonare` still in the July file, links to the
September `abbandonare`.
