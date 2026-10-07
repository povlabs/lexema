# Word page shapes, and the rule each one stands on

Read-only census for [#707](https://github.com/povlabs/lexema/issues/707),
2026-10-07. It builds every word page of the release, groups the pages by
shape, and maps each shape to the row of
[How a word page renders](../design-system-manifest.md#how-a-word-page-renders)
that rules it. It changes no rule, no rendered page and no dictionary row. The
leftover shapes are asked as questions 2 to 6
[on #708](https://github.com/povlabs/lexema/issues/708#issuecomment-6037356232).

The [machine-readable list](2026-10-07-word-page-shapes.json) has every shape:
its count, its examples, and its ruling with the rows it names.

## What was run

| | |
|---|---|
| Release | `it-0c432803`, archive SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf` |
| Dump | `itwiktionary-20260701` |
| Seed | the `seed` step of [tools/measureEmptyWordPages.ts](../tools/measureEmptyWordPages.ts) (#699): `seedSql` into a local SQLite file, as a full-release `pnpm run seed:dev` seeds it. No feed is applied. |
| Page code | `searchAttempt`, `wordPage()` and `phrasePage()` at `f1bd1833d7ad6a6886df39bae03a9f69ee4a693a`, the last commit to change `web/lib` or `src`, after #714. The `search` step refuses a tree whose page code differs from that commit, and writes it to the JSON. |
| Script | [tools/measureWordPageShapes.ts](../tools/measureWordPageShapes.ts), with [tools/wordPageShapes/](../tools/wordPageShapes/) |

Re-run it from the repository root, with the archive and dump in
`.data/source/`. The seed takes about 3 minutes and the search about 17; the
work directory must not exist yet:

```sh
pnpm exec tsx tools/measureEmptyWordPages.ts seed .data/source/it-extract.jsonl.gz .data/source/itwiktionary-20260701-pages-articles.xml.bz2 <work dir>
TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureWordPageShapes.ts search .data/source/it-extract.jsonl.gz <work dir>
TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureWordPageShapes.ts shapes .data/source/it-extract.jsonl.gz <work dir> > reports/2026-10-07-word-page-shapes.json
```

## What was searched

- **Every headword**, 541,433 of them: each distinct `word` of an archive
  record or a page-only entry, as #699 counted them. Each is searched the way
  the page searches (`searchAttempt`), and the page is built as the search page
  builds it: `phrasePage()` for an expression route, `wordPage()` otherwise.
- **A sample of expression searches**, 7,590. A headword search never opens an
  expression's short page (§ 6): that page opens only when an expression is
  typed with a word inflected, `vado via`. So for each of the 6,276 headwords of
  two words or more, and each word in it, the script searches the expression
  with that word swapped for the first single-word headword that is a form of
  it (`andare via` → `andai via`).

## How a shape is read

A page's shape is the set of parts it is made of:

- each kind of reading it lists: `own` (a reading of a record that is not the
  query's form), `form-of` (the query's own form record, a noun or adjective
  form block), `verb-form` (a verb form block), `grid-form` (a form no record
  describes), `bare` and `lone-bare` (empty readings), each with its part of
  speech where the rules tell them apart: noun, adjective, verb, other;
- `own … form record`, for a reading the source heads as a form
  (`Sostantivo, forma flessa`, `Voce verbale`) that no `form_of` edge makes a
  form-of reading;
- `form-of 2+ base words`, for a form whose lines name two base words;
- a record of another word: a spelling variant (`Abaco` on `abaco`, by the
  lookup's normalizer) or another word altogether (`Dario` on `Daria`);
- two blocks about one base word;
- the count: one reading, two about one word, two about two words, or three
  and more, where § 2 turns; and whether the jump links show.

`other` covers, by readings: Nome proprio 5,636, Locuzione nominale 3,502,
Avverbio 3,158, Locuzione verbale 948, Acronimo / Abbreviazione 708, and 27
smaller headings (the JSON's `otherPartsOfSpeech`). No rule tells them apart:
they read as § 3 reads any reading with no *Forms*.

Each part is mapped to the rows that rule it, in `COMPONENTS` in
[shape.ts](../tools/wordPageShapes/shape.ts). A shape is ruled when every part
is. Otherwise it takes its worst part's mark: **rules disagree**, **no rule**,
or **page breaks the rule** (a rule covers it and the page does not follow it).

## Totals

The counts add up to the searches made.

| Ruling | Headword shapes | Headword pages | Expression shapes | Expression pages |
|---|---:|---:|---:|---:|
| Ruled | 177 | 538,931 | 16 | 7,576 |
| No rule | 66 | 2,393 | 0 | 0 |
| Rules disagree | 8 | 59 | 2 | 14 |
| Page breaks the rule | 8 | 50 | 0 | 0 |
| **Total** | **259** | **541,433** | **18** | **7,590** |

Seven headwords find nothing (`skirmishes`, `nagymamák`: words of other
languages), and three sampled expressions (`abbi torto`). Each counts as a
shape, `no page (not-found)`.

Two kinds of page make up 82% of the release: a verb form with one verb block
(222,280, `abalienai`) and a verb form whose verb has no record, which shows
its form lines alone (221,739, `zurlò`; § 4, #690).

## The leftovers, asked on #708

Question 1, `studente`, is ruled and built (#714), so its shape is ruled here
and not asked again.

| Question | Part | Mark | Rows | Pages | Examples |
|---|---|---|---|---:|---|
| 2, 3 | A record with other capitals | no rule | 1a, 2b | 2,383 | `abaco`, `AC`, `Aglio` |
| 4 | A record with another apostrophe | no rule | 1a, 2b | 13 | `all'improvviso`, `fare l'occhiolino` |
| 5 | A verb block and a noun or adjective block about one word | rules disagree | 4b, 4c | 59 | `presiedute`, `vibranti`, `laureati` |
| 6 | An expression page with three or more readings | rules disagree | 2b, 6a | 14 of 7,590 sampled | `Venerdì santi`, `servizio sanitario nazionali` |

The capital and apostrophe rows are one part in the census, "a spelling
variant's record"; the question splits them. Three of its pages are counted
under question 5 instead, the worse mark (`giusta`, `Giusta`, `addolorata`).
1,396 of those pages show the
reading list only because the variant counts as another word, and 31 show only
the variant's readings (`Aglio` shows `aglio`'s).

## What the census found besides

- **Page breaks the rule, 50 pages.** Two noun, adjective or pronoun form
  blocks of one base word: `calabra` (adjective and noun of calabro), `altri`
  (adjective and pronoun of altro), `blasfeme`. Rule 1 says one block, so this
  is a bug, filed as [#717](https://github.com/povlabs/lexema/issues/717).
- **A form record read as its own word's, 753 pages.** The record is headed as
  a form but has no `form_of` edge (`aerei`'s "plurale di aereo"), so § 2
  counts it as its own headword's, and 212 two-reading pages show the list for
  it. § 3 and § 2 rule it, so it is not asked on #708; #715 holds the question,
  and the [counts are posted there](https://github.com/povlabs/lexema/issues/715#issuecomment-6037338634).
- **No record of another word shows beside the word's own.** § 1's fallback
  (the records that list the word) appears only on pages none of whose own
  records shows anything (`Daria` shows `Dario`'s).

## Every shape

Rows, as the tables name them:

| Code | Row of How a word page renders |
|---|---|
| 1a | [§ 1](../design-system-manifest.md#1-what-becomes-a-reading) *Only records about the searched word.* |
| 1c | [§ 1](../design-system-manifest.md#1-what-becomes-a-reading) *A page where every reading is empty (P2) keeps the part of speech under the word.* |
| 2b | [§ 2](../design-system-manifest.md#2-numbers-and-jump-links) *Jump links for three or more readings, or for two readings about two different words.* |
| 3a | [§ 3](../design-system-manifest.md#3-a-reading-of-a-words-own-record) *A heading, then Definitions, then Forms.* |
| 4a | [§ 4](../design-system-manifest.md#4-a-forms-block) *One block per base word.* |
| 4b | [§ 4](../design-system-manifest.md#4-a-forms-block) *A verb form block.* |
| 4c | [§ 4](../design-system-manifest.md#4-a-forms-block) *A noun or adjective form block.* |
| 4h | [§ 4](../design-system-manifest.md#4-a-forms-block) *A form no record describes (P3).* |
| 6a | [§ 6](../design-system-manifest.md#6-other-page-kinds) *A searched expression gets a short page.* |

A shape that is not ruled names its mark and the parts that carry it. Examples
are up to three plain lowercase words, spread across the alphabet, where the
shape has three.

### Headword searches (541,433)

| # | Shape | Pages | Examples | Rows |
|---:|---|---:|---|---|
| 1 | verb-form · 1 reading · no links | 222,280 | `abalienai`, `incameravi`, `è` | 4b, 2b |
| 2 | form-of verb · 1 reading · no links | 221,739 | `abaliena`, `raggrumoli`, `zurlò` | 4a, 2b |
| 3 | own noun · 1 reading · no links | 27,628 | `abaca`, `ischemia`, `équipe` | 3a, 2b |
| 4 | own other · 1 reading · no links | 12,900 | `abbagliatamente`, `incredibilmente`, `zzz` | 3a, 2b |
| 5 | form-of noun · 1 reading · no links | 11,755 | `abaceti`, `internamenti`, `zuzzurulloni` | 4c, 4a, 2b |
| 6 | form-of adjective · 1 reading · no links | 11,301 | `abapicali`, `inosservabili`, `zuppi` | 4c, 4a, 2b |
| 7 | own adjective · 1 reading · no links | 7,714 | `abarbicato`, `intenzionato`, `zurighese` | 3a, 2b |
| 8 | own verb · 1 reading · no links | 5,968 | `abalienare`, `impiastrare`, `zufolare` | 3a, 2b |
| 9 | own adjective · own noun · 2 readings, 1 word · no links | 2,631 | `abbacinatore`, `latino`, `zwinglista` | 3a, 2b |
| 10 | form-of adjective · verb-form · 2 readings, 2+ words · links | 2,396 | `abbacchiata`, `indirizzati`, `zigrinati` | 4c, 4a, 4b, 2b |
| 11 | own adjective · verb-form · 2 readings, 2+ words · links | 2,035 | `abalienato`, `innescante`, `zuccherato` | 3a, 4b, 2b |
| 12 | own noun · verb-form · 2 readings, 2+ words · links | 1,884 | `abandono`, `massacro`, `zufolo` | 3a, 4b, 2b |
| 13 | lone-bare · 1 reading · no links | 1,087 | `abbottonarsi`, `minimalistico`, `zonzo` | 1c, 2b |
| 14 | form-of noun · verb-form · 2 readings, 2+ words · links | 961 | `abbacchi`, `indovina`, `zufoli` | 4c, 4a, 4b, 2b |
| 15 | own adjective · own noun · verb-form · 3+ readings · links | 717 | `abbagliante`, `infestante`, `zuccherino` | 3a, 4b, 2b |
| 16 | form-of adjective · own noun · 2 readings, 2+ words · links | 678 | `abbattuta`, `lodigiana`, `zeppa` | 4c, 4a, 3a, 2b |
| 17 | verb-form · 2 readings, 2+ words · links | 657 | `abballino`, `complimentai`, `venerò` | 4b, 2b |
| 18 | a spelling variant's record · own noun · own other · 2 readings, 2+ words · links | 618 | `abaco`, `giada`, `zip` | **no rule**: a spelling variant's record (1a, 2b) |
| 19 | a spelling variant's record · own noun · 2 readings, 2+ words · links | 564 | `acacia`, `lattuga`, `zinnia` | **no rule**: a spelling variant's record (1a, 2b) |
| 20 | own verb · 2 readings, 1 word · no links | 469 | `abbacchiare`, `inchiedere`, `zittire` | 3a, 2b |
| 21 | form-of verb · own adjective · 2 readings, 2+ words · links | 276 | `agiato`, `putrefatto`, `vigente` | 4a, 3a, 2b |
| 22 | form-of adjective · form-of verb · 2 readings, 2+ words · links | 218 | `abalienate`, `riarsi`, `vellutati` | 4c, 4a, 2b |
| 23 | form-of verb · own noun · 2 readings, 2+ words · links | 213 | `abbuffata`, `quietanza`, `zampa` | 4a, 3a, 2b |
| 24 | form-of adjective · form-of noun · 2 readings, 2+ words · links | 200 | `abbaglianti`, `liriche`, `zuppe` | 4c, 4a, 2b |
| 25 | own adjective · own noun · 3+ readings · links | 193 | `abruzzese`, `logudorese`, `zapoteco` | 3a, 2b |
| 26 | form-of verb · own adjective · verb-form · 3+ readings · links | 186 | `abbrustolito`, `imbarbarito`, `travolto` | 4a, 3a, 4b, 2b |
| 27 | form-of adjective · own noun · verb-form · 3+ readings · links | 182 | `abbassata`, `muta`, `volta` | 4c, 4a, 3a, 4b, 2b |
| 28 | form-of verb · verb-form · 2 readings, 2+ words · links | 171 | `aggrappato`, `ridono`, `vezzeggiato` | 4a, 4b, 2b |
| 29 | a spelling variant's record · own adjective · own noun · own other · 3+ readings · links | 156 | `albo`, `limone`, `x` | **no rule**: a spelling variant's record (1a, 2b) |
| 30 | own noun form record · 1 reading · no links | 152 | `acarofobie`, `gommiste`, `zecche` | 3a, 2b |
| 31 | own adjective · verb-form · 3+ readings · links | 136 | `abbarbicato`, `invaghito`, `venduto` | 3a, 4b, 2b |
| 32 | form-of noun · own noun · 2 readings, 2+ words · links | 134 | `acrobate`, `ghiande`, `zappatrice` | 4c, 4a, 3a, 2b |
| 33 | own adjective form record · 1 reading · no links | 132 | `adiposi`, `irrisoria`, `vuote` | 3a, 2b |
| 34 | a spelling variant's record · own adjective · own other · 2 readings, 2+ words · links | 106 | `acre`, `generoso`, `vitale` | **no rule**: a spelling variant's record (1a, 2b) |
| 35 | own other · verb-form · 2 readings, 2+ words · links | 97 | `addosso`, `contro`, `sia` | 3a, 4b, 2b |
| 36 | own other · 2 readings, 1 word · no links | 91 | `accanto`, `gli`, `vi` | 3a, 2b |
| 37 | form-of adjective · form-of noun · verb-form · 3+ readings · links | 87 | `abbassate`, `ottimi`, `volute` | 4c, 4a, 4b, 2b |
| 38 | a spelling variant's record · own other · verb-form · 2 readings, 2+ words · links | 80 | `accorso`, `gloriano`, `volga` | **no rule**: a spelling variant's record (1a, 2b) |
| 39 | own noun · 2 readings, 1 word · no links | 79 | `aere`, `micio`, `viaggiatore` | 3a, 2b |
| 40 | form-of noun · form-of verb · 2 readings, 2+ words · links | 77 | `assegni`, `poeti`, `zimbelli` | 4c, 4a, 2b |
| 41 | a spelling variant's record · own noun · own other · verb-form · 3+ readings · links | 74 | `ala`, `firma`, `violo` | **no rule**: a spelling variant's record (1a, 2b) |
| 42 | own noun · own other · 2 readings, 1 word · no links | 74 | `accidenti`, `merda`, `vaffanculo` | 3a, 2b |
| 43 | form-of adjective · own other · 2 readings, 2+ words · links | 72 | `alcuni`, `pure`, `salve` | 4c, 4a, 3a, 2b |
| 44 | own verb form record · verb-form · 2 readings, 2+ words · links | 68 | `abbaiato`, `pungi`, `volesse` | 3a, 2b, 4b |
| 45 | a spelling variant's record · own adjective · own noun · 3+ readings · links | 67 | `amaranto`, `novarese`, `walser` | **no rule**: a spelling variant's record (1a, 2b) |
| 46 | a spelling variant's record · own noun · own other · 3+ readings · links | 62 | `a`, `io`, `veronica` | **no rule**: a spelling variant's record (1a, 2b) |
| 47 | form-of verb · own adjective · own noun · 3+ readings · links | 61 | `acido`, `passito`, `zelante` | 4a, 3a, 2b |
| 48 | own noun · verb-form · 3+ readings · links | 61 | `abbaglio`, `invaso`, `volgo` | 3a, 4b, 2b |
| 49 | a spelling variant's record · own other · 2 readings, 2+ words · links | 60 | `ac`, `mb`, `wh` | **no rule**: a spelling variant's record (1a, 2b) |
| 50 | a spelling variant's record · form-of adjective · own other · 2 readings, 2+ words · links | 58 | `aborigeni`, `glauca`, `venusta` | **no rule**: a spelling variant's record (1a, 2b) |
| 51 | a spelling variant's record · own adjective · own noun · own other · verb-form · 3+ readings · links | 55 | `alano`, `eliso`, `vivo` | **no rule**: a spelling variant's record (1a, 2b) |
| 52 | a spelling variant's record · own adjective · own other · verb-form · 3+ readings · links | 54 | `addolorato`, `illuminata`, `venerando` | **no rule**: a spelling variant's record (1a, 2b) |
| 53 | own adjective · own noun · own other · 3+ readings · links | 50 | `allora`, `niente`, `zitto` | 3a, 2b |
| 54 | form-of adjective · verb-form · 3+ readings · links | 47 | `abbandonati`, `lessi`, `volti` | 4c, 4a, 4b, 2b |
| 55 | own adjective · own other · 2 readings, 1 word · no links | 47 | `abbastanza`, `nostro`, `vostro` | 3a, 2b |
| 56 | form-of adjective · own verb form record · 2 readings, 2+ words · links | 46 | `abbandonata`, `finiti`, `usciti` | 4c, 4a, 3a, 2b |
| 57 | a verb block and a noun or adjective block about one word · form-of adjective · verb-form · 2 readings, 1 word · no links | 45 | `accentuata`, `presiedute`, `vibranti` | **rules disagree**: a verb block and a noun or adjective block about one word (4b, 4c) |
| 58 | own adjective form record · verb-form · 2 readings, 2+ words · links | 45 | `accavallato`, `gratificanti`, `vissuta` | 3a, 2b, 4b |
| 59 | form-of verb · own other · 2 readings, 2+ words · links | 42 | `Aurino`, `Mema`, `ci sono` | 4a, 3a, 2b |
| 60 | a spelling variant's record · form-of noun · own noun · 2 readings, 2+ words · links | 41 | `afidi`, `giudici`, `tirannidi` | **no rule**: a spelling variant's record (1a, 2b) |
| 61 | a spelling variant's record · form-of verb · own other · 2 readings, 2+ words · links | 41 | `aurino`, `letizio`, `zilla` | **no rule**: a spelling variant's record (1a, 2b) |
| 62 | own adjective · own verb · 2 readings, 1 word · no links | 41 | `articolare`, `popolare`, `volare` | 3a, 2b |
| 63 | own adjective · own verb form record · verb-form · 3+ readings · links | 37 | `abbaiante`, `infetto`, `vieto` | 3a, 2b, 4b |
| 64 | a spelling variant's record · own adjective · own noun · 2 readings, 2+ words · links | 36 | `acheuleano`, `olduvaiano`, `trecento` | **no rule**: a spelling variant's record (1a, 2b) |
| 65 | grid-form · 1 reading · no links | 35 | `accentratrici`, `iridea`, `vettovagliamenti` | 4h, 2b |
| 66 | own noun · own verb form record · verb-form · 3+ readings · links | 35 | `argomento`, `intervista`, `usura` | 3a, 2b, 4b |
| 67 | own verb form record · 1 reading · no links | 35 | `abbattette`, `preannunciato`, `ò` | 3a, 2b |
| 68 | form-of adjective · form-of noun · two blocks about one word · 2 readings, 1 word · no links | 33 | `abatemarchesi`, `calabra`, `pezzolani` | **page breaks the rule**: two blocks about one word (4a) |
| 69 | a spelling variant's record · form-of adjective · own noun · own other · 3+ readings · links | 32 | `barbara`, `prima`, `vera` | **no rule**: a spelling variant's record (1a, 2b) |
| 70 | form-of noun · verb-form · 3+ readings · links | 31 | `apostrofi`, `posti`, `tratti` | 4c, 4a, 4b, 2b |
| 71 | own noun · own verb · 2 readings, 1 word · no links | 31 | `alveare`, `nettare`, `vomere` | 3a, 2b |
| 72 | form-of noun · own other · 2 readings, 2+ words · links | 30 | `agli`, `fica`, `vie` | 4c, 4a, 3a, 2b |
| 73 | a spelling variant's record · form-of adjective · own noun · 2 readings, 2+ words · links | 27 | `aculeati`, `egizi`, `vertebrati` | **no rule**: a spelling variant's record (1a, 2b) |
| 74 | a spelling variant's record · own noun · verb-form · 3+ readings · links | 25 | `balena`, `duce`, `trema` | **no rule**: a spelling variant's record (1a, 2b) |
| 75 | own noun · own other · verb-form · 3+ readings · links | 23 | `abbasso`, `cazzo`, `vale` | 3a, 4b, 2b |
| 76 | a spelling variant's record · form-of adjective · own other · verb-form · 3+ readings · links | 22 | `adorna`, `fida`, `viva` | **no rule**: a spelling variant's record (1a, 2b) |
| 77 | own adjective · own noun · own verb · 3+ readings · links | 22 | `alare`, `militare`, `volgare` | 3a, 2b |
| 78 | form-of adjective · own noun form record · 2 readings, 2+ words · links | 21 | `anniversari`, `femorali`, `tracotanti` | 4c, 4a, 3a, 2b |
| 79 | form-of adjective · own other · verb-form · 3+ readings · links | 21 | `Adorna`, `Fida`, `tardi` | 4c, 4a, 3a, 4b, 2b |
| 80 | form-of other · 1 reading · no links | 21 | `Russie`, `non metalli`, `voci verbali` | 4a, 2b |
| 81 | own adjective · 2 readings, 1 word · no links | 21 | `ampezzano`, `intemperante`, `ventenne` | 3a, 2b |
| 82 | own adjective form record · own noun · 2 readings, 1 word · no links | 19 | `agostiniane`, `insiemistica`, `ventilatore` | 3a, 2b |
| 83 | a spelling variant's record · form-of adjective · own noun · 3+ readings · links | 18 | `agostiniani`, `roditori`, `violacee` | **no rule**: a spelling variant's record (1a, 2b) |
| 84 | form-of noun · 2 readings, 2+ words · links | 16 | `arti`, `mammiferi`, `vinattiere` | 4c, 4a, 2b |
| 85 | form-of verb · 2 readings, 2+ words · links | 16 | `rinsavire`, `sfrangereste`, `sfrangiate` | 4a, 2b |
| 86 | form-of adjective · form-of verb · own noun · 3+ readings · links | 15 | `assise`, `pettegola`, `vellutata` | 4c, 4a, 3a, 2b |
| 87 | own noun · own other · 3+ readings · links | 15 | `alla`, `insieme`, `via` | 3a, 2b |
| 88 | own noun · own verb · 3+ readings · links | 15 | `abitare`, `essere`, `volere` | 3a, 2b |
| 89 | a spelling variant's record · form-of adjective · own noun · own other · verb-form · 3+ readings · links | 14 | `bassa`, `china`, `tesi` | **no rule**: a spelling variant's record (1a, 2b) |
| 90 | a spelling variant's record · form-of noun · own other · 2 readings, 2+ words · links | 13 | `addii`, `conifere`, `terni` | **no rule**: a spelling variant's record (1a, 2b) |
| 91 | a spelling variant's record · own noun · 3+ readings · links | 13 | `ape`, `centauro`, `togo` | **no rule**: a spelling variant's record (1a, 2b) |
| 92 | own adjective · own noun · own verb form record · verb-form · 3+ readings · links | 13 | `bagnato`, `ibrido`, `specifico` | 3a, 2b, 4b |
| 93 | a spelling variant's record · own adjective · own noun · verb-form · 3+ readings · links | 12 | `ascendente`, `eccelso`, `paro` | **no rule**: a spelling variant's record (1a, 2b) |
| 94 | a spelling variant's record · own other · 3+ readings · links | 12 | `ci`, `e`, `su` | **no rule**: a spelling variant's record (1a, 2b) |
| 95 | bare · 2 readings, 1 word · no links | 12 | `innanzi`, `spensare`, `urgere` | 1c, 2b |
| 96 | form-of 2+ base words · form-of noun · 1 reading · no links | 12 | `auspici`, `geni`, `tempi` | 4c, 4a, 2b |
| 97 | form-of noun · own noun · verb-form · 3+ readings · links | 11 | `agganci`, `messe`, `tamburello` | 4c, 4a, 3a, 4b, 2b |
| 98 | own adjective · own noun · own other · verb-form · 3+ readings · links | 10 | `accosto`, `presto`, `verso` | 3a, 4b, 2b |
| 99 | own adjective · own verb · verb-form · 3+ readings · links | 10 | `congegnato`, `programmato`, `socchiuso` | 3a, 4b, 2b |
| 100 | own adjective form record · own noun form record · 2 readings, 1 word · no links | 10 | `alpina`, `rapaci`, `tangheri` | 3a, 2b |
| 101 | own noun · own noun form record · 2 readings, 1 word · no links | 10 | `bracconiere`, `impostore`, `strillone` | 3a, 2b |
| 102 | own noun · own verb form record · 2 readings, 1 word · no links | 10 | `fuoriuscito`, `scantinato`, `trivella` | 3a, 2b |
| 103 | own verb · verb-form · 2 readings, 2+ words · links | 10 | `dovremmo`, `porsi`, `valse` | 3a, 4b, 2b |
| 104 | a spelling variant's record · own noun · 1 reading · no links | 9 | `Aglio`, `Gennaro`, `filippini` | **no rule**: a spelling variant's record (1a, 2b) |
| 105 | form-of noun · own adjective · verb-form · 3+ readings · links | 9 | `armate`, `portate`, `versi` | 4c, 4a, 3a, 4b, 2b |
| 106 | own noun · own verb · verb-form · 3+ readings · links | 9 | `cadenza`, `gronda`, `scheda` | 3a, 4b, 2b |
| 107 | a spelling variant's record · form-of noun · own noun · 3+ readings · links | 8 | `carenati`, `signore`, `vite` | **no rule**: a spelling variant's record (1a, 2b) |
| 108 | a spelling variant's record · own other · 1 reading · no links | 8 | `brunetta`, `chiaretto`, `pia` | **no rule**: a spelling variant's record (1a, 2b) |
| 109 | another word's record · grid-form · own adjective form record · 2 readings, 2+ words · links | 8 | `acustici`, `fiochi`, `smaniose` | 1c, 4h, 3a, 2b |
| 110 | form-of noun · own adjective · 2 readings, 2+ words · links | 8 | `ammonitore`, `nanoelettronica`, `venti` | 4c, 4a, 3a, 2b |
| 111 | form-of noun · own verb form record · verb-form · 3+ readings · links | 8 | `alimenti`, `frammenti`, `sanzioni` | 4c, 4a, 3a, 2b, 4b |
| 112 | own adjective · own other · verb-form · 3+ readings · links | 8 | `addentro`, `discosto`, `tosto` | 3a, 4b, 2b |
| 113 | own noun form record · verb-form · 2 readings, 2+ words · links | 8 | `arrapante`, `messaggi`, `slittino` | 3a, 2b, 4b |
| 114 | a spelling variant's record · form-of noun · own noun · own other · 3+ readings · links | 7 | `pesci`, `primina`, `terzina` | **no rule**: a spelling variant's record (1a, 2b) |
| 115 | a spelling variant's record · own adjective · own noun · 2 readings, 1 word · no links | 7 | `Asfodelo`, `Quarantotto`, `UNICO` | **no rule**: a spelling variant's record (1a, 2b) |
| 116 | form-of 2+ base words · form-of noun · verb-form · 2 readings, 2+ words · links | 7 | `auguri`, `menti`, `vaccini` | 4c, 4a, 4b, 2b |
| 117 | form-of adjective · own noun form record · verb-form · 3+ readings · links | 7 | `aerei`, `maledetta`, `sbandata` | 4c, 4a, 3a, 2b, 4b |
| 118 | form-of adjective · own verb form record · verb-form · 3+ readings · links | 7 | `abbottonate`, `logora`, `serve` | 4c, 4a, 3a, 2b, 4b |
| 119 | form-of noun · own noun · 2 readings, 1 word · no links | 7 | `allorista`, `pretore`, `salumiere` | 4c, 4a, 3a, 2b |
| 120 | no page (not-found) | 7 | `skirmishes`, `testvérek`, `zapateros` | 1a |
| 121 | a spelling variant's record · own adjective form record · own other · 2 readings, 2+ words · links | 6 | `alessandrina`, `carina`, `marziana` | **no rule**: a spelling variant's record (1a, 2b) |
| 122 | another word's record · own other · 1 reading · no links | 6 | `Daria`, `Maura`, `pella` | 1c, 3a, 2b |
| 123 | form-of 2+ base words · form-of verb · 1 reading · no links | 6 | `andarsene`, `indetta`, `riempiendo` | 4c, 4a, 2b |
| 124 | form-of adjective · form-of noun · two blocks about one word · verb-form · 3+ readings · links | 6 | `assediata`, `obbligate`, `squilibrate` | **page breaks the rule**: two blocks about one word (4a) |
| 125 | own adjective · own other · 3+ readings · links | 6 | `alquanto`, `fino`, `tanto` | 3a, 2b |
| 126 | own other · 3+ readings · links | 6 | `anzi`, `fuori`, `o` | 3a, 2b |
| 127 | a spelling variant's record · form-of adjective · form-of noun · own other · 3+ readings · links | 5 | `acri`, `chiara`, `ortolana` | **no rule**: a spelling variant's record (1a, 2b) |
| 128 | a spelling variant's record · own adjective · 1 reading · no links | 5 | `Augusteo`, `Italo`, `Stagirita` | **no rule**: a spelling variant's record (1a, 2b) |
| 129 | a spelling variant's record · own noun · verb-form · 2 readings, 2+ words · links | 5 | `impenni`, `tifa`, `vinca` | **no rule**: a spelling variant's record (1a, 2b) |
| 130 | a spelling variant's record · own other · verb-form · 3+ readings · links | 5 | `IVA`, `Meno`, `sta` | **no rule**: a spelling variant's record (1a, 2b) |
| 131 | form-of adjective · form-of noun · own noun · 3+ readings · links | 5 | `basilica`, `conservatori`, `peste` | 4c, 4a, 3a, 2b |
| 132 | form-of adjective · form-of other · two blocks about one word · 2 readings, 1 word · no links | 5 | `altri`, `tali`, `tante` | **page breaks the rule**: two blocks about one word (4a) |
| 133 | form-of adjective · own noun · own verb form record · 3+ readings · links | 5 | `chiamata`, `ridotta`, `tradotta` | 4c, 4a, 3a, 2b |
| 134 | form-of verb · own adjective · own noun · verb-form · 3+ readings · links | 5 | `corrotto`, `inquirente`, `rimbambito` | 4a, 3a, 4b, 2b |
| 135 | own adjective · own noun · own verb form record · 3+ readings · links | 5 | `bruciata`, `portata`, `stampante` | 3a, 2b |
| 136 | own noun · 3+ readings · links | 5 | `classe`, `ippocampo`, `poma` | 3a, 2b |
| 137 | a spelling variant's record · form-of noun · own other · verb-form · 3+ readings · links | 4 | `bari`, `temi`, `trapani` | **no rule**: a spelling variant's record (1a, 2b) |
| 138 | a spelling variant's record · form-of verb · own noun · 3+ readings · links | 4 | `Sdentati`, `sdentati`, `siringa` | **no rule**: a spelling variant's record (1a, 2b) |
| 139 | a spelling variant's record · form-of verb · own noun · own other · 3+ readings · links | 4 | `Gemma`, `gemma`, `rubino` | **no rule**: a spelling variant's record (1a, 2b) |
| 140 | a spelling variant's record · own adjective · 2 readings, 2+ words · links | 4 | `Immaginifico`, `immaginifico`, `neodevoniano` | **no rule**: a spelling variant's record (1a, 2b) |
| 141 | a spelling variant's record · own adjective · own noun · own other · own verb · verb-form · 3+ readings · links | 4 | `Ardito`, `ardito`, `argentino` | **no rule**: a spelling variant's record (1a, 2b) |
| 142 | a verb block and a noun or adjective block about one word · form-of adjective · verb-form · 3+ readings · links | 4 | `accentuate`, `laureati`, `prorogate` | **rules disagree**: a verb block and a noun or adjective block about one word (4b, 4c) |
| 143 | form-of adjective · own verb · 2 readings, 2+ words · links | 4 | `amare`, `intermedi`, `leggere` | 4c, 4a, 3a, 2b |
| 144 | form-of noun · own adjective · own noun · 3+ readings · links | 4 | `casertano`, `messinese`, `sette` | 4c, 4a, 3a, 2b |
| 145 | form-of noun · own other · verb-form · 3+ readings · links | 4 | `Bari`, `Temi`, `Trapani` | 4c, 4a, 3a, 4b, 2b |
| 146 | form-of verb · own adjective form record · 2 readings, 2+ words · links | 4 | `inframmettente`, `plissettato`, `sconcia` | 4a, 3a, 2b |
| 147 | own adjective · own verb form record · 2 readings, 1 word · no links | 4 | `meccanizzati`, `sbarazzino`, `sfatto` | 3a, 2b |
| 148 | own adjective form record · own noun · verb-form · 3+ readings · links | 4 | `attenti`, `pensionata`, `profana` | 3a, 2b, 4b |
| 149 | own adjective form record · own noun form record · verb-form · 3+ readings · links | 4 | `regnanti`, `vigili`, `visti` | 3a, 2b, 4b |
| 150 | own other · verb-form · 3+ readings · links | 4 | `attraverso`, `dai`, `presso` | 3a, 4b, 2b |
| 151 | a spelling variant's record · form-of noun · own other · 3+ readings · links | 3 | `PA`, `pA`, `pa` | **no rule**: a spelling variant's record (1a, 2b) |
| 152 | form-of adjective · form-of noun · 3+ readings · links | 3 | `fiumane`, `fiumani`, `greca` | 4c, 4a, 2b |
| 153 | form-of adjective · form-of noun · form-of verb · 3+ readings · links | 3 | `fisse`, `scapigliate`, `vellutate` | 4c, 4a, 2b |
| 154 | form-of adjective · form-of noun · own other · 3+ readings · links | 3 | `Bionda`, `Chiara`, `Ortolana` | 4c, 4a, 3a, 2b |
| 155 | form-of adjective · form-of verb · verb-form · 3+ readings · links | 3 | `involta`, `involti`, `ristretta` | 4c, 4a, 4b, 2b |
| 156 | form-of adjective · own adjective · own noun · 3+ readings · links | 3 | `imbroglione`, `maggiore`, `sornione` | 4c, 4a, 3a, 2b |
| 157 | form-of noun · own adjective form record · 2 readings, 2+ words · links | 3 | `orbi`, `schiava`, `selvatici` | 4c, 4a, 3a, 2b |
| 158 | form-of noun · own verb · 2 readings, 2+ words · links | 3 | `cazzare`, `ire`, `massare` | 4c, 4a, 3a, 2b |
| 159 | form-of verb · own noun · verb-form · 3+ readings · links | 3 | `riscosso`, `slancio`, `stringa` | 4a, 3a, 4b, 2b |
| 160 | own verb · 3+ readings · links | 3 | `asciugare`, `assommare`, `effondere` | 3a, 2b |
| 161 | verb-form · 3+ readings · links | 3 | `acclimata`, `compì`, `ridesti` | 4b, 2b |
| 162 | a spelling variant's record · a verb block and a noun or adjective block about one word · form-of adjective · form-of verb · own other · 3+ readings · links | 2 | `Giusta`, `giusta` | **rules disagree**: a verb block and a noun or adjective block about one word (4b, 4c) |
| 163 | a spelling variant's record · bare · 2 readings, 2+ words · links | 2 | `SLA`, `Sla` | **no rule**: a spelling variant's record (1a, 2b) |
| 164 | a spelling variant's record · form-of adjective · form-of verb · own noun · own other · 3+ readings · links | 2 | `Pellegrina`, `pellegrina` | **no rule**: a spelling variant's record (1a, 2b) |
| 165 | a spelling variant's record · form-of adjective · form-of verb · own other · 3+ readings · links | 2 | `lisa`, `sincera` | **no rule**: a spelling variant's record (1a, 2b) |
| 166 | a spelling variant's record · form-of adjective · own adjective · own noun · own other · verb-form · 3+ readings · links | 2 | `Rosa`, `rosa` | **no rule**: a spelling variant's record (1a, 2b) |
| 167 | a spelling variant's record · form-of adjective · own noun · own other · own verb form record · verb-form · 3+ readings · links | 2 | `Ferma`, `ferma` | **no rule**: a spelling variant's record (1a, 2b) |
| 168 | a spelling variant's record · form-of adjective · own noun · verb-form · 3+ readings · links | 2 | `azzurri`, `umiliati` | **no rule**: a spelling variant's record (1a, 2b) |
| 169 | a spelling variant's record · form-of noun · own adjective form record · own other · 3+ readings · links | 2 | `Slava`, `slava` | **no rule**: a spelling variant's record (1a, 2b) |
| 170 | a spelling variant's record · form-of noun · own noun · own other · verb-form · 3+ readings · links | 2 | `Uccelli`, `uccelli` | **no rule**: a spelling variant's record (1a, 2b) |
| 171 | a spelling variant's record · form-of verb · own adjective · own other · 3+ readings · links | 2 | `Sincero`, `sincero` | **no rule**: a spelling variant's record (1a, 2b) |
| 172 | a spelling variant's record · form-of verb · own adjective · own other · verb-form · 3+ readings · links | 2 | `Incoronato`, `incoronato` | **no rule**: a spelling variant's record (1a, 2b) |
| 173 | a spelling variant's record · form-of verb · own noun · 2 readings, 2+ words · links | 2 | `pasqua`, `vulgata` | **no rule**: a spelling variant's record (1a, 2b) |
| 174 | a spelling variant's record · own adjective · own noun · own other · own verb form record · verb-form · 3+ readings · links | 2 | `Beato`, `beato` | **no rule**: a spelling variant's record (1a, 2b) |
| 175 | a spelling variant's record · own adjective · own noun · own verb form record · 3+ readings · links | 2 | `Sorbo`, `sorbo` | **no rule**: a spelling variant's record (1a, 2b) |
| 176 | a spelling variant's record · own adjective · own other · 3+ readings · links | 2 | `Loro`, `loro` | **no rule**: a spelling variant's record (1a, 2b) |
| 177 | a spelling variant's record · own adjective · own other · own verb form record · verb-form · 3+ readings · links | 2 | `Divino`, `divino` | **no rule**: a spelling variant's record (1a, 2b) |
| 178 | a spelling variant's record · own adjective form record · own noun · own other · 3+ readings · links | 2 | `Nana`, `nana` | **no rule**: a spelling variant's record (1a, 2b) |
| 179 | a spelling variant's record · own adjective form record · own other · verb-form · 3+ readings · links | 2 | `Roso`, `roso` | **no rule**: a spelling variant's record (1a, 2b) |
| 180 | a spelling variant's record · own noun · own other · own verb · verb-form · 3+ readings · links | 2 | `Grazia`, `grazia` | **no rule**: a spelling variant's record (1a, 2b) |
| 181 | a spelling variant's record · own noun · own other · own verb form record · verb-form · 3+ readings · links | 2 | `Corona`, `corona` | **no rule**: a spelling variant's record (1a, 2b) |
| 182 | a spelling variant's record · own noun form record · own other · verb-form · 3+ readings · links | 2 | `Incoronata`, `incoronata` | **no rule**: a spelling variant's record (1a, 2b) |
| 183 | a verb block and a noun or adjective block about one word · form-of adjective · form-of verb · 2 readings, 1 word · no links | 2 | `agghiaccianti`, `spiombate` | **rules disagree**: a verb block and a noun or adjective block about one word (4b, 4c) |
| 184 | a verb block and a noun or adjective block about one word · form-of adjective · own noun · verb-form · 3+ readings · links | 2 | `mandata`, `scalata` | **rules disagree**: a verb block and a noun or adjective block about one word (4b, 4c) |
| 185 | a verb block and a noun or adjective block about one word · form-of noun · verb-form · 2 readings, 1 word · no links | 2 | `badanti`, `giunte` | **rules disagree**: a verb block and a noun or adjective block about one word (4b, 4c) |
| 186 | another word's record · grid-form · own adjective form record · 3+ readings · links | 2 | `acustiche`, `ermeneutici` | 1c, 4h, 3a, 2b |
| 187 | another word's record · own noun form record · 1 reading · no links | 2 | `punkettoni`, `secchiona` | 1c, 3a, 2b |
| 188 | form-of 2+ base words · form-of adjective · form-of noun · form-of verb · 3+ readings · links | 2 | `scosse`, `sommosse` | 4c, 4a, 2b |
| 189 | form-of 2+ base words · form-of adjective · form-of verb · 2 readings, 2+ words · links | 2 | `fissi`, `rimossa` | 4c, 4a, 2b |
| 190 | form-of 2+ base words · form-of adjective · form-of verb · own noun · 3+ readings · links | 2 | `imposta`, `mossa` | 4c, 4a, 3a, 2b |
| 191 | form-of 2+ base words · form-of adjective · verb-form · 2 readings, 2+ words · links | 2 | `rimpatriate`, `scoperte` | 4c, 4a, 4b, 2b |
| 192 | form-of 2+ base words · form-of noun · form-of verb · 2 readings, 2+ words · links | 2 | `lamenti`, `porti` | 4c, 4a, 2b |
| 193 | form-of 2+ base words · form-of noun · verb-form · 3+ readings · links | 2 | `marchi`, `picchi` | 4c, 4a, 4b, 2b |
| 194 | form-of 2+ base words · form-of verb · own adjective · 2 readings, 2+ words · links | 2 | `promosso`, `smosso` | 4c, 4a, 3a, 2b |
| 195 | form-of adjective · form-of noun · own noun · two blocks about one word · 3+ readings · links | 2 | `numismatica`, `spazzatrice` | **page breaks the rule**: two blocks about one word (4a) |
| 196 | form-of adjective · form-of verb · 3+ readings · links | 2 | `rinvolta`, `rinvolti` | 4c, 4a, 2b |
| 197 | form-of adjective · form-of verb · own other · 3+ readings · links | 2 | `Lisa`, `Sincera` | 4c, 4a, 3a, 2b |
| 198 | form-of adjective · own noun · 3+ readings · links | 2 | `chiarificatori`, `propri` | 4c, 4a, 3a, 2b |
| 199 | form-of adjective · own noun · own verb · 3+ readings · links | 2 | `sbieca`, `smentita` | 4c, 4a, 3a, 2b |
| 200 | form-of noun · own noun · 3+ readings · links | 2 | `ballerina`, `mire` | 4c, 4a, 3a, 2b |
| 201 | form-of noun · own other · 3+ readings · links | 2 | `grazie`, `onde` | 4c, 4a, 3a, 2b |
| 202 | form-of noun · own verb · verb-form · 3+ readings · links | 2 | `domicili`, `scambi` | 4c, 4a, 3a, 4b, 2b |
| 203 | form-of noun · own verb form record · 2 readings, 2+ words · links | 2 | `condannata`, `vestiti` | 4c, 4a, 3a, 2b |
| 204 | form-of verb · own adjective form record · verb-form · 3+ readings · links | 2 | `sintonizzato`, `stagnato` | 4a, 3a, 2b, 4b |
| 205 | own adjective · own noun · own verb · verb-form · 3+ readings · links | 2 | `diserbante`, `sepolto` | 3a, 4b, 2b |
| 206 | own adjective form record · verb-form · 3+ readings · links | 2 | `disadorna`, `sporcati` | 3a, 2b, 4b |
| 207 | a spelling variant's record · a verb block and a noun or adjective block about one word · form-of adjective · own other · verb-form · 3+ readings · links | 1 | `addolorata` | **rules disagree**: a verb block and a noun or adjective block about one word (4b, 4c) |
| 208 | a spelling variant's record · form-of adjective · own other · 3+ readings · links | 1 | `gaia` | **no rule**: a spelling variant's record (1a, 2b) |
| 209 | a spelling variant's record · form-of noun · own noun · verb-form · 3+ readings · links | 1 | `numeri` | **no rule**: a spelling variant's record (1a, 2b) |
| 210 | a spelling variant's record · form-of verb · own adjective · 2 readings, 2+ words · links | 1 | `vulgato` | **no rule**: a spelling variant's record (1a, 2b) |
| 211 | a spelling variant's record · form-of verb · own other · 3+ readings · links | 1 | `vania` | **no rule**: a spelling variant's record (1a, 2b) |
| 212 | a spelling variant's record · own noun · own other · 2 readings, 1 word · no links | 1 | `V` | **no rule**: a spelling variant's record (1a, 2b) |
| 213 | a verb block and a noun or adjective block about one word · form-of adjective · own other · verb-form · 3+ readings · links | 1 | `Addolorata` | **rules disagree**: a verb block and a noun or adjective block about one word (4b, 4c) |
| 214 | another word's record · grid-form · own adjective form record · own noun form record · 3+ readings · links | 1 | `straniera` | 1c, 4h, 3a, 2b |
| 215 | another word's record · grid-form · own noun form record · 2 readings, 2+ words · links | 1 | `controllori` | 1c, 4h, 3a, 2b |
| 216 | another word's record · grid-form · own noun form record · 3+ readings · links | 1 | `cineoperatori` | 1c, 4h, 3a, 2b |
| 217 | form-of 2+ base words · form-of adjective · 1 reading · no links | 1 | `esteri` | 4c, 4a, 2b |
| 218 | form-of 2+ base words · form-of adjective · form-of noun · 2 readings, 2+ words · links | 1 | `predatori` | 4c, 4a, 2b |
| 219 | form-of 2+ base words · form-of noun · own noun · 2 readings, 2+ words · links | 1 | `pali` | 4c, 4a, 3a, 2b |
| 220 | form-of 2+ base words · form-of verb · own noun · 2 readings, 2+ words · links | 1 | `esercito` | 4c, 4a, 3a, 2b |
| 221 | form-of adjective · 2 readings, 2+ words · links | 1 | `operatori` | 4c, 4a, 2b |
| 222 | form-of adjective · form-of noun · own adjective · 3+ readings · links | 1 | `estense` | 4c, 4a, 3a, 2b |
| 223 | form-of adjective · form-of noun · own adjective · own noun · two blocks about one word · 3+ readings · links | 1 | `poltrone` | **page breaks the rule**: two blocks about one word (4a) |
| 224 | form-of adjective · form-of noun · own verb · two blocks about one word · 3+ readings · links | 1 | `sumere` | **page breaks the rule**: two blocks about one word (4a) |
| 225 | form-of adjective · form-of noun · own verb form record · 3+ readings · links | 1 | `morti` | 4c, 4a, 3a, 2b |
| 226 | form-of adjective · form-of other · 2 readings, 2+ words · links | 1 | `parecchie` | 4c, 4a, 2b |
| 227 | form-of adjective · form-of other · own verb form record · two blocks about one word · verb-form · 3+ readings · links | 1 | `diversi` | **page breaks the rule**: two blocks about one word (4a) |
| 228 | form-of adjective · own adjective · 2 readings, 1 word · no links | 1 | `imbelle` | 4c, 4a, 3a, 2b |
| 229 | form-of adjective · own noun · 2 readings, 1 word · no links | 1 | `protettrici` | 4c, 4a, 3a, 2b |
| 230 | form-of adjective · own noun · own noun form record · 3+ readings · links | 1 | `carbonara` | 4c, 4a, 3a, 2b |
| 231 | form-of adjective · own noun · own verb form record · verb-form · 3+ readings · links | 1 | `calma` | 4c, 4a, 3a, 2b, 4b |
| 232 | form-of adjective · own other · 3+ readings · links | 1 | `Gaia` | 4c, 4a, 3a, 2b |
| 233 | form-of adjective · own verb · verb-form · 3+ readings · links | 1 | `guasti` | 4c, 4a, 3a, 4b, 2b |
| 234 | form-of adjective · two blocks about one word · 2 readings, 1 word · no links | 1 | `blasfeme` | **page breaks the rule**: two blocks about one word (4a) |
| 235 | form-of noun · form-of verb · own noun · 3+ readings · links | 1 | `scapigliata` | 4c, 4a, 3a, 2b |
| 236 | form-of noun · own adjective · own adjective form record · own noun · 3+ readings · links | 1 | `burlone` | 4c, 4a, 3a, 2b |
| 237 | form-of noun · own adjective · own verb · 3+ readings · links | 1 | `scolare` | 4c, 4a, 3a, 2b |
| 238 | form-of noun · own noun · own other · 3+ readings · links | 1 | `colle` | 4c, 4a, 3a, 2b |
| 239 | form-of noun · own noun · own verb form record · 3+ readings · links | 1 | `sparata` | 4c, 4a, 3a, 2b |
| 240 | form-of noun · own verb · 3+ readings · links | 1 | `tessere` | 4c, 4a, 3a, 2b |
| 241 | form-of verb · own adjective · 3+ readings · links | 1 | `rinvolto` | 4a, 3a, 2b |
| 242 | form-of verb · own adjective · own noun · own other · 3+ readings · links | 1 | `sommesso` | 4a, 3a, 2b |
| 243 | form-of verb · own adjective · own noun · own other · verb-form · 3+ readings · links | 1 | `manifesto` | 4a, 3a, 4b, 2b |
| 244 | form-of verb · own adjective form record · own noun form record · 3+ readings · links | 1 | `spiccioli` | 4a, 3a, 2b |
| 245 | form-of verb · own other · 3+ readings · links | 1 | `Vania` | 4a, 3a, 2b |
| 246 | grid-form · 2 readings, 2+ words · links | 1 | `lussuriosi` | 4h, 2b |
| 247 | grid-form · 3+ readings · links | 1 | `soverchie` | 4h, 2b |
| 248 | own adjective · own noun form record · verb-form · 3+ readings · links | 1 | `scarti` | 3a, 2b, 4b |
| 249 | own adjective · own verb · 3+ readings · links | 1 | `giubilare` | 3a, 2b |
| 250 | own adjective · verb-form · 2 readings, 1 word · no links | 1 | `sfocato` | 3a, 4b, 2b |
| 251 | own adjective form record · own noun · 3+ readings · links | 1 | `tanghera` | 3a, 2b |
| 252 | own adjective form record · own noun · own verb form record · 3+ readings · links | 1 | `buttata` | 3a, 2b |
| 253 | own adjective form record · own verb form record · 2 readings, 1 word · no links | 1 | `producenti` | 3a, 2b |
| 254 | own adjective form record · own verb form record · verb-form · 3+ readings · links | 1 | `logorate` | 3a, 2b, 4b |
| 255 | own noun · own noun form record · 3+ readings · links | 1 | `pome` | 3a, 2b |
| 256 | own noun · own noun form record · verb-form · 3+ readings · links | 1 | `cestino` | 3a, 2b, 4b |
| 257 | own noun · own other · own verb · 3+ readings · links | 1 | `dovere` | 3a, 2b |
| 258 | own noun form record · verb-form · 3+ readings · links | 1 | `assistiti` | 3a, 2b, 4b |
| 259 | own other · own verb form record · 2 readings, 1 word · no links | 1 | `to` | 3a, 2b |

### Sampled expression searches (7,590)

| # | Shape | Pages | Examples | Rows |
|---:|---|---:|---|---|
| 1 | expression page · expression form · expression page, 1 reading · no links | 6,664 | `6 a conoscenza`, `filosofia della biologie`, `zuppe inglese` | 6a |
| 2 | expression page · expression form · expression page, 2 readings · no links | 776 | `Asia orientali`, `grigi kaki`, `zuppa inglesi` | 6a |
| 3 | form-of noun · 1 reading · no links | 55 | `alberi di Natale`, `macchine di sicurezza`, `zone di conforto` | 4c, 4a, 2b |
| 4 | another word's record · own other · 1 reading · no links | 33 | `acetati di piombo`, `espressioni di genere`, `uscite di sicurezza` | 1c, 3a, 2b |
| 5 | own other · 1 reading · no links | 12 | `analisi logica`, `logica formale`, `valvole di ritegno` | 3a, 2b |
| 6 | expression page · expression form · expression page, 3+ readings · no links | 11 | `Agenzia nazionali Stampa Associata`, `istituto nazionali della previdenza sociale`, `servizio sanitario nazionali` | **rules disagree**: expression page, 3+ readings (2b, 6a) |
| 7 | grid-form · 1 reading · no links | 11 | `animali da compagnia`, `navigatori web`, `tubi portavoce` | 4h, 2b |
| 8 | expression page · expression form · expression own · expression page, 2 readings · no links | 8 | `Torre fari`, `lata b`, `torre fari` | 6a |
| 9 | form-of other · 1 reading · no links | 6 | `Giovedì santi`, `facce di bronzo`, `pesci d'aprile` | 4a, 2b |
| 10 | expression page · expression form · expression own · expression page, 3+ readings · no links | 3 | `Venerdì santi`, `torri fari`, `venerdì santi` | **rules disagree**: expression page, 3+ readings (2b, 6a) |
| 11 | no page (not-found) | 3 | `Stati eccitato`, `abbi torto`, `avere torta` | 1a |
| 12 | another word's record · own adjective · 1 reading · no links | 2 | `quasi anteriori`, `quasi posteriori` | 1c, 3a, 2b |
| 13 | another word's record · own noun · 1 reading · no links | 1 | `perossidi di idrogeno` | 1c, 3a, 2b |
| 14 | another word's record · own other · 3+ readings · links | 1 | `alberi a camme` | 1c, 3a, 2b |
| 15 | form-of adjective · 1 reading · no links | 1 | `politicamente scorretta` | 4c, 4a, 2b |
| 16 | lone-bare · 1 reading · no links | 1 | `fare notizie` | 1c, 2b |
| 17 | own adjective form record · 1 reading · no links | 1 | `priva di vita` | 3a, 2b |
| 18 | own noun · 1 reading · no links | 1 | `gallinelle del Signore` | 3a, 2b |
