# Common Italian words the lookup misses, recounted — 2026-10-20

Issue [#899](https://github.com/povlabs/lexema/issues/899). The same count as
[2026-10-11](2026-10-11-missing-common-words.md), run again after the epic
[#802](https://github.com/povlabs/lexema/issues/802) fixes and their follow-ups
merged. The method, the check lists and the groups are unchanged; they are
described in the 2026-10-11 report. The script is
[src/lookup/measureMissingWords.ts](../src/lookup/measureMissingWords.ts), and the
groups and bug classes are [src/lookup/missingWord.ts](../src/lookup/missingWord.ts).

## What was measured

- **Release:** `it-0c432803`.
- **Code:** `main` at `abf5359dbc9422e57a0da9948e8fad8ef8bd907f`. The seed was
  built from that commit, and the measure ran on it. `main` did not move between
  the seed and the measure.
- **Layers in the seed**, read from the seed's own tables
  ([RUN_AN_IMPORT.md](../docs/RUN_AN_IMPORT.md)):

  | Layer | Rows |
  |---|---:|
  | Release records (`source_record`) | 560,357 |
  | Curated corrections (`corrected_claim`) | 288 |
  | Definition corrections (`corrected_definition`) | 2 |
  | Hand-kept readings (`hand_kept_definition`) | 13 |
  | Recovered entries (`recovered_entry`) | 203 |
  | Page-only entries (`raw_page`) | 878 |
  | Name entries (`name_entry`) | 37,918 |
  | Wikidata words (`wikidata_word`) | 19 |
  | Update feeds (`feed_release`, `applied_change`) | 0 |

  The name loader wrote 37,918 entries and left out 2,386. The Wikidata words
  loader wrote 19 and left out 44 lexemes with no Italian gloss
  ([ADR 0033](../.decisions/0033-wikidata-words-fill-wiktionary-gaps.md)).

- **Commands.** The seed and the two loaders ran in an earlier lane on #899, on
  the same commit
  ([comment](https://github.com/povlabs/lexema/issues/899#issuecomment-6279162317)).
  Per [Huey's comment](https://github.com/povlabs/lexema/issues/899#issuecomment-6279329352),
  this run reused that seed so only the measure ran:

  ```sh
  SEED_INPUT=.data/source/it-extract.jsonl.gz SEED_SQL=.data/full-sql SEED_STATE=.data/full-state pnpm run seed:dev
  SEED_STATE=.data/full-state pnpm run load:names
  SEED_STATE=.data/full-state pnpm run load:wikidata-words
  SEED_STATE=.data/full-state MISSING_JSON=<scratch>/missing-words.json pnpm run measure:missing-words
  ```

  `SEED_STATE` for the measure named that lane's `.data/full-state` by its path.
  The check list `morph-it.tgz` was saved by hand, because its host now puts a
  person check in front of the download; its SHA-256 matches the pinned
  `b137343d…7c024`, so the script read it unchanged. Wikidata was read from
  `https://query.wikidata.org/sparql` on 2026-10-20.

- **Code changes:** none. The script ran on `main` as it is.

## Then and now

| | 2026-10-11 | 2026-10-20 |
|---|---:|---:|
| Our bug | 965 | 14 |
| In Wikidata's words | 60 | 29 |
| In neither | 137 | 126 |
| Missing in all | 1162 | 169 |
| Wikidata lexemes with no Italian gloss (words) | 40 | 29 |

The 2026-10-11 count of unglossed lexemes is the 40 rows marked `no` under
"Italian sense" in that report's "In Wikidata's words" table. The 44 the loader
left out counts lexemes, not words, so it is not the same number.

The 2026-10-11 report does not name the layers it loaded, and the Wikidata words
layer merged after it (#815, 2026-10-15). So the two columns measure different
serving layers as well as different code.

**How the 993 words left the list.** No word that was found on 2026-10-11 is
missing now.

- **Our bug, 965 → 14.** 952 words are found now. One word joined the group:
  `trucchetti` moved here from "in neither", because the Wikidata word
  `trucchetto` is now found, so Morph-it!'s lemma resolves.
- **In Wikidata's words, 60 → 29.** This group shrinks by design and is not a
  gain or a loss of its own. Since ADR 0033's 2026-10-12 amendment, the Wikidata
  words loader keeps only a lexeme with an Italian gloss (`hasItalianGloss` in
  [src/wikidataWords/wikidataWord.ts](../src/wikidataWords/wikidataWord.ts)), and
  a kept lexeme's word is found, so it leaves the group. All 20 glossed rows of
  2026-10-11 are found now. 11 unglossed rows are found too, through the our-bug
  fixes rather than through Wikidata: `c'`, `nessun`, `qual`, `sull'`, `n'`,
  `qualcun`, `alcun`, `miglior`, `peggior`, `spinale`, `memorial`. What remains
  is only unglossed lexemes, 29 words.
- **In neither, 137 → 126.** 10 words are found now: `all'`, `anch'`, `dimmi`,
  `man`, `nessun'`, `qualcun'`, `take`, `global`, `real`, `dolcissima`. One,
  `trucchetti`, moved to our bug.

## Our bug, by class

| Bug class | 2026-10-11 | 2026-10-20 |
|---|---:|---:|
| `declared-lemma-only` | 16 | 0 |
| `accent-variant` | 12 | 4 |
| `pronominal-verb-pair` | 1 | 0 |
| `elided-form` | 26 | 2 |
| `truncated-form` | 30 | 0 |
| `clitic-form` | 830 | 0 |
| `demonstrative-form` | 2 | 0 |
| `verb-form` | 17 | 3 |
| `noun-inflection` | 17 | 5 |
| `adjective-inflection` | 14 | 0 |
| `headword-not-served` | 0 | 0 |
| `listed-form-not-served` | 0 | 0 |

Six classes went to zero: `declared-lemma-only`, `pronominal-verb-pair`,
`truncated-form`, `clitic-form`, `demonstrative-form` and `adjective-inflection`.
`headword-not-served` and `listed-form-not-served` never fired, then or now.

Each class that remains is filed for triage:
[#900](https://github.com/povlabs/lexema/issues/900) (`accent-variant`),
[#901](https://github.com/povlabs/lexema/issues/901) (`elided-form`),
[#902](https://github.com/povlabs/lexema/issues/902) (`verb-form`) and
[#903](https://github.com/povlabs/lexema/issues/903) (`noun-inflection`).

## Epic #802's success line

The success line is: every word in the posted missing-word list is either found by
`/v1/lookup` and on lexema.fyi, or sits in the "neither" list waiting on Huey.

**It does not hold yet.** 43 listed words are neither found nor in the neither
list:

- the 14 our-bug words below, filed in #900–#903;
- the 29 Wikidata words with no Italian gloss. ADR 0033's amendment keeps them out
  of the Wikidata words layer, so no fix to the lookup will find them. They wait
  on Huey the same way the neither words do, and the two lists below are the ones
  he rules on under
  [ADR 0031](../.decisions/0031-hand-kept-readings-fill-source-gaps.md).

Of the 14 words the brief names, 5 are found: `quei`, `quegli`, `raccontarvi`,
`trasferirsi` and `si trasferiscono`. `stanotte`, `stavolta`, `domattina`,
`oddio` and `paralimpico` are unglossed Wikidata words, and `ehi`, `pochino`,
`amichetti` and `handbike` are in neither.

## Read with care

- **The seed is the release, not production.** The seed holds no update feed
  (`feed_release` and `applied_change` are empty), so a word a feed added since
  ([ADR 0025](../.decisions/0025-newer-source-definitions-are-authoritative.md))
  would still show here as missing. #819 records that the live site opened `Dr.`
  for `dr.` on 2026-10-17; this count finds no `dr.` (#903).
- **The Morph-it! noise and lemma gaps** the 2026-10-11 report names still apply.
  The `glie-` clusters (`glielo`, `gliela`, `gliene`, `glieli`, `gliele`,
  `gliel'`) stay in neither because Morph-it! lemmatizes them as themselves.
- **Subtitle spellings.** `citta'` and `liberta'` sit in our bug, and `societa'`
  and `attivita'` in neither, for the same spelling (#901).
- **Counts over the top 20,000 only**, with the 14 named words added on top, as
  before.

## The list

The script's output, as printed. Every row of "In Wikidata's words" has no
Italian gloss, so that table is the unglossed list: word, rank, lexeme id and
lemma. "In neither" is the neither list, with each word's rank and Morph-it!
tags.


Release `it-0c432803`. Of the 20000 most frequent subtitle words, Morph-it! knows 15683 as Italian words; 706 only as names or symbols and 3611 not at all, and those are not looked up. With the 14 words the brief names, 15689 words were looked up, single and batch; single and batch disagree on 0.

| Group | Words |
|---|---:|
| Our bug | 14 |
| In Wikidata's words | 29 |
| In neither | 126 |
| Missing in all | 169 |

The top 20000 alone: 167 missing.

### Our bug (14)

| Bug class | Words |
|---|---:|
| `accent-variant` | 4 |
| `elided-form` | 2 |
| `verb-form` | 3 |
| `noun-inflection` | 5 |

| Word | Rank | Bug class | Lemma |
|---|---:|---|---|
| perchè | #397 | `accent-variant` | perché |
| é | #778 | `verb-form` | essere |
| mr. | #2107 | `noun-inflection` | mister |
| pò | #2859 | `accent-variant` | po' |
| dr. | #3859 | `noun-inflection` | dottore |
| citta' (also a name) | #4554 | `elided-form` | città |
| sè | #10330 | `accent-variant` | sé |
| p. (also a name) | #11375 | `noun-inflection` | pagina |
| liberta' | #12309 | `elided-form` | libertà |
| trucchetti | #14803 | `noun-inflection` | trucchetto |
| dò | #15781 | `verb-form` | dare |
| caffé | #15830 | `accent-variant` | caffè |
| n. (also a name) | #17104 | `noun-inflection` | numero |
| dài | #19114 | `verb-form` | dare |

### In Wikidata's words (29)

| Word | Rank | Lexeme | Lemma | Italian sense |
|---|---:|---|---|---|
| stanotte | #1158 | L1244377 | stanotte | no |
| stavolta | #1646 | L1235510 | stavolta | no |
| city (also a name) | #2274 | L1244270 | city | no |
| sottofondo | #3386 | L691479 | sottofondo | no |
| eccome | #4265 | L1259789 | eccome | no |
| quaggiù | #6661 | L1260322 | quaggiù | no |
| superman | #7349 | L1261911 | superman | no |
| quassù | #7389 | L1260324 | quassù | no |
| piccolino | #7452 | L60350 | piccolo | no |
| granché | #8097 | L1343381 | granché | no |
| sottufficiale | #11910 | L1158502 | sottufficiale | no |
| dopodiché | #12150 | L1235511 | dopodiché | no |
| studentesco | #14049 | L1258141 | studentesco | no |
| cordone | #14185 | L1341913 | cordone | no |
| bigliettino | #14250 | L690908 | bigliettino | no |
| camicetta | #14556 | L679545 | camicetta | no |
| orsetto | #14917 | L1214279 | orsetto | no |
| barretta | #14943 | L685950 | barretta | no |
| prematrimoniale | #16106 | L1158336 | prematrimoniale | no |
| quantomeno | #16324 | L1246197 | quantomeno | no |
| caposquadra | #16608 | L1712822 | caposquadra | no |
| minorile | #16678 | L1258035 | minorile | no |
| barrette | #17016 | L685950 | barretta | no |
| paranormale | #17693 | L1158259 | paranormale | no |
| piacimento | #18226 | L1246140 | piacimento | no |
| avvistamento | #19818 | L702739 | avvistamento | no |
| domattina | #2167 | L1259786 | domattina | no |
| oddio | #675 | L1244361 | oddio | no |
| paralimpico | named | L1247138 | paralimpico | no |

### In neither (126)

| Word | Rank | Morph-it! tags |
|---|---:|---|
| glielo | #894 | `PRO-PERS-CLI-COM` |
| ve | #905 | `PRO-PERS-CLI-2-F-P` `PRO-PERS-CLI-2-M-P` |
| uh | #1059 | `INT` |
| gliel' | #1320 | `PRO-PERS-CLI-COM` |
| pochino | #2998 | `NOUN-M:s` |
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
| plaza | #13239 | `NOUN-F:s` |
| music (also a name) | #13249 | `NPR` `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| trip | #13306 | `NOUN-M:p` `NOUN-M:s` |
| d.c. | #13490 | `ABL` |
| amichetta | #13710 | `NOUN-F:s` |
| scimmietta | #13774 | `NOUN-F:s` |
| cognac | #13901 | `NOUN-M:p` `NOUN-M:s` |
| superstar | #13948 | `NOUN-F:p` `NOUN-F:s` |
| shuttle | #14179 | `NOUN-M:p` `NOUN-M:s` |
| comment | #14214 | `ADJ:pos+f+p` `ADJ:pos+f+s` `ADJ:pos+m+p` `ADJ:pos+m+s` |
| mega | #14482 | `NOUN-F:p` `NOUN-F:s` `NOUN-M:p` `NOUN-M:s` |
| moretti (also a name) | #14584 | `NPR` `NOUN-M:p` |
| page | #14747 | `NOUN-F:s` |
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
