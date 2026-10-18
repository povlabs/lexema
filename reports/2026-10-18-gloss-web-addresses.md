# Glosses that hold a web address — 2026-10-18

Issue [#872](https://github.com/povlabs/lexema/issues/872). Release
`it-0c432803`, read from the archive `it-extract.jsonl.gz` (SHA-256
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`, 799,600
lines), not from the dump. Huey ruled that one source text normalization
([ADR 0019](../.decisions/0019-source-text-may-be-normalized.md)) takes these
addresses out ([ruling](https://github.com/povlabs/lexema/issues/872#issuecomment-6252756856)):
rule `gloss-web-address/v1`, `withoutWebAddresses` in
[src/italian/sourceTextNormalization.ts](../src/italian/sourceTextNormalization.ts).

## Method

Read every archive line in order, and on every line that holds `http://` or
`https://`, every string in `senses[].glosses`. A gloss counts when it holds
`http://` or `https://`. Every hit is an Italian record (`lang_code` `it`), and
each record has one such gloss.

## Count

**14 glosses in 14 records.** The scan for #857 found 4 of them, the ones whose
address holds an underscore.

| Word | Archive line | Sense (from 0) | Where the address sits | Address the rule removes |
|---|---|---|---|---|
| `nobiltà` | 8269 | 0 | opens the gloss | `https://araldicando.miraheze.org/wiki/Pagina_principale` |
| `scratch` | 21853 | 2 | glued to the last word | `https://suonarechitarra.com/2019/01/07/tom-morello-e-i-suoni-improbabili/#DJ_Scratch` |
| `trap` | 23306 | 1 | glued to the last word, two addresses glued together | `https://www.2duerighe.com/rubriche/dreki-fiori-di-cemento/123575-rap-italiano.html?amp=1https://produzionehiphop.com/blog/storia-e-curiosita/la-storia-dellhip-hop-italiano-old-school-italia.html` |
| `quarto` | 30447 | 3 | glued to the last word | `https://gremus.it/leggere-la-musica/la-semiminima-o-quarto` |
| `alcolemia` | 47343 | 0 | glued to the last word | `https://m.my-personaltrainer.it/salute/tasso-alcolemico.html#:~:text=L'alcolemia%20%C3%A8%20considerata%20nella,0%2C50%20g%2FL` |
| `androginia` | 47471 | 3 | glued to the last word | `https://www.gay.it/10-celebrita-androgine-anni-90` |
| `Salento` | 62155 | 1 | after the last full stop, as a bracketed link with the label `[1]` | `[https://www.barbarhouse.com/it/guide/salento.html [1]]` |
| `metamorfosi` | 91874 | 4 | glued to the last word | `https://www.wired.it/article/film-insetti-giganti-assassini-alieni-libri-titoli/` |
| `ciortone` | 113793 | 0 | inside, between two words | `http://it.wikipedia.org/wiki/Scomber_scombrus` |
| `biliardo` | 134002 | 1 | glued to the last word | `https://www.chimica-online.it/download/biliardo.htm` |
| `tripla` | 135501 | 2 | glued to the last word | `https://www.basketcoach.net/wli/main/view/dettaglio_archivio?NomeMacroCategoria=Fondamentali&IDMacroCategoria=8&pagina=Le%20Regole&CategoriaID=109&id_pagine_uniche=&titolo_user_id=d8f5443e8616b5b3` |
| `ologramma` | 136520 | 1 | glued to the last word | `https://www.officinakreativa.it/ologramma-3d/` |
| `funk` | 421399 | 1 | glued to the last word, two addresses glued together | `https://www.discotecalaziale.com/blog/soul-funk-gli-anni-doro-della-musica-nera-che-ha-cambiato-il-mondo/?srsltid=AfmBOookCwTZ4ic2__n_y2ZUo5c89CM1vRV2zXMJsRSuhkHelR5AYBt-https://www.musicaincontatto.it/2018/11/28/il-funk/` |
| `ghostwriter` | 604795 | 1 | glued to the last word | `https://www.exclusivemagazine.it/2018/11/19/ghost-writing-nel-rap-italiano-scandalo-o-evoluzione/` |

## What the rule stores

The address goes with the spaces beside it. Text on both sides keeps one space
between, and the gloss gets no space at either end, so `ciortone`'s gloss is
stored as `sgombro (pesce)`, `funk`'s ends `nel 1970` and `nobiltà`'s opens
`condizione sociale di persone`. A bare address runs to the next space, so the
two glued addresses of `trap` and `funk` go as one. Every stored gloss is in
[test/webAddress.test.ts](../test/webAddress.test.ts). `source_record_json`
keeps every line byte for byte.
