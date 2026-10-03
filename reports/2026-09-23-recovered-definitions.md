# Definitions the extraction drops, measured and recovered from the raw pages

> **Superseded in part, 2026-09-23.** [Phase two](2026-09-23-recovered-definitions-full-release.md)
> counted the loss exactly over every Italian record, against the Wiktionary dump the
> archive was built from. Its exact counts replace this report's extrapolation: 430
> lemma records with partial loss, not ~630; 12 inflected records, not 0; 6 with full
> loss. Across the whole dump it also found the parser described below reading some
> usage sentences and quotations as definitions; that is fixed, and this report's own
> 37 definitions over the fixtures are unchanged by the fix. The sections below are kept as they were measured.

Measurement for [issue #28](https://github.com/povlabs/lexema/issues/28), run 2026-09-23.
It follows [why `casa` has no definition](2026-09-18-definition-loss.md), which named the
cause; this report counts full and partial loss with the parser that now recovers it, and
says what the count means for the whole release.

Source file: `it-extract.jsonl.gz`, SHA-256
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`, 560,357 Italian
records. Raw pages: the 2,210 committed under `fixtures/` — 2,200 sampled pages in
`fixtures/upstream-wikitext/` and 10 regression pages in `fixtures/upstream-pages/`. No
new upstream input was fetched. Re-run with `pnpm run measure:recovery`; it streams the
archive once, takes about five seconds, and writes every loss it finds to
`artifacts/recovery-measure.json`.

## What counts as a lost definition

A record loses a definition when its raw page states one on a line below `#` and none of
the record's glosses carries that text. Which lines below `#` are definitions is decided
by the page's markup only (`src/italian/wikitext.ts`), never by a list of words:

| Route | Structure | Example |
| --- | --- | --- |
| below a page control | a `#` line with no prose of its own — headword template, gender/number stamp, plural link — and non-italic lines one level down | `casa`: `# {{Pn|w}} ''f sing'' {{Linkp|case}}`, then seven `#*` definitions |
| sub-term | a line below a definition that opens with a bold term and goes on in plain prose | `classico`: `#*'''liceo classico''', indirizzo della scuola…` |
| lead-in item | a plain line below a definition that ends with a colon | `posto`: `# … attributo araldico che si applica a:`, then three `#*` meanings |

An italic line below a definition is a usage sentence and is attached to it as an
example. A line that opens with a quotation mark is a quotation. Anything else below a
`#` sense — a plain usage sentence, a book citation — is left exactly as the extraction
left it. Each record is matched to the one page section whose part-of-speech heading the
extraction titles as the record's `pos_title`; a record with no such section, or with two,
is counted and skipped.

*Full* loss: the record's section states no sense on a `#` line, so the record carries no
extracted definition — only furniture, and in `lap steel guitar`'s case its main definition
misfiled as an example. *Partial* loss: the record keeps at least one sense and misses at least one
definition below it.

## Results over every record with a raw page

| Count | Records |
| --- | ---: |
| Italian records whose word has a raw page | 2,571 |
| matched to exactly one page section | 2,522 |
| skipped: two sections with the same part of speech | 41 |
| skipped: no section with the record's part of speech | 7 |
| skipped: page has no Italian section | 1 |
| **full loss** | **4** |
| **partial loss** | **14** |
| no loss | 2,504 |

**37 definitions recovered** across those 18 records — 36 lost outright and 1 misfiled — with the 12 examples the page attaches to
them. By route: 13 below a page control, 19 sub-terms, 5 lead-in items. One of the 37 —
`lap steel guitar`'s main definition — is in the record, filed under `examples[].text`;
the other 36 are nowhere in it. No matched definition was already a gloss, and none was
left unrendered.

The four full losses are `casa` (7 definitions), `manuale` noun (4), `pianoforte` (3) and
`lap steel guitar` (3). The fourteen partial losses are `serata`, `forma`, `musicale`,
`osso`, `partita`, `acustica`, `canzone`, `classico` adjective, `posto` adjective,
`servizio`, `esornativo`, `burocratico`, `rivelazione` and `dittatoriale`. None of the 41
skipped records has a section with anything below its `#` lines, so the skip hides no
loss.

Every one of the 37 was read by hand before this report and states a meaning. A first run
also flagged `acqua di cedro`, whose sense ends in a colon and introduces a novel
quotation; the quotation-mark rule was added for it, so that rule was fitted to this data.

## Checked against the earlier hand labels

The 2026-09-18 report's reviewers confirmed 12 lemma records by hand. This parser finds
9 of them. It misses three whose lost line has no structural mark: `farsi` (a plain lead-in
on a `#*` line), `diametro` (a plain continuation of the sense above) and `RIS` (a plain
`#*` definition under a `#` that spells the acronym). It also finds one record the
italic-based classifier could not see, `rivelazione`, whose sub-term line carries an
incidental italic. It recovers none of the three lines the reviewers ruled usage
sentences (`incignare`, `virgulto`, `spiluccare`).

So the structural rules trade a little recall for precision: they recover nothing a
reviewer rejected, and they miss plain-prose losses that only a reader of the Italian can
tell from a usage sentence.

## Extrapolation to the full release

*Replaced by the exact counts in [phase two](2026-09-23-recovered-definitions-full-release.md#exact-counts-against-the-phase-one-projection).*

Only the uniformly sampled records may be projected, because only they were drawn at
random ([the sampling](2026-09-18-definition-loss.md#3-blast-radius)). The regression
pages were chosen because they were broken.

| Stratum | Population | Scored | Losing a definition | Rate, 95% Wilson | Projected records |
| --- | ---: | ---: | ---: | --- | ---: |
| Lemma | 74,098 | 1,177 | 10 (all partial) | 0.85% (0.46%–1.56%) | **~630 (340–1,150)** |
| Inflected | 486,259 | 1,000 | 0 | 0% (0%–0.38%) | 0 (0–1,860) |

**Partial loss: roughly 630 lemma records, with a 95% interval of 340 to 1,150.** Read it as
a floor on what these rules can recover, not on the true loss: the three misses above say
some plain-prose losses have no structural mark at all. The inflected stratum's upper
bound is a statistical ceiling from a zero count, not an expectation; an inflected record
is a form-of pointer with almost nothing below its `#` lines.

**Full loss is too rare for the sample to see.** No sampled record had it (0 of 1,177
lemma records, so at most about 0.33%, or 240 records, at 95%). The whole archive gives a
tighter answer: a scan for records whose every gloss is the headword plus
`( approfondimento)` or `( citazioni)` finds 6, and 5 of them have glosses that are furniture only — the
four above and `console steel guitar`, whose raw page is not in `fixtures/`. (Their glosses are
furniture; `lap steel guitar` still carries its main definition, misfiled as an example.) The sixth,
`controbastone`, keeps a definition inside its gloss. That scan only sees headers that
link to Wikipedia, so the true count is higher, but by the sample's bound not by more than
a few hundred, and most likely by far less.

## What a full-release run needs

*Done in [phase two](2026-09-23-recovered-definitions-full-release.md), from the
2026-07-01 Italian Wiktionary dump.*

These counts cover the 2,210 words whose raw pages are committed. Recovering the rest
needs the raw page of every Italian entry, which means a second upstream input — most
likely an Italian Wiktionary database dump. That input is not decided and nothing here
fetches it. The layer is built so a dump can feed it through the same `RawPageSource`
(`src/source/rawPage.ts`); the run would also need the dump's revision per title, since
every recovered row names one, and a fresh measurement of version skew between the dump and
the archive, because a page edited after the archive was built can move a definition
between `#` and `#*`.

## Attribution

Page content quoted here is from Italian Wiktionary, CC BY-SA 4.0, at the revisions saved
in `fixtures/upstream-pages/` and `fixtures/upstream-wikitext/`
([their provenance](../fixtures/upstream-wikitext/PROVENANCE.md)).
