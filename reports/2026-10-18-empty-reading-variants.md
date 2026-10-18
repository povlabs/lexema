# Empty readings linked to the variant their page names — 2026-10-18

Issue [#803](https://github.com/povlabs/lexema/issues/803), part C. Release
`it-0c432803`, dump `itwiktionary-20260701`. Rule `it-empty-reading-variant/v1`
([src/italian/emptyReadingVariant.ts](../src/italian/emptyReadingVariant.ts)),
on Huey's [ruling](https://github.com/povlabs/lexema/issues/803#issuecomment-6254975552)
of 2026-10-18, recorded in
[ADR 0031](../.decisions/0031-hand-kept-readings-fill-source-gaps.md)'s
amendment of that day. Made with `pnpm run measure:empty-reading-variants`
([src/import/measureEmptyReadingVariants.ts](../src/import/measureEmptyReadingVariants.ts)),
which also writes the pinned list a lookup reads
([src/italian/emptyReadingVariantEvidence.ts](../src/italian/emptyReadingVariantEvidence.ts)).

An Italian record defines nothing when no sense has a gloss a page shows, no
sense declares a `form_of` edge, and the recovered layer reads no definition
for it. Such a record leads to each word its page's Italian `{{-var-}}` section
links with `[[…]]`, other than its own word, that has an Italian record of the
same section title with a definition. Each page link below opens the dump's
revision.

A few links follow the page's `{{-var-}}` line where that line names a related
word more than a spelling: `stecco` → `spina`, `noto` → `nuoto`,
`xiloteca` → `silografia`, `piezomagnetismo` → `magnetostrizione` and
`Labridi` → `pesci`. The rule reads the section as the page writes it.

## Count

Rule `it-empty-reading-variant/v1` on `it-0c432803` reads 6976 Italian readings that define nothing. It links 114 of them to a variant.

| Left alone because | Readings |
|---|---|
| its page is not in the dump (`not-in-dump`) | 0 |
| its page's Italian `{{-var-}}` section links no word, or it has none (`no-variant-line`) | 6604 |
| the recovered layer reads a definition for it off its page (`recovered`) | 7 |
| no word the section links has a reading of its section title that defines something (`no-variant-reading`) | 251 |

| Line | Word | Section | Leads to | `{{-var-}}` line |
|---|---|---|---|---|
| 2324 | [uno](https://it.wiktionary.org/w/index.php?title=uno&oldid=4012236) | Articolo | `un` | 64: `* {{Glossa\|aggettivo numerale}} {{Glossa\|articolo}} [[un]]` |
| 8424 | [denunzia](https://it.wiktionary.org/w/index.php?title=denunzia&oldid=3637579) | Sostantivo | `denuncia` | 13: `* [[denuncia]]` |
| 8831 | [caravan](https://it.wiktionary.org/w/index.php?title=caravan&oldid=3994397) | Sostantivo | `carovana` | 19: `* [[carovana]]` |
| 11654 | [game](https://it.wiktionary.org/w/index.php?title=game&oldid=3891013) | Sostantivo | `videogame` | 16: `* [[videogame]]` |
| 22980 | [the](https://it.wiktionary.org/w/index.php?title=the&oldid=3883501) | Sostantivo | `tè` | 14: `* [[tè]]` |
| 43323 | [nichellare](https://it.wiktionary.org/w/index.php?title=nichellare&oldid=3644741) | Verbo | `nichelare` | 20: `* [[nichelare]]` |
| 47288 | [afgano](https://it.wiktionary.org/w/index.php?title=afgano&oldid=3893301) | Aggettivo | `afghano` | 17: `*[[afghano]]` |
| 50324 | [impurezza](https://it.wiktionary.org/w/index.php?title=impurezza&oldid=3759396) | Sostantivo | `impurità` | 19: `* {{Glossa\|raro}} [[impurità]]` |
| 51900 | [musco](https://it.wiktionary.org/w/index.php?title=musco&oldid=4037310) | Sostantivo | `muschio` | 14: `* [[muschio]]` |
| 52003 | [noto](https://it.wiktionary.org/w/index.php?title=noto&oldid=3974031) | Sostantivo | `nuoto` | 48: `* [[nuoto]]` |
| 54211 | [sparviere](https://it.wiktionary.org/w/index.php?title=sparviere&oldid=3769234) | Sostantivo | `sparviero` | 18: `*[[sparviero]]` |
| 54355 | [stecco](https://it.wiktionary.org/w/index.php?title=stecco&oldid=3444413) | Sostantivo | `spina` | 17: `* {{Term\|antico\|it}}  [[spina]]` |
| 55575 | [vinto](https://it.wiktionary.org/w/index.php?title=vinto&oldid=3988287) | Sostantivo | `vitto` | 39: `* {{Glossa\|antico}} [[vitto]]` |
| 56698 | [piano piano](https://it.wiktionary.org/w/index.php?title=piano%20piano&oldid=4040534) | Locuzione avverbiale | `pian piano` | 15: `* [[pian piano]]` |
| 82079 | [psicoanalisi](https://it.wiktionary.org/w/index.php?title=psicoanalisi&oldid=3724366) | Sostantivo | `psicanalisi` | 17: `* [[psicanalisi]]` |
| 82092 | [psicoanalista](https://it.wiktionary.org/w/index.php?title=psicoanalista&oldid=3647544) | Sostantivo | `psicanalista` | 14: `* [[psicanalista]]` |
| 83288 | [perestrojka](https://it.wiktionary.org/w/index.php?title=perestrojka&oldid=3645901) | Sostantivo | `perestroika` | 16: `* [[perestroika]]` |
| 83295 | [gazzosa](https://it.wiktionary.org/w/index.php?title=gazzosa&oldid=3909818) | Sostantivo | `gassosa` | 16: `*[[gassosa]]` |
| 87378 | [caciucco](https://it.wiktionary.org/w/index.php?title=caciucco&oldid=3897566) | Sostantivo | `cacciucco` | 16: `* [[cacciucco]]` |
| 101516 | [corruscazione](https://it.wiktionary.org/w/index.php?title=corruscazione&oldid=3970842) | Sostantivo | `coruscazione` | 22: `* {{Term\|raro\|it}} [[coruscazione]]` |
| 105589 | [sovvenire](https://it.wiktionary.org/w/index.php?title=sovvenire&oldid=3686019) | Verbo | `sovenire` | 25: `* [[sovenire]]` |
| 115227 | [precorritore](https://it.wiktionary.org/w/index.php?title=precorritore&oldid=3647013) | Sostantivo | `precursore` | 18: `* [[precursore]]` |
| 118326 | [bono](https://it.wiktionary.org/w/index.php?title=bono&oldid=3849187) | Sostantivo | `buono` | 22: `* [[buono]]` |
| 122825 | [bussolo](https://it.wiktionary.org/w/index.php?title=bussolo&oldid=3964310) | Sostantivo | `bossolo` | 23: `* [[bossolo]]` |
| 123089 | [junior](https://it.wiktionary.org/w/index.php?title=junior&oldid=3642646) | Aggettivo | `giuniore`, `iunior` | 23: `* [[giuniore]], [[iunior]]` |
| 138076 | [sopraluogo](https://it.wiktionary.org/w/index.php?title=sopraluogo&oldid=3902167) | Sostantivo | `sopralluogo` | 16: `* [[sopralluogo]]` |
| 138202 | [stripe-tease](https://it.wiktionary.org/w/index.php?title=stripe-tease&oldid=3779396) | Sostantivo | `striptease` | 20: `*[[striptease]]` |
| 139348 | [spasimo](https://it.wiktionary.org/w/index.php?title=spasimo&oldid=3902456) | Sostantivo | `spasmo` | 27: `* {{Term\|antico\|it}} [[spasmo]]` |
| 140132 | [soperchio](https://it.wiktionary.org/w/index.php?title=soperchio&oldid=3877225) | Aggettivo | `soverchio` | 17: `* [[soverchio]]` |
| 140605 | [cric](https://it.wiktionary.org/w/index.php?title=cric&oldid=4057914) | Sostantivo | `cricco` | 19: `* [[cricco]]` |
| 153560 | [trascina](https://it.wiktionary.org/w/index.php?title=trascina&oldid=3996461) | Sostantivo | `tracina` | 21: `* [[tracina]]` |
| 165726 | [ricalcitrante](https://it.wiktionary.org/w/index.php?title=ricalcitrante&oldid=4085195) | Aggettivo | `recalcitrante` | 31: `* [[recalcitrante]]` |
| 189671 | [controindicato](https://it.wiktionary.org/w/index.php?title=controindicato&oldid=3999113) | Aggettivo | `contrindicato` | 26: `* {{Term\|raro\|it}} [[contrindicato]]` |
| 291470 | [stagnino](https://it.wiktionary.org/w/index.php?title=stagnino&oldid=4005792) | Sostantivo | `stagnaio` | 25: `{{Term\|regionale\|it}} [[stagnaio]]` |
| 352733 | [testimonio](https://it.wiktionary.org/w/index.php?title=testimonio&oldid=3985776) | Sostantivo | `testimone` | 27: `* [[testimone]]` |
| 404835 | [frutticultore](https://it.wiktionary.org/w/index.php?title=frutticultore&oldid=3639880) | Sostantivo | `frutticoltore` | 13: `* [[frutticoltore]]` |
| 405611 | [latticino](https://it.wiktionary.org/w/index.php?title=latticino&oldid=3903997) | Sostantivo | `latticinio` | 19: `*[[latticinio]]` |
| 405646 | [sovrapporta](https://it.wiktionary.org/w/index.php?title=sovrapporta&oldid=3786657) | Sostantivo | `soprapporta` | 13: `* [[sopraporta]], [[soprapporta]]` |
| 412987 | [cecio](https://it.wiktionary.org/w/index.php?title=cecio&oldid=3904298) | Sostantivo | `cece` | 16: `* [[cece]]` |
| 417136 | [dittero](https://it.wiktionary.org/w/index.php?title=dittero&oldid=4077067) | Aggettivo | `diptero` | 24: `* [[diptero]]` |
| 420051 | [quadrilobo](https://it.wiktionary.org/w/index.php?title=quadrilobo&oldid=3435191) | Aggettivo | `quadrilobato` | 21: `* [[quadrilobato]]` |
| 421539 | [luteranismo](https://it.wiktionary.org/w/index.php?title=luteranismo&oldid=3683440) | Sostantivo | `luteranesimo` | 16: `* [[luteranesimo]]` |
| 425071 | [poc'anzi](https://it.wiktionary.org/w/index.php?title=poc'anzi&oldid=3432309) | Avverbio | `pocanzi` | 16: `* [[pocanzi]]` |
| 439441 | [albatros](https://it.wiktionary.org/w/index.php?title=albatros&oldid=3971431) | Sostantivo | `albatro` | 20: `*[[albatro]]` |
| 442134 | [angloamericano](https://it.wiktionary.org/w/index.php?title=angloamericano&oldid=3905451) | Sostantivo | `anglo-americano` | 26: `* [[anglo-americano]]` |
| 446980 | [Novarese](https://it.wiktionary.org/w/index.php?title=Novarese&oldid=3363135) | Sostantivo | `novarese` | 13: `* [[novarese]]` |
| 448614 | [cistifelia](https://it.wiktionary.org/w/index.php?title=cistifelia&oldid=3391414) | Sostantivo | `cistifellea` | 13: `* [[cistifellea]]` |
| 448731 | [sfuocato](https://it.wiktionary.org/w/index.php?title=sfuocato&oldid=3779214) | Aggettivo | `sfocato` | 20: `*[[sfocato]]` |
| 450736 | [astrarre](https://it.wiktionary.org/w/index.php?title=astrarre&oldid=4067038) | Verbo | `astraere`, `astraggere` | 39: `* {{Term\|antico\|it}} [[astraere]], [[astraggere]]` |
| 451471 | [anglo-americano](https://it.wiktionary.org/w/index.php?title=anglo-americano&oldid=3377302) | Aggettivo | `angloamericano` | 26: `* [[angloamericano]]` |
| 451472 | [anglo-americano](https://it.wiktionary.org/w/index.php?title=anglo-americano&oldid=3377302) | Sostantivo | `angloamericano` | 26: `* [[angloamericano]]` |
| 452627 | [microcita](https://it.wiktionary.org/w/index.php?title=microcita&oldid=3905885) | Sostantivo | `microcito` | 16: `* [[microcito]]` |
| 454868 | [piezomagnetismo](https://it.wiktionary.org/w/index.php?title=piezomagnetismo&oldid=3629357) | Sostantivo | `magnetostrizione` | 16: `* [[magnetostrizione]]` |
| 457278 | [quadrimensionale](https://it.wiktionary.org/w/index.php?title=quadrimensionale&oldid=3780844) | Aggettivo | `quadridimensionale` | 16: `* [[quadridimensionale]]` |
| 461314 | [lapislazzolo](https://it.wiktionary.org/w/index.php?title=lapislazzolo&oldid=3418715) | Sostantivo | `lapislazzuli` | 16: `* [[lapislazzuli]]` |
| 461424 | [xiloteca](https://it.wiktionary.org/w/index.php?title=xiloteca&oldid=3452246) | Sostantivo | `silografia` | 13: `* [[silografia]]` |
| 461647 | [granulocito](https://it.wiktionary.org/w/index.php?title=granulocito&oldid=3920099) | Sostantivo | `granulocita` | 19: `* [[granulocita]]` |
| 462192 | [annunziatore](https://it.wiktionary.org/w/index.php?title=annunziatore&oldid=3627044) | Aggettivo | `annunciatore` | 16: `* [[annunciatore]]` |
| 462487 | [base-ball](https://it.wiktionary.org/w/index.php?title=base-ball&oldid=4061937) | Sostantivo | `baseball` | 19: `* [[baseball]], [[base ball]]` |
| 462493 | [beneficienza](https://it.wiktionary.org/w/index.php?title=beneficienza&oldid=3975426) | Sostantivo | `beneficenza` | 20: `* [[beneficenza]]` |
| 462505 | [poncio](https://it.wiktionary.org/w/index.php?title=poncio&oldid=3906488) | Sostantivo | `poncho` | 16: `* [[poncho]]` |
| 462524 | [nocchiero](https://it.wiktionary.org/w/index.php?title=nocchiero&oldid=3644783) | Sostantivo | `nocchiere` | 21: `* [[nocchiere]]` |
| 462562 | [alamanno](https://it.wiktionary.org/w/index.php?title=alamanno&oldid=3626556) | Aggettivo | `alemanno` | 17: `* [[alemanno]]` |
| 463076 | [scorazzare](https://it.wiktionary.org/w/index.php?title=scorazzare&oldid=3440219) | Verbo | `scorrazzare` | 16: `* [[scorrazzare]]` |
| 464356 | [raddirizzamento](https://it.wiktionary.org/w/index.php?title=raddirizzamento&oldid=3435625) | Sostantivo | `raddrizzamento` | 16: `* [[raddrizzamento]]` |
| 464386 | [quasi-gruppo](https://it.wiktionary.org/w/index.php?title=quasi-gruppo&oldid=3906658) | Sostantivo | `quasigruppo` | 16: `* [[quasigruppo]]` |
| 465074 | [aerolito](https://it.wiktionary.org/w/index.php?title=aerolito&oldid=3473746) | Sostantivo | `aerolite` | 16: `* [[aerolite]]` |
| 465946 | [autentificare](https://it.wiktionary.org/w/index.php?title=autentificare&oldid=3632843) | Verbo | `autenticare` | 20: `* [[autenticare]]` |
| 466106 | [atterigote](https://it.wiktionary.org/w/index.php?title=atterigote&oldid=3906860) | Sostantivo | `apterigote` | 17: `* [[apterigote]]` |
| 466107 | [Atterrigoti](https://it.wiktionary.org/w/index.php?title=Atterrigoti&oldid=3906861) | Sostantivo | `Apterigoti` | 19: `* [[Apterigoti]]` |
| 474668 | [orangotango](https://it.wiktionary.org/w/index.php?title=orangotango&oldid=3909991) | Sostantivo | `orango` | 17: `*[[orango]]` |
| 475348 | [semialfabeta](https://it.wiktionary.org/w/index.php?title=semialfabeta&oldid=3519962) | Sostantivo | `semianalfabeta` | 17: `*[[semianalfabeta]]` |
| 486090 | [subeguale](https://it.wiktionary.org/w/index.php?title=subeguale&oldid=3907188) | Aggettivo | `subuguale` | 16: `*[[subuguale]]` |
| 494940 | [dottorare](https://it.wiktionary.org/w/index.php?title=dottorare&oldid=3567484) | Verbo | `addottorare` | 20: `*[[addottorare]]` |
| 524502 | [Labridi](https://it.wiktionary.org/w/index.php?title=Labridi&oldid=3959219) | Sostantivo | `pesci` | 20: `*[[pesci]],  [[labroidei]]` |
| 537358 | [puntillismo](https://it.wiktionary.org/w/index.php?title=puntillismo&oldid=3647623) | Sostantivo | `puntilismo` | 16: `*[[puntilismo]]` |
| 537380 | [fisiocratismo](https://it.wiktionary.org/w/index.php?title=fisiocratismo&oldid=3683381) | Sostantivo | `fisiocrazia` | 16: `*[[fisiocrazia]]` |
| 537891 | [poetismo](https://it.wiktionary.org/w/index.php?title=poetismo&oldid=3646303) | Sostantivo | `poeticismo` | 16: `*[[poeticismo]]` |
| 537893 | [neohegelismo](https://it.wiktionary.org/w/index.php?title=neohegelismo&oldid=3908025) | Sostantivo | `neohegelianismo`, `neohegelianesimo` | 22: `*[[neohegelianismo]], [[neohegelianesimo]]` |
| 538038 | [energetismo](https://it.wiktionary.org/w/index.php?title=energetismo&oldid=3977426) | Sostantivo | `energismo` | 16: `*[[energismo]]` |
| 538040 | [pleocroismo](https://it.wiktionary.org/w/index.php?title=pleocroismo&oldid=3631172) | Sostantivo | `policroismo` | 19: `*[[policroismo]]` |
| 538052 | [seicentismo](https://it.wiktionary.org/w/index.php?title=seicentismo&oldid=3908043) | Sostantivo | `secentismo` | 16: `*[[secentismo]]` |
| 538065 | [cesaropapismo](https://it.wiktionary.org/w/index.php?title=cesaropapismo&oldid=3908046) | Sostantivo | `cesareopapismo` | 16: `*{{Term\|raro\|it}} [[cesareopapismo]]` |
| 538073 | [torismo](https://it.wiktionary.org/w/index.php?title=torismo&oldid=3765265) | Sostantivo | `torysmo` | 16: `*[[torysmo]]` |
| 538093 | [sensazionismo](https://it.wiktionary.org/w/index.php?title=sensazionismo&oldid=3921986) | Sostantivo | `sensazionalismo` | 16: `*[[sensazionalismo]]` |
| 538769 | [protosfera](https://it.wiktionary.org/w/index.php?title=protosfera&oldid=3734670) | Sostantivo | `protonosfera` | 16: `*[[protonosfera]]` |
| 544492 | [amerindo](https://it.wiktionary.org/w/index.php?title=amerindo&oldid=3669125) | Aggettivo | `amerindio` | 21: `*[[amerindio]]` |
| 544523 | [grammaticamente](https://it.wiktionary.org/w/index.php?title=grammaticamente&oldid=3668912) | Avverbio | `grammaticalmente` | 13: `*[[grammaticalmente]]` |
| 545165 | [giovanetto](https://it.wiktionary.org/w/index.php?title=giovanetto&oldid=3675034) | Sostantivo | `giovinetto` | 14: `*[[giovinetto]]` |
| 548625 | [disubbidienza](https://it.wiktionary.org/w/index.php?title=disubbidienza&oldid=3681357) | Sostantivo | `disobbedienza` | 24: `*[[disobbedienza]]` |
| 548636 | [disintossicare](https://it.wiktionary.org/w/index.php?title=disintossicare&oldid=3998252) | Verbo | `detossificare` | 28: `*[[detossificare]]` |
| 548930 | [panpsichismo](https://it.wiktionary.org/w/index.php?title=panpsichismo&oldid=3688272) | Sostantivo | `pampsichismo` | 16: `*[[pampsichismo]]` |
| 550077 | [citocromoossidasi](https://it.wiktionary.org/w/index.php?title=citocromoossidasi&oldid=3911046) | Sostantivo | `citocromossidasi` | 16: `*[[citocromossidasi]]` |
| 577457 | [Casuaridi](https://it.wiktionary.org/w/index.php?title=Casuaridi&oldid=3768124) | Sostantivo | `Casuariidi` | 17: `*[[Casuariidi]]` |
| 582797 | [sonare](https://it.wiktionary.org/w/index.php?title=sonare&oldid=3780010) | Verbo | `suonare` | 13: `*[[suonare]]` |
| 582888 | [sovraintendenza](https://it.wiktionary.org/w/index.php?title=sovraintendenza&oldid=3780793) | Sostantivo | `soprintendenza` | 13: `*[[soprintendenza]]` |
| 582975 | [rimovibile](https://it.wiktionary.org/w/index.php?title=rimovibile&oldid=3781200) | Aggettivo | `removibile` | 13: `*[[removibile]]` |
| 583418 | [instupidire](https://it.wiktionary.org/w/index.php?title=instupidire&oldid=3783690) | Verbo | `istupidire` | 16: `*[[istupidire]]` |
| 590946 | [immanicato](https://it.wiktionary.org/w/index.php?title=immanicato&oldid=3954091) | Aggettivo | `ammanicato` | 24: `*[[ammanicato]]` |
| 596674 | [neurosi](https://it.wiktionary.org/w/index.php?title=neurosi&oldid=3868368) | Sostantivo | `nevrosi` | 22: `*[[nevrosi]]` |
| 596698 | [cardiopalma](https://it.wiktionary.org/w/index.php?title=cardiopalma&oldid=3867600) | Sostantivo | `cardiopalmo` | 16: `*[[cardiopalmo]]` |
| 598544 | [carnificina](https://it.wiktionary.org/w/index.php?title=carnificina&oldid=3945199) | Sostantivo | `carneficina` | 21: `*[[carneficina]]` |
| 599430 | [paprika](https://it.wiktionary.org/w/index.php?title=paprika&oldid=4059299) | Sostantivo | `paprica` | 16: `* [[paprica]]` |
| 601216 | [connestabile](https://it.wiktionary.org/w/index.php?title=connestabile&oldid=3935006) | Sostantivo | `conestabile` | 16: `*[[conestabile]]` |
| 605390 | [bidet](https://it.wiktionary.org/w/index.php?title=bidet&oldid=3984478) | Sostantivo | `bidè` | 17: `*[[bidè]]` |
| 608714 | [parabolone](https://it.wiktionary.org/w/index.php?title=parabolone&oldid=3982130) | Sostantivo | `parabolano` | 24: `*[[parabolano]]` |
| 608874 | [Tubuliflore](https://it.wiktionary.org/w/index.php?title=Tubuliflore&oldid=4023939) | Sostantivo | `Tubiflore` | 18: `*[[Tubiflore]]` |
| 610842 | [uliveto](https://it.wiktionary.org/w/index.php?title=uliveto&oldid=4011217) | Sostantivo | `oliveto` | 17: `*[[oliveto]]` |
| 612196 | [euroasiatico](https://it.wiktionary.org/w/index.php?title=euroasiatico&oldid=4004350) | Aggettivo | `eurasiatico` | 24: `*[[eurasiatico]]` |
| 614653 | [Gigliacee](https://it.wiktionary.org/w/index.php?title=Gigliacee&oldid=4016365) | Sostantivo | `Liliacee` | 17: `* [[Liliacee]]` |
| 615193 | [centinodio](https://it.wiktionary.org/w/index.php?title=centinodio&oldid=4020727) | Sostantivo | `centinodia` | 17: `*[[centinodia]]` |
| 618725 | [premonstratense](https://it.wiktionary.org/w/index.php?title=premonstratense&oldid=4033076) | Sostantivo | `premostratense` | 23: `*[[premostratense]]` |
| 625501 | [frustulo](https://it.wiktionary.org/w/index.php?title=frustulo&oldid=4058251) | Sostantivo | `frustolo` | 21: `*[[frustolo]]` |
| 798228 | [maltusiano](https://it.wiktionary.org/w/index.php?title=maltusiano&oldid=4248395) | Aggettivo | `malthusiano` | 24: `* [[malthusiano]]` |
