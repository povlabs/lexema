# Fields the page-only entries' pages supply

Read-only measurement for [#439](https://github.com/povlabs/lexema/issues/439),
2026-10-04, under [ADR 0026](../.decisions/0026-recovered-entries-carry-what-the-word-page-shows.md).

The [machine-readable output](2026-10-04-page-entry-fields.json) lists every
word of the page-only set, its revision, each of its entries with its part of
speech, the line that states it, its rule and its counts of definitions, labels
and examples, and which granted fields the entry and the word carry. It verifies
release `it-0c432803` (archive SHA-256
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`) and dump
`itwiktionary-20260701` (SHA-1 `2bdd444236f7dcd26fee3652dbd641c31d0d9651`).

The set is the one the seed reads: every page of the dump whose title no record
of the archive spells, recovered by rules `italian-page-entry/v1` and
`italian-page-entry/v2` (`findPageEntries` in
[loadPageEntries.ts](../src/import/loadPageEntries.ts)). It is **186 words and
203 entries**, the count [PAGE_ENTRIES.md](../docs/PAGE_ENTRIES.md#load-them-into-a-seeded-dictionary)
states for a local seed. Each field is read by the production rule
`italian-page-facts/v1` ([pageFacts.ts](../src/italian/pageFacts.ts)).

## Result

**No word gives every field.** Every word has a part of speech and a definition;
each other field comes from some pages only.

| Field | Words | Entries |
|---|---:|---:|
| Part of speech | 186 | 203 |
| Definitions, with labels and examples | 186 | 203 |
| Gender and number | 113 | 122 |
| Form-of target | 35 | 42 |
| Forms | 45 | 54 |
| Pronunciation | 47 | 53 |
| Etymology | 114 | 126 |
| Synonyms | 50 | 58 |
| Antonyms | 29 | 37 |
| Derived words | 20 | 25 |
| Expressions | 4 | 5 |

A word counts a field when any of its entries carries it. The word-section
fields (pronunciation, etymology, the three word lists, expressions) are the
page's, so every entry of a page carries them; gender and number, forms and
form-of targets belong to the entry's own section.

- **Forms** come only from pages that write them out: 24 entries name plurals
  with `{{Linkp|…}}`, and 30 write a `{{Tabs|…}}` table of four cells. No
  verb page of the set writes a conjugation out. The verbs write `{{Pn|c}}`,
  which links to the conjugation on another page,
  `Appendice:Coniugazioni/Italiano/<verb>` (Module:Pn, raw source read
  2026-10-04), and ADR 0026 reads only the entry's own page.
  `tremolante`'s `{{it-agg|tremolant|e|i}}` builds its forms from a stem, and
  gives none.
- **Gender and number** come from the headword line's stamp. A stamp of
  another shape gives none: `cremastico`'s `masc. sing.`, `Stagirita`'s
  `m solo sing`, `armadeo`'s `m pl. -i`.
- **Etymology**: 21 `{{Noetim}}` lines give none, as the archive drops the
  same placeholder (#255).
- **Expressions**: only `lungo`, `purità`, `raccontare` and `tremare` write a
  `{{-prov-}}` item the rule reads.

The pages also write hyphenation (`{{-sill-}}`) and related terms
(`{{-rel-}}`), which no field reads: the word page shows neither.

## Reproduce

With the verified archive and dump copied locally from `povlabs/lexema-data`:

```sh
pnpm run measure:page-entry-fields \
  --archive it-extract.jsonl.gz \
  --dump itwiktionary-20260701-pages-articles.xml.bz2 \
  --out reports/2026-10-04-page-entry-fields.json
```
