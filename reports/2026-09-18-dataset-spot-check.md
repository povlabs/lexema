# Italian dataset spot check

## Status and method

Reference: observations from directly reading `it-extract.jsonl.gz`, not from the existing adapter, tests, or reports. Twelve exact, case-sensitive queries were checked against every Italian record's `word` and every embedded `forms[].form`. Only records with `lang_code == "it"` were admitted. Separate scans inspected direct entries and selected relation targets.

**Checked means faithful to this file, not independently verified Italian.** No grammar authority was consulted during this spot check. No articles or missing forms were generated. Counts below describe matching evidence, not distinct meanings or final search results.

Follow-up: [source research](2026-09-18-source-research.md) compares these claims with Wiktionary and selected Treccani entries. It finds missing `casa` content and conflicting evidence for the `studente` verb claim; the raw observations below are unchanged.

The inspection used Python's standard-library gzip and JSON readers, streaming one line at a time. Source locations below use 1-based physical JSONL line numbers and 0-based JSON Pointer array indexes. They apply only to this exact file:

- Compressed bytes: `39890237`
- SHA-256: `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`
- Download URL recovered from macOS `com.apple.metadata:kMDItemWhereFroms`: <https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz>
- Referring page in the same metadata: <https://kaikki.org/dictionary/rawdata.html>
- Exact upstream release date and applicable licence notices: not yet verified. The current download may differ from this file.

Existing repo documents were not used as evidence for these observations.

## Twelve query checks

| Query | Direct Italian records | Embedded matching forms | Observed data and limits |
| --- | ---: | ---: | --- |
| `casa` | 1 | 0 | Noun at line 1. Its only two glosses are `casa ( approfondimento) f sing` and `casa ( citazioni)`. No top-level gender/number tags or embedded forms. This is not a usable house definition. |
| `case` | 1 | 0 | Line 8864 has feminine/plural tags and `/senses/0/form_of/0/word = casa`. The relation is present even though the `casa` entry lacks forms. |
| `studente` | 2 | 3 | Noun at 37883, but also a verb form at 37884 pointing to `studiare`. A search must not assume there is only a noun analysis. |
| `studenti` | 1 | 4 | Direct noun form at 112278 points to `studente`. Two matching forms occur under `studente`, and one each under `studentessa` and `studentesse`. These are evidence paths, not four independent meanings. |
| `sale` | 3 | 2 | Salt noun at 21651; plural of `sala` at 21652; form of `salire` at 21653. Embedded matches occur under `sala` and `salire`. |
| `andare` | 2 | 0 | Noun at 2344 and verb at 2345. Verb has 97 embedded form objects; these include an auxiliary, not just conjugations. |
| `andavano` | 1 | 1 | Direct verb form at 462543 points to `andare`; also appears at line 2345 `/forms/16/form`. |
| `parlare` | 2 | 0 | Noun at 36 and verb at 37. Verb has 95 form objects, including auxiliary `avere`. |
| `parlerei` | 1 | 1 | Direct entry at 140699 names the conditional in gloss prose. Line 37 `/forms/53` has `present` and raw `io`, but no mood tag. |
| `bello` | 3 | 7 | Adjective at 33645 and two separate nouns at 33646–33647. Embedded matches also occur in related inflected entries. |
| `bella` | 2 | 7 | Adjective at 56435 and noun at 56436, both pointing to `bello`. The noun target is ambiguous by word and part of speech alone. |
| `città` | 1 | 0 | Line 31998 has feminine/invariable tags and a substantive definition. There is no explicit singular/plural tag. |

## Meaning evidence

These are examples of copied source claims, not replacement definitions:

| Location | Source text |
| --- | --- |
| Line 37883 `/senses/0/glosses/0` | chi è regolarmente iscritto in un corso di studi |
| Line 37 `/senses/0/glosses/0` | pronunciare parole esprimendo i propri pensieri |
| Line 2345 `/senses/0/glosses/0` | muoversi da un luogo verso un altro luogo |
| Line 21651 `/senses/0/glosses/0` | sostanza denominata anche cloruro di sodio che si presenta sotto forma di cristalli biancastri con diversi utilizzi tra cui quello culinario |

The two `casa` glosses show that a nonempty gloss array does not establish useful definition coverage.

## Conjugation evidence

- `andare`: line 2345 `/forms/0` contains auxiliary `essere`. Its raw tag says `verbo di prima coniugazione (irregolare)`.
- `andavano`: line 2345 `/forms/16` has `plural`, `third-person`, and `imperfect`. No mood tag is present. Line 462543 `/senses/0/glosses/0` explicitly says `terza persona plurale dell'imperfetto indicativo di andare`.
- `parlare`: line 37 `/forms/1` contains auxiliary `avere`.
- `parlerei`: line 37 `/forms/53` has `tags: ["present"]` and `raw_tags: ["io"]`. Line 140699 `/senses/0/glosses/0` says `prima persona singolare del condizionale presente di parlare`.

A mood stated in prose and a structured mood tag are different kinds of evidence. This check did not implement a prose parser or infer moods from spelling or table order.

## Article inputs

No ready-made noun article field was observed in these direct entries. The following are inputs for a future separately tested article rule, not generated article results:

- Explicit masculine singular: noun `studente`, noun `sale`.
- Explicit feminine plural: `case`, plural-noun `sale`.
- Explicit masculine plural: noun `studenti`.
- Missing structured gender and number: `casa`.
- Explicit feminine, number unspecified: `città` (`invariable`).

The same query can carry different gender/number evidence under different interpretations. An article cannot safely be assigned once per query.

## Relationship and grouping evidence

Embedded forms do not establish that their containing record is the base word:

- Line 551446 is the feminine form `studentessa`, pointing to `studente`. Its `/forms/1/form` is `studenti`.
- Line 551449 is `studentesse`, also pointing to `studente`. Its `/forms/1/form` is `studenti`.
- Line 50970 is `bellissimo`, pointing to `bello`. Its `/forms/0/form` is the positive form `bello` and `/forms/2/form` is `bella`.

Resolving a match directly to the containing record would mislabel these relationships. This check preserves their existence without deciding the final grouping policy.

Line 56436, noun `bella`, points to `bello`. Both lines 33646 and 33647 are noun records for `bello`, with different senses. The relation does not identify which record it means. It remains ambiguous; the check does not select a target.

## Remaining uncertainty

- Linguistic correctness of source claims has not been independently checked.
- No finished search response, article engine, or complete conjugation table has been validated.
- Normalized spelling, apostrophe handling, accent handling, and missing-word behavior were not tested by this case-sensitive check.
- Findings from these twelve queries do not establish quality across the whole dictionary.
- Licence requirements and the exact upstream release remain open.
