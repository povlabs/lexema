# Common Italian words the lookup misses, in three groups — 2026-10-11

Issue [#807](https://github.com/povlabs/lexema/issues/807), for epic
[#802](https://github.com/povlabs/lexema/issues/802). Release `it-0c432803`,
seeded in full on a laptop the same day
([RUN_AN_IMPORT.md](../docs/RUN_AN_IMPORT.md)). Made with
`pnpm run measure:missing-words`
([src/lookup/measureMissingWords.ts](../src/lookup/measureMissingWords.ts));
the groups and bug classes are
[src/lookup/missingWord.ts](../src/lookup/missingWord.ts).

## Check lists

Both are check lists only. The script fetches them into the ignored
`.data/check-lists/` and checks each by SHA-256. Neither is committed, and
nothing else in the repository reads them.

| List | Version | Licence | SHA-256 |
|---|---|---|---|
| [FrequencyWords](https://github.com/hermitdave/FrequencyWords) `content/2018/it/it_50k.txt`, built from OpenSubtitles 2018 | commit `bd9e23103f0a7f89b4c604ecf8638e6f62ee0211` (2019-02-14) | CC BY-SA 4.0 for the content (the repository's code is MIT) | `bb96cdcb…66fc19` |
| [Morph-it!](https://docs.sslmit.unibo.it/doku.php?id=resources:morph-it) `morph-it.tgz`, list `morph-it_048.txt` | 0.48 (2009-02-23) | dual: CC BY-SA 2.0 and LGPL | archive `b137343d…7c024` |

Wikidata lexemes were read from the public SPARQL endpoint
(`https://query.wikidata.org/sparql`) on 2026-10-11. Wikidata's data is CC0.

## Method

1. Take the 20,000 most frequent words of the frequency list.
2. Keep the ones Morph-it! knows with at least one tag that is not a proper
   name, punctuation, symbol or smiley (`NPR`, `PON`, `SENT`, `SYM`, `SMI`).
   This drops English names and brands. Add the 14 words the brief names
   (#802), known to Morph-it! or not.
3. Look up each word through Lexema's real lookup, the code `/v1/lookup` and
   `/v1/lookup/batch` run: `lookup()` one word at a time, and `lookupBatch()`
   with all words in one call. A word is missing when `lookup()` does not find
   it. The two agree on every word.
4. Sort each missing word into the first group that fits:
   - **Our bug**, with a bug class naming what a fix would change:
     - `declared-lemma-only`: the word page answers it as a declared lemma
       (#453), and the API lookup does not.
     - `accent-variant`: the page offers a word we have with its accent set
       right (`perche` → `perché`), and Morph-it! does not read it as another
       lemma of ours.
     - `pronominal-verb-pair`: `si` + a verb form we have.
     - `elided-form`, `truncated-form`, `clitic-form`, `demonstrative-form`,
       `verb-form`, `noun-inflection`, `adjective-inflection`: Morph-it! names
       a lemma that the lookup finds, and the word is that kind of form of it.
       An elided form ends in an apostrophe (`quell'`); a truncated one is its
       lemma cut short after `l`, `m`, `n` or `r` (`aver`, `cuor`); the rest
       follow Morph-it!'s tag.
     - Two classes never fired: `headword-not-served` and
       `listed-form-not-served`. No unhidden archive record heads or lists any
       missing word in `forms[]`, so a plain string match against the archive
       finds none of them.
   - **In Wikidata's words**: an Italian (Q652) lexeme has the word as its
     lemma or one of its forms. Wikidata is asked only about the words that are
     not our bug. "Italian sense" says whether a sense of the lexeme has an
     Italian gloss.
   - **In neither**: the rest.

## *si trasferiscono* / `trasferirsi`

`trasferirsi` is found: it.wiktionary has it, and the lookup answers it.
`si trasferiscono` is not found, though `trasferiscono` is. So the pair is
**our bug**, class `pronominal-verb-pair`: a `si` + verb form query does not
reach the pronominal verb `trasferirsi`. It is the only such pair in the list,
because the frequency list holds single words; the class is wider than this
one example.

## Read with care

- **Morph-it! noise.** Morph-it! reads some English names as Italian verb
  forms: `alan` (alare), `colin` (colare), `bean` (beare), `annette`
  (annettere), `capitan` (capitare), `devon` (dovere). The list marks a word
  "(also a name)" when Morph-it! also lists it as a proper name; the others
  carry no mark. A fix for `verb-form` should check each word.
- **Morph-it! lemma gaps.** A few words Morph-it! lemmatizes as themselves,
  so no lemma of ours explains them and they land in neither: `dimmi`
  (`VER:impr+pres+2+s+mi`, the imperative of dire + mi), `glielo`, `gliela`,
  `gliene` and the other `glie-` clusters. The neither table shows each
  word's Morph-it! tags so these stand out.
- **Subtitle spellings.** `citta'`, `liberta'`, `societa'`, `attivita'` and
  `piu` are subtitle spellings with an apostrophe or no accent. They are in the
  list as the lookup sees them.
- **The seed is the release, not production.** Production also serves the
  update feeds applied since ([ADR 0025](../.decisions/0025-newer-source-definitions-are-authoritative.md)). This count does not read them, so a
  word a feed added would still show here as missing.
- **Counts over the top 20,000 only.** The 14 named words are added on top.
  Three of them (`paralimpico`, `handbike`, `si trasferiscono`) are outside the
  top 20,000 and show "named" as their rank. `ehi` and `oddio` are in the top
  20,000 but unknown to Morph-it!, so only their naming in the brief put them
  in the count.

## The list

The script's output, as printed.

Release `it-0c432803`. Of the 20000 most frequent subtitle words, Morph-it! knows 15683 as Italian words; 706 only as names or symbols and 3611 not at all, and those are not looked up. With the 14 words the brief names, 15689 words were looked up, single and batch; single and batch disagree on 0.

| Group | Words |
|---|---:|
| Our bug | 965 |
| In Wikidata's words | 60 |
| In neither | 137 |
| Missing in all | 1162 |

The top 20000 alone: 1159 missing.

### Our bug (965)

| Bug class | Words |
|---|---:|
| `declared-lemma-only` | 16 |
| `accent-variant` | 12 |
| `pronominal-verb-pair` | 1 |
| `elided-form` | 26 |
| `truncated-form` | 30 |
| `clitic-form` | 830 |
| `demonstrative-form` | 2 |
| `verb-form` | 17 |
| `noun-inflection` | 17 |
| `adjective-inflection` | 14 |

| Word | Rank | Bug class | Lemma |
|---|---:|---|---|
| perche | #64 | `accent-variant` | perché |
| piu | #88 | `accent-variant` | più |
| cos' | #169 | `elided-form` | cosa |
| farlo | #214 | `clitic-form` | fare |
| dov' | #255 | `elided-form` | dove |
| aver | #265 | `truncated-form` | avere |
| far (also a name) | #361 | `truncated-form` | fare |
| perchè | #397 | `accent-variant` | perché |
| quei | #406 | `demonstrative-form` | quello |
| quell' | #461 | `elided-form` | quello |
| com' | #473 | `elided-form` | come |
| quest' | #503 | `elided-form` | questo |
| farti | #530 | `clitic-form` | fare |
| dammi | #604 | `clitic-form` | dare |
| fammi | #628 | `clitic-form` | fare |
| smettila | #646 | `clitic-form` | smettere |
| dirmi | #683 | `clitic-form` | dire |
| dirlo | #698 | `clitic-form` | dire |
| vuol | #724 | `verb-form` | volere |
| saperlo | #743 | `clitic-form` | sapere |
| preoccuparti | #768 | `clitic-form` | preoccupare |
| é | #778 | `verb-form` | essere |
| dev' | #781 | `elided-form` | dovere |
| dirti | #789 | `clitic-form` | dire |
| scusami | #812 | `clitic-form` | scusare |
| vederti | #861 | `clitic-form` | vedere |
| lasciami | #902 | `clitic-form` | lasciare |
| farci | #959 | `clitic-form` | fare |
| vattene | #987 | `clitic-form` | andare |
| averlo | #1064 | `clitic-form` | avere |
| aiutarti | #1107 | `clitic-form` | aiutare |
| ascoltami | #1140 | `clitic-form` | ascoltare |
| parlarne | #1180 | `clitic-form` | parlare |
| farla | #1227 | `clitic-form` | fare |
| averti | #1266 | `clitic-form` | avere |
| vederlo | #1303 | `clitic-form` | vedere |
| parlarti | #1315 | `clitic-form` | parlare |
| aiutarmi | #1330 | `clitic-form` | aiutare |
| m' | #1340 | `elided-form` | mi |
| quegli | #1353 | `demonstrative-form` | quello |
| caffe | #1358 | `accent-variant` | caffè |
| farle | #1374 | `clitic-form` | fare |
| qualcos' | #1386 | `elided-form` | qualcosa |
| darmi | #1412 | `clitic-form` | dare |
| darti | #1415 | `clitic-form` | dare |
| diro | #1459 | `accent-variant` | dirò |
| avermi | #1464 | `clitic-form` | avere |
| aiutarla | #1508 | `clitic-form` | aiutare |
| guardami | #1528 | `clitic-form` | guardare |
| vederla | #1541 | `clitic-form` | vedere |
| aiutami | #1555 | `clitic-form` | aiutare |
| dirle | #1607 | `clitic-form` | dire |
| andartene | #1621 | `clitic-form` | andare |
| prendermi | #1691 | `clitic-form` | prendere |
| andarci | #1732 | `clitic-form` | andare |
| dirtelo | #1734 | `clitic-form` | dire |
| chiederti | #1739 | `clitic-form` | chiedere |
| fargli | #1758 | `clitic-form` | fare |
| pensarci | #1817 | `clitic-form` | pensare |
| trovarlo | #1888 | `clitic-form` | trovare |
| scusatemi | #1891 | `clitic-form` | scusare |
| chiamami | #1894 | `clitic-form` | chiamare |
| esserlo | #1917 | `clitic-form` | essere |
| andarmene | #1921 | `clitic-form` | andare |
| credimi | #1971 | `clitic-form` | credere |
| quand' | #1975 | `elided-form` | quando |
| nient' | #1976 | `elided-form` | niente |
| vedermi | #1978 | `clitic-form` | vedere |
| dirgli | #1982 | `clitic-form` | dire |
| dargli | #1993 | `clitic-form` | dare |
| chiamarmi | #2036 | `clitic-form` | chiamare |
| uccidermi | #2041 | `clitic-form` | uccidere |
| lascialo | #2045 | `clitic-form` | lasciare |
| s' | #2065 | `elided-form` | si |
| conoscerti | #2096 | `clitic-form` | conoscere |
| prenderlo | #2102 | `clitic-form` | prendere |
| mr. | #2107 | `noun-inflection` | mister |
| amor | #2108 | `truncated-form` | amore |
| sig. | #2141 | `noun-inflection` | signore |
| son | #2153 | `verb-form` | essere |
| lasciarmi | #2163 | `clitic-form` | lasciare |
| lasciatemi | #2168 | `clitic-form` | lasciare |
| andarcene | #2181 | `clitic-form` | andare |
| parlarle | #2192 | `clitic-form` | parlare |
| mal | #2223 | `truncated-form` | male |
| bell' | #2227 | `elided-form` | bello |
| scusarmi | #2278 | `clitic-form` | scusare |
| dirci | #2283 | `clitic-form` | dire |
| dirmelo | #2304 | `clitic-form` | dire |
| dirglielo | #2315 | `clitic-form` | dire |
| ucciderlo | #2316 | `clitic-form` | uccidere |
| sentirmi | #2331 | `clitic-form` | sentire |
| aiutarci | #2342 | `clitic-form` | aiutare |
| fatemi | #2370 | `clitic-form` | fare |
| farvi | #2392 | `clitic-form` | fare |
| smetterla | #2405 | `clitic-form` | smettere |
| darle | #2453 | `clitic-form` | dare |
| prenderla | #2476 | `clitic-form` | prendere |
| trovarmi | #2481 | `clitic-form` | trovare |
| alan (also a name) | #2486 | `verb-form` | alare |
| facciamolo | #2497 | `clitic-form` | fare |
| averne | #2531 | `clitic-form` | avere |
| darci | #2558 | `clitic-form` | dare |
| trovarla | #2567 | `clitic-form` | trovare |
| portarlo | #2579 | `clitic-form` | portare |
| mettermi | #2581 | `clitic-form` | mettere |
| farne | #2600 | `clitic-form` | fare |
| portarti | #2618 | `clitic-form` | portare |
| metterti | #2624 | `clitic-form` | mettere |
| conoscerla | #2640 | `clitic-form` | conoscere |
| sentirti | #2654 | `clitic-form` | sentire |
| andiamocene | #2703 | `clitic-form` | andare |
| portami | #2709 | `clitic-form` | portare |
| tenerlo | #2712 | `clitic-form` | tenere |
| pensaci | #2747 | `clitic-form` | pensare |
| parlarmi | #2768 | `clitic-form` | parlare |
| muoverti | #2776 | `clitic-form` | muovere |
| stan | #2791 | `verb-form` | stare |
| togliti | #2812 | `clitic-form` | togliere |
| lasciarlo | #2832 | `clitic-form` | lasciare |
| lasciarti | #2835 | `clitic-form` | lasciare |
| dirvi | #2838 | `clitic-form` | dire |
| trovarti | #2840 | `clitic-form` | trovare |
| aiutarvi | #2854 | `clitic-form` | aiutare |
| pò | #2859 | `accent-variant` | po' |
| essermi | #2871 | `clitic-form` | essere |
| ucciderti | #2893 | `clitic-form` | uccidere |
| portarla | #2902 | `clitic-form` | portare |
| lasciar | #2934 | `truncated-form` | lasciare |
| vederci | #2969 | `clitic-form` | vedere |
| portarmi | #2988 | `clitic-form` | portare |
| chiedermi | #2995 | `clitic-form` | chiedere |
| professor | #3042 | `truncated-form` | professore |
| perdonami | #3050 | `clitic-form` | perdonare |
| chiederle | #3093 | `clitic-form` | chiedere |
| farli | #3095 | `clitic-form` | fare |
| esserne | #3106 | `clitic-form` | essere |
| metterci | #3146 | `clitic-form` | mettere |
| aiutatemi | #3170 | `clitic-form` | aiutare |
| parlargli | #3182 | `clitic-form` | parlare |
| aiutarlo | #3203 | `clitic-form` | aiutare |
| scoprirlo | #3256 | `clitic-form` | scoprire |
| sentirlo | #3306 | `clitic-form` | sentire |
| capirlo | #3322 | `clitic-form` | capire |
| datemi | #3340 | `clitic-form` | dare |
| poterlo | #3359 | `clitic-form` | potere |
| smettetela | #3370 | `clitic-form` | smettere |
| fidarti | #3373 | `clitic-form` | fidare |
| ditemi | #3415 | `clitic-form` | dire |
| sposarmi | #3423 | `clitic-form` | sposare |
| piantala | #3441 | `clitic-form` | piantare |
| chiamarti | #3468 | `clitic-form` | chiamare |
| fermarlo | #3484 | `clitic-form` | fermare |
| mettilo | #3495 | `clitic-form` | mettere |
| andar | #3498 | `truncated-form` | andare |
| fottiti | #3527 | `clitic-form` | fottere |
| lasciarla | #3550 | `clitic-form` | lasciare |
| han | #3582 | `verb-form` | avere |
| esser | #3584 | `truncated-form` | essere |
| chiamarlo | #3603 | `clitic-form` | chiamare |
| brav' | #3613 | `elided-form` | bravo |
| essersi | #3629 | `clitic-form` | essere |
| metterlo | #3632 | `clitic-form` | mettere |
| guardarmi | #3651 | `clitic-form` | guardare |
| dira | #3668 | `accent-variant` | dirà |
| fatelo | #3696 | `clitic-form` | fare |
| fidarmi | #3713 | `clitic-form` | fidare |
| chiamarla | #3809 | `clitic-form` | chiamare |
| dr. | #3859 | `noun-inflection` | dottore |
| parlami | #3916 | `clitic-form` | parlare |
| tenerla | #3921 | `clitic-form` | tenere |
| andatevene | #3940 | `clitic-form` | andare |
| fermarmi | #3949 | `clitic-form` | fermare |
| fermarti | #3988 | `clitic-form` | fermare |
| ucciderla | #4006 | `clitic-form` | uccidere |
| vedervi | #4028 | `clitic-form` | vedere |
| portatelo | #4112 | `clitic-form` | portare |
| neanch' | #4123 | `elided-form` | neanche |
| trovarci | #4146 | `clitic-form` | trovare |
| ringraziarti | #4203 | `clitic-form` | ringraziare |
| ammetterlo | #4210 | `clitic-form` | ammettere |
| chiederlo | #4223 | `clitic-form` | chiedere |
| occuparmi | #4250 | `clitic-form` | occupare |
| portalo | #4252 | `clitic-form` | portare |
| esserti | #4278 | `clitic-form` | essere |
| proteggerti | #4316 | `clitic-form` | proteggere |
| tenerti | #4337 | `clitic-form` | tenere |
| metterla | #4361 | `clitic-form` | mettere |
| tal | #4368 | `truncated-form` | tale |
| mettila | #4454 | `clitic-form` | mettere |
| potermi | #4489 | `clitic-form` | potere |
| volerlo | #4538 | `clitic-form` | volere |
| toccarmi | #4547 | `clitic-form` | toccare |
| citta' (also a name) | #4554 | `elided-form` | città |
| tenermi | #4585 | `clitic-form` | tenere |
| dar | #4590 | `truncated-form` | dare |
| usarlo | #4591 | `clitic-form` | usare |
| fermatevi | #4593 | `clitic-form` | fermare |
| fratellino | #4639 | `declared-lemma-only` |  |
| pipi | #4649 | `accent-variant` | pipì |
| senz' | #4652 | `elided-form` | senza |
| poterti | #4661 | `clitic-form` | potere |
| colin | #4813 | `verb-form` | colare |
| cercarlo | #4853 | `clitic-form` | cercare |
| darvi | #4883 | `clitic-form` | dare |
| guardalo | #4895 | `clitic-form` | guardare |
| averli | #4934 | `clitic-form` | avere |
| avervi | #4962 | `clitic-form` | avere |
| aspettami | #4965 | `clitic-form` | aspettare |
| lasciarci | #4981 | `clitic-form` | lasciare |
| passami | #5030 | `clitic-form` | passare |
| quartier | #5044 | `truncated-form` | quartiere |
| bravissimo | #5091 | `adjective-inflection` | bravo |
| salvarti | #5113 | `clitic-form` | salvare |
| seguitemi | #5123 | `clitic-form` | seguire |
| lasciatelo | #5157 | `clitic-form` | lasciare |
| uscirne | #5194 | `clitic-form` | uscire |
| seguimi | #5217 | `clitic-form` | seguire |
| preoccuparmi | #5227 | `clitic-form` | preoccupare |
| ascoltatemi | #5270 | `clitic-form` | ascoltare |
| guardarti | #5299 | `clitic-form` | guardare |
| sbrigatevi | #5375 | `clitic-form` | sbrigare |
| incontrarci | #5386 | `clitic-form` | incontrare |
| prenderli | #5397 | `clitic-form` | prendere |
| provarlo | #5410 | `clitic-form` | provare |
| preoccupatevi | #5415 | `clitic-form` | preoccupare |
| vederli | #5416 | `clitic-form` | vedere |
| mostrarti | #5434 | `clitic-form` | mostrare |
| permettermi | #5511 | `clitic-form` | permettere |
| portala | #5591 | `clitic-form` | portare |
| usarla | #5634 | `clitic-form` | usare |
| offrirti | #5679 | `clitic-form` | offrire |
| guardarlo | #5692 | `clitic-form` | guardare |
| tieniti | #5700 | `clitic-form` | tenere |
| parlarci | #5780 | `clitic-form` | parlare |
| saperne | #5811 | `clitic-form` | sapere |
| portarci | #5852 | `clitic-form` | portare |
| parliamone | #5867 | `clitic-form` | parlare |
| fermarci | #5896 | `clitic-form` | fermare |
| bravissima | #5906 | `adjective-inflection` | bravo |
| presentarti | #5954 | `clitic-form` | presentare |
| ancor | #5973 | `truncated-form` | ancora |
| credermi | #5997 | `clitic-form` | credere |
| provaci | #5999 | `clitic-form` | provare |
| salvarlo | #6024 | `clitic-form` | salvare |
| color | #6032 | `truncated-form` | colore |
| togliermi | #6035 | `clitic-form` | togliere |
| preparatevi | #6051 | `clitic-form` | preparare |
| cercarla | #6109 | `clitic-form` | cercare |
| diamoci | #6138 | `clitic-form` | dare |
| muoverci | #6147 | `clitic-form` | muovere |
| ucciderci | #6152 | `clitic-form` | uccidere |
| conoscerlo | #6155 | `clitic-form` | conoscere |
| ascoltarmi | #6241 | `clitic-form` | ascoltare |
| salvarla | #6256 | `clitic-form` | salvare |
| seguirmi | #6261 | `clitic-form` | seguire |
| andarvene | #6268 | `clitic-form` | andare |
| presentarvi | #6330 | `clitic-form` | presentare |
| accettarlo | #6331 | `clitic-form` | accettare |
| raccontami | #6346 | `clitic-form` | raccontare |
| comportarti | #6387 | `clitic-form` | comportare |
| conoscervi | #6409 | `clitic-form` | conoscere |
| cercarti | #6483 | `clitic-form` | cercare |
| incontrarti | #6513 | `clitic-form` | incontrare |
| perdonatemi | #6521 | `clitic-form` | perdonare |
| salvarmi | #6571 | `clitic-form` | salvare |
| finiscila | #6572 | `clitic-form` | finire |
| chiedergli | #6593 | `clitic-form` | chiedere |
| prenderne | #6612 | `clitic-form` | prendere |
| poterla | #6687 | `clitic-form` | potere |
| fermarli | #6708 | `clitic-form` | fermare |
| calmatevi | #6741 | `clitic-form` | calmare |
| mandarmi | #6742 | `clitic-form` | mandare |
| unirti | #6748 | `clitic-form` | unire |
| sentirla | #6770 | `clitic-form` | sentire |
| proteggerla | #6783 | `clitic-form` | proteggere |
| aspettarti | #6848 | `clitic-form` | aspettare |
| prenderle | #6866 | `clitic-form` | prendere |
| trovarli | #6873 | `clitic-form` | trovare |
| proteggermi | #6884 | `clitic-form` | proteggere |
| dimenticarti | #6886 | `clitic-form` | dimenticare |
| aspettarmi | #6891 | `clitic-form` | aspettare |
| concentrarmi | #6894 | `clitic-form` | concentrare |
| val (also a name) | #6927 | `truncated-form` | valle |
| fidarci | #6931 | `clitic-form` | fidare |
| incontrarla | #6932 | `clitic-form` | incontrare |
| spiegarmi | #6960 | `clitic-form` | spiegare |
| chiedervi | #6971 | `clitic-form` | chiedere |
| cercarmi | #6972 | `clitic-form` | cercare |
| toglierti | #6983 | `clitic-form` | togliere |
| renderlo | #6993 | `clitic-form` | rendere |
| leggerlo | #7013 | `clitic-form` | leggere |
| arrivarci | #7019 | `clitic-form` | arrivare |
| volerci | #7042 | `clitic-form` | volere |
| trent' | #7048 | `elided-form` | trenta |
| saper | #7067 | `truncated-form` | sapere |
| rivederla | #7117 | `clitic-form` | rivedere |
| sopportarlo | #7165 | `clitic-form` | sopportare |
| ricordarti | #7172 | `clitic-form` | ricordare |
| dirla | #7179 | `clitic-form` | dire |
| guardala | #7187 | `clitic-form` | guardare |
| renderti | #7220 | `clitic-form` | rendere |
| permetterci | #7223 | `clitic-form` | permettere |
| sposarci | #7244 | `clitic-form` | sposare |
| divertirci | #7266 | `clitic-form` | divertire |
| fermarla | #7280 | `clitic-form` | fermare |
| incontrarlo | #7282 | `clitic-form` | incontrare |
| perderti | #7287 | `clitic-form` | perdere |
| credetemi | #7329 | `clitic-form` | credere |
| parlarvi | #7339 | `clitic-form` | parlare |
| spiegarti | #7346 | `clitic-form` | spiegare |
| chiederglielo | #7363 | `clitic-form` | chiedere |
| tenerli | #7411 | `clitic-form` | tenere |
| convincerlo | #7492 | `clitic-form` | convincere |
| toccarlo | #7497 | `clitic-form` | toccare |
| portarli | #7529 | `clitic-form` | portare |
| liberarmi | #7530 | `clitic-form` | liberare |
| nasconderti | #7539 | `clitic-form` | nascondere |
| amarti | #7544 | `clitic-form` | amare |
| tirarti | #7558 | `clitic-form` | tirare |
| rilassarti | #7561 | `clitic-form` | rilassare |
| divertirti | #7573 | `clitic-form` | divertire |
| aiutarli | #7601 | `clitic-form` | aiutare |
| valsa | #7618 | `verb-form` | valere |
| perdonarmi | #7634 | `clitic-form` | perdonare |
| portatemi | #7637 | `clitic-form` | portare |
| dimenticarlo | #7656 | `clitic-form` | dimenticare |
| avvicinarti | #7670 | `clitic-form` | avvicinare |
| mettimi | #7712 | `clitic-form` | mettere |
| chiamalo | #7732 | `clitic-form` | chiamare |
| prepararmi | #7752 | `clitic-form` | preparare |
| baciami | #7780 | `clitic-form` | baciare |
| occuparti | #7783 | `clitic-form` | occupare |
| finirla | #7817 | `clitic-form` | finire |
| toglietevi | #7819 | `clitic-form` | togliere |
| ucciderli | #7831 | `clitic-form` | uccidere |
| ringraziarmi | #7848 | `clitic-form` | ringraziare |
| sposarlo | #7859 | `clitic-form` | sposare |
| guardarla | #7879 | `clitic-form` | guardare |
| evitarlo | #7889 | `clitic-form` | evitare |
| vederle | #7939 | `clitic-form` | vedere |
| portarle | #7943 | `clitic-form` | portare |
| divertirmi | #7950 | `clitic-form` | divertire |
| proteggerlo | #7952 | `clitic-form` | proteggere |
| assicurarci | #7960 | `clitic-form` | assicurare |
| doverlo | #8027 | `clitic-form` | dovere |
| chiedermelo | #8029 | `clitic-form` | chiedere |
| muovermi | #8062 | `clitic-form` | muovere |
| lasciaci | #8074 | `clitic-form` | lasciare |
| facciamola | #8096 | `clitic-form` | fare |
| avergli | #8108 | `clitic-form` | avere |
| lavorarci | #8119 | `clitic-form` | lavorare |
| lasciarli | #8120 | `clitic-form` | lasciare |
| prendertela | #8124 | `clitic-form` | prendere |
| cambiarmi | #8132 | `clitic-form` | cambiare |
| portarvi | #8150 | `clitic-form` | portare |
| sott' | #8162 | `elided-form` | sotto |
| convincermi | #8168 | `clitic-form` | convincere |
| tirarlo | #8169 | `clitic-form` | tirare |
| capitan | #8170 | `verb-form` | capitare |
| permettimi | #8174 | `clitic-form` | permettere |
| ricordarmi | #8185 | `clitic-form` | ricordare |
| tenetevi | #8191 | `clitic-form` | tenere |
| ringraziarla | #8195 | `clitic-form` | ringraziare |
| alzarti | #8206 | `clitic-form` | alzare |
| metterli | #8220 | `clitic-form` | mettere |
| tantissime | #8237 | `adjective-inflection` | tanto |
| spiegarlo | #8249 | `clitic-form` | spiegare |
| spararmi | #8292 | `clitic-form` | sparare |
| dolcetto | #8339 | `declared-lemma-only` |  |
| tate | #8358 | `noun-inflection` | tata |
| tirar | #8370 | `truncated-form` | tirare |
| poterci | #8402 | `clitic-form` | potere |
| mandarlo | #8411 | `clitic-form` | mandare |
| spostatevi | #8437 | `clitic-form` | spostare |
| nascondermi | #8492 | `clitic-form` | nascondere |
| tirarmi | #8500 | `clitic-form` | tirare |
| farmelo | #8561 | `clitic-form` | fare |
| tienimi | #8565 | `clitic-form` | tenere |
| incontrarmi | #8574 | `clitic-form` | incontrare |
| sparargli | #8583 | `clitic-form` | sparare |
| offrirle | #8633 | `clitic-form` | offrire |
| tenerci | #8669 | `clitic-form` | tenere |
| dirvelo | #8735 | `clitic-form` | dire |
| vendicarsi | #8760 | `clitic-form` | vendicare |
| fartelo | #8784 | `clitic-form` | fare |
| immaginarlo | #8790 | `clitic-form` | immaginare |
| buonissimo | #8804 | `adjective-inflection` | buono |
| chiamatemi | #8814 | `clitic-form` | chiamare |
| rifarlo | #8819 | `clitic-form` | rifare |
| alzarmi | #8847 | `clitic-form` | alzare |
| mandami | #8876 | `clitic-form` | mandare |
| toccarla | #8880 | `clitic-form` | toccare |
| mostrarmi | #8905 | `clitic-form` | mostrare |
| presentarmi | #8908 | `clitic-form` | presentare |
| starmi | #8920 | `clitic-form` | stare |
| rendermi | #8924 | `clitic-form` | rendere |
| piacerti | #8925 | `clitic-form` | piacere |
| ringraziarvi | #8961 | `clitic-form` | ringraziare |
| perderlo | #9017 | `clitic-form` | perdere |
| dateci | #9053 | `clitic-form` | dare |
| figuriamoci | #9058 | `clitic-form` | figurare |
| permetterti | #9080 | `clitic-form` | permettere |
| allontanatevi | #9107 | `clitic-form` | allontanare |
| esserle | #9124 | `clitic-form` | essere |
| prepararti | #9128 | `clitic-form` | preparare |
| riportarlo | #9147 | `clitic-form` | riportare |
| aprirla | #9208 | `clitic-form` | aprire |
| sparagli | #9226 | `clitic-form` | sparare |
| portaci | #9235 | `clitic-form` | portare |
| affrontarlo | #9240 | `clitic-form` | affrontare |
| lasciatela | #9251 | `clitic-form` | lasciare |
| v' | #9336 | `elided-form` | vi |
| convincerla | #9353 | `clitic-form` | convincere |
| levatevi | #9369 | `clitic-form` | levare |
| sbrigarci | #9375 | `clitic-form` | sbrigare |
| dategli | #9400 | `clitic-form` | dare |
| ascoltarlo | #9420 | `clitic-form` | ascoltare |
| devon | #9424 | `verb-form` | dovere |
| concentrarti | #9426 | `clitic-form` | concentrare |
| darlo | #9431 | `clitic-form` | dare |
| trovarne | #9450 | `clitic-form` | trovare |
| signorino | #9472 | `declared-lemma-only` |  |
| affar | #9479 | `truncated-form` | affare |
| mandarti | #9481 | `clitic-form` | mandare |
| concentrarci | #9483 | `clitic-form` | concentrare |
| controllarlo | #9511 | `clitic-form` | controllare |
| preoccuparci | #9523 | `clitic-form` | preoccupare |
| raccontarmi | #9562 | `clitic-form` | raccontare |
| alzatevi | #9576 | `clitic-form` | alzare |
| aprilo | #9586 | `clitic-form` | aprire |
| comportarmi | #9635 | `clitic-form` | comportare |
| chiedigli | #9653 | `clitic-form` | chiedere |
| pagarmi | #9656 | `clitic-form` | pagare |
| svegliarti | #9668 | `clitic-form` | svegliare |
| amarmi | #9688 | `clitic-form` | amare |
| venirmi | #9722 | `clitic-form` | venire |
| salvarci | #9742 | `clitic-form` | salvare |
| mar (also a name) | #9745 | `truncated-form` | mare |
| marines | #9762 | `noun-inflection` | marine |
| accompagnarmi | #9781 | `clitic-form` | accompagnare |
| aiutaci | #9813 | `clitic-form` | aiutare |
| starmene | #9847 | `clitic-form` | stare |
| assicurarti | #9868 | `clitic-form` | assicurare |
| occuparci | #9871 | `clitic-form` | occupare |
| pensarlo | #9881 | `clitic-form` | pensare |
| dimostrarlo | #9884 | `clitic-form` | dimostrare |
| lasciateci | #9887 | `clitic-form` | lasciare |
| riprendermi | #9894 | `clitic-form` | riprendere |
| arrabbiarti | #9929 | `clitic-form` | arrabbiare |
| tornarci | #9933 | `clitic-form` | tornare |
| sbrighiamoci | #9935 | `clitic-form` | sbrigare |
| nasconderlo | #9940 | `clitic-form` | nascondere |
| dircelo | #9944 | `clitic-form` | dire |
| mettici | #9947 | `clitic-form` | mettere |
| avvicinatevi | #9960 | `clitic-form` | avvicinare |
| salutarti | #9967 | `clitic-form` | salutare |
| unisciti | #9983 | `clitic-form` | unire |
| tener | #10007 | `truncated-form` | tenere |
| chiedilo | #10014 | `clitic-form` | chiedere |
| unirmi | #10059 | `clitic-form` | unire |
| piacermi | #10069 | `clitic-form` | piacere |
| ditegli | #10103 | `clitic-form` | dire |
| lamentarti | #10108 | `clitic-form` | lamentare |
| assicuratevi | #10117 | `clitic-form` | assicurare |
| guardatevi | #10122 | `clitic-form` | guardare |
| comprarmi | #10136 | `clitic-form` | comprare |
| insegnarmi | #10160 | `clitic-form` | insegnare |
| ripeterlo | #10161 | `clitic-form` | ripetere |
| metterle | #10195 | `clitic-form` | mettere |
| proteggerci | #10215 | `clitic-form` | proteggere |
| conoscermi | #10227 | `clitic-form` | conoscere |
| renderla | #10238 | `clitic-form` | rendere |
| ricordatevi | #10240 | `clitic-form` | ricordare |
| fidatevi | #10249 | `clitic-form` | fidare |
| portar | #10280 | `truncated-form` | portare |
| spiegami | #10285 | `clitic-form` | spiegare |
| mostrarle | #10287 | `clitic-form` | mostrare |
| costringermi | #10292 | `clitic-form` | costringere |
| perderla | #10297 | `clitic-form` | perdere |
| seguirlo | #10327 | `clitic-form` | seguire |
| sè | #10330 | `accent-variant` | sé |
| poverina | #10331 | `adjective-inflection` | poverino |
| riportarla | #10339 | `clitic-form` | riportare |
| rilassarmi | #10357 | `clitic-form` | rilassare |
| tantissimi | #10366 | `adjective-inflection` | tanto |
| insegnarti | #10384 | `clitic-form` | insegnare |
| permettetemi | #10424 | `clitic-form` | permettere |
| mangiarlo | #10432 | `clitic-form` | mangiare |
| darla | #10434 | `clitic-form` | dare |
| sposarla | #10491 | `clitic-form` | sposare |
| aprirlo | #10502 | `clitic-form` | aprire |
| mettetelo | #10546 | `clitic-form` | mettere |
| fatela | #10583 | `clitic-form` | fare |
| rintracciarlo | #10634 | `clitic-form` | rintracciare |
| guardatelo | #10659 | `clitic-form` | guardare |
| pensateci | #10679 | `clitic-form` | pensare |
| conoscerci | #10734 | `clitic-form` | conoscere |
| venderla | #10749 | `clitic-form` | vendere |
| ricordami | #10750 | `clitic-form` | ricordare |
| sentirci | #10775 | `clitic-form` | sentire |
| tirarla | #10845 | `clitic-form` | tirare |
| ascoltarti | #10847 | `clitic-form` | ascoltare |
| cambiarlo | #10910 | `clitic-form` | cambiare |
| mostrarvi | #10945 | `clitic-form` | mostrare |
| comprarti | #11038 | `clitic-form` | comprare |
| fateci | #11047 | `clitic-form` | fare |
| mettervi | #11063 | `clitic-form` | mettere |
| arrestarlo | #11077 | `clitic-form` | arrestare |
| usarli | #11082 | `clitic-form` | usare |
| trovarvi | #11090 | `clitic-form` | trovare |
| riposarti | #11118 | `clitic-form` | riposare |
| convincerti | #11133 | `clitic-form` | convincere |
| mettiamola | #11159 | `clitic-form` | mettere |
| camerino | #11181 | `declared-lemma-only` |  |
| mandarla | #11195 | `clitic-form` | mandare |
| nasconderci | #11219 | `clitic-form` | nascondere |
| ascoltarla | #11229 | `clitic-form` | ascoltare |
| scusarci | #11230 | `clitic-form` | scusare |
| occuparmene | #11249 | `clitic-form` | occupare |
| statemi | #11257 | `clitic-form` | stare |
| distruggerlo | #11283 | `clitic-form` | distruggere |
| colpirlo | #11287 | `clitic-form` | colpire |
| diamogli | #11306 | `clitic-form` | dare |
| portiamolo | #11317 | `clitic-form` | portare |
| prestarmi | #11325 | `clitic-form` | prestare |
| avercela | #11328 | `clitic-form` | avere |
| vestirmi | #11330 | `clitic-form` | vestire |
| veder | #11331 | `truncated-form` | vedere |
| lasciarvi | #11333 | `clitic-form` | lasciare |
| offrirvi | #11369 | `clitic-form` | offrire |
| p. (also a name) | #11375 | `noun-inflection` | pagina |
| volermi | #11391 | `clitic-form` | volere |
| collare | #11447 | `declared-lemma-only` |  |
| avvicinarmi | #11473 | `clitic-form` | avvicinare |
| general (also a name) | #11477 | `truncated-form` | generale |
| spaventarmi | #11513 | `clitic-form` | spaventare |
| sant' | #11590 | `elided-form` | santo |
| potersi | #11593 | `clitic-form` | potere |
| negarlo | #11619 | `clitic-form` | negare |
| farglielo | #11637 | `clitic-form` | fare |
| ditelo | #11662 | `clitic-form` | dire |
| trasferirti | #11718 | `clitic-form` | trasferire |
| scriverlo | #11726 | `clitic-form` | scrivere |
| potervi | #11735 | `clitic-form` | potere |
| pagarti | #11755 | `clitic-form` | pagare |
| potercela | #11772 | `clitic-form` | potere |
| stargli | #11802 | `clitic-form` | stare |
| offrirmi | #11804 | `clitic-form` | offrire |
| venderlo | #11819 | `clitic-form` | vendere |
| perdermi | #11836 | `clitic-form` | perdere |
| vestirti | #11845 | `clitic-form` | vestire |
| buttarmi | #11846 | `clitic-form` | buttare |
| fermatelo | #11850 | `clitic-form` | fermare |
| sentir | #11859 | `truncated-form` | sentire |
| dividerci | #11870 | `clitic-form` | dividere |
| spararti | #11886 | `clitic-form` | sparare |
| chiamarli | #11889 | `clitic-form` | chiamare |
| liberarci | #11893 | `clitic-form` | liberare |
| guardali | #11902 | `clitic-form` | guardare |
| fregarmi | #11921 | `clitic-form` | fregare |
| dovermi | #11927 | `clitic-form` | dovere |
| fartela | #11982 | `clitic-form` | fare |
| venirci | #12002 | `clitic-form` | venire |
| fateli | #12022 | `clitic-form` | fare |
| trattenermi | #12025 | `clitic-form` | trattenere |
| portateli | #12035 | `clitic-form` | portare |
| bicchierino | #12037 | `declared-lemma-only` |  |
| prepararci | #12087 | `clitic-form` | preparare |
| provalo | #12093 | `clitic-form` | provare |
| datevi | #12148 | `clitic-form` | dare |
| occuparsene | #12173 | `clitic-form` | occupare |
| licenziarmi | #12177 | `clitic-form` | licenziare |
| lasciarle | #12190 | `clitic-form` | lasciare |
| riprenderti | #12250 | `clitic-form` | riprendere |
| raccontarti | #12272 | `clitic-form` | raccontare |
| buttalo | #12305 | `clitic-form` | buttare |
| liberta' | #12309 | `elided-form` | libertà |
| toglierlo | #12315 | `clitic-form` | togliere |
| lavarti | #12387 | `clitic-form` | lavare |
| trovarle | #12402 | `clitic-form` | trovare |
| rovinarmi | #12415 | `clitic-form` | rovinare |
| sistemarlo | #12418 | `clitic-form` | sistemare |
| lavarmi | #12471 | `clitic-form` | lavare |
| poterle | #12516 | `clitic-form` | potere |
| abbracciami | #12554 | `clitic-form` | abbracciare |
| tirami | #12569 | `clitic-form` | tirare |
| dicendomi | #12592 | `clitic-form` | dire |
| comprarlo | #12608 | `clitic-form` | comprare |
| ripensarci | #12617 | `clitic-form` | ripensare |
| piaciuti | #12620 | `verb-form` | piacere |
| allontanarti | #12699 | `clitic-form` | allontanare |
| raggiungerlo | #12753 | `clitic-form` | raggiungere |
| finiamola | #12768 | `clitic-form` | finire |
| superarlo | #12815 | `clitic-form` | superare |
| permetterlo | #12818 | `clitic-form` | permettere |
| aiutateci | #12826 | `clitic-form` | aiutare |
| volerti | #12872 | `clitic-form` | volere |
| allontanarmi | #12918 | `clitic-form` | allontanare |
| buttarti | #12949 | `clitic-form` | buttare |
| grand' | #12951 | `elided-form` | grande |
| felicissima | #12960 | `adjective-inflection` | felice |
| fategli | #13017 | `clitic-form` | fare |
| impedirlo | #13056 | `clitic-form` | impedire |
| procurarmi | #13067 | `clitic-form` | procurare |
| fargliela | #13099 | `clitic-form` | fare |
| uccidervi | #13100 | `clitic-form` | uccidere |
| controllarla | #13107 | `clitic-form` | controllare |
| salvarli | #13111 | `clitic-form` | salvare |
| convincerli | #13130 | `clitic-form` | convincere |
| godermi | #13131 | `clitic-form` | godere |
| tenerle | #13174 | `clitic-form` | tenere |
| starsene | #13233 | `clitic-form` | stare |
| cuor | #13237 | `truncated-form` | cuore |
| seguirla | #13256 | `clitic-form` | seguire |
| buttarlo | #13259 | `clitic-form` | buttare |
| amarlo | #13287 | `clitic-form` | amare |
| contattarlo | #13378 | `clitic-form` | contattare |
| farmela | #13407 | `clitic-form` | fare |
| tagliarmi | #13411 | `clitic-form` | tagliare |
| aspettarci | #13416 | `clitic-form` | aspettare |
| pagarlo | #13446 | `clitic-form` | pagare |
| arrestarmi | #13455 | `clitic-form` | arrestare |
| trovalo | #13467 | `clitic-form` | trovare |
| vergognarti | #13468 | `clitic-form` | vergognarsi |
| rivolgermi | #13471 | `clitic-form` | rivolgere |
| interrogarlo | #13550 | `clitic-form` | interrogare |
| farmene | #13607 | `clitic-form` | fare |
| felicissimo | #13623 | `adjective-inflection` | felice |
| ricordarlo | #13626 | `clitic-form` | ricordare |
| amarla | #13652 | `clitic-form` | amare |
| capirmi | #13659 | `clitic-form` | capire |
| separarci | #13673 | `clitic-form` | separare |
| mandalo | #13692 | `clitic-form` | mandare |
| camioncino | #13702 | `declared-lemma-only` |  |
| venirti | #13704 | `clitic-form` | venire |
| catturarlo | #13711 | `clitic-form` | catturare |
| battermi | #13717 | `clitic-form` | battere |
| crederlo | #13725 | `clitic-form` | credere |
| unirvi | #13733 | `clitic-form` | unire |
| passarci | #13773 | `clitic-form` | passare |
| bear | #13783 | `truncated-form` | beare |
| comprarne | #13844 | `clitic-form` | comprare |
| metter | #13875 | `truncated-form` | mettere |
| rimettermi | #13921 | `clitic-form` | rimettere |
| sentirvi | #13932 | `clitic-form` | sentire |
| risolverlo | #13952 | `clitic-form` | risolvere |
| odiarmi | #13965 | `clitic-form` | odiare |
| rompermi | #13974 | `clitic-form` | rompere |
| rimetterti | #13978 | `clitic-form` | rimettere |
| picchiarmi | #13981 | `clitic-form` | picchiare |
| contattarla | #13999 | `clitic-form` | contattare |
| buttala | #14003 | `clitic-form` | buttare |
| quarant' | #14004 | `elided-form` | quaranta |
| salvami | #14020 | `clitic-form` | salvare |
| chiedimi | #14053 | `clitic-form` | chiedere |
| aspettarlo | #14077 | `clitic-form` | aspettare |
| capirci | #14114 | `clitic-form` | capire |
| vedersi | #14115 | `clitic-form` | vedere |
| ripensandoci | #14124 | `clitic-form` | ripensare |
| identificarlo | #14151 | `clitic-form` | identificare |
| allenarmi | #14195 | `clitic-form` | allenare |
| batter | #14198 | `truncated-form` | battere |
| giudicarmi | #14209 | `clitic-form` | giudicare |
| scusateci | #14223 | `clitic-form` | scusare |
| chiuderla | #14229 | `clitic-form` | chiudere |
| gestirlo | #14276 | `clitic-form` | gestire |
| guardarci | #14285 | `clitic-form` | guardare |
| ciel | #14311 | `truncated-form` | cielo |
| andiamoci | #14333 | `clitic-form` | andare |
| accompagnarla | #14353 | `clitic-form` | accompagnare |
| guardarli | #14355 | `clitic-form` | guardare |
| parlaci | #14368 | `clitic-form` | parlare |
| cercarli | #14373 | `clitic-form` | cercare |
| spiegarle | #14382 | `clitic-form` | spiegare |
| piantatela | #14383 | `clitic-form` | piantare |
| rivederlo | #14402 | `clitic-form` | rivedere |
| distruggerla | #14449 | `clitic-form` | distruggere |
| toccarti | #14503 | `clitic-form` | toccare |
| riprovarci | #14558 | `clitic-form` | riprovare |
| leggerla | #14570 | `clitic-form` | leggere |
| seguirti | #14589 | `clitic-form` | seguire |
| mostrargli | #14637 | `clitic-form` | mostrare |
| pensarla | #14645 | `clitic-form` | pensare |
| finirlo | #14651 | `clitic-form` | finire |
| unitevi | #14694 | `clitic-form` | unire |
| pagarla | #14702 | `clitic-form` | pagare |
| mettiamolo | #14761 | `clitic-form` | mettere |
| rilassatevi | #14874 | `clitic-form` | rilassare |
| reggiti | #14918 | `clitic-form` | reggere |
| incontrarvi | #14940 | `clitic-form` | incontrare |
| cosette | #14960 | `noun-inflection` | cosetta |
| preoccuparvi | #14965 | `clitic-form` | preoccupare |
| tiratelo | #14998 | `clitic-form` | tirare |
| confermarlo | #15011 | `clitic-form` | confermare |
| tornatene | #15023 | `clitic-form` | tornare |
| invitarti | #15065 | `clitic-form` | invitare |
| usarle | #15083 | `clitic-form` | usare |
| rovinarti | #15087 | `clitic-form` | rovinare |
| cavartela | #15108 | `clitic-form` | cavare |
| liberami | #15130 | `clitic-form` | liberare |
| gestirla | #15136 | `clitic-form` | gestire |
| mandarci | #15156 | `clitic-form` | mandare |
| fermiamoci | #15166 | `clitic-form` | fermare |
| spingermi | #15189 | `clitic-form` | spingere |
| ultra | #15234 | `accent-variant` | ultrà |
| poterli | #15298 | `clitic-form` | potere |
| riconoscerlo | #15328 | `clitic-form` | riconoscere |
| lasciargli | #15367 | `clitic-form` | lasciare |
| salutarla | #15380 | `clitic-form` | salutare |
| giocarci | #15382 | `clitic-form` | giocare |
| comprarla | #15397 | `clitic-form` | comprare |
| interessarti | #15408 | `clitic-form` | interessare |
| divertentissimo | #15417 | `adjective-inflection` | divertente |
| trattenerlo | #15432 | `clitic-form` | trattenere |
| tenervi | #15438 | `clitic-form` | tenere |
| abituarmi | #15455 | `clitic-form` | abituare |
| riprenderci | #15459 | `clitic-form` | riprendere |
| venirne | #15468 | `clitic-form` | venire |
| deciderlo | #15513 | `clitic-form` | decidere |
| sentirne | #15547 | `clitic-form` | sentire |
| lettino | #15567 | `declared-lemma-only` |  |
| provarla | #15610 | `clitic-form` | provare |
| presentarle | #15619 | `clitic-form` | presentare |
| raccontarlo | #15644 | `clitic-form` | raccontare |
| lasciamolo | #15650 | `clitic-form` | lasciare |
| lasciateli | #15656 | `clitic-form` | lasciare |
| informarla | #15664 | `clitic-form` | informare |
| chiamarci | #15690 | `clitic-form` | chiamare |
| piacergli | #15697 | `clitic-form` | piacere |
| lamentarmi | #15702 | `clitic-form` | lamentare |
| starle | #15736 | `clitic-form` | stare |
| batterti | #15747 | `clitic-form` | battere |
| finitela | #15770 | `clitic-form` | finire |
| raccontaci | #15777 | `clitic-form` | raccontare |
| dò | #15781 | `verb-form` | dare |
| avvicinarci | #15782 | `clitic-form` | avvicinare |
| paco | #15799 | `accent-variant` | pacò |
| innamorarmi | #15825 | `clitic-form` | innamorare |
| caffé | #15830 | `accent-variant` | caffè |
| buttarla | #15835 | `clitic-form` | buttare |
| batterlo | #15838 | `clitic-form` | battere |
| trasferirci | #15850 | `clitic-form` | trasferire |
| mettergli | #15862 | `clitic-form` | mettere |
| fischia | #15880 | `verb-form` | fischiare |
| servirmi | #15903 | `clitic-form` | servire |
| procurarti | #15920 | `clitic-form` | procurare |
| ditemelo | #15929 | `clitic-form` | dire |
| spostarlo | #15977 | `clitic-form` | spostare |
| berlo | #16012 | `clitic-form` | bere |
| allenarti | #16015 | `clitic-form` | allenare |
| proteggerli | #16031 | `clitic-form` | proteggere |
| proteggervi | #16039 | `clitic-form` | proteggere |
| bocconcino | #16048 | `declared-lemma-only` |  |
| contattarti | #16057 | `clitic-form` | contattare |
| aiutalo | #16067 | `clitic-form` | aiutare |
| incastrarmi | #16113 | `clitic-form` | incastrare |
| basandomi | #16115 | `clitic-form` | basare |
| essercene | #16132 | `clitic-form` | essere |
| buonissima | #16134 | `adjective-inflection` | buono |
| portargli | #16167 | `clitic-form` | portare |
| sentirli | #16189 | `clitic-form` | sentire |
| facendomi | #16290 | `clitic-form` | fare |
| raggiungerla | #16295 | `clitic-form` | raggiungere |
| insegnargli | #16306 | `clitic-form` | insegnare |
| riconsiderare | #16308 | `declared-lemma-only` |  |
| salutarlo | #16314 | `clitic-form` | salutare |
| congratularmi | #16343 | `clitic-form` | congratularsi |
| crucchi | #16370 | `noun-inflection` | crucco |
| vergognare | #16374 | `declared-lemma-only` |  |
| comportarci | #16389 | `clitic-form` | comportare |
| richiamarmi | #16394 | `clitic-form` | richiamare |
| darglielo | #16401 | `clitic-form` | dare |
| impegnarti | #16423 | `clitic-form` | impegnare |
| artificieri | #16441 | `noun-inflection` | artificiere |
| ricordarvi | #16457 | `clitic-form` | ricordare |
| dimenticarmi | #16465 | `clitic-form` | dimenticare |
| raccontarci | #16466 | `clitic-form` | raccontare |
| facendolo | #16468 | `clitic-form` | fare |
| viverci | #16477 | `clitic-form` | vivere |
| guadagnarci | #16544 | `clitic-form` | guadagnare |
| valige | #16594 | `noun-inflection` | valigia |
| permettergli | #16672 | `clitic-form` | permettere |
| impedirmi | #16684 | `clitic-form` | impedire |
| sposami | #16731 | `clitic-form` | sposare |
| spiegartelo | #16750 | `clitic-form` | spiegare |
| facciamogli | #16754 | `clitic-form` | fare |
| riportarmi | #16775 | `clitic-form` | riportare |
| divertirvi | #16788 | `clitic-form` | divertire |
| tirarci | #16796 | `clitic-form` | tirare |
| patatina | #16797 | `declared-lemma-only` |  |
| chiedendomi | #16818 | `clitic-form` | chiedere |
| accusarmi | #16832 | `clitic-form` | accusare |
| scusaci | #16840 | `clitic-form` | scusare |
| vendicarmi | #16859 | `clitic-form` | vendicare |
| spaventarla | #16873 | `clitic-form` | spaventare |
| yankees | #16881 | `noun-inflection` | yankee |
| piacerle | #16883 | `clitic-form` | piacere |
| ripetermi | #16941 | `clitic-form` | ripetere |
| sposarvi | #16963 | `clitic-form` | sposare |
| comprarle | #16964 | `clitic-form` | comprare |
| sembrarti | #16974 | `clitic-form` | sembrare |
| prepariamoci | #16999 | `clitic-form` | preparare |
| mangiarla | #17025 | `clitic-form` | mangiare |
| essergli | #17029 | `clitic-form` | essere |
| vederne | #17033 | `clitic-form` | vedere |
| mostrarci | #17077 | `clitic-form` | mostrare |
| contattarmi | #17097 | `clitic-form` | contattare |
| n. (also a name) | #17104 | `noun-inflection` | numero |
| patteggiare | #17105 | `declared-lemma-only` |  |
| sottotenente | #17121 | `declared-lemma-only` |  |
| scopriamolo | #17147 | `clitic-form` | scoprire |
| indossarlo | #17179 | `clitic-form` | indossare |
| concedermi | #17194 | `clitic-form` | concedere |
| sistemarmi | #17199 | `clitic-form` | sistemare |
| mandarli | #17218 | `clitic-form` | mandare |
| fuggitivi | #17227 | `noun-inflection` | fuggitivo |
| ignorarlo | #17240 | `clitic-form` | ignorare |
| chiederci | #17245 | `clitic-form` | chiedere |
| volerla | #17264 | `clitic-form` | volere |
| seguirci | #17273 | `clitic-form` | seguire |
| impedirgli | #17279 | `clitic-form` | impedire |
| leggilo | #17318 | `clitic-form` | leggere |
| procurarci | #17349 | `clitic-form` | procurare |
| cercarci | #17372 | `clitic-form` | cercare |
| consegnarlo | #17387 | `clitic-form` | consegnare |
| sbagliarmi | #17394 | `clitic-form` | sbagliare |
| invitarla | #17395 | `clitic-form` | invitare |
| tipe | #17397 | `noun-inflection` | tipa |
| riaverla | #17457 | `clitic-form` | riavere |
| buttar | #17459 | `truncated-form` | buttare |
| abbandonarmi | #17566 | `clitic-form` | abbandonare |
| rintracciarla | #17659 | `clitic-form` | rintracciare |
| fatele | #17660 | `clitic-form` | fare |
| diventarlo | #17688 | `clitic-form` | diventare |
| invitarmi | #17705 | `clitic-form` | invitare |
| mandarle | #17708 | `clitic-form` | mandare |
| svegliarlo | #17728 | `clitic-form` | svegliare |
| toglierla | #17731 | `clitic-form` | togliere |
| colpirti | #17738 | `clitic-form` | colpire |
| ricordarle | #17765 | `clitic-form` | ricordare |
| cinquant' | #17767 | `elided-form` | cinquanta |
| guadagnarmi | #17771 | `clitic-form` | guadagnare |
| ingelosire | #17783 | `declared-lemma-only` |  |
| sicurissimo | #17798 | `adjective-inflection` | sicuro |
| facilissimo | #17834 | `adjective-inflection` | facile |
| toglietemi | #17847 | `clitic-form` | togliere |
| curarlo | #17853 | `clitic-form` | curare |
| piaciute | #17876 | `verb-form` | piacere |
| salvarle | #17877 | `clitic-form` | salvare |
| risolverla | #17885 | `clitic-form` | risolvere |
| affrontarla | #17928 | `clitic-form` | affrontare |
| arrestarla | #17944 | `clitic-form` | arrestare |
| descriverlo | #18001 | `clitic-form` | descrivere |
| arrestarti | #18036 | `clitic-form` | arrestare |
| riaverlo | #18042 | `clitic-form` | riavere |
| goderti | #18046 | `clitic-form` | godere |
| ottenerlo | #18089 | `clitic-form` | ottenere |
| ignoralo | #18108 | `clitic-form` | ignorare |
| dimentichiamoci | #18150 | `clitic-form` | dimenticare |
| sistemarla | #18153 | `clitic-form` | sistemare |
| informarvi | #18202 | `clitic-form` | informare |
| usalo | #18237 | `clitic-form` | usare |
| sbarazzarci | #18242 | `clitic-form` | sbarazzare |
| cent' | #18246 | `elided-form` | cento |
| denunciarlo | #18259 | `clitic-form` | denunciare |
| aggiustarlo | #18365 | `clitic-form` | aggiustare |
| baciarla | #18376 | `clitic-form` | baciare |
| parlane | #18377 | `clitic-form` | parlare |
| liberarlo | #18384 | `clitic-form` | liberare |
| poterne | #18411 | `clitic-form` | potere |
| darli | #18415 | `clitic-form` | dare |
| unirci | #18450 | `clitic-form` | unire |
| mangiarli | #18458 | `clitic-form` | mangiare |
| toglierle | #18463 | `clitic-form` | togliere |
| scopami | #18477 | `clitic-form` | scopare |
| rimettilo | #18496 | `clitic-form` | rimettere |
| crederle | #18514 | `clitic-form` | credere |
| accettarla | #18570 | `clitic-form` | accettare |
| muovervi | #18574 | `clitic-form` | muovere |
| passarla | #18575 | `clitic-form` | passare |
| ripararlo | #18587 | `clitic-form` | riparare |
| games | #18596 | `noun-inflection` | game |
| riprenderlo | #18604 | `clitic-form` | riprendere |
| fermarvi | #18605 | `clitic-form` | fermare |
| condividerlo | #18607 | `clitic-form` | condividere |
| capirti | #18639 | `clitic-form` | capire |
| abbracciarti | #18646 | `clitic-form` | abbracciare |
| seppellirlo | #18658 | `clitic-form` | seppellire |
| fidarvi | #18688 | `clitic-form` | fidare |
| pover' | #18707 | `elided-form` | povero |
| dovervi | #18730 | `clitic-form` | dovere |
| ammazzarti | #18742 | `clitic-form` | ammazzare |
| annette | #18773 | `verb-form` | annettere |
| mandala | #18799 | `clitic-form` | mandare |
| rimetterlo | #18801 | `clitic-form` | rimettere |
| trattenerla | #18821 | `clitic-form` | trattenere |
| uccidetemi | #18848 | `clitic-form` | uccidere |
| renderci | #18886 | `clitic-form` | rendere |
| pentire | #18915 | `declared-lemma-only` |  |
| datele | #18951 | `clitic-form` | dare |
| punirmi | #18974 | `clitic-form` | punire |
| scrivimi | #18975 | `clitic-form` | scrivere |
| goderci | #18985 | `clitic-form` | godere |
| assicurarvi | #19026 | `clitic-form` | assicurare |
| spaventarlo | #19040 | `clitic-form` | spaventare |
| vendermi | #19090 | `clitic-form` | vendere |
| bravissimi | #19093 | `adjective-inflection` | bravo |
| dài | #19114 | `verb-form` | dare |
| proviamoci | #19120 | `clitic-form` | provare |
| coprirti | #19130 | `clitic-form` | coprire |
| toglierci | #19138 | `clitic-form` | togliere |
| riposarmi | #19141 | `clitic-form` | riposare |
| vantarmi | #19143 | `clitic-form` | vantare |
| aprirmi | #19165 | `clitic-form` | aprire |
| fior | #19180 | `truncated-form` | fiore |
| basandosi | #19214 | `clitic-form` | basare |
| salutarmi | #19228 | `clitic-form` | salutare |
| cambiarla | #19231 | `clitic-form` | cambiare |
| spostarti | #19328 | `clitic-form` | spostare |
| beale | #19344 | `clitic-form` | beare |
| scambiarci | #19346 | `clitic-form` | scambiare |
| studios | #19350 | `noun-inflection` | studio |
| rivederci | #19353 | `clitic-form` | rivedere |
| scrivermi | #19418 | `clitic-form` | scrivere |
| restarci | #19419 | `clitic-form` | restare |
| conoscerli | #19437 | `clitic-form` | conoscere |
| mangiarmi | #19450 | `clitic-form` | mangiare |
| venderli | #19473 | `clitic-form` | vendere |
| impegnarmi | #19476 | `clitic-form` | impegnare |
| bean | #19484 | `verb-form` | beare |
| azzardarti | #19498 | `clitic-form` | azzardare |
| controllarli | #19510 | `clitic-form` | controllare |
| comprarsi | #19537 | `clitic-form` | comprare |
| servirvi | #19561 | `clitic-form` | servire |
| avvertirmi | #19566 | `clitic-form` | avvertire |
| insultarmi | #19578 | `clitic-form` | insultare |
| contarci | #19580 | `clitic-form` | contare |
| spiegarci | #19612 | `clitic-form` | spiegare |
| disturbarvi | #19657 | `clitic-form` | disturbare |
| spostarla | #19661 | `clitic-form` | spostare |
| voltarti | #19673 | `clitic-form` | voltare |
| incastrarlo | #19689 | `clitic-form` | incastrare |
| mostrarlo | #19707 | `clitic-form` | mostrare |
| tenetela | #19720 | `clitic-form` | tenere |
| rilassarci | #19723 | `clitic-form` | rilassare |
| toccami | #19760 | `clitic-form` | toccare |
| ritirarmi | #19780 | `clitic-form` | ritirare |
| follie | #19786 | `noun-inflection` | follia |
| riportalo | #19790 | `clitic-form` | riportare |
| urlarmi | #19816 | `clitic-form` | urlare |
| importantissimo | #19817 | `adjective-inflection` | importante |
| starcene | #19824 | `clitic-form` | stare |
| doverla | #19832 | `clitic-form` | dovere |
| trarne | #19835 | `clitic-form` | trarre |
| raccontarvi | #19838 | `clitic-form` | raccontare |
| mettetela | #19867 | `clitic-form` | mettere |
| credergli | #19882 | `clitic-form` | credere |
| ringraziarlo | #19890 | `clitic-form` | ringraziare |
| svegliarla | #19896 | `clitic-form` | svegliare |
| considerarlo | #19913 | `clitic-form` | considerare |
| combatterlo | #19936 | `clitic-form` | combattere |
| spiegargli | #19966 | `clitic-form` | spiegare |
| affrontarli | #19983 | `clitic-form` | affrontare |
| si trasferiscono | named | `pronominal-verb-pair` | trasferirsi |

### In Wikidata's words (60)

| Word | Rank | Lexeme | Lemma | Italian sense |
|---|---:|---|---|---|
| c' | #44 | L1165467 | ci | no |
| nessun | #385 | L1211891, L1211892 | nessuno | no |
| ben (also a name) | #536 | L21252 | bene | yes |
| qual | #540 | L21231, L1232700 | quale | no |
| sull' | #667 | L642883, L642884 | sullo, sulla | no |
| n' | #762 | L21266 | ne | no |
| qualcun | #1021 | L1232695 | qualcuno | no |
| stanotte | #1158 | L1244377 | stanotte | no |
| alcun | #1209 | L1199371, L1255651 | alcuno | no |
| miglior | #1265 | L1217823 | migliore | no |
| de (also a name) | #1267 | L1236812 | de | yes |
| stavolta | #1646 | L1235510 | stavolta | no |
| city (also a name) | #2274 | L1244270 | city | no |
| sottofondo | #3386 | L691479 | sottofondo | no |
| sin (also a name) | #3756 | L1165630 | sino | yes |
| eccome | #4265 | L1259789 | eccome | no |
| peggior | #4450 | L1179500 | peggiore | no |
| post (also a name) | #5261 | L1244241 | post | yes |
| quaggiù | #6661 | L1260322 | quaggiù | no |
| paparino | #6681 | L1144362 | papà | yes |
| superman | #7349 | L1261911 | superman | no |
| quassù | #7389 | L1260324 | quassù | no |
| piccolino | #7452 | L60350 | piccolo | no |
| granché | #8097 | L1343381 | granché | no |
| pentirai | #8239 | L1422655 | pentirsi | yes |
| flebo | #9380 | L1261627 | flebo | yes |
| buffet | #10052 | L1413985 | buffet | yes |
| prof | #10646 | L1180137 | professore | yes |
| pento | #10839 | L1422655 | pentirsi | yes |
| riformatorio | #11023 | L685123 | riformatorio | yes |
| sottufficiale | #11910 | L1158502 | sottufficiale | no |
| trucchetto | #11943 | L580449 | trucco | yes |
| dopodiché | #12150 | L1235511 | dopodiché | no |
| spinale | #13681 | L1158511 | spinale | no |
| memorial | #13686 | L1197243 | memorial | no |
| open (also a name) | #13715 | L1244271, L1244272 | open | yes |
| hit | #14002 | L1209906 | hit | yes |
| studentesco | #14049 | L1258141 | studentesco | no |
| cordone | #14185 | L1341913 | cordone | no |
| datore | #14233 | L1508824 | datore | yes |
| bigliettino | #14250 | L690908 | bigliettino | no |
| camicetta | #14556 | L679545 | camicetta | no |
| magazine | #14770 | L1229381 | magazine | yes |
| orsetto | #14917 | L1214279 | orsetto | no |
| barretta | #14943 | L685950 | barretta | no |
| oretta | #15870 | L640281 | ora | yes |
| prematrimoniale | #16106 | L1158336 | prematrimoniale | no |
| quantomeno | #16324 | L1246197 | quantomeno | no |
| caposquadra | #16608 | L1712822 | caposquadra | no |
| minorile | #16678 | L1258035 | minorile | no |
| barrette | #17016 | L685950 | barretta | no |
| servigi | #17463 | L486974 | servigio | yes |
| paranormale | #17693 | L1158259 | paranormale | no |
| piacimento | #18226 | L1246140 | piacimento | no |
| targhetta | #18540 | L709002 | targhetta | yes |
| freccette | #19061 | L1248742 | freccetta | yes |
| avvistamento | #19818 | L702739 | avvistamento | no |
| domattina | #2167 | L1259786 | domattina | no |
| oddio | #675 | L1244361 | oddio | no |
| paralimpico | named | L1247138 | paralimpico | no |

### In neither (137)

| Word | Rank | Morph-it! tags |
|---|---:|---|
| all' | #150 | `ARTPRE-F:s` `ARTPRE-M:s` |
| anch' | #478 | `ADV` |
| dimmi | #552 | `VER:impr+pres+2+s+mi` |
| glielo | #894 | `PRO-PERS-CLI-COM` |
| ve | #905 | `PRO-PERS-CLI-2-F-P` `PRO-PERS-CLI-2-M-P` |
| uh | #1059 | `INT` |
| gliel' | #1320 | `PRO-PERS-CLI-COM` |
| pochino | #2998 | `NOUN-M:s` |
| man (also a name) | #3083 | `NPR` `NOUN-M:p` `NOUN-M:s` |
| on | #3084 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| gliene | #3271 | `PRO-PERS-CLI-COM` |
| house (also a name) | #3371 | `NPR` `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| email | #3693 | `NOUN-F:p` `NOUN-F:s` |
| vent' | #4002 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| gliela | #4029 | `PRO-PERS-CLI-COM` |
| st. (also a name) | #4045 | `NPR` `ABL` |
| evviva | #4163 | `INT` `NOUN-M:p` `NOUN-M:s` |
| yeah | #4600 | `INT` |
| kit | #4803 | `NOUN-M:p` `NOUN-M:s` |
| armadietto | #4830 | `NOUN-M:s` |
| bang | #4873 | `NOUN-M:p` `NOUN-M:s` |
| boy | #4973 | `NOUN-M:p` `NOUN-M:s` |
| blue (also a name) | #5018 | `NPR` `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| ooh | #5221 | `INT` |
| sorellina | #5306 | `NOUN-F:s` |
| von (also a name) | #5748 | `NPR` `NOUN-M:p` `NOUN-M:s` |
| mail | #5749 | `NOUN-F:p` `NOUN-F:s` |
| valigetta | #5795 | `NOUN-F:s` |
| night | #5815 | `NOUN-M:p` `NOUN-M:s` |
| bell (also a name) | #5868 | `NPR` `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| rivoglio | #5979 | `VER:ind+pres+1+s` |
| nessun' | #6151 | `DET-INDEF:f+s` |
| qualcun' | #6428 | `ADJ:pos+f+s` |
| hard | #6720 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| dj | #6871 | `NOUN-M:p` `NOUN-M:s` |
| dossier | #7191 | `NOUN-M:p` `NOUN-M:s` |
| end | #7310 | `NOUN-M:p` `NOUN-M:s` |
| piccolina | #7382 | `NOUN-F:s` |
| news (also a name) | #7577 | `NPR` `NOUN-F:p` |
| glieli | #7685 | `PRO-PERS-CLI-COM` |
| lavoretto | #8270 | `NOUN-M:s` |
| dance | #8293 | `NOUN-F:s` |
| scartoffie | #8306 | `NOUN-F:p` |
| gliele | #9085 | `PRO-PERS-CLI-COM` |
| home | #9116 | `NOUN-F:p` `NOUN-F:s` |
| tantino | #9210 | `ADJ:pos+m+s` |
| bip | #9383 | `NOUN-M:p` `NOUN-M:s` |
| pc (also a name) | #9928 | `NPR` `NOUN-M:p` `NOUN-M:s` |
| modus | #9965 | `NOUN-M:p` `NOUN-M:s` |
| mah | #10004 | `INT` |
| amichetto | #10038 | `NOUN-M:s` |
| risiamo | #10140 | `VER:impr+pres+1+p` `VER:ind+pres+1+p` `VER:sub+pres+1+p` |
| royal (also a name) | #10251 | `NPR` `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| culetto | #10645 | `NOUN-M:s` |
| posticino | #10820 | `NOUN-M:s` |
| take | #10880 | `NOUN-M:p` `NOUN-M:s` |
| societa' | #10965 | `NOUN-F:p` `NOUN-F:s` |
| problemino | #11235 | `NOUN-M:s` |
| station | #11566 | `NOUN-F:p` `NOUN-F:s` |
| call | #11576 | `NOUN-M:p` `NOUN-M:s` |
| coop | #11890 | `NOUN-F:p` `NOUN-F:s` |
| fratellone | #11915 | `NOUN-M:s` |
| ohh | #12214 | `INT` |
| ugh | #12222 | `INT` |
| bambolina | #12330 | `NOUN-F:s` |
| altronde | #12599 | `ADV` |
| major (also a name) | #12802 | `NPR` `NOUN-F:p` `NOUN-F:s` |
| attivita' | #12870 | `NOUN-F:p` `NOUN-F:s` |
| reginetta | #13036 | `NOUN-F:s` |
| ping | #13062 | `NOUN-M:p` `NOUN-M:s` |
| nonnina | #13127 | `NOUN-F:s` |
| vecchietto | #13195 | `NOUN-M:s` |
| global | #13215 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| plaza | #13239 | `NOUN-F:s` |
| music (also a name) | #13249 | `NPR` `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| trip | #13306 | `NOUN-M:p` `NOUN-M:s` |
| d.c. | #13490 | `ABL` |
| real (also a name) | #13562 | `NPR` `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| amichetta | #13710 | `NOUN-F:s` |
| scimmietta | #13774 | `NOUN-F:s` |
| cognac | #13901 | `NOUN-M:p` `NOUN-M:s` |
| superstar | #13948 | `NOUN-F:p` `NOUN-F:s` |
| shuttle | #14179 | `NOUN-M:p` `NOUN-M:s` |
| comment | #14214 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| mega | #14482 | `NOUN-F:p` `NOUN-F:s` `NOUN-M:p` `NOUN-M:s` |
| moretti (also a name) | #14584 | `NPR` `NOUN-M:p` |
| page | #14747 | `NOUN-F:s` |
| trucchetti | #14803 | `NOUN-M:p` |
| fatina | #14814 | `NOUN-F:s` |
| vecchietta | #14885 | `NOUN-F:s` |
| 'fanculo | #14969 | `INT` |
| borsone | #15102 | `NOUN-M:s` |
| teen | #15113 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| liberty | #15167 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| viaggetto | #15212 | `NOUN-M:s` |
| oh-oh | #15363 | `INT` |
| family | #15396 | `NOUN-M:p` `NOUN-M:s` |
| rivuole | #15575 | `VER:ind+pres+3+s` |
| lavoretti | #15772 | `NOUN-M:p` |
| giornataccia | #15803 | `NOUN-F:s` |
| discorsetto | #15883 | `NOUN-M:s` |
| scatoloni | #16366 | `NOUN-M:p` |
| pr (also a name) | #16416 | `NPR` `NOUN-F:p` `NOUN-F:s` |
| mmh | #16463 | `INT` |
| rue | #16665 | `NOUN-F:p` `NOUN-F:s` |
| amichetti | #16716 | `NOUN-M:p` |
| cosina | #16925 | `NOUN-F:s` |
| portabagagli | #16935 | `NOUN-M:p` `NOUN-M:s` |
| rilevatore | #17101 | `NOUN-M:s` |
| cruise (also a name) | #17122 | `NPR` `NOUN-M:p` `NOUN-M:s` |
| mogliettina | #17303 | `NOUN-F:s` |
| cenetta | #17337 | `NOUN-F:s` |
| festicciola | #17451 | `NOUN-F:s` |
| biondina | #17455 | `NOUN-F:s` |
| gilet | #17825 | `NOUN-M:p` `NOUN-M:s` |
| ah-ah | #18157 | `INT` |
| breakfast | #18232 | `NOUN-M:p` `NOUN-M:s` |
| rivuoi | #18305 | `VER:impr+pres+2+s` `VER:ind+pres+2+s` |
| soap | #18327 | `NOUN-F:p` `NOUN-F:s` |
| armadietti | #18355 | `NOUN-M:p` |
| testolina | #18364 | `NOUN-F:s` |
| cesareo | #18808 | `ADJ:pos+m+s` `NOUN-M:s` |
| rambo (also a name) | #18829 | `NPR` `NOUN-M:p` `NOUN-M:s` |
| toto | #18896 | `NOUN-M:s` |
| dolcissima | #18902 | `NOUN-F:s` |
| sporcaccione | #18983 | `ADJ:pos+f+s` `ADJ:pos+m+s` `NOUN-M:s` |
| book | #18996 | `NOUN-M:p` `NOUN-M:s` |
| culone | #19070 | `NOUN-F:p` `NOUN-M:s` |
| fair | #19082 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| midwest | #19135 | `NOUN-M:p` `NOUN-M:s` |
| mezzora | #19201 | `NOUN-F:s` |
| suk | #19254 | `NOUN-M:p` `NOUN-M:s` |
| backstage | #19595 | `NOUN-M:p` `NOUN-M:s` |
| market | #19765 | `NOUN-M:p` `NOUN-M:s` |
| farmer | #19894 | `NOUN-M:p` `NOUN-M:s` |
| ehi | #89 | unknown |
| handbike | named | unknown |
