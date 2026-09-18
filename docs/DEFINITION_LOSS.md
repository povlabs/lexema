# Why `casa` has no definition

Investigation for [issue #11](https://github.com/hueypov/lexema/issues/11), run 2026-09-18.

Everything below is reproducible from this repo:

```bash
python3 tools/definition_loss.py verify          # replays the regression cases, no network
python3 tools/definition_loss.py sample   --stratum lemma --size 400 --seed 11 --out build/sample-lemma.json
python3 tools/definition_loss.py fetch    --sample build/sample-lemma.json
python3 tools/definition_loss.py classify --sample build/sample-lemma.json --out build/report-lemma.json
```

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

**Method B — random upstream sample.** 400 words drawn uniformly (seed 11) from the
74,098 lemma records, their pages fetched and classified against the extract; plus 200
from the 486,259 inflected-form records. Wilson 95% intervals.

| Tier | Lemma sample | Rate | Projected over 74,098 lemma records |
| --- | ---: | --- | --- |
| Severe — whole section's definitions lost (`casa` shape) | 0 / 396 | 0% [0, 0.96%] | 0 – 711 |
| Partial — one sub-sense lost at `#*` under a real `#` | 5 / 396 | 1.26% [0.54%, 2.92%] | 400 – **935** – 2,164 |
| Wrapped prose (separate route, section 2) | 5 / 396 | 1.26% [0.54%, 2.92%] | 400 – **935** – 2,164 |
| Inflected forms | 0 / 200 | 0% [0, 1.88%] | mechanism does not apply |

**Read it this way.** The severe `casa` shape is **rare — order of tens of pages**, not
thousands. Method A found 4 by name; Method B says it cannot be commoner than ~1% of
lemmas. The partial tier is roughly **1,000 lemma records (400–2,200)**, and hurts much
less: those entries keep most of their meanings and lose one sub-sense. Inflected forms
are untouched, which is most of the file.

**Error bars and what would move them.** The intervals are binomial only. Three further
sources of error are not in them:

1. **Version skew.** The local snapshot is older than the pages I fetched. A page fixed
   or broken upstream since then shows up on the wrong side. This is the largest
   uncertainty in Method A; it does not affect the `verify` cases, which pin a revision id.
2. **Classifier precision.** It decides "definition vs example" by whether the line
   carries italic markup — a proxy for how the real extractor behaves, not a reading of
   the Italian. It agreed with hand-checking on `casa`, `manuale`, `verde`, `informatica`
   and `scarlatto`, and misread 2 of roughly 45 pages I checked by hand: it called
   `lap steel guitar`'s definition an example (it contains an incidental italic) and
   `malanga`'s citation a definition (it contains none). Both misreads are inherent to
   the proxy. Not measured on a larger blind set.
3. **Wrapped-prose precision is poor.** Of the 5 flagged pages only about 3 lose real
   meaning; the rest are stray markup. Treat that row as an upper bound.

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
mechanical and now tested, and the fix is bounded because the flagged set is small
(tens of severe pages, ~1,000 partial). The trade-off is that we take on a second parser
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
- `definitions` — prose that states a meaning, each flagged `reachable_by_extractor`.
- `examples` — usage sentences and quotations, same flag.

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

- **The exact severe-case count.** Method A's recall is unknown and Method B found zero
  in 396. I can bound it (≲700 lemma records, likely tens) but not count it. Detecting
  the shape reliably needs the upstream page, not the extract.
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
