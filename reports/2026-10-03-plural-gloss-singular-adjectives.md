# Singular adjectives glossed "plurale di", corrected by rule — 2026-10-03

Issue [#516](https://github.com/hueypov/lexema/issues/516). Release
`it-0c432803`. Rule `it-plural-gloss-number/v3`
([src/italian/pluralGlossNumber.ts](../src/italian/pluralGlossNumber.ts)), on
Huey's [ruling](https://github.com/hueypov/lexema/issues/516#issuecomment-5971933388)
of 2026-10-03, recorded in
[ADR 0027](../.decisions/0027-curated-corrections-are-cited-exceptions.md)'s
amendment. v1 and its scan, evidence fetch and other classes are in
[the #483 report](2026-10-03-plural-gloss-number.md), and v2 in
[the #515 report](2026-10-03-plural-gloss-number-v2.md). v3 is built on v2,
which merged first.

## What changed

v1 and v2 left 37 adjective records alone with the reason `singular-adjective`: each
is tagged singular, its first gloss says "plurale di L", and its own
en.wiktionary page, in an `Adjective` or `Participle` section, names it a
singular of L (`{{feminine singular of|it|L}}`, `{{adj form of|it|L||f|s}}`,
`{{inflection of|it|L||f|s}}`). v3 corrects them in the shape v1 gives a
wrong-gloss singular noun: number `singular`, overriding
`/senses/0/glosses/0` with the record's own first gloss. The gender stays as
tagged.

Only the record's own en.wiktionary revision, already pinned in
[src/italian/pluralGlossEvidence.ts](../src/italian/pluralGlossEvidence.ts),
confirms an adjective. Its `shows` is the section's heading, head and
definition lines. No lemma page and no it.wiktionary table counts. An
adjective whose page also names it a plural of L, under any head, is left
alone as `sources-disagree`; on this release no adjective is.

No pinned revision changed. Every one of v2's 195 corrections is unchanged:
the same records, facts and evidence. `test/pluralGlossNumber.test.ts` judges
the release under v2 and v3 and checks that the only verdicts that differ are
the 37 `singular-adjective` exclusions, now corrected.

## The 37 corrected adjectives

| Line | Word | First gloss, overridden | Cited en.wiktionary revision |
|---|---|---|---|
| 97 | `rosa` | femminile plurale di roso | [93016003](https://en.wiktionary.org/w/index.php?title=rosa&oldid=93016003) |
| 45589 | `fitta` | femminile plurale di fitto | [91772916](https://en.wiktionary.org/w/index.php?title=fitta&oldid=91772916) |
| 52779 | `rapida` | plurale di rapido | [89761501](https://en.wiktionary.org/w/index.php?title=rapida&oldid=89761501) |
| 201735 | `stanca` | plurale di stanco | [73364313](https://en.wiktionary.org/w/index.php?title=stanca&oldid=73364313) |
| 229294 | `sistemata` | femminile plurale di sistemato | [71377797](https://en.wiktionary.org/w/index.php?title=sistemata&oldid=71377797) |
| 403399 | `cosmetica` | femminile plurale di cosmetico | [71374957](https://en.wiktionary.org/w/index.php?title=cosmetica&oldid=71374957) |
| 425109 | `tarchiata` | plurale di tarchiato | [55490916](https://en.wiktionary.org/w/index.php?title=tarchiata&oldid=55490916) |
| 425110 | `atticciata` | plurale di atticciato | [55542319](https://en.wiktionary.org/w/index.php?title=atticciata&oldid=55542319) |
| 427566 | `bruna` | plurale di bruno | [93062333](https://en.wiktionary.org/w/index.php?title=bruna&oldid=93062333) |
| 439479 | `fosca` | plurale di fosco | [92096454](https://en.wiktionary.org/w/index.php?title=fosca&oldid=92096454) |
| 441845 | `pietosa` | plurale di pietoso | [63290239](https://en.wiktionary.org/w/index.php?title=pietosa&oldid=63290239) |
| 447094 | `devota` | plurale di devoto | [88936983](https://en.wiktionary.org/w/index.php?title=devota&oldid=88936983) |
| 447899 | `plantigrada` | plurale di plantigrado | [72701392](https://en.wiktionary.org/w/index.php?title=plantigrada&oldid=72701392) |
| 447929 | `etiopica` | plurale di etiopico | [65760045](https://en.wiktionary.org/w/index.php?title=etiopica&oldid=65760045) |
| 448684 | `sanguinaria` | plurale di sanguinario | [88809636](https://en.wiktionary.org/w/index.php?title=sanguinaria&oldid=88809636) |
| 449249 | `sudafricana` | plurale di sudafricano | [84291671](https://en.wiktionary.org/w/index.php?title=sudafricana&oldid=84291671) |
| 449259 | `smemorata` | plurale di smemorato | [64791333](https://en.wiktionary.org/w/index.php?title=smemorata&oldid=64791333) |
| 449319 | `superstiziosa` | plurale di superstizioso | [60757233](https://en.wiktionary.org/w/index.php?title=superstiziosa&oldid=60757233) |
| 449354 | `espressiva` | plurale di espressivo | [71383968](https://en.wiktionary.org/w/index.php?title=espressiva&oldid=71383968) |
| 451448 | `nevrotica` | plurale di nevrotico | [63289929](https://en.wiktionary.org/w/index.php?title=nevrotica&oldid=63289929) |
| 451492 | `atmosferica` | plurale di atmosferico | [65762748](https://en.wiktionary.org/w/index.php?title=atmosferica&oldid=65762748) |
| 452450 | `precaria` | plurale di precario | [89680225](https://en.wiktionary.org/w/index.php?title=precaria&oldid=89680225) |
| 455653 | `carrellata` | plurale di carrellato | [71381155](https://en.wiktionary.org/w/index.php?title=carrellata&oldid=71381155) |
| 459486 | `benevola` | plurale di benevolo | [92214020](https://en.wiktionary.org/w/index.php?title=benevola&oldid=92214020) |
| 463417 | `strepitosa` | plurale di strepitoso | [63635914](https://en.wiktionary.org/w/index.php?title=strepitosa&oldid=63635914) |
| 545194 | `severa` | plurale di severo | [93121353](https://en.wiktionary.org/w/index.php?title=severa&oldid=93121353) |
| 547491 | `epicurea` | plurale di epicureo | [64691923](https://en.wiktionary.org/w/index.php?title=epicurea&oldid=64691923) |
| 548888 | `neoclassica` | plurale di neoclassico | [65580308](https://en.wiktionary.org/w/index.php?title=neoclassica&oldid=65580308) |
| 585981 | `indaffarata` | plurale di indaffarato | [55470012](https://en.wiktionary.org/w/index.php?title=indaffarata&oldid=55470012) |
| 587101 | `riottosa` | plurale di riottoso | [63365364](https://en.wiktionary.org/w/index.php?title=riottosa&oldid=63365364) |
| 589811 | `asettica` | plurale di asettico | [63303216](https://en.wiktionary.org/w/index.php?title=asettica&oldid=63303216) |
| 589842 | `spettacolosa` | plurale di spettacoloso | [55503340](https://en.wiktionary.org/w/index.php?title=spettacolosa&oldid=55503340) |
| 600597 | `scarlatta` | plurale di scarlatto | [63261354](https://en.wiktionary.org/w/index.php?title=scarlatta&oldid=63261354) |
| 600758 | `misantropa` | plurale di misantropo | [66469550](https://en.wiktionary.org/w/index.php?title=misantropa&oldid=66469550) |
| 605182 | `copernicana` | plurale di copernicano | [72000865](https://en.wiktionary.org/w/index.php?title=copernicana&oldid=72000865) |
| 614285 | `fossilifera` | plurale di fossilifero | [55518575](https://en.wiktionary.org/w/index.php?title=fossilifera&oldid=55518575) |
| 627548 | `melmosa` | plurale di melmoso | [55491066](https://en.wiktionary.org/w/index.php?title=melmosa&oldid=55491066) |

`sudafricana`, `superstiziosa`, `nevrotica` and `misantropa` also have a noun
record with the same wrong gloss, a different archive line, corrected or
excluded under v1 as before.

## Counts under v3

| Class | Noun | Adj | Total |
|---|---|---|---|
| Corrected by v1's reading: number only | 43 | 74 | 117 |
| Corrected by v1's reading: number and gender | 8 | 16 | 24 |
| Corrected by v1's reading: wrong-gloss singular noun | 15 | 0 | 15 |
| Corrected by v2: `feminine-lemma` (5 also in gender) | 1 | 14 | 15 |
| Corrected by v2: `neighbouring-pos` (5 also in gender) | 9 | 15 | 24 |
| **New in v3:** wrong-gloss singular adjective | 0 | 37 | 37 |
| Already corrected by hand: #449 (8), #420 (5) | 13 | 0 | 13 |
| Not an Italian record | 5 | 3 | 8 |
| No en.wiktionary confirmation: `no-en-page` 10, `no-italian-entry` 2, `no-section-for-pos` 15, `no-plural-statement` 2 | 14 | 15 | 29 |
| Other, with a named reason: `other-lemma` 10 | 7 | 3 | 10 |
| **All** | 115 | 177 | 292 |

So the rule corrects **232 records**, 37 more than v2, and writes 266
`corrected_claim` rows, 37 more: one number each. No `singular-adjective`
class is left.

## Writing them

The [change declaration](../dictionary-changes/2026-10-03-correct-plural-gloss-singular-adjectives.json)
writes the 37 to the shared dictionary through the dictionary deploy, after
the merge; no agent writes it. Its `expected` counts are the ones the pull
request plan check printed for this change. Each record's
`source_record_json`, archive line and `grammar_claim` rows stay as imported;
the correction is a `corrected_claim` row beside them.
