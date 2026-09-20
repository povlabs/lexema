# Why `casa` has no definition

Investigation for [issue #11](https://github.com/hueypov/lexema/issues/11), run 2026-09-18.

Saved regression cases replay offline. Re-sampling re-runs the heuristic against whatever
the pages say today; the hand labels in `fixtures/definition-loss-samples/hand-labels.json`
are tied to the revisions reviewed here, so a fresh draw needs fresh review:

```bash
python3 tools/definition_loss.py verify          # replays the regression cases, no network
python3 test/definition-loss.py                  # proves verify fails when content is removed
python3 tools/definition_loss.py sample   --stratum lemma --size 1200 --seed 11 --out build/sample-lemma.json
python3 tools/definition_loss.py fetch    --sample build/sample-lemma.json
python3 tools/definition_loss.py classify --sample build/sample-lemma.json --out build/report-lemma.json
```

`classify` stops rather than print a rate if it flags a record that nobody has labelled.

Source file under study: `it-extract.jsonl.gz`, SHA-256
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`, 560,357 Italian
records. No record was edited.

---

## 1. The loss, reproduced

`fixtures/upstream-pages/casa.wikitext` is Italian Wiktionary revision 4257826, saved
verbatim. Its noun section reads:

```wikitext
# {{Pn|w}} ''f sing'' {{Linkp|case}}
#* {{Term|architettura|it}} [[edificio]] [[costruito]] [[per]] [[essere]] utilizzato ...
#** ''un mio amico ha acquistato una bella casa in montagna''
#* [[dimora]] di una [[persona]]; [[costruzione]] o [[struttura]] in cui uno vive ...
#** ''ti avviso che stasera torno a casa tardi dal lavoro''
... five more #* definitions ...
```

Seven definitions and seven usage sentences. Line 1 of the extract has neither:

```json
"senses": [
  {"glosses": ["casa ( approfondimento) f sing"], "raw_tags": ["pl.: case"]},
  {"glosses": ["casa ( citazioni)"]}
]
```

Both glosses are the rendered `#` lines — page furniture. `tools/definition_loss.py verify`
replays this from the saved page with no network access and exits non-zero if it ever
stops holding.

## 2. The cause

**Named:** it.wiktionary has two page layouts. wiktextract's Italian extractor only
handles one of them, and its fallback silently throws prose away.

The starting hypothesis — "nested lists get dropped" — is **wrong as stated**. Nested
lists are read; 26,176 senses in this very file carry examples harvested from `#*` lines.
The truth is narrower and provable from the extractor's own source.

### The two page layouts

Most Italian entries put the headword on a bare line and the meaning on `#`
(`fixtures/upstream-pages/informatica.wikitext`):

```wikitext
{{Pn|w}}
''f sing''
#{{Glossa|scienza}} [[disciplina]] [[scientifica]] e [[tecnica]] che studia ...   <- definition
#* ''Visto il costo contenuto di un personal computer, oggi l'{{Pn}} è entrata ...''  <- example
```

A minority — `casa`, `manuale`, `pianoforte` — push everything one level down, so `#`
holds the headword, `#*` holds the definitions and `#**` holds the examples.

### What the extractor does with the second layout

From [`extractor/it/pos.py`](https://github.com/tatuylonen/wiktextract/blob/master/src/wiktextract/extractor/it/pos.py),
`extract_gloss_list_item`:

```python
elif node.sarg.endswith(("*", ":")):
    for example_list_item in node.find_child(NodeKind.LIST_ITEM):
        extract_example_list_item(wxr, sense, example_list_item, word_entry.lang_code)
...
for list_node in list_item.find_child(NodeKind.LIST):
    if list_node.sarg.startswith("#") and list_node.sarg.endswith("#"):   # only `##`
        extract_gloss_list_item(wxr, word_entry, child_list_item, sense)
```

Sub-senses are recursed **only** from `##`. Anything under `#*` or `#:` goes to the
example reader, with no path back to being a meaning.

Then [`extractor/it/example.py`](https://github.com/tatuylonen/wiktextract/blob/master/src/wiktextract/extractor/it/example.py),
`extract_example_list_item`, for a non-CJK language appends an `Example` in exactly one
branch:

```python
case NodeKind.ITALIC:
    ...
    e_data = Example(text=clean_node(wxr, sense, node))
    examples.append(e_data)
```

and ends with `if len(example.text) > 0: sense.examples.append(example)`.

**A `#*` line containing no `''italic''` run produces nothing at all.** Italian
Wiktionary writes usage sentences in italics and definitions in plain prose — so on
these pages the definitions are exactly the lines that render to nothing. The `#**`
examples sit one level lower still; they can only ever be attached as a *translation*
of an example that, here, was never created.

When a `#*` definition *does* happen to contain an incidental italic — a quoted foreign
word, a cited instrument name — the outcome is worse than deletion. `lap steel guitar`:

```json
{"glosses": ["lap steel guitar ( approfondimento) f sing"],
 "examples": [{"text": "(musica) tipo di steel guitar che si suona da seduti, appoggiata sulle gambe ...",
              "translation": "elettrica, dotata di pick-up come sulle chitarre elettriche"}]}
```

The definition survives — filed as an **example**, with a sub-definition filed as a
**translation**. A consumer that trusts the field names shows this word as having no
meaning and one usage sentence. This is precisely why definitions, examples and page
controls have to be kept apart downstream: the damage is mislabelling, not only absence.

### The three independent checks that confirm it

| Check | Prediction | Result |
| --- | --- | --- |
| `casa`: 7 plain-prose `#*` definitions | all 7 vanish, both glosses are the `#` lines | holds |
| `manuale` adjective: `#* [[procedimento]] ''{{Pn}}''` — partly italic | only the italic run survives | extract stores example `"manuale"`, the word `procedimento` is gone |
| `informatica`: `#` definition, fully italic `#*` | definition and example both survive | holds |

The middle row is the decisive one: it rules out "nested lists are dropped" and pins the
behaviour on the italic-only rule.

### A second, separate loss route

`verde` and `Tersina` lose prose a different way: the wikitext wraps a definition onto
the *next physical line*, outside the list. The list parser ends an item at the newline,
so that text never reaches its sense. `verde`'s heraldry sense keeps the gloss
`verde ( approfondimento)` and loses `smalto araldico di colore verde intenso...`.
This is reported separately below and is **not** the `casa` bug.

### What is not the cause

- **Not a stale download.** Independently confirmed earlier in `docs/SOURCE_RESEARCH.md`.
  The mechanism is in the extractor, so a newer dump of the same code changes nothing.
- **Not records being dropped.** Every Italian record survives; `page.py` inserts a
  `no-gloss` sense rather than discarding an entry.
- **Not the 667 empty Italian records.** They look like the same bug and are not: those
  pages carry `{{Nodef|it}}` or a bare `#` upstream. They are genuinely undefined on
  Italian Wiktionary, and no extraction change will fill them.

## 3. Blast radius

Two methods, because neither alone is trustworthy.

**Method A — whole-file scan.** Stream all 560,357 Italian records and flag those where
every glossed sense reads as headword furniture (the word plus gender/number stamps plus
`( approfondimento)` / `( citazioni)`). 41 records, 39 distinct words. Fetching all 39
upstream and re-parsing confirms **4 real severe losses**: `casa`, `manuale`,
`pianoforte` and `lap steel guitar`. Of the other 35:

- most are genuinely thin upstream (`asciugatoio`, `presina`, `in vitro` — a bare
  headword line and no definition on the page at all);
- `malanga` is a **false positive** of my classifier: its `#` line is a cross-reference
  to the English entry and the `#:` below it is a book citation, not a definition. What
  it loses is a quotation;
- `curie`, `dolmen` and `arteria` are a **different bug** — a non-Italian section tagged
  `lang_code: "it"`, so a Dutch `# '''curie'''` line lands in the Italian data. Filed as
  follow-up work.

This method has unknown recall: it can only see a control `#` line that renders to
non-empty text.

**Method B — uniform record sample.** The unit is the record, start to finish. Seed 11
draws records uniformly from a stratum; each drawn record keeps its word and its part of
speech; scoring then reads only *that* record's section of its page. So the numerator and
the denominator count the same thing, and the rate multiplies out to the population.

This is the part an earlier version of this document got wrong. It sampled records,
deduplicated to words, then classified every part of speech on each page — which credits a
loss to a record nobody drew. `classico` is the worked example: the page loses the
definition of *liceo classico* from its **noun** section, but the record drawn was the
**adjective**. Page-level counting scored it a hit; record-level counting does not.

Two strata, covering all 560,357 Italian records:

| Stratum | Population | Drawn | Scored | Flagged | Confirmed by hand |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lemma | 74,098 | 1,200 | 1,189 | 15 | **12** |
| Inflected | 486,259 | 1,000 | 1,000 | 0 | **0** |

Eleven lemma records went unscored: 6 whose part of speech is no longer on the live page,
5 whose page has no Italian section at all. They are dropped rather than guessed at.

Every one of the 15 flags was read by hand and decided in writing before it counted.
`classify` refuses to print a rate while any flag is unlabelled, so no number here comes
from a flag nobody read. Twelve state a meaning; three are usage sentences and were
thrown out:

| Record | Flagged text | Verdict |
| --- | --- | --- |
| `incignare` verb | *ho incignato il vestito nuovo* | example — one speaker, one new suit |
| `virgulto` noun | *una pianta dai virgulti vigorosi* | example — adds nothing to the `#` line |
| `spiluccare` verb | *Edoardo ha spiluccato il biscotto al cioccolato* | example — one person, one biscuit |

The twelve kept records, with the reason for each, are in
`fixtures/definition-loss-samples/hand-labels.json` and repeated in the report.

### The answer

**Roughly 750 Italian records lose a definition this way — about 1 in 750 — with a 95%
interval of 430 to 1,300.**

That comes from the lemma stratum: 12/1,189 = 1.01%, Wilson interval 0.58%–1.76%, times
74,098 lemma records.

The inflected stratum contributes nothing measurable, and there is a structural reason,
not just a zero count. The bug needs a `#*`/`#:` child line to route into the example
reader. Only **3 of 1,000** inflected records have such a line at all, and all three are
italic usage sentences the extractor keeps correctly. An inflected page is a form-of
pointer; there is rarely anything nested under it to lose. Its binomial upper bound is
0.38%, so even the pessimistic reading of both strata together stays under 3,200 records.

Among lemma records the bug can actually reach — the 179 of 1,189 with a nested child —
the rate is 12/179, about **7%**. That is the number to hold in mind when reading a page
with sub-senses, and it is why `casa` is not a freak.

**This is a floor, not a ceiling.** The negatives were never exhaustively hand-reviewed,
so the heuristic's recall is unknown; anything it failed to nominate is missing from the
12. Read 750 as the right order of magnitude — hundreds, not tens and not tens of
thousands — rather than a precise count.

| Tier | Observed | Interpretation |
| --- | ---: | --- |
| Severe (all glosses useless) | 4 records | Method A discoveries; none fell in the sample. |
| Partial, hand-confirmed | 12 / 1,189 lemma | 1.01%, projecting to ~750 records. |
| Wrapped prose (separate bug) | 16 / 1,189 | Heuristic flags, not 16 verified losses. |
| Inflected | 0 / 1,000 | Only 3 are even exposed to the mechanism. |

**Remaining uncertainty:**

1. **Version skew.** The local snapshot is older than the pages I fetched. A page fixed
   or broken upstream since then shows up on the wrong side. This is the largest
   uncertainty in Method A; it does not affect the `verify` cases, which pin a revision id.
2. **Classifier precision is measured; its recall is not.** It decides "definition vs
   example" by whether the line carries italic markup — a proxy for how the real
   extractor behaves, not a reading of the Italian. Hand review of all 15 flags puts its
   precision at 12/15, **80%**, and the review, not the proxy, sets the numerator. What
   is *not* measured is how much it misses: a lost definition that happens to carry an
   incidental italic reads as an example and is never nominated. `lap steel guitar` is a
   known case of exactly that. This is why 750 is a floor.
3. **Wrapped-prose precision is poor.** Of the 16 flagged records only a fraction lose
   real meaning; the rest are stray markup. Treat that row as an upper bound, and note
   it is a different bug from the one this document measures.
4. **One record, one section.** A record is matched to its page section by part of speech
   title. 16 of 1,189 lemma records matched more than one section with the same title;
   those count as hit if either section loses a definition, which can only overstate, and
   only by at most 16 records.

A single severe page can matter far more than its count suggests: `casa` is among the
most common nouns in Italian. **Counting records understates the user-visible damage.**

## 4. Recommended fix

**Recommendation: fix the extraction, in our own adapter, as a layer beside the original
record — not a patch to the stored data, and not a hand-written enrichment corpus.**

Concretely: keep `it-extract.jsonl.gz` as the untouched base, and re-derive the affected
senses from saved upstream wikitext for the pages our detector flags, recording revision
id, licence and route for each recovered definition. The original record stays byte-identical
and always wins when both agree; the enrichment only ever fills gaps.

| Route | Cost | Why not chosen |
| --- | --- | --- |
| **Repair the extraction (chosen)** | Days. Re-parse `#*`/`#**` for the flagged pages, plus a detector to find them. Rules are already written down and tested in `tools/definition_loss.py`. | — |
| Hand-source an enrichment corpus | Weeks, and never finishes. Needs a licensed source; Treccani reserves reproduction (`docs/SOURCE_RESEARCH.md`), so it would mean writing definitions ourselves. | Slow, unverifiable, and creates data with no provenance. |
| Upstream the fix to wiktextract | Small patch, but release timing is not ours and we would still need a local path until it lands. | Worth doing **as well**, not instead. |

Why this route wins: the content is already ours under CC BY-SA 4.0, the loss rule is
visible in the saved cases. The flagged set is a starting point, not a bound on total repair effort. The trade-off is that we take on a second parser
to maintain, and it will drift from upstream page conventions over time — so the detector
must run on every data refresh, not once. **Confidence: high** on the cause and on the
route; **medium** on the effort, because the partial tier has not been repaired end to end
even once.

## 5. Regression cases

`fixtures/definition-loss-regressions.json`, replayed by `definition_loss.py verify`
against the saved pages in `fixtures/upstream-pages/`. Every case records the revision id,
URL and licence.

**The three kinds are kept apart on purpose** — conflating them is how this bug stayed
hidden, since an entry with two "glosses" looks populated:

- `page_controls` — headword repeats, gender/number stamps, plural links,
  `approfondimento`/`citazioni` pointers. Must never be shown as a meaning.
- `definitions` — human-labelled meanings; `reachable_by_extractor` means reachable **as a gloss**, not retained somewhere else.
- `examples` — usage sentences and quotations; the flag describes example retention.

For `lap steel guitar`, all three lines are definitions. `extractor_destination` separately records `examples[].text`, `examples[].translation`, or `absent`. The generator emits drafts, not trusted human labels. `verify` checks all saved page lines and exact record/POS, gloss, example and translation expectations, including controls. `python3 test/definition-loss.py` proves missing records and deleted retained fields fail. This tests the stored snapshot, not a replay of wiktextract or a future repair adapter.

| Case | Expectation |
| --- | --- |
| `casa` | 7/7 definitions unreachable; both glosses are controls |
| `manuale` | 4/5 unreachable; adjective sense survives, noun section is wiped |
| `pianoforte` | 3/3 unreachable |
| `lap steel guitar` | definition mislabelled into `examples[].text`, sub-sense into `translation`; gloss is a control |
| `classico` | 1/10 unreachable — partial tier, `liceo classico` keeps its headword but loses its explanation |
| `partita` | 2/8 unreachable — partial tier |
| `canzone` | 1/4 unreachable — partial tier |
| `informatica` | 0/6 — control, must stay clean |
| `studente` | 0/2 — control, must stay clean |
| `verde` | 0/9 by this route — control; its separate wrapped-prose loss is tracked apart |

The three clean controls matter as much as the failures: they are what stops a future
"fix" from reclassifying every example as a definition.

## 6. What I could not establish

- **The exact severe-case count.** Method A's recall is unknown, and Method B drew no
  severe record in 2,189. Section 3 bounds the *partial* tier, which is the common case;
  the severe tier is only known by its four named discoveries. Detecting that shape
  reliably needs the upstream page, not the extract.
- **The true total, as opposed to a floor.** ~750 counts what the heuristic nominated and
  a person then confirmed. A definition it never nominated — one carrying an incidental
  italic, say — is invisible to the count. Closing that needs a blind hand review of a
  sample of negatives, which is not this PR.
- **Whether version skew flips any of the 34 Method-A non-losses.** The local snapshot's
  upstream revision ids are not recorded anywhere, so I cannot fetch the matching
  revisions. `arteria` and `dolmen` are unresolved for this reason.
- **Whether the `lang_code: "it"` mislabelling (`curie`, `dolmen`) is common.** Spotted
  in passing, not measured. Filed separately.
- **Whether repairing the partial tier is safe in bulk.** I verified the rule on 10 pages.
  Bulk repair needs a larger blind-checked sample before anyone trusts it.

## 7. Attribution

Page content in `fixtures/upstream-pages/` and `fixtures/definition-loss-regressions.json`
is from Italian Wiktionary, CC BY-SA 4.0, saved verbatim with revision ids. Extractor
source is quoted from [tatuylonen/wiktextract](https://github.com/tatuylonen/wiktextract)
for analysis.
