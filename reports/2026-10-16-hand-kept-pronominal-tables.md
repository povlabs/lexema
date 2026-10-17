# Hand-kept tables for the 24 pronominal verbs the rule cannot decide

Measurement for [issue #844](https://github.com/povlabs/lexema/issues/844), run
2026-10-16. [The #838 report](2026-10-16-pronominal-regular-tables.md) listed
24 pronominal verb records for Huey: `it-regular-conjugation/v1` cannot read
their class from the source, so their pages showed meanings and no table.
Each now has one outcome: a hand-kept base table citing an en.wiktionary
revision ([src/italian/handKeptTables.ts](../src/italian/handKeptTables.ts),
[ADR 0031](../.decisions/0031-hand-kept-readings-fill-source-gaps.md)'s
2026-10-16 amendment), or listed for Huey.

## What was measured

| | |
|---|---|
| Release | `it-0c432803`, `it-extract.jsonl.gz` (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`) |
| Records | the 24, verbatim in [fixtures/hand-kept-tables/archive-lines.jsonl](../fixtures/hand-kept-tables/archive-lines.jsonl) |
| Evidence | 23 en.wiktionary revisions and the tables their `{{it-conj}}` calls expand to, pinned in [fixtures/hand-kept-tables/](../fixtures/hand-kept-tables/PROVENANCE.md) |
| Script | [`tools/measurePronominalConjugation.ts`](../tools/measurePronominalConjugation.ts), which now gives a declined record its hand-kept table as the page does |
| Output | [2026-10-16-pronominal-regular-tables.json](2026-10-16-pronominal-regular-tables.json), `noneOutcomes` |

Run it with
`pnpm exec tsx tools/measurePronominalConjugation.ts <it-extract.jsonl.gz> > result.json`.
Every other count and list in that JSON is as #838 left it.

## The 24 records

| Outcome | Records |
|---|---:|
| A hand-kept table: a regular class the cited call names | 11 |
| A hand-kept table: the base verb's own cells | 10 |
| Not a pronominal verb (a form or a rare spelling) | 0 |
| Listed for Huey: en.wiktionary has no page for the verb or its base | 3 |
| **Total** | **24** |

No record's gloss says it is another verb's form. 21 have a meaning of their
own (`sdarsi`: "abbandonare un'attività per pigrizia"; `inostrarsi`: "tingersi
d'ostro"), and `immusonirsi`, `informicolirsi` and `rivalersi` carry only
Wikizionario's missing-definition notice.

### Hand-kept, a regular class (11)

The cited revision's call names a class `regularCells` already builds, so the
table keeps the class and its stem, and its cells are the rule's.

| Record | Cited revision and call | Class | Sample |
|---|---|---|---|
| impadronirsi | [impadronirsi 91778278](https://en.wiktionary.org/w/index.php?title=impadronirsi&oldid=91778278) `{{it-conj\|+isc}}` | `ire-b` | *mi impadronisco* |
| appassirsi | [appassire 90569343](https://en.wiktionary.org/w/index.php?title=appassire&oldid=90569343) `{{it-conj\|e[intransitive]:a[transitive]/+isc}}` | `ire-b` | *mi appassisco* |
| assennirsi | [assennire 71366604](https://en.wiktionary.org/w/index.php?title=assennire&oldid=71366604) `{{it-conj-rfc\|a/+isc}}` | `ire-b` | *mi assennisco* |
| immusonirsi | [immusonirsi 71366912](https://en.wiktionary.org/w/index.php?title=immusonirsi&oldid=71366912) `{{it-conj\|+isc}}` | `ire-b` | *mi immusonisco* |
| informicolirsi | [informicolirsi 75047050](https://en.wiktionary.org/w/index.php?title=informicolirsi&oldid=75047050) `{{it-conj\|+isc}}` | `ire-b` | *mi informicolisco* |
| susseguirsi | [susseguirsi 90583647](https://en.wiktionary.org/w/index.php?title=susseguirsi&oldid=90583647) `{{it-conj\|@}}` | `ire` | *mi susseguo* |
| adastiarsi | [adastiarsi 71027279](https://en.wiktionary.org/w/index.php?title=adastiarsi&oldid=71027279) `{{it-conj\|à}}` | `iare` | *mi adastio*, *ti adasti* |
| appollaiarsi | [appollaiarsi 71105779](https://en.wiktionary.org/w/index.php?title=appollaiarsi&oldid=71105779) `{{it-conj\|à}}` | `iare` | *mi appollaio* |
| incacchiarsi | [incacchiarsi 71106904](https://en.wiktionary.org/w/index.php?title=incacchiarsi&oldid=71106904) `{{it-conj\|à}}` | `iare` | *mi incacchio* |
| industriarsi | [industriarsi 92190948](https://en.wiktionary.org/w/index.php?title=industriarsi&oldid=92190948) `{{it-conj\|ù}}` | `iare` | *mi industrio* |
| infischiarsi | [infischiarsi 80612746](https://en.wiktionary.org/w/index.php?title=infischiarsi&oldid=80612746) `{{it-conj\|ì-}}` | `iare` | *mi infischio*, *infischiati* |

`appassirsi` and `assennirsi` have no en.wiktionary page, so each cites its
base's. `assennire`'s `{{it-conj-rfc}}` passes its argument to `{{it-conj}}`
unchanged; its note asks only for the base's auxiliary to be reviewed, which
the pronominal table replaces with essere.

### Hand-kept, the base verb's cells (10)

The call names no class Lexema builds, so the table keeps the base verb's
simple forms as the revision's table writes them.

| Record | Cited revision and call | Sample |
|---|---|---|
| obliarsi | [obliarsi 92175298](https://en.wiktionary.org/w/index.php?title=obliarsi&oldid=92175298) `{{it-conj\|ì}}` | *mi oblio*, *ti oblii* (a stressed `i`) |
| avvalersi | [avvalersi 80612794](https://en.wiktionary.org/w/index.php?title=avvalersi&oldid=80612794) `{{it-conj\|/@}}` | *mi avvalgo*, *mi avvalsi*, *mi avvarrò* |
| avvedersi | [avvedersi 67977311](https://en.wiktionary.org/w/index.php?title=avvedersi&oldid=67977311) `{{it-conj\|/@}}` | *mi avvidi*, *mi sono avvisto, avveduto* |
| genuflettersi | [genuflettersi 93133732](https://en.wiktionary.org/w/index.php?title=genuflettersi&oldid=93133732) `{{it-conj\|\@}}` | *mi genuflettei, mi genuflessi*, *mi sono genuflesso* |
| imbattersi | [imbattersi 90564438](https://en.wiktionary.org/w/index.php?title=imbattersi&oldid=90564438) `{{it-conj\|\@}}` | *mi imbattei*, *mi sono imbattuto* |
| ravvedersi | [ravvedersi 90577471](https://en.wiktionary.org/w/index.php?title=ravvedersi&oldid=90577471) `{{it-conj\|/@}}` | *mi ravvidi*, *mi ravvedrò, mi ravvederò* |
| rivalersi | [rivalersi 93588532](https://en.wiktionary.org/w/index.php?title=rivalersi&oldid=93588532) `{{it-conj\|/@}}` | *mi rivalgo*, *mi rivarrò* |
| prefiggersi | [prefiggersi 67588523](https://en.wiktionary.org/w/index.php?title=prefiggersi&oldid=67588523) `{{it-conj\|\@}}` | *mi prefissi*, *mi sono prefisso* |
| assuefarsi | [assuefarsi 92141667](https://en.wiktionary.org/w/index.php?title=assuefarsi&oldid=92141667) `{{it-conj\|@}}`, [assuefare 92141666](https://en.wiktionary.org/w/index.php?title=assuefare&oldid=92141666) `{{it-conj\|a/@}}` | *mi assuefaccio*, *si assuefà*, *assuefatti* |
| stupefarsi | [stupefarsi 77623586](https://en.wiktionary.org/w/index.php?title=stupefarsi&oldid=77623586) `{{it-conj\|@}}`, [stupefare 93134607](https://en.wiktionary.org/w/index.php?title=stupefare&oldid=93134607) `{{it-conj\|a[transitive]:e[intransitive]/@}}` | *mi stupefaccio*, *stupefatti* |

The two verbs on `fare` also cite their base's page, whose table gives the
short `tu` imperative (`assuefa'`) the pronoun doubles on (`assuefatti`).

### Listed for Huey (3)

| Record | Why |
|---|---|
| attremirsi | en.wiktionary has no page for `attremirsi` or `attremire` (the API answers `missing`), so nothing says whether it takes `-isc-`. |
| sdarsi | No page for `sdarsi` or `sdare`, so nothing cited says whether it follows `dare`. |
| inostrarsi | No page for `inostrarsi` or `inostrare`. Its meaning ("tingersi d'ostro") says it is made on `ostro`, not `trarre`, so it is likely a regular `-are` verb, but the rule reads no class from an `-rarsi` ending and nothing cited settles it. |

Each still shows its meanings and no table.

## How the tables were checked

`test/handKeptTables.test.ts` reads each pinned expansion's table and compares
it, cell for cell, with the kept cells: on the verb's own page, with the
pronominal table `it-pronominal-conjugation/v1` builds on them (every simple
tense, the gerund, both participles, the auxiliary, the imperative, and the
`tu` negative imperative); on a base's page, with the base cells themselves.
All 23 revisions agree on every cell. en.wiktionary's tables show no compound
tense; those are built on essere and the kept participle, as for every
pronominal table.

## Every word page, before and after

`pnpm run diff:pages 6dcc50c f9cd588` (`web/pageDiff/`), with
`SEED_INPUT` the release's `it-extract.jsonl.gz`, seeded the whole release at
each commit with that commit's own `seed:dev` and rendered every query's page.
Base 6dcc50c is `origin/main` after #842; head f9cd588 adds the tables. The
queries were every page word and, by `--words`, 1,932 more for the 24 words,
built as #838's were: every spelling the rules now build (`mi avvidi`,
`assuefatti`; each `si` + third-person cell is one of them, the pair route's
query), and the clitic infinitives `-rmi`, `-rti`, `-rci`, `-rvi` of each of
the 24 (the shape route's: `avvedermi`).

| | Pages |
|---|---:|
| Compared (a page at both commits) | 550,459 |
| Added or removed | 0 |
| Changed | 21 |
| … a word with a hand-kept table | 21 |
| … any other page | **0** |

The 21 changed pages are exactly the 21 words with a hand-kept table:
adastiarsi, appassirsi, appollaiarsi, assennirsi, assuefarsi, avvalersi,
avvedersi, genuflettersi, imbattersi, immusonirsi, impadronirsi, incacchiarsi,
industriarsi, infischiarsi, informicolirsi, obliarsi, prefiggersi, ravvedersi,
rivalersi, stupefarsi and susseguirsi. The pages of attremirsi, sdarsi and
inostrarsi did not change. Of the 552,388 queries, the 550,459 compared are
every one that opens a page at either commit, so no page an extra query opens
changed either.
