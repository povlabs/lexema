# "Plurale di" records tagged singular, corrected by rule — 2026-10-03

Issue [#483](https://github.com/hueypov/lexema/issues/483). Release
`it-0c432803`. Rule `it-plural-gloss-number/v1`
([src/italian/pluralGlossNumber.ts](../src/italian/pluralGlossNumber.ts)), on
Huey's [ruling](https://github.com/hueypov/lexema/issues/483#issuecomment-5970891514)
of 2026-10-03, recorded in
[ADR 0027](../.decisions/0027-curated-corrections-are-cited-exceptions.md)'s
amendment.

## The scan

`scanRecord` reads every line of `it-extract.jsonl.gz` and keeps a record when:

- `pos` is `noun` or `adj`;
- its top-level `tags` include `singular` and not `plural`;
- `senses[0].glosses[0]` matches
  `^(maschile |femminile )?plurale( maschile| femminile)? di `.

It keeps **292 records: 115 noun, 177 adj**, the count #483 filed. The lemma
the gloss names is the run of letters after that opening (`glossLemma`).

## The evidence fetch

`pnpm run measure:plural-gloss`
([src/import/measurePluralGloss.ts](../src/import/measurePluralGloss.ts)) reads
these pages through the MediaWiki API (`action=query&prop=revisions`), 50 a
request:

| Page | For |
|---|---|
| en.wiktionary, title = the record's word | every Italian record |
| en.wiktionary, title = the gloss's lemma | noun records |
| it.wiktionary, title = the gloss's lemma | noun records |

Each page is read at one revision, pinned by its revision id (oldid) in
[src/italian/pluralGlossEvidence.ts](../src/italian/pluralGlossEvidence.ts).
The first run, on 2026-10-03, read each page's current revision by title and
pinned it; a page the wiki lacks is pinned as absent. Every later run fetches
the pinned ids (`revids=`), so it reads the same text. A second run on
2026-10-03 rewrote the file byte for byte. Only the lines the rule reads are
kept: on en.wiktionary, inside `==Italian==`, every heading, head template and
definition line (`enExcerpt`); on it.wiktionary, inside `== {{-it-}} ==`, every
part-of-speech heading and `{{Tabs|…}}` line (`itExcerpt`). The file pins 361
en.wiktionary pages and 105 it.wiktionary pages; 14 of the 466 are absent.

## The rule

A record is judged from its own line and those pinned lines only (`judge`):

1. **Not Italian:** `lang_code` is not `it`. Left alone.
2. **Already corrected:** a hand entry of the curated list names its line (#420,
   #449). Left alone.
3. **Real plural:** the word's en.wiktionary page, in a section for its part of
   speech (`Noun` for a noun; `Adjective` or `Participle` for an adjective),
   has a definition template that makes it a plural of exactly the gloss's
   lemma: `{{plural of|it|L}}`, `{{masculine plural of|it|L}}`,
   `{{feminine plural of|it|L}}`, or `{{adj form of|it|L||<g>|p}}` /
   `{{inflection of|it|L||<g>|p}}`. The section's head may not say singular
   (`g=f-s`), and no template in it may make the word a singular of L. Its
   number is set to plural over the `singular` tag. Its gender is set too, only
   where that same revision states one gender (the template's `m`/`f`, the
   template name, or the head's `g=`), the record has exactly one gender tag,
   and the two differ. The evidence is that one revision.
4. **Real singular noun with a wrong gloss:** a noun record, not a real plural
   by 3, that a page names a singular of L: the word's en.wiktionary page
   (`{{female equivalent of|it|L}}`, `{{feminine singular of|it|L}}`,
   `{{adj form of|it|L||f|s}}`…), L's en.wiktionary noun head
   (`{{it-noun|m|f=<word>}}`), L's it.wiktionary `{{Tabs|ms|mp|fs|fp}}` with the
   word in a singular slot, or, when L is the word itself, the word's
   en.wiktionary singular noun head (`{{it-noun|f}}`). A page's noun section
   decides; its adjective and participle sections only when it says nothing of
   the word. No page read may make it a plural. Its number is set to singular
   over the gloss, in the shape #420 gave `ammaliatrice`; its gender stays.
5. **Anything else is left as the source states it,** with one reason:
   `singular-adjective` (en.wiktionary makes the adjective a singular of L; no
   ruling covers these), `no-en-page`, `no-italian-entry`,
   `no-section-for-pos` (the plural is filed only under another part of
   speech), `other-lemma` (a plural, but of another lemma than the gloss
   names, as `analogiche`, "plurale di analogica", against
   `{{adj form of|it|analogico||f|p}}`), `no-plural-statement`, or
   `sources-disagree`.

No record is judged by hand.

## Counts

| Class | Noun | Adj | Total |
|---|---|---|---|
| Corrected: number only | 43 | 74 | 117 |
| Corrected: number and gender | 8 | 16 | 24 |
| Corrected: wrong-gloss singular noun | 15 | 0 | 15 |
| Already corrected by hand: #449 (8), #420 (5) | 13 | 0 | 13 |
| Not an Italian record | 5 | 3 | 8 |
| No en.wiktionary confirmation: `no-en-page` 10, `no-italian-entry` 2, `no-section-for-pos` 39, `no-plural-statement` 2 | 23 | 30 | 53 |
| Other, with a named reason: `singular-adjective` 37, `other-lemma` 25 | 8 | 54 | 62 |
| **All** | 115 | 177 | 292 |

So the rule corrects **156 records** (141 real plurals, 24 of them in gender
too, and 15 wrong-gloss singular nouns), writing 180 `corrected_claim` rows.
The [change declaration](../dictionary-changes/2026-10-03-correct-plural-gloss-records.json)
writes them to the shared dictionary through the dictionary deploy, after the
merge; no agent writes it.

#483's diagnosis read 201 of the 212 real plurals as confirmed. The rule
confirms 141 because it holds to what the ruling asks: the template has to be in
the record's own part of speech and name the gloss's very lemma. The largest
groups it leaves are adjectives whose gloss names the feminine singular
(`platoniche`, "plurale di platonica", against `{{adj form of|it|platonico||f|p}}`)
and nouns whose plural en.wiktionary files only as an adjective (`virtuosi`,
`piccine`).

The wrong-gloss singular nouns: `bucaniera`, `cantiniera`, `condensa`,
`giornalaia`, `giostraia`, `mima`, `misantropa`, `nevrotica`, `sbruffona`,
`sicaria`, `smacchiatrice`, `sociologa`, `superstiziosa`, `tuttologa`,
`virtuosa`.

The gender corrections:

| Line | Word | Pos | Tagged | Set to |
|---|---|---|---|---|
| 10075 | `curve` | adj | masculine | feminine |
| 58881 | `insensate` | adj | masculine | feminine |
| 186523 | `aggiogate` | adj | masculine | feminine |
| 200772 | `scarichi` | adj | feminine | masculine |
| 422962 | `analogici` | adj | feminine | masculine |
| 423325 | `elettrolitici` | adj | feminine | masculine |
| 427899 | `antropici` | adj | feminine | masculine |
| 439468 | `portatori` | noun | feminine | masculine |
| 446896 | `veritieri` | adj | feminine | masculine |
| 447548 | `pitecantropi` | noun | feminine | masculine |
| 447650 | `agostiniani` | noun | feminine | masculine |
| 447658 | `autodromi` | noun | feminine | masculine |
| 449345 | `bioetici` | adj | feminine | masculine |
| 451647 | `babbee` | noun | masculine | feminine |
| 453219 | `congiuntivi` | adj | feminine | masculine |
| 457452 | `iniziatrici` | noun | masculine | feminine |
| 546786 | `transitori` | adj | feminine | masculine |
| 548533 | `scuciti` | adj | feminine | masculine |
| 584902 | `imbroglioni` | noun | feminine | masculine |
| 588293 | `belliche` | adj | masculine | feminine |
| 595396 | `incorrotte` | adj | masculine | feminine |
| 595592 | `proni` | adj | feminine | masculine |
| 600837 | `sostituti` | noun | feminine | masculine |
| 601007 | `biblici` | adj | feminine | masculine |

## Every record left unchanged

By archive line, with the rule's reason. `already-corrected` lines are the
hand entries' own.

| Line | Word | Pos | Reason |
|---|---|---|---|
| 97 | `rosa` | adj | singular-adjective |
| 45589 | `fitta` | adj | singular-adjective |
| 47315 | `aiuti` | noun | not-italian |
| 48496 | `comiche` | noun | other-lemma |
| 52779 | `rapida` | adj | singular-adjective |
| 53931 | `scolare` | noun | already-corrected |
| 64691 | `abonados` | adj | not-italian |
| 72381 | `punti` | adj | no-section-for-pos |
| 90588 | `ricoverati` | noun | already-corrected |
| 112306 | `riviste` | adj | no-section-for-pos |
| 124334 | `munceca` | noun | not-italian |
| 155600 | `adirati` | adj | no-section-for-pos |
| 201735 | `stanca` | adj | singular-adjective |
| 208047 | `galleggianti` | adj | no-section-for-pos |
| 218713 | `citerei` | adj | no-section-for-pos |
| 229294 | `sistemata` | adj | singular-adjective |
| 249703 | `invalidi` | adj | no-section-for-pos |
| 349689 | `massicci` | adj | no-section-for-pos |
| 363961 | `scapigliate` | noun | no-section-for-pos |
| 378248 | `agreements` | noun | not-italian |
| 403399 | `cosmetica` | adj | singular-adjective |
| 405574 | `constantes` | noun | not-italian |
| 415895 | `francofili` | adj | no-section-for-pos |
| 422963 | `analogiche` | adj | other-lemma |
| 423030 | `intermediari` | adj | no-section-for-pos |
| 423222 | `intese` | adj | no-section-for-pos |
| 423326 | `elettrolitiche` | adj | other-lemma |
| 425109 | `tarchiata` | adj | singular-adjective |
| 425110 | `atticciata` | adj | singular-adjective |
| 425137 | `marmocchie` | noun | no-en-page |
| 426435 | `raggiunta` | adj | no-section-for-pos |
| 427566 | `bruna` | adj | singular-adjective |
| 427736 | `valorose` | adj | other-lemma |
| 429919 | `scrittrici` | noun | other-lemma |
| 439410 | `caparbie` | noun | no-section-for-pos |
| 439467 | `portatrici` | noun | already-corrected |
| 439479 | `fosca` | adj | singular-adjective |
| 441164 | `platoniche` | adj | other-lemma |
| 441216 | `paradigmatiche` | adj | other-lemma |
| 441839 | `virtuosi` | noun | no-section-for-pos |
| 441842 | `virtuose` | adj | other-lemma |
| 441843 | `virtuose` | noun | no-section-for-pos |
| 441845 | `pietosa` | adj | singular-adjective |
| 441846 | `pietose` | adj | other-lemma |
| 442067 | `splendide` | adj | other-lemma |
| 442306 | `filologiche` | adj | other-lemma |
| 442315 | `cattedratiche` | adj | other-lemma |
| 446352 | `missionari` | adj | no-section-for-pos |
| 446353 | `missionari` | noun | other-lemma |
| 446354 | `missionarie` | adj | other-lemma |
| 446355 | `missionarie` | noun | no-section-for-pos |
| 446944 | `presocratiche` | adj | other-lemma |
| 447094 | `devota` | adj | singular-adjective |
| 447524 | `mosse` | noun | already-corrected |
| 447554 | `foranei` | adj | other-lemma |
| 447672 | `starnutatori` | adj | no-section-for-pos |
| 447803 | `indecorosa` | adj | no-plural-statement |
| 447899 | `plantigrada` | adj | singular-adjective |
| 447929 | `etiopica` | adj | singular-adjective |
| 448418 | `darviniani` | noun | no-en-page |
| 448684 | `sanguinaria` | adj | singular-adjective |
| 449028 | `scopritori` | adj | no-section-for-pos |
| 449177 | `annose` | adj | other-lemma |
| 449249 | `sudafricana` | adj | singular-adjective |
| 449250 | `sudafricana` | noun | already-corrected |
| 449259 | `smemorata` | adj | singular-adjective |
| 449319 | `superstiziosa` | adj | singular-adjective |
| 449322 | `tolemaica` | adj | no-plural-statement |
| 449354 | `espressiva` | adj | singular-adjective |
| 449505 | `costruttrici` | adj | other-lemma |
| 449506 | `costruttrici` | noun | already-corrected |
| 449818 | `neorealisti` | adj | no-section-for-pos |
| 449821 | `neorealiste` | noun | no-section-for-pos |
| 449969 | `ammaliatrice` | noun | already-corrected |
| 450165 | `masticatrici` | noun | no-en-page |
| 450304 | `narcotici` | adj | no-section-for-pos |
| 450327 | `archeozoici` | noun | no-section-for-pos |
| 450440 | `chimi` | noun | no-italian-entry |
| 451006 | `tribune` | noun | other-lemma |
| 451448 | `nevrotica` | adj | singular-adjective |
| 451492 | `atmosferica` | adj | singular-adjective |
| 452450 | `precaria` | adj | singular-adjective |
| 452514 | `intuizionistica` | adj | no-en-page |
| 452598 | `rotariane` | noun | no-section-for-pos |
| 453220 | `congiuntivi` | noun | already-corrected |
| 453231 | `venditori` | adj | no-section-for-pos |
| 453383 | `atee` | noun | other-lemma |
| 454305 | `smacchiatrice` | adj | no-en-page |
| 454471 | `longobarde` | noun | no-section-for-pos |
| 455164 | `ripetitrice` | adj | no-section-for-pos |
| 455653 | `carrellata` | adj | singular-adjective |
| 457316 | `babilonesi` | adj | no-section-for-pos |
| 457544 | `aperitive` | adj | no-italian-entry |
| 459486 | `benevola` | adj | singular-adjective |
| 459973 | `prevaricatrici` | noun | no-section-for-pos |
| 463417 | `strepitosa` | adj | singular-adjective |
| 464479 | `declaratori` | noun | no-section-for-pos |
| 466319 | `magnets` | noun | not-italian |
| 470772 | `ajustés` | adj | not-italian |
| 470776 | `ajustées` | adj | not-italian |
| 545156 | `ingannatrici` | noun | other-lemma |
| 545194 | `severa` | adj | singular-adjective |
| 547491 | `epicurea` | adj | singular-adjective |
| 548888 | `neoclassica` | adj | singular-adjective |
| 551117 | `idrolizzabili` | noun | no-en-page |
| 561954 | `girovaghe` | noun | no-section-for-pos |
| 561961 | `piccine` | noun | no-section-for-pos |
| 565048 | `frigi` | noun | no-section-for-pos |
| 577604 | `omotermi` | adj | no-en-page |
| 584043 | `sepolte` | noun | no-section-for-pos |
| 584094 | `odontotecnici` | adj | no-section-for-pos |
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
| 597799 | `sbieche` | noun | no-section-for-pos |
| 599446 | `anfitrioni` | noun | already-corrected |
| 599820 | `erule` | noun | no-en-page |
| 600597 | `scarlatta` | adj | singular-adjective |
| 600758 | `misantropa` | adj | singular-adjective |
| 600835 | `sarcofaghe` | adj | no-section-for-pos |
| 601614 | `milionari` | adj | no-section-for-pos |
| 605172 | `bucanieri` | adj | no-section-for-pos |
| 605174 | `bucaniera` | adj | no-en-page |
| 605182 | `copernicana` | adj | singular-adjective |
| 605508 | `romantica` | noun | already-corrected |
| 605544 | `scontente` | noun | already-corrected |
| 608044 | `mandatarie` | noun | no-en-page |
| 614285 | `fossilifera` | adj | singular-adjective |
| 627548 | `melmosa` | adj | singular-adjective |
