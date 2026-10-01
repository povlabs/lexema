# Dictionary quality past the twelve words, 2026-10-01

Measurement for [#17](https://github.com/hueypov/lexema/issues/17). The
[spot check](2026-09-18-dataset-spot-check.md) read twelve hand-picked words. This
report asks how the whole release reads: whether a record shows a definition at
all, whether that definition is any use, and which grammar fields are stated,
missing, unclassified, disputed or unsupported. Nothing in the source was edited.

Two kinds of number are kept apart throughout:

- **Whole-release counts.** Exact for this archive. They count what the source
  states and fails to state. They say nothing about whether the Italian is right.
- **A hand-labelled sample.** 200 records, 25 from each of eight strata, each read
  by hand. Its rates describe those strata at the precision a sample of 25 allows,
  and they are not a dictionary-wide accuracy figure.

## Setup

- Release `it-0c432803`: `it-extract.jsonl.gz`, SHA-256
  `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`, 560,357
  Italian records of 799,600 lines. The other 239,243 are another language; none
  is malformed.
- Raw pages: `itwiktionary-20260701-pages-articles.xml.bz2`, the dump the archive
  was built from ([its identity](2026-09-23-recovered-definitions-full-release.md#the-input-the-dump-the-archive-was-built-from)).
  Read only for the recovered layer and to ask whether a page exists.
- Code: [`src/italian/recordQuality.ts`](../src/italian/recordQuality.ts) names what
  a sense holds and runs the other checks;
  [`src/import/measureQuality.ts`](../src/import/measureQuality.ts) streams the
  archive twice and writes `artifacts/quality-measure.json`.
- The word page's rule for which senses it numbers now lives in
  [`src/italian/furniture.ts`](../src/italian/furniture.ts) as `splitSenses`. The
  page and this measurement both call it on every sense, so the furniture class
  measured here is the class the page hides.

Re-run, with both files in the repository root (about 45 seconds):

```sh
pnpm run measure:quality draw   # rewrites fixtures/quality-sample/sample.json; same archive, same sample
pnpm run measure:quality        # the counts, and the sample scored against its hand labels
```

The second command refuses to print a usefulness rate while any sampled record
lacks a hand label, and refuses a sample whose lines do not match the archive.

## The sample

`draw` hashes `it-quality-sample/v1`, the stratum name and each member record's
line SHA-256, and keeps the 25 lowest hashes per stratum. The same archive always
gives the same 200 records. They are in
[`fixtures/quality-sample/sample.json`](../fixtures/quality-sample/sample.json); no
record fell in two strata.

| Stratum | Rule | Population |
| --- | --- | ---: |
| common | headword is one of the 1,000 most frequent tokens in the archive's own usage sentences | 1,682 |
| noun | noun record, not a form-of record | 37,151 |
| verb | verb record, not a form-of record | 7,865 |
| adjective | adjective record, not a form-of record | 14,961 |
| inflection | a sense names the word it inflects (`form_of`) | 485,444 |
| ambiguous | headword spelled by two or more Italian records | 35,902 |
| accented | headword holds an accented letter | 33,018 |
| thin | not form-of, at most one gloss, no example, no forms table | 28,349 |

**How this biases it.**

- The strata are not the dictionary's proportions. Form-of records are 87% of the
  release and one stratum in eight here. So the strata cannot be pooled into one
  rate.
- "Common" is common in Wiktionary's example sentences, not in Italian. No outside
  frequency list was read. Its top is function words (`di`, `il`, `la`, `è`), and
  it favours words editors chose to illustrate.
- "Accented" is mostly future and past-remote verb forms (`inquinerò`, `filtrò`):
  23 of its 25 are form-of records. It says little about accented lemmas.
- A hash rule is uniform within a stratum, but 25 is small. One bad record moves a
  rate by 4 points.

## Useful definition, measured apart from a non-empty gloss array

### Over the whole release

Each sense was read the way the word page reads it: Wikizionario's "definizione
mancante" sentence taken out (#255), headword lines hidden when anything else is
there (the furniture rule), and recovered definitions added (#28).

| What a record's strongest sense holds | Records |
| --- | ---: |
| a gloss stating a meaning | 68,356 |
| a form-of pointer (`plurale di casa`) | 485,046 |
| only the "definizione mancante" placeholder | 6,282 |
| only bare headword lines (`casa ( approfondimento) f sing`) | 5 |
| only a headword line that goes on to state something | 1 |
| no gloss at all | 667 |
| **All Italian records** | **560,357** |

- **559,690** records have a non-empty gloss array (99.88%).
- **553,413** show at least one definition on the page (98.76%).
- **6,279** records have gloss text and show nothing. Nearly all of them hold only
  the placeholder. Apart from those, 667 records have no gloss at all; Wiktionary has no
  definition for 665 of them ([definition-loss report](2026-09-18-definition-loss.md#what-is-not-the-cause)),
  and the recovered layer reads one back for two.
- **10** records have a meaning only through the recovered layer, `casa` among them.

### How big the furniture class really is

The page refuses a gloss of `word` that is `word ( citazioni)` or starts with
`word ( approfondimento)` (`isFurnitureGloss`). It calls a sense furniture when
every gloss is one of those and no recovered list hangs under it. Nothing else
about the sense counts, a `form_of` pointer included. That rule matches **22
glosses in 18 records**, out of 560,357. It is the smallest of the "non-empty but
not a definition" classes. The placeholder covers 9,362 senses in 8,538 records,
which `withoutPlaceholder` already drops; in 6,282 of those records no sense says
more.

Ten of the 22 are bare headword lines, in `casa`, `verde`, `pianoforte`, `punta`,
`manuale`, `lap steel guitar` and `console steel guitar`. Hiding them is right.

The other twelve start as a headword line and go on to say something. Read by hand:

| Record (archive line) | What follows the marker | Page today |
| --- | --- | --- |
| `do` (10367) | *di petto: do acuto posto due ottave sopra il do centrale…* | hidden |
| `palo` (43791) | *pezza onorevole … che occupa verticalmente la parte centrale dello scudo…* | hidden |
| `banda` (45622) | *pezza onorevole … andamento diagonale…* | hidden |
| `biglietto` (47955) | *piccolo rettangolo posto in verticale…* | hidden |
| `balzana` (56392) | *partizione orizzontale a metà, dello scudo…*; the sense also carries a stray `form_of` to `troncato` | hidden |
| `fascia` (78801) | *pezza onorevole … orizzontalmente…* | hidden |
| `cinta` (110548) | *bordura larga la metà del normale…* | hidden |
| `sbarra` (122502), two glosses | the heraldic bar, and the gymnastics bar | hidden |
| `controbastone` (123172) | *una sbarra molto diminuita in larghezza…* | shown: nothing else to show |
| `orlo` (52120) | *vedi orlatura*, a cross-reference | hidden |
| `filetto` (40204) | *detto di:*, a lead-in to three recovered items | hidden; its items show |

So **the rule hides a real definition in 8 records (9 glosses)**, plus `orlo`'s
cross-reference. Of those eight, only `banda` gets anything from the recovered
layer (one definition), and whether that is the hidden one was not checked. This
is a defect in the page rule, not in the data.

### The sample, read by hand

A record is **useful** when something the page shows tells a reader what the word
means, or names the word it is a form, variant or synonym of. Each label and its
reason is in [`hand-labels.json`](../fixtures/quality-sample/hand-labels.json).
Correctness was not judged: a gloss that states a meaning counts, right or wrong.

| Stratum | Gloss text | Shows a definition | Useful | 95% interval |
| --- | ---: | ---: | ---: | --- |
| common | 25/25 | 25/25 | 24/25 | 80–99% |
| noun | 25/25 | 24/25 | 23/25 | 75–98% |
| verb | 25/25 | 24/25 | 24/25 | 80–99% |
| adjective | 25/25 | 24/25 | 24/25 | 80–99% |
| inflection | 25/25 | 25/25 | 25/25 | 87–100% |
| ambiguous | 25/25 | 24/25 | 23/25 | 75–98% |
| accented | 25/25 | 25/25 | 25/25 | 87–100% |
| thin | 24/25 | 22/25 | 22/25 | 70–96% |

Ten records are not useful. Seven show nothing: six placeholders (`rifritto`,
`ergersi`, `risposto`, `brut`, `sportsman`, `acconciatore`) and one with no gloss
(`perturbabile`). Three show a gloss that says nothing:

- `ma` (interjection): the gloss is `mah`. It respells the word.
- `procinto`: *usato solo nella locuzione "in procinto di"*. It says where, not what.
- `rigermoglio` (verb, line 367333): *prima persona singolare dell'indicativo
  presente 1° persona singolare dell'indicativo presente*. It never names the verb
  and carries no `form_of`.

These three are what "shows a definition" cannot see. The placeholder already
makes "non-empty" overstate; on this sample, "shows a definition" overstates
"useful" by 3 records in 200.

## Fields counted against stated denominators

The words mean:

- **missing**: the importer expects the field ([`grammarPolicy.ts`](../src/import/grammarPolicy.ts)) and no structural tag states it.
- **unclassified**: no structural tag states it, and a free-text `raw_tags` entry
  names it. The importer keeps that text verbatim and does not map it.
  `rawTextNames` ([`recordQuality.ts`](../src/italian/recordQuality.ts)) decides
  "names it": a gender or number stamp or word (`f.sing.`, `s.m.inv.`, `msing`,
  `solo maschile`, `pl.: case`). Register and field labels such as `diritto`,
  `scuola` or `forestierismo` name neither, so a record carrying only those is
  missing, not unclassified.
- **disputed**: two parts of the source state different values for one fact.
- **unsupported**: a claim the source's other evidence does not back. Its target
  has no record, or the target's table does not list it.

### Definitions

Denominator: all 560,357 records. 553,413 show one. 6,944 show none: 6,279
with gloss text, nearly all placeholder-only, and 665 with no gloss. 10 records
have their meaning only through recovery.

### Gender and number

Denominator: records whose part of speech the importer expects gender and number
on (noun, adjective, proper name). One proper-name form-of record, which states
one gender and one number, is left out of the table.

"Both" counts records whose own tags state two or more values of one dimension.
It means a different thing on each dimension:

- **Gender.** Every one is masculine and feminine together. That is common gender
  (`cantante`).
- **Number.** Two or three of `singular`, `plural` and `invariable`, in 147
  records. 94 of them have `invariable` beside `singular` or `plural` (`verde`);
  `crudeltà` and `logo` carry all three. The other 53 have `singular` and
  `plural`. The ones read by hand (`khmer`, `barmaid`, `ingegnere`, `cialtrone`,
  `avventuriere`, `molle`) are one spelling used in both numbers. Either the word
  does not change (`khmer`), or it is a homograph across genders: `cialtrone` is
  masculine singular, and also the feminine plural of `cialtrona`.

Neither is counted as disputed. Both values come from the one tag list, and they
do not contradict each other. Not all 53 `singular`-and-`plural` records were read
by hand.

The two "Missing" columns split on whether the record carries raw text about
something else.

| Records | Dimension | Denominator | Stated, one value | Both | Unclassified | Missing, other raw text | Missing, no raw text |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| noun lemmas | gender | 37,151 | 31,169 | 1,508 | 64 | 626 | 3,784 |
| noun lemmas | number | 37,151 | 27,442 | 92 | 170 | 1,609 | 7,838 |
| adjective lemmas | gender | 14,961 | 9,129 | 3,053 | 21 | 188 | 2,570 |
| adjective lemmas | number | 14,961 | 11,054 | 26 | 64 | 261 | 3,556 |
| proper-name lemmas | gender | 4,837 | 3,732 | 96 | 2 | 24 | 983 |
| proper-name lemmas | number | 4,837 | 210 | 3 | 0 | 45 | 4,579 |
| noun form-of | gender | 15,734 | 14,852 | 348 | 7 | 6 | 521 |
| noun form-of | number | 15,734 | 11,758 | 12 | 11 | 42 | 3,911 |
| adjective form-of | gender | 15,527 | 12,092 | 2,865 | 10 | 6 | 554 |
| adjective form-of | number | 15,527 | 12,127 | 14 | 27 | 22 | 3,337 |

Unclassified is small: 64 noun lemmas have a gender only in free text. `casa` is
not one of them. Its one raw tag, `pl.: case`, names its plural, so its number is
unclassified and its gender is missing. **1 noun lemma in 8 has no structural
gender (4,474 of 37,151), so no article can be generated for it.**

### Verb mood on conjugation rows

Denominator: `forms[]` rows of verb lemma records that the importer owes a mood,
because they state person, number or tense and no mood. That is 487,492 of
545,270 rows.

- No row states indicative, subjunctive or conditional structurally, so all
  487,492 are **missing** a structural mood.
- Rule `it-moods/v1` reads one from the tags and the pronoun for **487,460** of
  them. It leaves **32** unplaced.

The importer also owes a mood to 69,947 rows on form-of verb records. Of those,
69,737 are a participle's gender and number forms (`accentuata`, `accentuati`).
They are no cell of any table, and expecting a mood of them is a policy artefact,
not a gap in the data.

### Form-of targets

Denominator: 608,726 `form_of` edges.

| Target word is carried by | Any part of speech | Same part of speech |
| --- | ---: | ---: |
| exactly one record (resolved) | 279,647 | 292,144 |
| two or more (ambiguous) | 43,749 | 28,673 |
| no record (dangling; **unsupported**) | 285,330 | 287,909 |

**Dangling is the largest finding here: 47% of all form-of edges name a word with
no record.** 9,064 distinct target words are dangling.

- **8,960 have no page at all** in the dump. That is 282,814 edges, almost all
  verb forms: `rattenere`, `ricredere`, `giustapporre`. Wiktionary has pages for
  their inflected forms but not for the verb itself.
- **104 have a page, and the extraction made no Italian record of it.** That is
  2,516 edges. They include everyday verbs: `raccontare`, `fornire`, `dipendere`,
  `educare`, `tremare`, `smentire`, `congedare`. The repository's own page parser
  finds no Italian part-of-speech section on any of the 104. The pages use layouts
  both parsers miss:
  - `raccontare` puts `{{Transitivo|it}}` where a part-of-speech heading should be.
  - `fornire` has `{{-verb-|it}}` but no `{{-it-}}` language heading.
  - `campire` is a bare stub marked `{{W}}`.
  - `translatare` holds only a Romanian section.

  Searching `raccontare` therefore finds no lemma, while 54 form-of pointers
  each say "… di raccontare".

Ambiguous targets are mostly one word split over two records. 579 verb words have
two or more verb lemma records. Reading their record tags, 549 of those are split
by transitivity: `chiudere` is one transitive and one intransitive record, each
with its own copy of the table. 413
noun words have two or more noun records, as `bello` does. `bella` the noun points
at `bello`, and nothing says which.

### Mood named in a verb form's gloss, against the target's table

Denominator: 576,990 verb form-of senses. Of these, 147 name no single mood. The
check reads the mood a form-of gloss names in prose (`… del condizionale presente
di parlare`). It then asks the target's own conjugation table where `it-moods/v1`
places that spelling. Prose is read here only to measure. No claim is made from it.

| Answer | Senses |
| --- | ---: |
| the table lists the spelling under that mood (corroborated) | 247,453 |
| the table lists it, never under that mood (elsewhere) | 4,377 |
| the table does not list it (unlisted; **unsupported**) | 15,499 |
| no table: the target has no record (282,587) or a record with no `forms` (26,927) | 309,514 |

- **`parlerei`**: the gloss says condizionale, and `it-moods/v1` places it there.
  Corroborated.
- **Elsewhere, 4,377.** 4,353 are feminine or plural participles. A table lists a
  participle once, masculine singular, so `create`, *participio passato femminile
  plurale di creare*, finds only *voi create*. That is a homograph, not a dispute.
  The other 24 were read by hand against the table's own cell:
  - **15 are disputed**: the gloss and the table give different spellings for one
    cell. Examples:
    - `voga`: the gloss says *congiuntivo presente, lui/lei*; the table's cell is `voghi`.
    - `intimate`: the gloss says congiuntivo; the table's cell is `intimiate`.
    - `prospettava`: the gloss says imperativo; the table's cell is `prospetta`.
    - `devia`: the gloss says imperativo; the table's cell is `devii`.
    - `sottoponga`: the gloss says imperativo; the table's cell is `sottopona`.
    - `contenete`: the gloss says imperativo; the table's cell is `conteniate`.

    Which side is right was not checked against a grammar. Some look like table
    errors (`sottopona`, `scompai`, `reppellereste`), others like gloss errors.
  - **`intaglio`** is a 16th: it calls itself *participio presente di intagliare*,
    and the table's present participle is `intagliante`.
  - The last eight are not disputes:
    - five shortened participles the table does not list (`urto`, `domo`, `aduso`,
      `sgombero`, `sfracello`);
    - `edito` beside the table's `editato`;
    - two feminine plurals whose gloss omits the gender (`erudite`, `rilasciate`).
- **Unlisted, 15,499.** 14,664 are feminine or plural participles, which no table
  lists. The other 835 include:
  - **`studente`**, *participio presente di studiare*: `studiare`'s table gives
    `studiante`. This is the spot check's conflicting claim, now a counted case.
  - `riceva`, *terza persona singolare dell'imperativo di temere*: the gloss names
    the wrong verb.
  - pronominal lemmas whose table writes `mi arrendo`, so `arrendessi` matches no
    row.

  These were not read one by one.

### Duplicate embedded forms

Denominator: the 80,931 records with a `forms` table. A spelling listed twice in
one record falls in one of three cases:

| Relation | Records | Groups | Example |
| --- | ---: | ---: | --- |
| identical tags | 52 | 1,876 | `gallo` lists `galli` *masculine plural* twice; 26 verb records repeat rows of their table (`abbisognare` repeats its gerund, participles and finite rows) |
| one entry's tags inside the other's | 169 | 169 | `studente` lists `studenti` as *masculine plural* and again as *plural* |
| different cells, one spelling | 6,552 | 63,701 | `studiare`'s `studi`: indicativo *tu*, three congiuntivo persons and an imperativo. This is the language, not a defect |

The first two cases, 221 records, are true duplicates. A page that lists forms
should show each spelling once per cell.

## Regression cases

[`test/recordQuality.test.ts`](../test/recordQuality.test.ts) runs in CI. It reads
verbatim archive lines: the spot check's words from
[`fixtures/dev-seed.jsonl`](../fixtures/dev-seed.jsonl), and seven more from
[`fixtures/quality-regressions.jsonl`](../fixtures/quality-regressions.jsonl)
(archive lines 196, 43791, 56392, 139668, 140523, 226888, 429722).

| Case | What it pins |
| --- | --- |
| `casa` | a non-empty gloss array of two headword lines; the page shows them only until the raw page's seven definitions are recovered. Its raw tag `pl.: case` names number, not gender |
| `parlerei` | the condizionale its gloss names is where `it-moods/v1` places it in `parlare`'s table |
| `studente` | the verb record's present participle is unlisted; `studiare`'s table gives `studiante` |
| `bella` | the noun's target `bello` is three records, two of them nouns: ambiguous |
| `sale` | three records, a meaning and two form-of pointers; `sala` resolves only within its part of speech |
| duplicate embedded forms | `studente`'s `studenti` (subsumed), `gallo`'s `galli` (identical), `studiare`'s `studi` (distinct cells) |
| `palo` | the furniture rule hides a headword line that states a heraldic meaning |
| `balzana` | a headword line with a stray `form_of` is furniture all the same, as the page reads it |
| `rifritto` | a gloss array holding only the placeholder shows nothing |
| `voga` | the gloss's congiuntivo cell is `voghi` in `vogare`'s table |
| `raccontavo` | a form-of record whose lemma, `raccontare`, has no record |

## Limits

- **No accuracy claim.** The whole-release counts measure what the source states
  and whether its parts agree. They do not measure whether the Italian is right. The
  sample's "useful" means "states something", not "states it correctly". No grammar
  authority was consulted.
- **The sample is small and unpooled.** Each stratum's 95% interval is about 20
  points wide. The strata overlap in the population, not in the drawn records, and
  they do not weight to the release.
- **One reader.** The hand labels are one person's reading, with no second reader.
  The borderline calls are the three "says nothing" records above.
- **Prose read to measure.** `glossMood` takes the one mood word a gloss names. A
  gloss naming two, or none, is not compared (147 senses).
- **Unclassified is a floor.** `rawTextNames` reads stamps and grammar words as
  written. A misspelt stamp (`simg`, `fsin`) or a bare `s` names nothing, so its
  record counts as missing.
- **The disputes are a floor.** Only 24 "elsewhere" answers were read by hand. A
  mismatch inside the 4,353 participle homographs, or among the 835 unlisted, is
  not counted.
- **Page existence is the July dump's.** A lemma page created after 2026-07-01 is
  counted as absent. This matches the archive, not today's Wiktionary.

## Follow-up

- The furniture rule hiding real definitions (`palo`, `banda`, `sbarra`, `balzana`, …) is a
  page defect with a clear fix: hide a headword line only when nothing but stamps
  follows the marker ([#325](https://github.com/hueypov/lexema/issues/325)).
- The 104 lemma pages the extraction skips (`raccontare`, `fornire`, `dipendere`)
  are missing records, not missing fields. Whether to recover whole records from
  raw pages is a data decision, like [#28](https://github.com/hueypov/lexema/issues/28) was
  ([#326](https://github.com/hueypov/lexema/issues/326)).
