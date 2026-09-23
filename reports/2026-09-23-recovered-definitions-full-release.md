# Definitions the extraction drops, counted exactly over the whole release

Measurement for [issue #28](https://github.com/hueypov/lexema/issues/28), phase two, run
2026-09-23. [Phase one](2026-09-23-recovered-definitions.md) counted the loss over the
2,210 raw pages committed under `fixtures/` and projected it onto the release from a
random sample. This report runs the same recovery over every Italian record in the
archive, against the page each one was extracted from, so its counts are exact and
replace that projection.

## The input: the dump the archive was built from

The archive was not re-fetched or changed. What was added is its raw page source.

Wiktextract builds the archive from a Wikimedia dump of Italian Wiktionary. It turns
each page's wikitext into records, and on the layout #28 is about it drops the
definitions. The dump still holds them. Huey approved reading it on 2026-09-23 (*"okay
do it"*), after being told what it is. **It is not newer data replacing ours.** It is
the page source the archive itself was converted from. It is read once, only to pick
up the definitions the conversion dropped. The archive stays as it is. Only the
recovered layer gains rows, and each row names the page and revision it was read from.
This is a one-time read that matches the archive, not a feed of new dumps
([ADR 0012](../.decisions/0012-archive-is-the-release-seed.md): raw pages at seed time,
only to recover dropped definitions; the dump is not chased).

| Fact | Value |
| --- | --- |
| File | `itwiktionary-20260701-pages-articles.xml.bz2` |
| From | `https://dumps.wikimedia.org/itwiktionary/20260701/`, downloaded once, 2026-09-23 |
| Size | 70,997,844 bytes; 826,706,104 unpacked |
| SHA-1 | `2bdd444236f7dcd26fee3652dbd641c31d0d9651`, equal to the `sha1` Wikimedia's `dumpstatus.json` lists for it (job `articlesdump`, `done`, updated 2026-07-03 03:46:04) |
| SHA-256 | `0e4232980291ec93de2a9885d89517c857a01c77c328557e129feca1779da38d` |
| Main-namespace pages | 758,429 |
| Newest revision in it | 2026-07-03T03:15:23Z |
| Durable copy | `source/` in `hueypov/lexema-data`, beside the archive |

Why this dump: the archive was written on 2026-07-16
([gzip header time](../docs/LICENSING.md#11-what-we-can-prove)), and Wiktextract builds
from the most recent dump. 2026-07-01 is the last one before that date. The file does
not name its dump, so this stays an inference
([LICENSING.md §1.3](../docs/LICENSING.md#13-the-one-reasonable-inference--and-its-limit)).
The data agrees with it: every one of the archive's 560,357 Italian records has a page
of its exact title in this dump.

`src/source/wiktionaryDump.ts` first checks the file's size and SHA-1 against the table
above and refuses a file that differs. It then streams the file through `bzip2 -dc` and
reads it line by line; it never holds the XML whole. Re-run with the dump in the repository root:
`pnpm run measure:recovery`, about 25 seconds. It writes every loss it finds to
`artifacts/recovery-measure.json`.

## Results over every Italian record

Archive `it-extract.jsonl.gz`, SHA-256 `0c432803c672…`, 560,357 Italian records.

| Count | Records |
| --- | ---: |
| Italian records | 560,357 |
| with no page in the dump | **0** |
| matched to exactly one page section | 558,142 |
| skipped: two sections with the same part of speech | 1,474 |
| skipped: no section with the record's part of speech | 519 |
| skipped: no Italian part-of-speech section the parser reads | 222 |
| **full loss** | **6** |
| **partial loss** | **442** |
| no loss | 557,694 |

**889 definitions recovered** across those 448 records, with the **17 examples** the page
attaches to them. By route: 17 below a page control, 561 sub-terms, 311 lead-in items
(the routes are defined in [phase one](2026-09-23-recovered-definitions.md#what-counts-as-a-lost-definition)).

**335 of the 889 sit in a list a definition opens with a colon**: 311 lead-in items and
24 sub-terms. **332 are placed inside that definition**, and the page shows them nested
there, not numbered as definitions of their own
([#123](https://github.com/hueypov/lexema/issues/123), counted by `measure:recovery` on
2026-09-23 and in a full seed). For 327 the definition that opens the list is a sense
the record carries (`accollato`'s `attributo araldico che si applica a:`). For 5 it is
itself a recovered definition (`lap steel guitar`, `pianoforte`).

An item is placed under a record sense only by text identity, checked on both sides.
The lead-in's `#` line is rendered as a reader sees it and compared with each gloss,
both with whitespace collapsed and one closing colon dropped. Nothing else is changed:
Wiktextract moves a line's usage labels (`{{Term|araldica|it}}`, `{{Est}}`) out of the
gloss into `topics`, `tags` and `raw_tags`, and the renderer drops the same templates.
Exactly one sense must have a gloss equal to that text, and no other `#` line in the
section may have it. A `#` line with a template the renderer does not know may read as
anything where that template prints, so it is told apart only by the words around it.
`{{Nodef}}` is the exception: it prints *definizione mancante; se vuoi, aggiungila tu*,
exactly the gloss of 9,370 archive senses, so it prints that. A gloss that only quotes
the line, or a sense that sits in the line's place, places nothing. This is a text
match, not a record of which page line a sense came from: the archive keeps no such
link. Two lines or two senses with one text, or a lead-in not glossed at all, leave
the items numbered at the top of the list.

Over the release, 121 `#` lines open a list of recovered items. 120 render to exactly
the text of one of their record's glosses, colon included; `filetto`'s is the other.
The check places the same 332 items as the earlier 40-character clause test, under the
same senses. Before the gap rule it placed 261. Each of the 71 it missed sat beside
another `#` line with a template the renderer does not know, so that line's text was
unknown: `{{it}}` for 28 (`-ismo`), `{{Nodef}}` for 23 (heraldic attributes such as
`armato` and `coperto`), `{{Vd}}` for 16 (`oro`, `gente`, `sposo`), `{{Taxon}}` for 3
(`grifone`) and both of the last two for 1 (`fico`).

The **3 unplaced** items are `filetto`'s heraldic ones. The record has a sense in the
right place, but it prints the line's `{{Pn|w=…}}` as `filetto ( approfondimento) detto
di:`, which is not the line's text. They stay numbered at the top of the list, as before
#123. 24 placements, spread across the 120 lead-ins, were read against their dump pages
on 2026-09-23 (`suolo`, `oro`, `fico`, `-ismo` twice, `-esimo`, `litania`, `liceo`,
`d'oro`, `metallico`, `digitato`, `brisura`, `arma di dipendenza`, `in banda`, and
heraldic attributes such as `troncato`, `incappucciato` and `controinquartato`). In each,
the items are the `#*` lines directly below the matched `#` line, and the sense they
are placed under glosses that line's text. A sample does not show every placement is
right; it shows the check did what it says on these.

**51 of the 889 are misfiled as examples:** the record carries the text, but under
`senses[].examples[]`, not as a definition. They sit in 18 records; 25 are `-ismo`'s
derivation lists, and the rest include `lap steel guitar` and `console steel guitar`'s
main definitions. The other 838 are nowhere in the record. One definition the page
states below `#` is already a gloss and is not recovered again. One line is marked a
definition but not rendered, because its template (`{{spreg}}`, in `quadro`) is unknown
to the renderer; it is reported, not printed wrong.

The six full losses are `casa` (7 definitions), `manuale` noun (4), `pianoforte` (3),
`lap steel guitar` (3), `console steel guitar` (1) and `colorito` adjective (1). By the
earlier reports' strata, 436 of the 448 records are lemma records (6 full, 430 partial)
and 12 are inflected (all partial, mostly sub-terms like `forza armata` under `armata`).

**Version drift.** No page in the dump is newer than the archive: its newest revision is
2026-07-03, thirteen days before the archive was written. So no record is read against
a later edit of its page. The committed fixtures are the other way round: they were
fetched in September, and 55 of the 2,210 were edited after this dump (`casa` is
revision 4257826 there and 4051358 here). A seed that reads the dump names the dump's
revision on every row.

**What is still not reached.** The 2,215 skipped records are not recovered. In the
1,474 with two same-named sections, only 9 records have any definition below `#` in
those sections, 22 lines at most. The 519 with no matching section have 4 such lines
between them, in any section of their page. The 222 with no section read mostly have a
part-of-speech heading in a form the parser does not accept (`{{-sost-|it|x}}`,
`{{-agg-|it|}}`, `{{-sost-|}}`), or are English words the archive labels Italian (#29).
Accepting those headings was tried: it matches 252 more records but recovers only four
more definitions (`nascente`, `steel bar`), so it is not in this change.
Plain-prose losses with no structural mark (`farsi`, `diametro`, `RIS` in phase one) are
still missed, as before.

## Exact counts against the phase one projection

| | Phase one (projected) | Exact, over the dump |
| --- | --- | ---: |
| Lemma records with partial loss | ~630 (95%: 340–1,150) | **430** |
| Inflected records with a loss | 0 (95%: 0–1,860) | **12** |
| Records with full loss | "too rare for the sample to see"; 5 furniture-only by a gloss scan | **6** |

430 is inside the projected interval, below its middle. The projection was the right
size; the exact count replaces it. Phase one's own 37 definitions over the fixtures are
unchanged by the fixes below.

## Correctness: three hand-read samples

Counts alone do not say the recovered lines are definitions. Each sample took 60 of the
recovered definitions spread across the alphabet: all of them sorted by title, cut into
60 equal runs, one drawn at random from each run (mulberry32, seeds 28, 2828 and 282828).
Every drawn line was read against its raw page, beside the line above it. The question
for each: is it a definition, or a quotation, an example or a page control?

**Before round 1.** The very first run recovered 949 definitions. Reading its nine
full losses by hand found three wrong: `fondarsi`, `ordito` and `soccorso`, whose lines
sit under `{{Nodef}}` — the page's own mark that it gives no definition — and are usage
sentences or bare terms. The first fix below took the run to 939.

**Round 1 (939 definitions): 4 wrong.** `discordia` (`'''Discordia''' tra
familiari.`, a usage sentence), `eppure` (`'''Eppure''', me l'avevano detto!`), `errare`
(a quotation with broken italics) and `famiglia` (an item under the page's own
`#Esempi:`).

**Fixes, all structural** (`src/italian/wikitext.ts`, tested in `test/recovery.test.ts`):

- Below `{{Nodef}}`, a line is not a definition by position. Only a bold sub-term that
  goes on to define itself still is (`colorito`: `'''espressione colorita''': utilizzo di
  termini volgari…`).
- A sub-term needs a comma, a colon or a bracket between the bold term and the prose
  that defines it. A bold word that runs straight into a sentence is the headword in a
  usage sentence.
- A line ending in `!` or `?` is something said, not a meaning.
- The items after `Esempi:` (or `Ad esempio:`, `Per esempio:`) are examples.

The last three removed 36 lines from round 1's run: 31 usage sentences, quotations or
example lists; one bare term (`atlante`); and four real definitions the comma-or-colon
rule now misses (`avorio`'s, written `'''avorio vegetale''' é quello…`). That trade was
taken on purpose: showing a usage sentence as a definition is the failure #28 exists to
stop.

**Round 2 (901 definitions): 2 wrong.** `croceo` and `paturnie`: italic quotations
followed by their author in brackets (`''I genitori trasmettono ai figli le loro
paturnie, le loro ubbie'' (Daniele Luttazzi)`). Fix: a closing attribution in brackets
does not stop a line counting as italic. It removed 12 lines, all literary quotations
(`croceo`, `glie`, `paturnie`, `puttanesimo`, `tacito`).

**Round 3, the final parser (889 definitions): no quotation, example or page control.**
38 of the 60 state a meaning. The other 22 are items of a list that a definition opens
with a colon, and they finish that definition rather than stand alone. Most are
heraldic: 11 follow `attributo araldico che si applica a:` (`accollato`, `armato`,
`fustato`, `gigliato`, `graticolato`, `illuminato`, `incappucciato`, `posto`,
`scorciato`, `semipartito`, `squamato`). The rest are `-ismo`'s derivation groups (2),
the books of `Giano` and `Samuele` (`II Samuele: 24 capitoli`), one of `radiorilevatore`'s
kinds, one of `libro`'s classes, a row of `virtù`'s virtues, two botanical forms
(`digitato`, `peltato`), one of `apparato`'s organ systems and one of `lutto`'s durations.
They are the page's definition text, which the extraction dropped. But a page that lists
them as numbered definitions of their own reads oddly. Huey ruled on 2026-09-23, choosing
among nest, flat, join into one line and drop: **"nest"**. Each item is stored with the
definition whose colon opens its list, and the page shows it nested inside that
definition, worded exactly as recovered and still marked *recovered*
([#123](https://github.com/hueypov/lexema/issues/123)). The rule is the page's layout, so
the items that define themselves in full nest too.

**This first said 53 and 7, and that was wrong.** The documentation review of the pull
request found three of the items counted as meanings (`accollato`, `armato`, `fustato`).
Re-reading all 60 against the dump then found twelve more. Two of the 22 are judgement
calls, counted as items: `apparato`'s `'''apparato visivo''': anche con riferimento al
sistema nervoso` and `lutto`'s `''lutto vedovile'' della durata di trecento giorni` are
worded as sub-terms, but neither says more than the lead-in above it. Four sub-terms
that also sit under a colon-ended line are counted as meanings, because each defines
itself in full: `d'oro`'s `nozze d'oro`, `metallico`'s `legame metallico`, `oro`'s
`schiavo dell'oro` and `suolo`'s `suolo a cuscinetto`.

One line outside the samples is known to be wrong and is left: `simpatia`'s
`'''simpatia''' del mare con la luna''`, an example that lost its opening italics.

## The full-release seed

Seeding the whole archive with the dump
(`SEED_INPUT=it-extract.jsonl.gz pnpm run seed:dev` into a new state directory under
`/tmp`) took 469 seconds and finished `complete`: every loaded row count matched the
generated SQL and the release row matched the run. The record tables hold exactly the
counts [IMPORT.md](../docs/IMPORT.md) lists for this archive (560,357 `source_record`,
1,273,490 `lookup_form`, 3,454,793 `grammar_claim`, …). The recovered layer added
443 `raw_page`, 889 `recovered_definition`, 56 `recovered_label` and 17
`recovered_example` rows. `casa`, `colorito`, `console steel guitar`, `fegato` and
`controrampante` were looked at on the word page at 1440 px against that database: each
shows its recovered definitions marked *recovered*, with a link to the dump revision.

## Round 3, line by line

Title and page line of each sampled definition, in draw order. *m*: states a meaning;
*i*: an item that finishes a definition ending in a colon.

`-ismo` 11 i · `-ismo` 25 i · `abuso` 11 m · `accollato` 11 i · `affare` 9 m ·
`amore` 7 m · `antisemita` 5 m · `apparato` 8 i · `armato` 9 i · `attribuzione` 6 m ·
`automobilistico` 7 m · `biochimica` 10 m · `burocratico` 5 m · `calcolatrice` 11 m ·
`casa` 10 m · `cocktail` 5 m · `computer` 10 m · `consulente` 9 m · `controllo` 8 m ·
`cruento` 6 m · `d'oro` 19 m · `digitato` 6 i · `diritto` 27 m · `economia` 9 m ·
`elettronica` 12 m · `equazione` 7 m · `excursus` 5 m · `fisica` 13 m · `focaccia` 12 m ·
`fustato` 6 i · `Giano` 7 i · `gigliato` 6 i · `graticolato` 7 i · `illuminato` 8 i ·
`incappucciato` 11 i · `ingegneria` 9 m · `internazionale` 7 m · `libro` 17 i ·
`lutto` 8 i · `manuale` 13 m · `mercato` 10 m · `metallico` 14 m · `nutrizionale` 6 m ·
`oro` 59 m · `peltato` 7 i · `pizza` 9 m · `posto` 10 i · `pressione` 13 m ·
`radiorilevatore` 9 i · `repubblica` 6 m · `sacro` 6 m · `Samuele` 8 i · `scorciato` 6 i ·
`semipartito` 5 i · `somma` 10 m · `squamato` 7 i · `suolo` 10 m · `transigere` 10 m ·
`tributario` 6 m · `virtù` 12 i

## Attribution

Page content quoted here is from Italian Wiktionary, CC BY-SA 4.0, at the revisions in
the 2026-07-01 dump named above.
