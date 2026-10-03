# Italian pages with definitions and no record, by layout

Read-only measurement for [#474](https://github.com/hueypov/lexema/issues/474),
part of epic [#471](https://github.com/hueypov/lexema/issues/471), 2026-10-03.
It widens [the 2026-10-02 measurement](2026-10-02-page-entry-recovery.md) from
form-of targets to the whole dump. It changes no production rule.

The [machine-readable output](2026-10-03-unrecorded-page-layouts.json) lists
every counted title with its revision id, revision timestamp, layout group, the
part-of-speech sections that hold its definitions, the parts of speech the
detector reads, and what rule `italian-page-entry/v1` does with it. It verifies
release `it-0c432803` (archive SHA-256
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`) and dump
`itwiktionary-20260701` (SHA-1 `2bdd444236f7dcd26fee3652dbd641c31d0d9651`).

## What is counted

A page counts when all of these hold:

- It is one of the dump's 758,429 main-namespace pages.
- No admitted Italian archive record has its title as `word`.
- It has at least one `#` line (`#`, `##`; not `#*` or `#:`) that states
  something in plain text. A line with only templates (`{{Nodef|it}}`), italics
  (a gender stamp) or the bold headword does not count. A redirect is not a
  definition.
- That line is Italian. Either it sits after an Italian marker (`{{-it-}}` in
  any heading form) and before the next language marker, or the page has no
  language marker yet and the line sits under a heading that names Italian
  (`{{-sost-|it}}`, `{{Riflessivo|it}}`). A line that any marker or heading
  places in another language is not Italian.

**245 pages** count. The fixed detector reads **192** of them with a part of
speech the layout states. Rule `italian-page-entry/v1` recovers **13** of the
245.

## Count per layout

Each page is in one group. A page copied from English Wiktionary (`{{Trasfen}}`)
goes to its own group first. Then a page with no part-of-speech signal, then a
page with several part-of-speech sections. Every other page is grouped by how it
marks Italian and what opens its one section.

| Layout | Pages | Read with a stated part of speech | Examples |
|---|---:|---:|---|
| No language heading; `{{-sost-\|it}}` template | 86 | 86 | `addirizzare`, `autoconsumo`, `blasonario`, `talora`, `mastoide` |
| Bare `{{-it-}}` line; `{{-sost-\|it}}` template | 42 | 42 | `alcole`, `amano`, `carrozzone`, `ciborio` |
| No part-of-speech signal | 42 | 0 | `motteggio`, `denunziare`, `tardamente`, `beige perlato` |
| `== {{-it-}} ==`; template with stray spaces (`{{-sost  form-\|it}}`, ` {{-sost-\|it}}`) | 21 | 21 | `a monte`, `bituminosa`, `ghiribizzi`, `dessiografia` |
| Copied from English Wiktionary (`{{Trasfen}}`) | 17 | 9 | `follare`, `mezz'ora`, `volerci`, `insino` |
| Several part-of-speech sections | 16 | 16 | `lungo`, `scapestrato`, `valente`, `piacione` |
| Bare `{{-it-}}` line; bare `{{-sost-}}` template | 8 | 8 | `ancudine`, `francesismo`, `piallare` |
| `== {{-it-}} ==`; `{{Transitivo\|it}}`, `{{Intransitivo\|it}}` or `{{Riflessivo\|it}}`, no part-of-speech heading | 6 | 6 | `accerchiarsi`, `dipendere`, `tremare` |
| Broken `{{-it-}}` heading (`= {{-it-}} =`, `=== {{-it-}} ===`, text before `==`); `{{-sost-\|it}}` template | 4 | 4 | `celta`, `purità`, `subliminali` |
| `== {{-it-}} ==`; template the part-of-speech table does not know (`{{-loc veb-\|it}}`, `{{-pron-\|it}}`) | 2 | 0 | `piangere sul latte versato`, `tantundem` |
| Bare `{{-it-}}` line; English heading (`===Adjective===`) | 1 | 0 | `irrequieti` |
| **Total** | **245** | **192** | |

The JSON names the groups `none-heading/template`, `bare-heading/template`,
`no-part-of-speech`, `standard-heading/spaced-template`,
`english-wiktionary-copy`, `several-parts-of-speech`,
`bare-heading/bare-template`, `standard-heading/verb-label`,
`malformed-heading/template`, `standard-heading/unknown-template` and
`bare-heading/english-heading`, in the table's order.

**Several Italian part-of-speech sections: 19 pages.** 16 are in their own
group above. The other 3 (`insino`, `tuttavolta`, `vale a dire`) are English
Wiktionary copies. All 16 in the group are read with a stated part of speech
for every section. For example, `lungo` is Aggettivo + Preposizione and
`scapestrato` is Aggettivo + Sostantivo + Voce verbale. Whether such a page
gives one entry per section is the open question for the ADR child of #471.

**No part-of-speech signal: 42 pages.** 19 of them are RAL colour pages
(`beige perlato`, `oro perlato`). The rest include `motteggio`, `denunziare`,
`tardamente` and place names (`Misurata`, `Natanya`).

## What the production rule recovers

Added for [#477](https://github.com/hueypov/lexema/issues/477). The
production rule is the one the seed runs: `italian-page-entry/v1`, then
`italian-page-entry/v2` for the pages v1 does not recover
([ADR 0028](../.decisions/0028-recovered-pages-any-part-of-speech.md)). The
command runs it over every main-namespace page with no Italian archive record,
not only the 245 counted ones.

**185 pages, 202 entries.** 184 of the pages are among the 245 counted above
and give 201 entries. The other one is `dismagare`, which rule v1 recovers but
the detector does not count (see the cross-checks). A page gives one entry per
part-of-speech section. 14 entries are v1's and 188 are v2's.

| Layout | Pages | Pages recovered | Entries |
|---|---:|---:|---:|
| No language heading; `{{-sost-\|it}}` template | 86 | 85 | 85 |
| Bare `{{-it-}}` line; `{{-sost-\|it}}` template | 42 | 42 | 42 |
| No part-of-speech signal | 42 | 0 | 0 |
| `== {{-it-}} ==`; template with stray spaces | 21 | 21 | 21 |
| Copied from English Wiktionary (`{{Trasfen}}`) | 17 | 0 | 0 |
| Several part-of-speech sections | 16 | 16 | 33 |
| Bare `{{-it-}}` line; bare `{{-sost-}}` template | 8 | 8 | 8 |
| `== {{-it-}} ==`; verb label, no part-of-speech heading | 6 | 6 | 6 |
| Broken `{{-it-}}` heading; `{{-sost-\|it}}` template | 4 | 4 | 4 |
| `== {{-it-}} ==`; template the detector's table did not know | 2 | 2 | 2 |
| Bare `{{-it-}}` line; English heading | 1 | 0 | 0 |
| Not counted by the detector | — | 1 | 1 |
| **Total** | **245** | **185** | **202** |

The detector reads 192 pages with a stated part of speech, and the rule
recovers 184 of the counted pages. The difference has three parts:

- The rule recovers 9 fewer English Wiktionary copies. ADR 0028 admits none.
- It recovers 1 fewer page in the no-heading group: `Aglio` states the
  section but no definition the rule reads (`no-definition`).
- It recovers 2 more in the unknown-template group, whose two templates ADR
  0028 added to the table.

The JSON gives each counted title a `production` field (the rule's outcome and
its entry count), each group `recoveredPages` and `recoveredEntries`, and the
totals and uncounted titles under `recoveredByProductionRule`. A local seed of
`it-0c432803` on the same dump wrote exactly these 185 pages and 202
`recovered_entry` rows.

## The detector

The detector reads layout only, never the definition text. It is in
[`measureUnrecordedPages.ts`](../src/import/measureUnrecordedPages.ts) and
nowhere else. A section's part of speech is stated in one of four ways:

- a `{{-x-|it}}` template that the production table `POS_TITLE_BY_TEMPLATE`
  knows. Stray spaces in the name are read as one space;
- a bare `{{-x-}}` template that the same table knows;
- `{{Transitivo|it}}`, `{{Intransitivo|it}}` or `{{Riflessivo|it}}` with no
  heading open, which states Verbo;
- a written Italian title from the same table (`'''''Verbo'''''`,
  `=== Verbo transitivo ===`).

English headings (`===Verb===`) and templates the table does not know state
none. A page is read when every Italian definition sits in a section with a stated
part of speech. In 9 English Wiktionary copies the detector reads a part of
speech, but their definitions are often in English (`mezz'ora`: "half an
hour").

## Cross-checks

- Rule `italian-page-entry/v1` recovers 13 of the 245 pages: the 14 eligible
  titles of the 2026-10-02 report minus `dismagare`. That page writes its
  definitions as numbered prose with no `#` line, so it is outside this count.
- Of the 2026-10-02 report's 104 dangling titles with a page, 25 count here.
  The other 79 have no Italian `#` line that states something. They are pages
  in another language, redirects (`gottare`), stubs with prose and no `#` list
  (`ghindare`, `gazare`, `zigare`), and pages with no definition line
  (`sghiacciare`).
- `reports/2026-10-02-page-entry-recovery.json` still reproduces byte for
  byte with its own command.
- Running this command twice on the same inputs gave byte-identical JSON.

## Reproduce

With the verified archive and dump copied locally from `hueypov/lexema-data`:

```sh
pnpm exec tsx src/import/measureUnrecordedPages.ts \
  --archive it-extract.jsonl.gz \
  --dump itwiktionary-20260701-pages-articles.xml.bz2 \
  --out reports/2026-10-03-unrecorded-page-layouts.json
```

The same command writes the production rule's counts. The script refuses an
archive whose SHA-256 is not `it-0c432803`, and a dump
whose size or SHA-1 does not match. Titles are sorted by code unit, so the
output does not depend on the machine's locale. This measurement performed no
shared write.
