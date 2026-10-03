# "Plurale di" records tagged singular, rule v2 — 2026-10-03

Issue [#515](https://github.com/hueypov/lexema/issues/515). Release
`it-0c432803`. Rule `it-plural-gloss-number/v2`
([src/italian/pluralGlossNumber.ts](../src/italian/pluralGlossNumber.ts)), on
Huey's [ruling](https://github.com/hueypov/lexema/issues/515#issuecomment-5971932437)
of 2026-10-03 ("yes to all 3"), recorded in
[ADR 0027](../.decisions/0027-curated-corrections-are-cited-exceptions.md)'s
amendment. It builds on v1 and its report,
[2026-10-03-plural-gloss-number.md](2026-10-03-plural-gloss-number.md), whose
scan and fetch it keeps.

## What v2 adds

v2 judges a record exactly as v1 does. Only where v1 leaves it as
`other-lemma`, `no-section-for-pos` or `no-plural-statement` does v2 read two
more statements, the two the ruling accepts:

1. **`feminine-lemma`: the gloss names the feminine singular.** The word's
   en.wiktionary page, in a section for its part of speech, makes it a plural
   of a lemma T, and the gloss's lemma G is not T. The record is corrected when
   G's own en.wiktionary page, in a section for the same part of speech, names
   G the feminine singular of T (`{{feminine singular of|it|T}}`,
   `{{adj form of|it|T||f|s}}`, `{{female equivalent of|it|T}}`). Every plural
   the word's section states has to be of such a T. None may be stated
   masculine, and no singular of T may stand beside them. The correction cites
   the word's revision first (its `corrected_claim` row links to it), then G's.
   `platoniche`, "plurale di platonica", against
   `{{adj form of|it|platonico||f|p}}` and, on `platonica`,
   `{{adj form of|it|platonico||f|s}}`.
2. **`neighbouring-pos`: the plural is filed under the other part of speech.**
   The word's own page states it a plural of exactly G, but only in a section
   of the other part of speech: `Adjective` or `Participle` for a noun record,
   `Noun` for an adjective record. A `Verb` section is no neighbour. No
   singular of G may stand beside it. Its gender is set as v1 sets it: only
   where that same revision states one gender, the record has one gender tag,
   and the two differ. `virtuosi` [noun], against
   `{{adj form of|it|virtuoso||m|p}}`.

To read G's page for an adjective, the fetch now pins en.wiktionary's page of
the gloss's lemma for every Italian record, not only for nouns. That added the
adjectives' lemma pages to
[pluralGlossEvidence.ts](../src/italian/pluralGlossEvidence.ts); every page v1
pinned keeps its revision. A second run of `pnpm run measure:plural-gloss`
rewrote the file byte for byte.

Every record v1 corrects, v2 corrects with the same facts and the same
evidence (`test/pluralGlossNumber.test.ts`).

## Counts

| Class | Noun | Adj | Total |
|---|---|---|---|
| Corrected by v1's reading: number only | 43 | 74 | 117 |
| Corrected by v1's reading: number and gender | 8 | 16 | 24 |
| Corrected by v1's reading: wrong-gloss singular noun | 15 | 0 | 15 |
| **New in v2:** `feminine-lemma` (5 also in gender) | 1 | 14 | 15 |
| **New in v2:** `neighbouring-pos` (5 also in gender) | 9 | 15 | 24 |
| Already corrected by hand (#420, #449) | 13 | 0 | 13 |
| Not an Italian record | 5 | 3 | 8 |
| No en.wiktionary confirmation: `no-en-page` 10, `no-italian-entry` 2, `no-section-for-pos` 15, `no-plural-statement` 2 | 14 | 15 | 29 |
| Other: `singular-adjective` 37 ([#516](https://github.com/hueypov/lexema/issues/516)), `other-lemma` 10 | 7 | 40 | 47 |
| **All** | 115 | 177 | 292 |

So v2 corrects **195 records**, 39 more than v1, writing 229
`corrected_claim` rows, 49 more than v1 (39 numbers and 10 genders). Of v1's
25 `other-lemma` records it corrects 15, and of its 39 `no-section-for-pos`
records 24. No record reads `sources-disagree`.

The ten still `other-lemma` have a plural template, but not the ruled shape:
the gloss names the masculine and the page a feminine (`comiche` [noun],
"femminile plurale di comico", against `{{plural of|it|comica}}`), or the
gloss's lemma has no page section of the record's part of speech naming it a
feminine singular (`missionari` [noun], whose `missionaria` page has only an
Adjective section). The fifteen still `no-section-for-pos` either have only a
`Verb` section (`adirati`) or state a plural of another lemma under the other
part of speech (`riviste`, "femminile plurale di rivisto", against
`{{plural of|it|rivista}}`); case 2 takes only exactly the gloss's lemma.

The change declaration
[2026-10-03-correct-plural-gloss-records-v2.json](../dictionary-changes/2026-10-03-correct-plural-gloss-records-v2.json)
writes the new corrections to the shared dictionary through the dictionary
deploy, after the merge; no agent writes it.

## Every record newly corrected

"Cited" names each en.wiktionary page and revision, the word's own first.

| Line | Word | Pos | Confirmed by | Gender set to | Cited en.wiktionary revisions |
|---|---|---|---|---|---|
| 72381 | `punti` | adj | neighbouring-pos | — | punti 92685139 |
| 208047 | `galleggianti` | adj | neighbouring-pos | — | galleggianti 62833351 |
| 249703 | `invalidi` | adj | neighbouring-pos | — | invalidi 92952522 |
| 349689 | `massicci` | adj | neighbouring-pos | — | massicci 62817875 |
| 415895 | `francofili` | adj | neighbouring-pos | — | francofili 62831066 |
| 422963 | `analogiche` | adj | feminine-lemma | — | analogiche 66429089, analogica 66429094 |
| 423030 | `intermediari` | adj | neighbouring-pos | masculine | intermediari 92096292 |
| 423326 | `elettrolitiche` | adj | feminine-lemma | — | elettrolitiche 68581505, elettrolitica 68581509 |
| 427736 | `valorose` | adj | feminine-lemma | — | valorose 75979422, valorosa 71889380 |
| 441164 | `platoniche` | adj | feminine-lemma | feminine | platoniche 88629786, platonica 88629783 |
| 441216 | `paradigmatiche` | adj | feminine-lemma | feminine | paradigmatiche 55347275, paradigmatica 55485011 |
| 441839 | `virtuosi` | noun | neighbouring-pos | — | virtuosi 78027605 |
| 441842 | `virtuose` | adj | feminine-lemma | feminine | virtuose 90801022, virtuosa 91610562 |
| 441846 | `pietose` | adj | feminine-lemma | — | pietose 63290241, pietosa 63290239 |
| 442067 | `splendide` | adj | feminine-lemma | — | splendide 92987335, splendida 73887401 |
| 442306 | `filologiche` | adj | feminine-lemma | feminine | filologiche 66453080, filologica 66453084 |
| 442315 | `cattedratiche` | adj | feminine-lemma | feminine | cattedratiche 65344317, cattedratica 71384721 |
| 446354 | `missionarie` | adj | feminine-lemma | — | missionarie 73888849, missionaria 73888843 |
| 446944 | `presocratiche` | adj | feminine-lemma | — | presocratiche 55386842, presocratica 55534045 |
| 447672 | `starnutatori` | adj | neighbouring-pos | masculine | starnutatori 62795624 |
| 449028 | `scopritori` | adj | neighbouring-pos | — | scopritori 62830511 |
| 449177 | `annose` | adj | feminine-lemma | — | annose 73892970, annosa 80725741 |
| 449505 | `costruttrici` | adj | feminine-lemma | — | costruttrici 63070366, costruttrice 58018016 |
| 449818 | `neorealisti` | adj | neighbouring-pos | — | neorealisti 62830355 |
| 449821 | `neorealiste` | noun | neighbouring-pos | — | neorealiste 55355172 |
| 450304 | `narcotici` | adj | neighbouring-pos | — | narcotici 73887997 |
| 450327 | `archeozoici` | noun | neighbouring-pos | — | archeozoici 55244518 |
| 453231 | `venditori` | adj | neighbouring-pos | — | venditori 73890546 |
| 453383 | `atee` | noun | feminine-lemma | — | atee 68561631, atea 85015280 |
| 457316 | `babilonesi` | adj | neighbouring-pos | — | babilonesi 70614731 |
| 464479 | `declaratori` | noun | neighbouring-pos | — | declaratori 55246625 |
| 561954 | `girovaghe` | noun | neighbouring-pos | feminine | girovaghe 55350623 |
| 561961 | `piccine` | noun | neighbouring-pos | feminine | piccine 55333940 |
| 565048 | `frigi` | noun | neighbouring-pos | — | frigi 93125385 |
| 584043 | `sepolte` | noun | neighbouring-pos | — | sepolte 64693322 |
| 584094 | `odontotecnici` | adj | neighbouring-pos | masculine | odontotecnici 62834044 |
| 597799 | `sbieche` | noun | neighbouring-pos | — | sbieche 92209658 |
| 601614 | `milionari` | adj | neighbouring-pos | — | milionari 92096274 |
| 605172 | `bucanieri` | adj | neighbouring-pos | — | bucanieri 63323079 |

## Every record left unchanged

With the reason v2 gives. A record a hand entry corrects is listed as `already-corrected`.

| Line | Word | Pos | Reason |
|---|---|---|---|
| 97 | `rosa` | adj | singular-adjective |
| 45589 | `fitta` | adj | singular-adjective |
| 47315 | `aiuti` | noun | not-italian |
| 48496 | `comiche` | noun | other-lemma |
| 52779 | `rapida` | adj | singular-adjective |
| 53931 | `scolare` | noun | already-corrected |
| 64691 | `abonados` | adj | not-italian |
| 90588 | `ricoverati` | noun | already-corrected |
| 112306 | `riviste` | adj | no-section-for-pos |
| 124334 | `munceca` | noun | not-italian |
| 155600 | `adirati` | adj | no-section-for-pos |
| 201735 | `stanca` | adj | singular-adjective |
| 218713 | `citerei` | adj | no-section-for-pos |
| 229294 | `sistemata` | adj | singular-adjective |
| 363961 | `scapigliate` | noun | no-section-for-pos |
| 378248 | `agreements` | noun | not-italian |
| 403399 | `cosmetica` | adj | singular-adjective |
| 405574 | `constantes` | noun | not-italian |
| 423222 | `intese` | adj | no-section-for-pos |
| 425109 | `tarchiata` | adj | singular-adjective |
| 425110 | `atticciata` | adj | singular-adjective |
| 425137 | `marmocchie` | noun | no-en-page |
| 426435 | `raggiunta` | adj | no-section-for-pos |
| 427566 | `bruna` | adj | singular-adjective |
| 429919 | `scrittrici` | noun | other-lemma |
| 439410 | `caparbie` | noun | no-section-for-pos |
| 439467 | `portatrici` | noun | already-corrected |
| 439479 | `fosca` | adj | singular-adjective |
| 441843 | `virtuose` | noun | no-section-for-pos |
| 441845 | `pietosa` | adj | singular-adjective |
| 446352 | `missionari` | adj | no-section-for-pos |
| 446353 | `missionari` | noun | other-lemma |
| 446355 | `missionarie` | noun | no-section-for-pos |
| 447094 | `devota` | adj | singular-adjective |
| 447524 | `mosse` | noun | already-corrected |
| 447554 | `foranei` | adj | other-lemma |
| 447803 | `indecorosa` | adj | no-plural-statement |
| 447899 | `plantigrada` | adj | singular-adjective |
| 447929 | `etiopica` | adj | singular-adjective |
| 448418 | `darviniani` | noun | no-en-page |
| 448684 | `sanguinaria` | adj | singular-adjective |
| 449249 | `sudafricana` | adj | singular-adjective |
| 449250 | `sudafricana` | noun | already-corrected |
| 449259 | `smemorata` | adj | singular-adjective |
| 449319 | `superstiziosa` | adj | singular-adjective |
| 449322 | `tolemaica` | adj | no-plural-statement |
| 449354 | `espressiva` | adj | singular-adjective |
| 449506 | `costruttrici` | noun | already-corrected |
| 449969 | `ammaliatrice` | noun | already-corrected |
| 450165 | `masticatrici` | noun | no-en-page |
| 450440 | `chimi` | noun | no-italian-entry |
| 451006 | `tribune` | noun | other-lemma |
| 451448 | `nevrotica` | adj | singular-adjective |
| 451492 | `atmosferica` | adj | singular-adjective |
| 452450 | `precaria` | adj | singular-adjective |
| 452514 | `intuizionistica` | adj | no-en-page |
| 452598 | `rotariane` | noun | no-section-for-pos |
| 453220 | `congiuntivi` | noun | already-corrected |
| 454305 | `smacchiatrice` | adj | no-en-page |
| 454471 | `longobarde` | noun | no-section-for-pos |
| 455164 | `ripetitrice` | adj | no-section-for-pos |
| 455653 | `carrellata` | adj | singular-adjective |
| 457544 | `aperitive` | adj | no-italian-entry |
| 459486 | `benevola` | adj | singular-adjective |
| 459973 | `prevaricatrici` | noun | no-section-for-pos |
| 463417 | `strepitosa` | adj | singular-adjective |
| 466319 | `magnets` | noun | not-italian |
| 470772 | `ajustés` | adj | not-italian |
| 470776 | `ajustées` | adj | not-italian |
| 545156 | `ingannatrici` | noun | other-lemma |
| 545194 | `severa` | adj | singular-adjective |
| 547491 | `epicurea` | adj | singular-adjective |
| 548888 | `neoclassica` | adj | singular-adjective |
| 551117 | `idrolizzabili` | noun | no-en-page |
| 577604 | `omotermi` | adj | no-en-page |
| 585981 | `indaffarata` | adj | singular-adjective |
| 587101 | `riottosa` | adj | singular-adjective |
| 589811 | `asettica` | adj | singular-adjective |
| 589842 | `spettacolosa` | adj | singular-adjective |
| 589907 | `malvagie` | noun | other-lemma |
| 591729 | `presieduti` | adj | other-lemma |
| 594670 | `socie` | noun | other-lemma |
| 595081 | `maniaci` | noun | already-corrected |
| 596016 | `curde` | noun | already-corrected |
| 597736 | `presiedute` | adj | other-lemma |
| 599446 | `anfitrioni` | noun | already-corrected |
| 599820 | `erule` | noun | no-en-page |
| 600597 | `scarlatta` | adj | singular-adjective |
| 600758 | `misantropa` | adj | singular-adjective |
| 600835 | `sarcofaghe` | adj | no-section-for-pos |
| 605174 | `bucaniera` | adj | no-en-page |
| 605182 | `copernicana` | adj | singular-adjective |
| 605508 | `romantica` | noun | already-corrected |
| 605544 | `scontente` | noun | already-corrected |
| 608044 | `mandatarie` | noun | no-en-page |
| 614285 | `fossilifera` | adj | singular-adjective |
| 627548 | `melmosa` | adj | singular-adjective |
