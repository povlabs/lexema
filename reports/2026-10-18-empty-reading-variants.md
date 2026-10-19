# Empty readings linked to the variant their page names — 2026-10-18

Issue [#803](https://github.com/povlabs/lexema/issues/803), part C. Release
`it-0c432803`, dump `itwiktionary-20260701`. Rule `it-empty-reading-variant/v2`
([src/italian/emptyReadingVariant.ts](../src/italian/emptyReadingVariant.ts)),
on Huey's [ruling](https://github.com/povlabs/lexema/issues/803#issuecomment-6254975552)
of 2026-10-18 and his [tightening](https://github.com/povlabs/lexema/issues/803#issuecomment-6256991566)
of 2026-10-19, both recorded in
[ADR 0031](../.decisions/0031-hand-kept-readings-fill-source-gaps.md)'s
amendment of 2026-10-18. Re-measured on 2026-10-19 with
`pnpm run measure:empty-reading-variants`
([src/import/measureEmptyReadingVariants.ts](../src/import/measureEmptyReadingVariants.ts)),
which also writes the pinned list a lookup reads
([src/italian/emptyReadingVariantEvidence.ts](../src/italian/emptyReadingVariantEvidence.ts)).

An Italian record defines nothing when no sense has a gloss a page shows, no
sense declares a `form_of` edge, and the recovered layer reads no definition
for it. Such a record leads to each word its page's Italian `{{-var-}}` section
links with `[[…]]`, other than its own word, that has an Italian record of the
same section title with a definition, and that is a close spelling of its word.

A close spelling is at most two edits from the word, once both are folded:
lower case, accents dropped, and hyphens, spaces and apostrophes taken out. An
edit is one letter added, dropped or changed (Levenshtein distance). The
*Edits* column gives that distance. The first version of the rule, `v1`, had
no such test and linked 114 readings; `v2` drops the links in the second
table. Each page link below opens the dump's revision.

## Count

Rule `it-empty-reading-variant/v2` on `it-0c432803` reads 6976 Italian readings that define nothing. It links 102 of them to a variant, and leaves 15 links to a variant that is no close spelling.

| Left alone because | Readings |
|---|---|
| its page is not in the dump (`not-in-dump`) | 0 |
| its page's Italian `{{-var-}}` section links no word, or it has none (`no-variant-line`) | 6604 |
| the recovered layer reads a definition for it off its page (`recovered`) | 7 |
| no word the section links has a reading of its section title that defines something (`no-variant-reading`) | 251 |
| every such word is more than 2 edits from its spelling (`far-variants`) | 12 |

### Kept: the readings the rule links

| Line | Word | Section | Leads to | Edits | `{{-var-}}` line |
|---|---|---|---|---|---|
| 2324 | [uno](https://it.wiktionary.org/w/index.php?title=uno&oldid=4012236) | Articolo | `un` | 1 | 64: `* {{Glossa\|aggettivo numerale}} {{Glossa\|articolo}} [[un]]` |
| 8424 | [denunzia](https://it.wiktionary.org/w/index.php?title=denunzia&oldid=3637579) | Sostantivo | `denuncia` | 1 | 13: `* [[denuncia]]` |
| 8831 | [caravan](https://it.wiktionary.org/w/index.php?title=caravan&oldid=3994397) | Sostantivo | `carovana` | 2 | 19: `* [[carovana]]` |
| 22980 | [the](https://it.wiktionary.org/w/index.php?title=the&oldid=3883501) | Sostantivo | `tè` | 1 | 14: `* [[tè]]` |
| 43323 | [nichellare](https://it.wiktionary.org/w/index.php?title=nichellare&oldid=3644741) | Verbo | `nichelare` | 1 | 20: `* [[nichelare]]` |
| 47288 | [afgano](https://it.wiktionary.org/w/index.php?title=afgano&oldid=3893301) | Aggettivo | `afghano` | 1 | 17: `*[[afghano]]` |
| 51900 | [musco](https://it.wiktionary.org/w/index.php?title=musco&oldid=4037310) | Sostantivo | `muschio` | 2 | 14: `* [[muschio]]` |
| 52003 | [noto](https://it.wiktionary.org/w/index.php?title=noto&oldid=3974031) | Sostantivo | `nuoto` | 1 | 48: `* [[nuoto]]` |
| 54211 | [sparviere](https://it.wiktionary.org/w/index.php?title=sparviere&oldid=3769234) | Sostantivo | `sparviero` | 1 | 18: `*[[sparviero]]` |
| 55575 | [vinto](https://it.wiktionary.org/w/index.php?title=vinto&oldid=3988287) | Sostantivo | `vitto` | 1 | 39: `* {{Glossa\|antico}} [[vitto]]` |
| 56698 | [piano piano](https://it.wiktionary.org/w/index.php?title=piano%20piano&oldid=4040534) | Locuzione avverbiale | `pian piano` | 1 | 15: `* [[pian piano]]` |
| 82079 | [psicoanalisi](https://it.wiktionary.org/w/index.php?title=psicoanalisi&oldid=3724366) | Sostantivo | `psicanalisi` | 1 | 17: `* [[psicanalisi]]` |
| 82092 | [psicoanalista](https://it.wiktionary.org/w/index.php?title=psicoanalista&oldid=3647544) | Sostantivo | `psicanalista` | 1 | 14: `* [[psicanalista]]` |
| 83288 | [perestrojka](https://it.wiktionary.org/w/index.php?title=perestrojka&oldid=3645901) | Sostantivo | `perestroika` | 1 | 16: `* [[perestroika]]` |
| 83295 | [gazzosa](https://it.wiktionary.org/w/index.php?title=gazzosa&oldid=3909818) | Sostantivo | `gassosa` | 2 | 16: `*[[gassosa]]` |
| 87378 | [caciucco](https://it.wiktionary.org/w/index.php?title=caciucco&oldid=3897566) | Sostantivo | `cacciucco` | 1 | 16: `* [[cacciucco]]` |
| 101516 | [corruscazione](https://it.wiktionary.org/w/index.php?title=corruscazione&oldid=3970842) | Sostantivo | `coruscazione` | 1 | 22: `* {{Term\|raro\|it}} [[coruscazione]]` |
| 105589 | [sovvenire](https://it.wiktionary.org/w/index.php?title=sovvenire&oldid=3686019) | Verbo | `sovenire` | 1 | 25: `* [[sovenire]]` |
| 118326 | [bono](https://it.wiktionary.org/w/index.php?title=bono&oldid=3849187) | Sostantivo | `buono` | 1 | 22: `* [[buono]]` |
| 122825 | [bussolo](https://it.wiktionary.org/w/index.php?title=bussolo&oldid=3964310) | Sostantivo | `bossolo` | 1 | 23: `* [[bossolo]]` |
| 123089 | [junior](https://it.wiktionary.org/w/index.php?title=junior&oldid=3642646) | Aggettivo | `iunior` | 1 | 23: `* [[giuniore]], [[iunior]]` |
| 138076 | [sopraluogo](https://it.wiktionary.org/w/index.php?title=sopraluogo&oldid=3902167) | Sostantivo | `sopralluogo` | 1 | 16: `* [[sopralluogo]]` |
| 138202 | [stripe-tease](https://it.wiktionary.org/w/index.php?title=stripe-tease&oldid=3779396) | Sostantivo | `striptease` | 1 | 20: `*[[striptease]]` |
| 139348 | [spasimo](https://it.wiktionary.org/w/index.php?title=spasimo&oldid=3902456) | Sostantivo | `spasmo` | 1 | 27: `* {{Term\|antico\|it}} [[spasmo]]` |
| 140132 | [soperchio](https://it.wiktionary.org/w/index.php?title=soperchio&oldid=3877225) | Aggettivo | `soverchio` | 1 | 17: `* [[soverchio]]` |
| 140605 | [cric](https://it.wiktionary.org/w/index.php?title=cric&oldid=4057914) | Sostantivo | `cricco` | 2 | 19: `* [[cricco]]` |
| 153560 | [trascina](https://it.wiktionary.org/w/index.php?title=trascina&oldid=3996461) | Sostantivo | `tracina` | 1 | 21: `* [[tracina]]` |
| 165726 | [ricalcitrante](https://it.wiktionary.org/w/index.php?title=ricalcitrante&oldid=4085195) | Aggettivo | `recalcitrante` | 1 | 31: `* [[recalcitrante]]` |
| 189671 | [controindicato](https://it.wiktionary.org/w/index.php?title=controindicato&oldid=3999113) | Aggettivo | `contrindicato` | 1 | 26: `* {{Term\|raro\|it}} [[contrindicato]]` |
| 291470 | [stagnino](https://it.wiktionary.org/w/index.php?title=stagnino&oldid=4005792) | Sostantivo | `stagnaio` | 2 | 25: `{{Term\|regionale\|it}} [[stagnaio]]` |
| 352733 | [testimonio](https://it.wiktionary.org/w/index.php?title=testimonio&oldid=3985776) | Sostantivo | `testimone` | 2 | 27: `* [[testimone]]` |
| 404835 | [frutticultore](https://it.wiktionary.org/w/index.php?title=frutticultore&oldid=3639880) | Sostantivo | `frutticoltore` | 1 | 13: `* [[frutticoltore]]` |
| 405611 | [latticino](https://it.wiktionary.org/w/index.php?title=latticino&oldid=3903997) | Sostantivo | `latticinio` | 1 | 19: `*[[latticinio]]` |
| 405646 | [sovrapporta](https://it.wiktionary.org/w/index.php?title=sovrapporta&oldid=3786657) | Sostantivo | `soprapporta` | 1 | 13: `* [[sopraporta]], [[soprapporta]]` |
| 412987 | [cecio](https://it.wiktionary.org/w/index.php?title=cecio&oldid=3904298) | Sostantivo | `cece` | 2 | 16: `* [[cece]]` |
| 417136 | [dittero](https://it.wiktionary.org/w/index.php?title=dittero&oldid=4077067) | Aggettivo | `diptero` | 1 | 24: `* [[diptero]]` |
| 420051 | [quadrilobo](https://it.wiktionary.org/w/index.php?title=quadrilobo&oldid=3435191) | Aggettivo | `quadrilobato` | 2 | 21: `* [[quadrilobato]]` |
| 421539 | [luteranismo](https://it.wiktionary.org/w/index.php?title=luteranismo&oldid=3683440) | Sostantivo | `luteranesimo` | 2 | 16: `* [[luteranesimo]]` |
| 425071 | [poc'anzi](https://it.wiktionary.org/w/index.php?title=poc'anzi&oldid=3432309) | Avverbio | `pocanzi` | 0 | 16: `* [[pocanzi]]` |
| 439441 | [albatros](https://it.wiktionary.org/w/index.php?title=albatros&oldid=3971431) | Sostantivo | `albatro` | 1 | 20: `*[[albatro]]` |
| 442134 | [angloamericano](https://it.wiktionary.org/w/index.php?title=angloamericano&oldid=3905451) | Sostantivo | `anglo-americano` | 0 | 26: `* [[anglo-americano]]` |
| 446980 | [Novarese](https://it.wiktionary.org/w/index.php?title=Novarese&oldid=3363135) | Sostantivo | `novarese` | 0 | 13: `* [[novarese]]` |
| 448614 | [cistifelia](https://it.wiktionary.org/w/index.php?title=cistifelia&oldid=3391414) | Sostantivo | `cistifellea` | 2 | 13: `* [[cistifellea]]` |
| 448731 | [sfuocato](https://it.wiktionary.org/w/index.php?title=sfuocato&oldid=3779214) | Aggettivo | `sfocato` | 1 | 20: `*[[sfocato]]` |
| 450736 | [astrarre](https://it.wiktionary.org/w/index.php?title=astrarre&oldid=4067038) | Verbo | `astraere` | 1 | 39: `* {{Term\|antico\|it}} [[astraere]], [[astraggere]]` |
| 451471 | [anglo-americano](https://it.wiktionary.org/w/index.php?title=anglo-americano&oldid=3377302) | Aggettivo | `angloamericano` | 0 | 26: `* [[angloamericano]]` |
| 451472 | [anglo-americano](https://it.wiktionary.org/w/index.php?title=anglo-americano&oldid=3377302) | Sostantivo | `angloamericano` | 0 | 26: `* [[angloamericano]]` |
| 452627 | [microcita](https://it.wiktionary.org/w/index.php?title=microcita&oldid=3905885) | Sostantivo | `microcito` | 1 | 16: `* [[microcito]]` |
| 457278 | [quadrimensionale](https://it.wiktionary.org/w/index.php?title=quadrimensionale&oldid=3780844) | Aggettivo | `quadridimensionale` | 2 | 16: `* [[quadridimensionale]]` |
| 461314 | [lapislazzolo](https://it.wiktionary.org/w/index.php?title=lapislazzolo&oldid=3418715) | Sostantivo | `lapislazzuli` | 2 | 16: `* [[lapislazzuli]]` |
| 461647 | [granulocito](https://it.wiktionary.org/w/index.php?title=granulocito&oldid=3920099) | Sostantivo | `granulocita` | 1 | 19: `* [[granulocita]]` |
| 462192 | [annunziatore](https://it.wiktionary.org/w/index.php?title=annunziatore&oldid=3627044) | Aggettivo | `annunciatore` | 1 | 16: `* [[annunciatore]]` |
| 462487 | [base-ball](https://it.wiktionary.org/w/index.php?title=base-ball&oldid=4061937) | Sostantivo | `baseball` | 0 | 19: `* [[baseball]], [[base ball]]` |
| 462493 | [beneficienza](https://it.wiktionary.org/w/index.php?title=beneficienza&oldid=3975426) | Sostantivo | `beneficenza` | 1 | 20: `* [[beneficenza]]` |
| 462505 | [poncio](https://it.wiktionary.org/w/index.php?title=poncio&oldid=3906488) | Sostantivo | `poncho` | 1 | 16: `* [[poncho]]` |
| 462524 | [nocchiero](https://it.wiktionary.org/w/index.php?title=nocchiero&oldid=3644783) | Sostantivo | `nocchiere` | 1 | 21: `* [[nocchiere]]` |
| 462562 | [alamanno](https://it.wiktionary.org/w/index.php?title=alamanno&oldid=3626556) | Aggettivo | `alemanno` | 1 | 17: `* [[alemanno]]` |
| 463076 | [scorazzare](https://it.wiktionary.org/w/index.php?title=scorazzare&oldid=3440219) | Verbo | `scorrazzare` | 1 | 16: `* [[scorrazzare]]` |
| 464356 | [raddirizzamento](https://it.wiktionary.org/w/index.php?title=raddirizzamento&oldid=3435625) | Sostantivo | `raddrizzamento` | 1 | 16: `* [[raddrizzamento]]` |
| 464386 | [quasi-gruppo](https://it.wiktionary.org/w/index.php?title=quasi-gruppo&oldid=3906658) | Sostantivo | `quasigruppo` | 0 | 16: `* [[quasigruppo]]` |
| 465074 | [aerolito](https://it.wiktionary.org/w/index.php?title=aerolito&oldid=3473746) | Sostantivo | `aerolite` | 1 | 16: `* [[aerolite]]` |
| 465946 | [autentificare](https://it.wiktionary.org/w/index.php?title=autentificare&oldid=3632843) | Verbo | `autenticare` | 2 | 20: `* [[autenticare]]` |
| 466106 | [atterigote](https://it.wiktionary.org/w/index.php?title=atterigote&oldid=3906860) | Sostantivo | `apterigote` | 1 | 17: `* [[apterigote]]` |
| 466107 | [Atterrigoti](https://it.wiktionary.org/w/index.php?title=Atterrigoti&oldid=3906861) | Sostantivo | `Apterigoti` | 2 | 19: `* [[Apterigoti]]` |
| 475348 | [semialfabeta](https://it.wiktionary.org/w/index.php?title=semialfabeta&oldid=3519962) | Sostantivo | `semianalfabeta` | 2 | 17: `*[[semianalfabeta]]` |
| 486090 | [subeguale](https://it.wiktionary.org/w/index.php?title=subeguale&oldid=3907188) | Aggettivo | `subuguale` | 1 | 16: `*[[subuguale]]` |
| 494940 | [dottorare](https://it.wiktionary.org/w/index.php?title=dottorare&oldid=3567484) | Verbo | `addottorare` | 2 | 20: `*[[addottorare]]` |
| 537358 | [puntillismo](https://it.wiktionary.org/w/index.php?title=puntillismo&oldid=3647623) | Sostantivo | `puntilismo` | 1 | 16: `*[[puntilismo]]` |
| 537891 | [poetismo](https://it.wiktionary.org/w/index.php?title=poetismo&oldid=3646303) | Sostantivo | `poeticismo` | 2 | 16: `*[[poeticismo]]` |
| 538038 | [energetismo](https://it.wiktionary.org/w/index.php?title=energetismo&oldid=3977426) | Sostantivo | `energismo` | 2 | 16: `*[[energismo]]` |
| 538052 | [seicentismo](https://it.wiktionary.org/w/index.php?title=seicentismo&oldid=3908043) | Sostantivo | `secentismo` | 1 | 16: `*[[secentismo]]` |
| 538065 | [cesaropapismo](https://it.wiktionary.org/w/index.php?title=cesaropapismo&oldid=3908046) | Sostantivo | `cesareopapismo` | 1 | 16: `*{{Term\|raro\|it}} [[cesareopapismo]]` |
| 538073 | [torismo](https://it.wiktionary.org/w/index.php?title=torismo&oldid=3765265) | Sostantivo | `torysmo` | 1 | 16: `*[[torysmo]]` |
| 538093 | [sensazionismo](https://it.wiktionary.org/w/index.php?title=sensazionismo&oldid=3921986) | Sostantivo | `sensazionalismo` | 2 | 16: `*[[sensazionalismo]]` |
| 538769 | [protosfera](https://it.wiktionary.org/w/index.php?title=protosfera&oldid=3734670) | Sostantivo | `protonosfera` | 2 | 16: `*[[protonosfera]]` |
| 544492 | [amerindo](https://it.wiktionary.org/w/index.php?title=amerindo&oldid=3669125) | Aggettivo | `amerindio` | 1 | 21: `*[[amerindio]]` |
| 544523 | [grammaticamente](https://it.wiktionary.org/w/index.php?title=grammaticamente&oldid=3668912) | Avverbio | `grammaticalmente` | 1 | 13: `*[[grammaticalmente]]` |
| 545165 | [giovanetto](https://it.wiktionary.org/w/index.php?title=giovanetto&oldid=3675034) | Sostantivo | `giovinetto` | 1 | 14: `*[[giovinetto]]` |
| 548625 | [disubbidienza](https://it.wiktionary.org/w/index.php?title=disubbidienza&oldid=3681357) | Sostantivo | `disobbedienza` | 2 | 24: `*[[disobbedienza]]` |
| 548930 | [panpsichismo](https://it.wiktionary.org/w/index.php?title=panpsichismo&oldid=3688272) | Sostantivo | `pampsichismo` | 1 | 16: `*[[pampsichismo]]` |
| 550077 | [citocromoossidasi](https://it.wiktionary.org/w/index.php?title=citocromoossidasi&oldid=3911046) | Sostantivo | `citocromossidasi` | 1 | 16: `*[[citocromossidasi]]` |
| 577457 | [Casuaridi](https://it.wiktionary.org/w/index.php?title=Casuaridi&oldid=3768124) | Sostantivo | `Casuariidi` | 1 | 17: `*[[Casuariidi]]` |
| 582797 | [sonare](https://it.wiktionary.org/w/index.php?title=sonare&oldid=3780010) | Verbo | `suonare` | 1 | 13: `*[[suonare]]` |
| 582888 | [sovraintendenza](https://it.wiktionary.org/w/index.php?title=sovraintendenza&oldid=3780793) | Sostantivo | `soprintendenza` | 2 | 13: `*[[soprintendenza]]` |
| 582975 | [rimovibile](https://it.wiktionary.org/w/index.php?title=rimovibile&oldid=3781200) | Aggettivo | `removibile` | 1 | 13: `*[[removibile]]` |
| 583418 | [instupidire](https://it.wiktionary.org/w/index.php?title=instupidire&oldid=3783690) | Verbo | `istupidire` | 1 | 16: `*[[istupidire]]` |
| 590946 | [immanicato](https://it.wiktionary.org/w/index.php?title=immanicato&oldid=3954091) | Aggettivo | `ammanicato` | 1 | 24: `*[[ammanicato]]` |
| 596674 | [neurosi](https://it.wiktionary.org/w/index.php?title=neurosi&oldid=3868368) | Sostantivo | `nevrosi` | 1 | 22: `*[[nevrosi]]` |
| 596698 | [cardiopalma](https://it.wiktionary.org/w/index.php?title=cardiopalma&oldid=3867600) | Sostantivo | `cardiopalmo` | 1 | 16: `*[[cardiopalmo]]` |
| 598544 | [carnificina](https://it.wiktionary.org/w/index.php?title=carnificina&oldid=3945199) | Sostantivo | `carneficina` | 1 | 21: `*[[carneficina]]` |
| 599430 | [paprika](https://it.wiktionary.org/w/index.php?title=paprika&oldid=4059299) | Sostantivo | `paprica` | 1 | 16: `* [[paprica]]` |
| 601216 | [connestabile](https://it.wiktionary.org/w/index.php?title=connestabile&oldid=3935006) | Sostantivo | `conestabile` | 1 | 16: `*[[conestabile]]` |
| 605390 | [bidet](https://it.wiktionary.org/w/index.php?title=bidet&oldid=3984478) | Sostantivo | `bidè` | 1 | 17: `*[[bidè]]` |
| 608714 | [parabolone](https://it.wiktionary.org/w/index.php?title=parabolone&oldid=3982130) | Sostantivo | `parabolano` | 2 | 24: `*[[parabolano]]` |
| 608874 | [Tubuliflore](https://it.wiktionary.org/w/index.php?title=Tubuliflore&oldid=4023939) | Sostantivo | `Tubiflore` | 2 | 18: `*[[Tubiflore]]` |
| 610842 | [uliveto](https://it.wiktionary.org/w/index.php?title=uliveto&oldid=4011217) | Sostantivo | `oliveto` | 1 | 17: `*[[oliveto]]` |
| 612196 | [euroasiatico](https://it.wiktionary.org/w/index.php?title=euroasiatico&oldid=4004350) | Aggettivo | `eurasiatico` | 1 | 24: `*[[eurasiatico]]` |
| 614653 | [Gigliacee](https://it.wiktionary.org/w/index.php?title=Gigliacee&oldid=4016365) | Sostantivo | `Liliacee` | 2 | 17: `* [[Liliacee]]` |
| 615193 | [centinodio](https://it.wiktionary.org/w/index.php?title=centinodio&oldid=4020727) | Sostantivo | `centinodia` | 1 | 17: `*[[centinodia]]` |
| 618725 | [premonstratense](https://it.wiktionary.org/w/index.php?title=premonstratense&oldid=4033076) | Sostantivo | `premostratense` | 1 | 23: `*[[premostratense]]` |
| 625501 | [frustulo](https://it.wiktionary.org/w/index.php?title=frustulo&oldid=4058251) | Sostantivo | `frustolo` | 1 | 21: `*[[frustolo]]` |
| 798228 | [maltusiano](https://it.wiktionary.org/w/index.php?title=maltusiano&oldid=4248395) | Aggettivo | `malthusiano` | 1 | 24: `* [[malthusiano]]` |

### Dropped: the links the closeness test leaves

| Line | Word | Section | Variant left | Edits | Reading still linked | `{{-var-}}` line |
|---|---|---|---|---|---|---|
| 11654 | [game](https://it.wiktionary.org/w/index.php?title=game&oldid=3891013) | Sostantivo | `videogame` | 5 | no | 16: `* [[videogame]]` |
| 50324 | [impurezza](https://it.wiktionary.org/w/index.php?title=impurezza&oldid=3759396) | Sostantivo | `impurità` | 3 | no | 19: `* {{Glossa\|raro}} [[impurità]]` |
| 54355 | [stecco](https://it.wiktionary.org/w/index.php?title=stecco&oldid=3444413) | Sostantivo | `spina` | 5 | no | 17: `* {{Term\|antico\|it}}  [[spina]]` |
| 115227 | [precorritore](https://it.wiktionary.org/w/index.php?title=precorritore&oldid=3647013) | Sostantivo | `precursore` | 4 | no | 18: `* [[precursore]]` |
| 123089 | [junior](https://it.wiktionary.org/w/index.php?title=junior&oldid=3642646) | Aggettivo | `giuniore` | 3 | yes | 23: `* [[giuniore]], [[iunior]]` |
| 450736 | [astrarre](https://it.wiktionary.org/w/index.php?title=astrarre&oldid=4067038) | Verbo | `astraggere` | 3 | yes | 39: `* {{Term\|antico\|it}} [[astraere]], [[astraggere]]` |
| 454868 | [piezomagnetismo](https://it.wiktionary.org/w/index.php?title=piezomagnetismo&oldid=3629357) | Sostantivo | `magnetostrizione` | 13 | no | 16: `* [[magnetostrizione]]` |
| 461424 | [xiloteca](https://it.wiktionary.org/w/index.php?title=xiloteca&oldid=3452246) | Sostantivo | `silografia` | 6 | no | 13: `* [[silografia]]` |
| 474668 | [orangotango](https://it.wiktionary.org/w/index.php?title=orangotango&oldid=3909991) | Sostantivo | `orango` | 5 | no | 17: `*[[orango]]` |
| 524502 | [Labridi](https://it.wiktionary.org/w/index.php?title=Labridi&oldid=3959219) | Sostantivo | `pesci` | 6 | no | 20: `*[[pesci]],  [[labroidei]]` |
| 537380 | [fisiocratismo](https://it.wiktionary.org/w/index.php?title=fisiocratismo&oldid=3683381) | Sostantivo | `fisiocrazia` | 4 | no | 16: `*[[fisiocrazia]]` |
| 537893 | [neohegelismo](https://it.wiktionary.org/w/index.php?title=neohegelismo&oldid=3908025) | Sostantivo | `neohegelianismo` | 3 | no | 22: `*[[neohegelianismo]], [[neohegelianesimo]]` |
| 537893 | [neohegelismo](https://it.wiktionary.org/w/index.php?title=neohegelismo&oldid=3908025) | Sostantivo | `neohegelianesimo` | 4 | no | 22: `*[[neohegelianismo]], [[neohegelianesimo]]` |
| 538040 | [pleocroismo](https://it.wiktionary.org/w/index.php?title=pleocroismo&oldid=3631172) | Sostantivo | `policroismo` | 3 | no | 19: `*[[policroismo]]` |
| 548636 | [disintossicare](https://it.wiktionary.org/w/index.php?title=disintossicare&oldid=3998252) | Verbo | `detossificare` | 6 | no | 28: `*[[detossificare]]` |
