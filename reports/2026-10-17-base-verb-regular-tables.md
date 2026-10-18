# Verbs with no forms whose own Appendice page has an `{{It-conj}}` call

Measurement for [issue #841](https://github.com/povlabs/lexema/issues/841), run
2026-10-17. Some verb records of the release list no form, so their word pages
showed meanings and no table, though their own
`Appendice:Coniugazioni/Italiano/<verb>` page names their class in an
`{{It-conj}}` call (`verificare`: `{{It-conj|verific|care|avere}}`). Huey ruled
on 2026-10-17 that such a verb gets the rule-built table pronominal verbs get
([ruling](https://github.com/povlabs/lexema/issues/841#issuecomment-6233282178)).
This report counts them, and gives each its outcome under rule
`it-regular-conjugation/v1`
([src/italian/regularConjugation.ts](../src/italian/regularConjugation.ts),
`ownClassOf`).

## What was measured

| | |
|---|---|
| Release | `it-0c432803`, `it-extract.jsonl.gz` (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`) |
| Dump | `itwiktionary-20260701-pages-articles.xml.bz2`, the one the archive was built from (SHA-1 `2bdd444236f7dcd26fee3652dbd641c31d0d9651`) |
| Calls | [`tools/pinConjugationTemplates.ts`](../tools/pinConjugationTemplates.ts) wrote [src/italian/conjugationTemplateCalls.ts](../src/italian/conjugationTemplateCalls.ts): 267 `{{It-conj}}` calls (52 before), each with its page's revision id |
| Script | [`tools/measureBaseRegularTables.ts`](../tools/measureBaseRegularTables.ts), read-only, under a minute |
| Output | [2026-10-17-base-verb-regular-tables.json](2026-10-17-base-verb-regular-tables.json) |

Run them with
`pnpm exec tsx tools/pinConjugationTemplates.ts <it-extract.jsonl.gz> <dump.xml.bz2> > src/italian/conjugationTemplateCalls.ts`
and
`pnpm exec tsx tools/measureBaseRegularTables.ts <it-extract.jsonl.gz> > result.json`.

A record counts when it is an Italian verb record, its word is not pronominal
(`-rsi`, `-rsene`), no record of its word lists a form that fills a cell, and
no `form_of` edge of it names a verb record. That is the record the page may
give a table. The pin tool looked up the own Appendice page of every such word.

The pronominal outcomes of
[the #838 report](2026-10-16-pronominal-regular-tables.md) are unchanged: a
re-run of `tools/measurePronominalConjugation.ts` over the new calls gives
JSON equal to the committed one, key for key.

## The count

| Records with no forms | Records | Words |
|---|---:|---:|
| Every gloss says it is a form of another verb, which has no record (`metallizzino`, of metallizzare) | 223,859 | 223,841 |
| No `{{It-conj}}` call on its own page | 725 | 697 |
| **An `{{It-conj}}` call on its own page** | **257** | **245** |
| Total | 224,841 | 224,783 |

The 257 with a call, split by whether the rule settles the class:

| Outcome | Records | Words |
|---|---:|---:|
| **Settled: a rule-built table** | **212** | **206** |
| Not settled: the call names essere, or both auxiliaries | 19 | 17 |
| Not settled: the call overrides a form, or names a class the rule does not build | 26 | 22 |
| **Total** | **257** | **245** |

A word with two records gets one table, under its first record with a meaning.

### Settled (206 words)

| Class | Words |
|---|---|
| `are` (136) | accertare, addecimare, addipanare, addrizzare, adequare, adirare, adontare, adunare, affiatare, affigurare, appostare, bottinare, canalizzare, capitalizzare, cianfrinare, cifrare, ciondolare, combinare, concatenare, condensare, decantare, decatizzare, declassare, deidrogenare, demotivare, dializzare, discreditare, disertare, dissetare, disvelare, escogitare, filettare, fischiettare, frazionare, freddare, fucinare, gesticolare, giubilare, graduare, grafitare, granulare, grommare, hackerare, incettare, indossare, influenzare, inorpellare, insaldare, insalivare, inscenare, insellare, intronare, invasare, latitare, malignare, mammare, matematizzare, modulare, mutuare, nobilitare, ondulare, perseguitare, pettinare, picchettare, pignorare, posticipare, preaccennare, preordinare, prepensionare, propugnare, prosternare, pulsare, racemizzare, raggrumare, raggruppare, rapportare, rattristare, razzolare, registrare, responsabilizzare, riadoperare, riassegnare, ridimensionare, rimarginare, riorganizzare, ripopolare, riscontare, rizzare, ruspare, sbattezzare, sbevazzare, sbollentare, sburrare, scacazzare, scaffalare, schettinare, scombinare, secolarizzare, settare, sfacchinare, sforzare, sguazzare, shakerare, sillogizzare, simpatizzare, slabbrare, smagnetizzare, smagrare, smallare, smammare, socializzare, sollazzare, somministrare, spantanare, spappolare, sparlare, spasimare, spopolare, stabilizzare, stampare, stornare, strabuzzare, strozzare, suggestionare, svergognare, tappezzare, tarpare, tifare, tramestare, trasognare, trepidare, trivellare, urbanizzare, vigilare, vitaminizzare, zaffare |
| `care` (21) | allocare, disboscare, disseccare, distaccare, dittongare, embricare, estrinsecare, imbroccare, infangare, intascare, intersecare, maiolicare, mummificare, radicare, sbiancare, scomunicare, seccare, sfaticare, spiaccicare, vangare, verificare |
| `ciare` (12) | conteggiare, pasticciare, preannunciare, primeggiare, rimpiallacciare, sceneggiare, sculacciare, simboleggiare, sorseggiare, sovesciare, svaligiare, vagheggiare |
| `iare` (24) | cariare, daziare, divariare, falcidiare, fischiare, gozzovigliare, ingraziare, ossequiare, parodiare, presidiare, propiziare, ripudiare, sbrogliare, scagliare, scrocchiare, smagliare, smaliziare, smaniare, soverchiare, spannocchiare, strigliare, uguagliare, vagliare, viziare |
| `ire-b` (13) | accudire, disostruire, evoluire, gremire, impreziosire, interagire, ordire, rammorbidire, sbizzarrire, sfavorire, spaurire, starnutire, stormire |

Ten calls write `care` or `ciare` on a stem in `g`: `dittongare`,
`infangare`, `vangare` (`{{It-conj|vang|care|avere}}`) and `primeggiare`,
`sceneggiare`, `simboleggiare`, `sorseggiare`, `svaligiare`, `vagheggiare`,
`conteggiare` (`{{It-conj|contegg|ciare|avere}}`). Modulo:It-conj (revision
4048685 in the dump) writes `care` and `gare` in one branch and `ciare` and
`giare` in another, on any stem, so the rule now reads these calls as the
template writes them: *vango, vanghi*; *conteggio, conteggerò*. Before this
change it read none of them, as no pronominal verb's call had such a stem.

### Not settled: the call names essere, or both (17 words)

The rule writes every compound tense on avere. These calls name another
auxiliary, so the table would be on the wrong one, and the page shows none.
Listed for Huey. Since #873 all 17 get a table, on the auxiliary their call
names ([2026-10-18 report](2026-10-18-essere-regular-tables.md)).

| Auxiliary in the call | Words |
|---|---|
| `essere` | affaticare, cascare, infradiciare, insanguinare, rifuggire, rifugiare, rintristire, sbilanciare |
| `avere, come intr. essere`, `avere, se intr. essere`, `avere, se intransitivo essere` | incocciare, incrudelire, inferocire, insalvatichire, insecchire, insuperbire, invelenire, rifiorire, scolare |

### Not settled: overrides or a class the rule does not build (22 words)

| Why | Words |
|---|---|
| The second conjugation (`ere`), no override | rivendere, svendere |
| The second conjugation, with overridden forms (`pp=prefisso`) | diligere, evolvere, incingere, incogliere, infiggere, inscrivere, interdire, prediligere, prefiggere, prevalere, prorompere, prudere, rescindere, sottintendere, stravolgere, suffiggere, trascendere |
| The third conjugation, with overridden forms (`pres1s=convengo`) | convenire, riconvenire, ridivenire |

## Searched forms

The forms of these verbs were already found before this change. Most have a
form record of their own (`verifico`, "prima persona singolare dell'indicativo
presente di verificare"), and one with none is read by the `conjugated` shape
of `it-word-shape/v1` (#809, `fischia` of fischiare). Neither reads the verb's
table, so this change leaves the lookup as it is. A real-word test pins
`verifico`, `stampano`, `pettiniamo` and `vanghi` finding their verbs
(web/test/page.test.tsx).
