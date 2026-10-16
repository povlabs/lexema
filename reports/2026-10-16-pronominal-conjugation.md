# Pronominal verbs: which get a built table, and how the rule compares with the source

Measurement for [issue #837](https://github.com/povlabs/lexema/issues/837), run
2026-10-16. Most pronominal verbs (`trasferirsi`, `alzarsi`, `andarsene`) have a
record with no forms. Rule `it-pronominal-conjugation/v1`
([src/italian/pronominalConjugation.ts](../src/italian/pronominalConjugation.ts))
now builds their table from the base verb's when the page is built. This report
counts which records get one, and compares the rule with the tables the source
does give.

## What was measured

| | |
|---|---|
| Release | `it-0c432803`, `it-extract.jsonl.gz` (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`) |
| Script | [`tools/measurePronominalConjugation.ts`](../tools/measurePronominalConjugation.ts), read-only, about a minute |
| Output | [2026-10-16-pronominal-conjugation.json](2026-10-16-pronominal-conjugation.json) |

Run it with
`pnpm exec tsx tools/measurePronominalConjugation.ts <it-extract.jsonl.gz> > result.json`.

## The records

The archive has 1,070 Italian `verb` records, of 1,053 words, whose word the rule
reads as pronominal (one word of lower-case letters ending in `-rsi` or `-rsene`).

| What its page shows | Records |
|---|---:|
| Its own source table, as before (`arrendersi`, `accorgersi`) | 94 |
| A table built from its base verb's (`trasferirsi`, `alzarsi`, `andarsene`) | 750 |
| No table: no base verb record has one (`pentirsi`: no `pentire` record) | 152 |
| No table: the record is another verb's form, not a pronominal verb (`corsi` of correre, `persi` of perdere) | 74 |

Of the 750, 743 take a base record that lists `<word> (coniugazione)`, the
source's own pointer; the other 7 (`dirsi`, `sottrarsi`, `uscirsene`, ...) take
the first base record with a table. 54 have two base records; in every one of
those the two records' tables are identical, form for form. The 152 are listed
under `noneWords` in the output and filed as
[#838](https://github.com/povlabs/lexema/issues/838); each one's outcome under
`it-regular-conjugation/v1` is in
[2026-10-16-pronominal-regular-tables.md](2026-10-16-pronominal-regular-tables.md).

## Every word page, before and after

`pnpm run diff:pages a94664d7 5bf93594` (`web/pageDiff/`) seeded the whole
release at each commit with that commit's own `seed:dev`, and rendered every
query's page with the real `searchAttempt` and `Outcome`. Base a94664d is
`origin/main` after the Wikidata-words epic (#815); head 5bf9359 is this branch
after merging it, so both sides carry the `it-word-shape/v1` and
`it-pronominal-pair/v1` routes (#809, #810). The queries were every page word
(550,466: each headword and each word a `form_of` edge names) and, by
`--words`, 75,030 more read off the release for the 1,053 `-rsi`/`-rsene`
words: `si` and each one-word third-person cell of a base verb's table (22,988,
the pair route: `si trasferiscono`), every spelling the rule builds
(`trasferendosi`, `mi sono alzato`, `me ne vado`), and each clitic infinitive
(`alzarmi`, `andartene`, the shape route).

| | Pages |
|---|---:|
| Compared (a page at both commits) | 569,026 |
| Added or removed | 0 |
| Changed | 6,727 |
| … a `-rsi`/`-rsene` headword's page | 743 |
| … a `si` + verb query, which the pair route answers with a `-rsi` verb's page (`si trasferiscono`: `trasferirsi`) | 5,984 |
| … whose records about the query include no `-rsi`/`-rsene` verb | **0** |

Each changed page was then rendered again at the head with its base verb's
records taken away, so no rule-built table can be drawn. All 6,727 came back
byte for byte the base page. So the built table, and the change it brings to its
reading, is the whole change; no other page moved, and no pair, shape or built
spelling query changed in any other way. The 5,984 pair pages belong to 740
pronominal verbs; a pair whose verb keeps its source table (`si arrende`) did
not change.

An earlier run over the 743 headword pages, at 4a13d9e and bb8e357 (before the
merge), split them three ways:

| | Pages |
|---|---:|
| … gained one *Forme* section, the rest byte for byte the same | 474 |
| … gained one *Forme* section, and the reading it sits in, which had nothing to show and was a bare unnumbered heading, now carries its number (`1 · Verbo`) | 250 |
| … had a declared table of one to six cells (#799), now the built one | 19 |

The 19 are `abbarbicarsi`, `abbottonarsi`, `accendersi`, `acquietarsi`,
`addirsi`, `addolorarsi`, `adeguarsi`, `adempiersi`, `affaccendarsi`,
`affannarsi`, `affogarsi`, `ammirarsi`, `contenersi`, `dismuoversi`,
`inorgoglirsi`, `laurearsi`, `ostinarsi`, `rivedersi` and `sdraiarsi`.
`laurearsi`'s declared table was the one cell `laureati`; the built one holds
that cell too.

The 743 pages and the 750 records above count different things. `amarsi`,
`farsi` and `abbassarsi` have a second record with its own table, so their page
draws that one and is left as it is. `andarsene`, `fregarsene` and
`raggiungersi` count among the 74 forms of another verb in the script, which
reads a `form_of` edge by its word; on the page their edges reach no verb record
(`andarsene`'s served edge names `senza mezzi termini`), so they take the built
table. Several words have two records and one page.

## The rule against the 94 source tables

Of the 94 records with their own table, 79 have a base verb with a table (15
have none: `accorgersi` has no `accorgere`). For those 79 the script runs the
rule on the base verb's forms and compares the two tables cell by cell: 7,347
cells, of which 6,592 hold the same spellings. 51 tables match in every cell.
Each of the 755 cells that differ is listed in the output with its reason; the
reasons are:

| Reason | Cells | Records |
|---|---:|---|
| `source-builds-on-avere`: the source table builds its compound tenses on avere (`mi ho abbagliato`) and names avere its auxiliary; the rule uses essere ([#839](https://github.com/povlabs/lexema/issues/839)) | 473 | abbagliarsi, abbracciarsi, dominarsi, incontrarsi, mangiarsi, rimediarsi, rovesciarsi, sottomettersi, staccarsi, suddividersi (two records) |
| `source-adds-participle`: the source cell is the rule's plus the participle with the pronoun on (`mi sono arreso, arresosi`; `participio arresosi, arresosisi`) | 134 | arrendersi, conoscersi, muoversi, sottomettersi, suddividersi |
| `base-lists-other-spellings`: the base verb's table spells the verb differently from the source's pronominal table (`affaccerò` / `affaccierò`, `asciughi` / `asciugi`, `postosi` / `pstosi`) or lists other spellings (`abbattei` / `abbattetti, abbattei`) | 114 | abbattersi, affacciarsi, aggiungersi, arrendersi, asciugarsi, commuoversi, disporsi, farsi, muoversi, porsi, sedersi, spiegarsi |
| `source-pronoun-on-first-only`: the source writes the pronoun before a cell's first spelling only (`mi siedo, seggo`), the rule before each (`mi siedo, mi seggo`) | 29 | connettersi, estinguersi, perdersi, sedersi |
| `source-imperative-without-pronoun`: the source lists an imperative with no pronoun (`commuovi`, `siedi`); the rule attaches one (`commuoviti`, `siediti`) | 4 | commuoversi, muoversi, sedersi |
| `base-has-no-cell`: the base record lists no auxiliary (`amare`), so the built table has no *ausiliare* | 1 | amarsi |

No differing cell comes from the rule misreading a base cell: every difference
is a difference between the two source tables, or the source's pronominal table
departing from the shape Italian gives these forms.

## What the rule leaves to the base verb

A built cell is exactly as good as the base cell it came from. Where the base
table has a slip, the built one carries it: `disporre` lists `disponiate` as its
`voi` imperative, so `disporsi` would read `disponiatevi`; `sedere`'s
congiuntivo lists `sega`, so `sedersi` would read `mi sega`. Both verbs keep
their own source tables, so neither shows; a verb with no table of its own and
such a base would.
