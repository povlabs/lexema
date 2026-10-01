# Other languages' entries tagged `lang_code: "it"`

Investigation for [issue #29](https://github.com/hueypov/lexema/issues/29), run 2026-10-01.
It follows up a side finding of [the definition-loss investigation](2026-09-18-definition-loss.md)
(§3: `curie`, `dolmen` and `arteria`).

Inputs: the archive `it-extract.jsonl.gz` (SHA-256 `0c432803c672…`, 560,357 Italian
records) and the Italian Wiktionary dump it was built from,
`itwiktionary-20260701-pages-articles.xml.bz2`, checked against its published SHA-1
before any page is read (identity and provenance in
[the full-release recovery report](2026-09-23-recovered-definitions-full-release.md#the-input-the-dump-the-archive-was-built-from)).
No record was edited.

To re-run, put both files in the repository root and run
`pnpm run measure:section-language` (about a minute). The regression cases run in CI
as `test/sectionLanguage.test.ts`.

## 1. The pattern, checked against the page source

**Confirmed, but the cause is not the one the issue guessed.** Nothing is inherited
from a previous section. Wiktextract gives a record the language of the `== {{-xx-}} ==`
heading it sits under, and reads nothing else: `lang_code` is the name of that
heading's first template, and the part-of-speech template's own language argument is
never read
([`extractor/it/page.py`, lines 69–86](https://github.com/tatuylonen/wiktextract/blob/b67e9cb3a7aa8eca65903dcf40a4aa8899be140a/src/wiktextract/extractor/it/page.py#L69-L86);
that file has not changed since 2025-06-13, before the archive was built on 2026-07-16).
So any entry a page puts under its Italian heading comes out Italian, whatever
language it is.

The pages do that in four ways. Each quote is from the dump's revision.

**A language line instead of a heading** — `curie`, revision 3539009. The Dutch
entry opens with a bare `{{-nl-}}` line. That is not a level-2 heading, so no Dutch
section starts and the block stays inside the Italian one:

```wikitext
{{-nl-}}
{{-pron-}}
{{Audio|nl-curie.ogg}}
{{-sost-}}
# '''curie'''
```

**A late heading naming another language** — `dolmen`, revision 4055841. After the
Italian entry's translation box comes `{{-sost-|en}}` with no `== {{-en-}} ==` above it:

```wikitext
{{-trad-}}
{{Trad1|}}
:*{{en}}: [[dolmen]]
{{Trad2}}

{{-sost-|en}}
{{Pn}}
#[[dolmen]]
```

**A whole page in the wrong section** — `hatefulness`, revision 4058628. The page is
an English entry, and its only heading is `== {{-it-}} ==`:

```wikitext
== {{-it-}} ==
{{-sost-|en}}
{{Pn}}
#[[odiosità]], [[odio]], [[astio]]
```

**No mark at all** — `arteria`, revision 4032543. A Latin entry after the translation
box, headed `{{-sost-|it}}`. Only its usage label `{{Term|anatomia|la}}` and the
references (`*latino`) say it is Latin.

The issue's hypothesis was that a heading with no language, `{{-sost-}}`, takes the
previous section's. It does not: on these pages there is no previous section, only
the Italian one. Such headings are mostly Italian. They head 218 lined-up records, and
7 of those are another language. `sdrucciolo`'s noun, an Italian entry, is one of the
other 211.

## 2. Reach

**About fifty records, not thousands: 52 found by hand, at most about 64 (95%).**

### Method

A census, not a sample. Every Italian record is lined up with the block of its page
it came from. Wiktextract writes a page's records in page order, so a title's records
and the part-of-speech blocks under its Italian heading pair up one to one when their
parts of speech agree. That holds for 558,912 of the 560,357 records (540,448 of
541,247 titles). The other 1,445 records, on 799 titles, are left out of the
structural signals and counted.

Six signals nominate a record. Four read the page's structure; two read only the
record's text and exist to test what the structural ones miss:

| Signal | Records | Another language |
| --- | ---: | ---: |
| Language line above the block | 6 | 6 |
| Heading names another language, below the translation box | 18 | 18 |
| Heading names another language, anywhere | 96 | 43 |
| Below the translation box, heading names no other language | 18 | 4 |
| **Any structural signal** | **119** | **52** |
| Every gloss repeats the headword | 28 | 13 |
| A topic category names another language (`Anatomia-LA`) | 42 | 6 |

All 169 nominated records were read on their page and labelled by hand, each with a
written reason, in
[`fixtures/section-language/labels.json`](../fixtures/section-language/labels.json).
The script refuses to print a rate while any nominated record is unlabelled.

### Result

52 records on 43 titles are another language's entry: 40 English, 6 Latin, 2
Sicilian, and one each Dutch, Spanish, Interlingua and Venetian. That is 0.009% of the
Italian records.

### Error bars

The 52 are counted, not estimated. The uncertainty is what no signal points at. The
two text signals find 17 other-language records without looking at structure, and
the structural signals find all 17: recall 17/17, at least 81.6% at 95% (Wilson). If
that recall holds for other misses too, the whole population is at most 52 / 0.816 ≈
64.

Two things weaken that bound, and neither can be measured from what is here:

- The text signals favour stub entries (a gloss that repeats the headword). A long
  foreign entry with no structural mark would escape both.
- The 1,445 records that do not line up are invisible to the structural signals. The
  text signals saw 2 of them, both Italian.

Labels are one reader's call. The borderline ones are Italian loanwords and Latin
phrases with a foreign heading (`honeste vivere`, `praesidium`, `Aberdeen`,
`manicula`), labelled Italian because Italian uses them and the page defines them in
Italian prose. `stabilito` and `virgolettato` are Italian nouns whose one definition
is written in English; they are labelled Italian here, and are a different problem.

## 3. A detection rule

**A block under the Italian heading is another language when a bare language line
stands above it, or when its heading names another language and it comes after the
Italian entry's translation box.** Everything else is Italian.

It is `blockLanguage` in
[`src/italian/sectionLanguage.ts`](../src/italian/sectionLanguage.ts). It reads page
structure only. Which `{{-xx-}}` templates are languages comes from the dump itself:
the 308 codes it uses in `== {{-xx-}} ==` headings. There is no word list.

| | Records | Precision | Recall over the 52 |
| --- | ---: | ---: | ---: |
| The rule | 23 | 23/23 (95%: 85.7–100%) | 23/52 (95%: 31.6–57.7%) |
| Heading names another language, alone | 96 | 43/96 | 43/52 |
| Any structural signal | 119 | 52/119 | 52/52 |

The heading's language alone is the obvious rule, and it is wrong half the time.
Pages use it to mark where an Italian loanword comes from (`sushi`, `baseball` and
`newton` are `{{-sost-|int}}`), and they mistype it (`bellicose`, an Italian plural,
is `{{-agg form-|en}}`). Only after the translation box, where the Italian entry has
already ended, does it reliably open a foreign one.

What the rule misses: 24 records whose Italian heading holds nothing but the foreign
entry, like `hatefulness` (English), `canilia` (Sicilian) and `facundia` (Latin), where
nothing separates it from an Italian entry but its content; `arteria`, `mire` and `puri`, which carry no language
mark; and `eczema`, which sits under a second `== {{-it-}} ==` heading.

**The rule needs the raw page.** The archive keeps only one of its inputs. A
heading's language survives as a category (`dolmen`'s foreign record carries
`Sostantivi in inglese`), but the language line and the block's position do not.
`curie`'s Dutch record carries only `Sostantivi privi dell'indicazione della lingua`,
and so do Italian records like `sdrucciolo`'s noun.

## 4. Recommendation

| Option | What it does | Cost |
| --- | --- | --- |
| Filter | The seed drops the rule's 23 records | Reading raw pages for anything but recovering definitions is a new decision ([ADR 0012](../.decisions/0012-archive-is-the-release-seed.md)). A wrong drop loses an Italian entry silently; none in the 23 here. 29 known foreign records stay. |
| Flag | The seed keeps all 23 and marks them; Italian search leaves them out | The same ADR 0012 change, plus one stored mark. Reversible, and the record and its provenance stay. 29 known foreign records stay. |
| Accept | Nothing changes | 52 records (43 titles) reach Italian search: `hatefulness` reads as an Italian word, and `curie` and `dolmen` show a second sense that only repeats the headword. |
| Filter broadly (any structural signal) | Drops 119 records | Rejected: 67 of them are Italian entries, such as `sushi`, `baseball` and `bellicose`. |

**Recommendation: flag the rule's 23 and hide them from Italian search; accept the
rest for now.** Flagging takes out every record the rule is sure of. It drops
nothing, so the archive line, its provenance and any reversal stay intact. The page
shows no note about the mark. Confidence: medium-high. The 23 are a census with no
false positive. The cost is small next to its benefit only because so few records are
affected. The other 29 need a content judgement no structural rule makes, which is
why they stay accepted.

Neither flag nor filter can be built without Huey amending ADR 0012 to allow this
second use of the raw pages.

## 5. Regression cases

[`fixtures/section-language/regressions.json`](../fixtures/section-language/regressions.json)
holds four pages verbatim from the dump, with the archive records of their titles:

| Case | Records | Expected |
| --- | --- | --- |
| `curie` | lines 16046, 16047 | Italian; Dutch by the language line `{{-nl-}}` |
| `dolmen` | lines 67414, 67415 | Italian; English by the late heading `{{-sost-|en}}` |
| `sushi` | line 101975 | Italian, though its heading is `{{-sost-|int}}` |
| `sdrucciolo` | lines 346, 347 | Italian, though its noun heading is `{{-sost-}}` |

`sushi` and `sdrucciolo` are the genuinely Italian records that must not be filtered:
one fails a rule that reads the heading's language alone, the other a rule built on
the issue's first guess. The fixture also stores the dump's 308 language codes;
`measure:section-language` fails if they drift from the dump.

## 6. What I could not establish

- **Misses with no sign at all.** A long foreign entry headed `it`, alone on its page,
  is invisible to every signal here. The bound in §2 assumes such misses are as
  common as the ones the text signals see.
- **The 1,445 records that do not line up** with their page's blocks, mostly because
  a heading template is not in the part-of-speech table. Only the text signals read
  them.
- **A second reader.** Every label is one person's reading; the borderline ones are
  named in §2.

## Attribution

Page text quoted here and saved in `fixtures/section-language/` is from Italian
Wiktionary, CC BY-SA 4.0, by revision id. Extractor source is quoted from
[tatuylonen/wiktextract](https://github.com/tatuylonen/wiktextract) for analysis.
