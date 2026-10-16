# Pronominal verbs with no base table: which get a regular one

Measurement for [issue #838](https://github.com/povlabs/lexema/issues/838), run
2026-10-16. [The #837 report](2026-10-16-pronominal-conjugation.md) left 152
pronominal verb records with no table: no record of their word fills a cell,
and no base verb record has a table (`pentirsi`: no `pentire` record;
`accertarsi`: `accertare`'s record has no forms). Rule
`it-regular-conjugation/v1`
([src/italian/regularConjugation.ts](../src/italian/regularConjugation.ts))
now gives such a verb the regular table of the class the source settles, and
`it-pronominal-conjugation/v1` builds the pronominal table on it. This report
gives each of the 152 records its outcome.

## What was measured

| | |
|---|---|
| Release | `it-0c432803`, `it-extract.jsonl.gz` (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`) |
| Dump | `itwiktionary-20260701-pages-articles.xml.bz2`, the one the archive was built from (SHA-1 `2bdd444236f7dcd26fee3652dbd641c31d0d9651`) |
| Calls | [`tools/pinConjugationTemplates.ts`](../tools/pinConjugationTemplates.ts) wrote [src/italian/conjugationTemplateCalls.ts](../src/italian/conjugationTemplateCalls.ts): 52 `{{It-conj}}` calls, from the 553 Appendice pages it looked for |
| Script | [`tools/measurePronominalConjugation.ts`](../tools/measurePronominalConjugation.ts), read-only, about a minute |
| Output | [2026-10-16-pronominal-regular-tables.json](2026-10-16-pronominal-regular-tables.json), `noneOutcomes` |

Run them with
`pnpm exec tsx tools/pinConjugationTemplates.ts <it-extract.jsonl.gz> <dump.xml.bz2> > src/italian/conjugationTemplateCalls.ts`
and
`pnpm exec tsx tools/measurePronominalConjugation.ts <it-extract.jsonl.gz> > result.json`.

The counts the #837 report gave are unchanged: 1,070 records, of which 94 show
their own table, 750 a table built from a base verb's, 74 are another verb's
form by a `form_of` edge, and 152 have neither.

## Where the class comes from

Italian Wiktionary writes each verb's table as one `{{It-conj}}` call on an
`Appendice:Coniugazioni/Italiano/<verb>` page, and the call names the class:
`{{It-conj|pent|irsi|essere}}` is the third conjugation without `-isc-`,
`{{It-conj|sment|ire-b|avere}}` the one with it. Only 2 of the 151 words have
such a page of their own (`pentirsi`, `amicarsi`), but 51 more have one for
their base verb, whose record has no forms or does not exist (`accertare`,
`smentire`). The rule reads the word's own page first, then its base verbs'.
A call that overrides a form (`prefiggere`'s `pp=prefisso`) or names a class
the rule does not build settles nothing.

Without a call, only the ending of an `-are` base settles the class, as the
template's documentation states it: `-are`; `-care`, `-gare` (an `h` before
`e` and `i`); `-ciare`, `-giare` (no `i` before `e` and `i`); `-gliare` (no
`i` before `i`). The rule never reads a class from any other ending.

Each class's cells were checked against a whole source table of the same
class in `fixtures/dev-seed.jsonl` (`parlare`, `unificare`, `litigare`,
`slanciare`, `mangiare`, `studiare`, `vestire`, `rimbambire`), cell for cell
(test/regularConjugation.test.ts).

## The 152 records

| Outcome | Records |
|---|---:|
| A rule-built table, its class from an `{{It-conj}}` call | 51 |
| A rule-built table, its class from the `-are` ending | 55 |
| Not a pronominal verb: every gloss says it is another verb's form | 21 |
| Listed for Huey: the source does not settle the class | 24 |
| The word's other record has its own table, which the page already draws | 1 |
| **Total** | **152** |

No hand-kept table was added.

### Rule-built, from an `{{It-conj}}` call (51)

| Class | Records |
|---|---|
| `are` (30) | accertarsi, adunarsi, affiatarsi, battezzarsi, combinarsi, disvelarsi, felicitarsi, granularsi, imbellettarsi, impuntarsi, incamminarsi, indebitarsi, infiltrarsi, inorpellarsi, insanguinarsi, lussarsi, pettinarsi, raggrupparsi, rannuvolarsi, rattristarsi, riavvicinarsi, ridimensionarsi, sbattezzarsi, sdebitarsi, sfarinarsi, sforzarsi, sollazzarsi, spantanarsi, spappolarsi, stamparsi |
| `care` (7) | affaticarsi, distaccarsi, estrinsecarsi, inimicarsi, mummificarsi, seccarsi, verificarsi |
| `ciare` (1) | sbilanciarsi |
| `iare` (6) | ingraziarsi, rabbuiarsi, sborniarsi, scagliarsi, smagliarsi, sostanziarsi |
| `ire` (1) | pentirsi (its own page: *mi pento*, *pentiti*) |
| `ire-b` (6) | incollerirsi, inferocirsi, prostituirsi, smentirsi, spazientirsi, stizzirsi (*mi smentisco*) |

### Rule-built, from the ending (55)

| Ending | Records |
|---|---|
| `-are` (37) | abboffarsi, abbozzolarsi, abbuffarsi, accodarsi, adastarsi, affreddarsi, appisolarsi, appropinquarsi, aragnarsi, assentarsi, attelarsi, attutarsi, auncinarsi, ausarsi, autogovernarsi, autotumularsi, barcamenarsi, fidanzarsi, impaperarsi, impossessarsi, incavolarsi, inforforarsi, ingegnarsi, inglesizzarsi, insaporarsi, inserpentarsi, intanarsi, intrearsi, lagnarsi, sbarazzarsi, sberrettarsi, sbudinarsi, scalmanarsi, scervellarsi, sderetanarsi, situarsi, suicidarsi |
| `-care` (3) | sclerificarsi, stravaccarsi, svaccarsi |
| `-gare` (3) | appalugarsi, impelagarsi, insegarsi |
| `-ciare` (8) | abbiosciarsi, abbisciarsi, accovacciarsi, accucciarsi, aggricciarsi, incapricciarsi, scollacciarsi, spatasciarsi |
| `-giare` (1) | pavoneggiarsi |
| `-gliare` (3) | appigliarsi (two records, one page), meravigliarsi |

### Not a pronominal verb (21)

Each record's glosses all say which form of another verb it is
("seconda persona singolare dell'indicativo presente di traversare"), and
none has a `form_of` edge, so the #837 script counted it as a verb. It gets no
table, and its page is as it was: controversi, disborsi, diversi, esborsi,
imborsi, immorsi, indorsi, inforsi, intorsi, intraversi, malversi, mersi,
rattorsi, reinsorsi, riarsi, riattraversi, rinversi, ritraversi, scontorsi,
smorsi, traversi.

### Listed for Huey (24)

No call is pinned for these, or the one pinned overrides forms, and the
ending does not settle the class. Each needs a hand-kept table citing an
en.wiktionary revision (ADR 0031, which would need amending for forms), or
stays without one:

| Why the source does not settle it | Records |
|---|---|
| `-ire`: `-isc-` or not (7) | appassirsi, assennirsi, attremirsi, immusonirsi, impadronirsi, informicolirsi, susseguirsi |
| another `-iare`, whose `i` may be stressed (6) | adastiarsi, appollaiarsi, incacchiarsi, industriarsi, infischiarsi, obliarsi |
| the second conjugation: its passato remoto and participle are the verb's own (6) | avvalersi, avvedersi, genuflettersi, imbattersi, ravvedersi, rivalersi |
| made on `fare`, `dare` or `trarre`, or may be (4) | assuefarsi, stupefarsi (`fare`), sdarsi (`dare`), inostrarsi (any `-trarsi` may be a `trarre` verb) |
| a call that overrides forms (1) | prefiggersi (`{{It-conj|prefigg|ere|avere|pp=prefisso|…}}`) |

### Already drawn (1)

`amicarsi` has two records. The other one carries its own table, and the page
draws it; this record changes nothing.

## Every word page, before and after

`pnpm run diff:pages cb795985 15f17010` (`web/pageDiff/`), with
`SEED_INPUT=.data/source/it-extract.jsonl.gz`, seeded the whole release at
each commit with that commit's own `seed:dev` and rendered every query's page.
Base cb79598 is `origin/main` after #840; head 15f1701 is this rule. The
queries were every page word (550,466) and, by `--words`, 9,611 more for the
151 words: every spelling the rules build (`mi pento`, `pentiti`), `si` and
each one-word third-person base cell (1,484, the pair route: `si pente`), and
each clitic infinitive (755, the shape route: `pentirmi`).

| | Pages |
|---|---:|
| Compared (a page at both commits) | 551,270 |
| Added or removed | 0 |
| Changed | 105 |
| … a word whose record gets a rule-built table | 105 |
| … any other page | **0** |

The 105 changed pages are exactly the 105 words with a rule-built table
(`appigliarsi`'s two records share one page). 17 of them showed a declared
table read from their form records' glosses (#799) and now show the built
one, as the base-built table replaced 19 such tables in #837: accucciarsi,
autogovernarsi, disvelarsi, impelagarsi, impossessarsi, incapricciarsi,
incavolarsi, insanguinarsi, mummificarsi, pentirsi (whose `pentiti` record
says it is the `tu` imperative), scalmanarsi, sclerificarsi, sfarinarsi, situarsi,
smentirsi, stizzirsi and verificarsi.

No `si` + verb query and no clitic shape changed. Of the 1,484 pairs, only
`amicarsi`'s 8 open a page, which keeps its own table; the pair route reads a
base verb record's cells, which these verbs do not have (noted on
[#817](https://github.com/povlabs/lexema/issues/817)). The 755 clitic shapes
open their verb's page as a form page, which draws no built table, before and
after. No page of the 21 records that are another verb's form, the 24 listed
for Huey, or `amicarsi` changed.
