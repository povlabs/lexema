# Italian Kaikki/Wiktextract dataset findings

> Historical inspection notes. Their verification claims have not been accepted wholesale in the current work. See [DATASET_SPOT_CHECK.md](2026-09-18-dataset-spot-check.md) for fresh direct observations and [SOURCE_RESEARCH.md](2026-09-18-source-research.md) for upstream comparisons and remaining uncertainty.

## Inspection method

`it-extract.jsonl.gz` was inspected by streaming gzip JSONL records one line at a time. The full dictionary was never loaded into memory.

## Verified dataset statistics

| Measurement | Verified value |
|---|---:|
| File path | `it-extract.jsonl.gz` |
| Compressed size | 39,890,237 bytes (~39.9 MB) |
| Total JSONL records | 799,600 |
| Records with `lang_code: "it"` | 560,357 |
| Raw UTF-8 JSON bytes for Italian records | 391,274,879 (~391.3 MB) |
| Largest Italian record | 49,189 bytes |
| Italian records tagged `form-of` | 486,259 |
| Embedded Italian `forms[]` objects | 713,133 |
| Embedded Italian `senses[]` objects | 714,867 |

The file is **not Italian-only** despite its name. It contains records for `it`, `ca`, `la`, `pt`, `es`, `en`, and other languages. Importers must filter strictly on `lang_code == "it"`, never on filename, word spelling, or categories.

## Italian part-of-speech counts

| POS | Records |
|---|---:|
| verb | 462,020 |
| noun | 52,885 |
| adj | 30,488 |
| phrase | 4,922 |
| name | 4,838 |
| adv | 3,157 |
| abbrev | 669 |
| other POS combined | 378 |

## Field coverage

| POS | With `forms[]` | With source examples | With `sounds[]` | `form-of` records |
|---|---:|---:|---:|---:|
| noun | 25,368 | 5,101 | 25,356 | 15,979 |
| verb | 32,911 | 2,763 | 12,364 | 454,457 |
| adj | 22,090 | 2,213 | 12,600 | 15,795 |

Source examples are sparse. Lexema cannot promise a Wiktionary-derived example for every entry or every searched form.

## Common top-level fields

Frequently observed fields:

```text
word, lang, lang_code, pos, pos_title, senses, categories,
etymology_texts, tags, sounds, hyphenations, forms, synonyms,
translations, related, derived, antonyms, proverbs, hypernyms,
raw_tags, hyponyms, notes, redirect, title
```

They are optional and inconsistent. `senses[]` may contain `glosses`, `tags`, `raw_tags`, `form_of`, `examples`, categories, and topics. `sounds[]` may include IPA and audio URLs. Do not require any of these fields in the normalized API.

## Noun representation

### `studente`

```json
{
  "word": "studente",
  "pos": "noun",
  "tags": ["masculine", "singular"],
  "forms": [
    {"form": "studenti", "tags": ["masculine", "plural"]},
    {"form": "studente/studentessa", "tags": ["feminine", "singular"]},
    {"form": "studentesse", "tags": ["feminine", "plural"]}
  ]
}
```

The separate record `studenti` is also a noun `form-of` record pointing to `studente`.

### Other observed noun patterns

- `zaino`: masculine singular, `zaini` plural.
- `psicologo`: masculine/feminine variants are explicit (`psicologi`, `psicologa`, `psicologhe`).
- `amico`: noun record has only `amici`; separate `amica` source records provide additional gendered forms.
- `casa`: the observed noun record has no `forms[]`; the separate `case` record points to `casa`.

**Finding:** form indexing must include both each record's `word` and every `forms[].form`. An importer cannot rely on only one representation.

## Adjective representation

### `bello`

```json
{
  "word": "bello",
  "pos": "adj",
  "tags": ["masculine", "singular"],
  "forms": [
    {"form": "belli", "tags": ["masculine", "plural"]},
    {"form": "bella", "tags": ["feminine", "singular"]},
    {"form": "belle", "tags": ["feminine", "plural"]}
  ]
}
```

`bella` and `belli` also exist as distinct adjective form-of records pointing to `bello`.

### Incomplete and compound adjective data

- `fine` is tagged both masculine and feminine singular but exposes only `fini` with an unqualified plural tag.
- `grande` contains useful comparative/superlative tags, but some source form strings are compound or multiline, for example `grandissimo\n massimo`.

**Finding:** return a provenance-bearing list of variants. Do not force every adjective into four clean form slots or split source strings automatically.

## Verb representation

### Embedded lemma paradigms

Verb lemmas can expose large `forms[]` arrays sourced from pages like:

```text
Appendice:Coniugazioni/Italiano/andare
```

Observed form counts:

| Lemma | Form count | Direct observations |
|---|---:|---|
| `andare` | 97 | `essere` auxiliary; explicitly irregular; intransitive |
| `parlare` | 95 | `avere` auxiliary; first-conjugation raw tag |
| `credere` | 98 | `avere` auxiliary on transitive record |
| `dormire` | 95 | `avere` auxiliary; third conjugation |
| `finire` | 137 | `avere` plus conditional intransitive `essere` notation |

Example embedded entries from `andare`:

```json
{"form":"vado","tags":["singular","first-person","present"],"raw_tags":["io"]}
{"form":"andavano","tags":["plural","third-person","imperfect"],"raw_tags":["essi/esse"]}
{"form":"andrà","tags":["singular","third-person","future"],"raw_tags":["lui/lei"]}
{"form":"sono andato","tags":["singular","first-person","past","perfect"],"raw_tags":["io"]}
```

### Separate verbal form records

`andavano`, `parlo`, `parlerò`, `parlato`, `credo`, `dormo`, and `finisco` occur as separate verb records tagged `form-of` with `form_of: [{"word": "<lemma>"}]`.

Example:

```json
{
  "word": "andavano",
  "pos": "verb",
  "tags": ["form-of"],
  "senses": [{
    "glosses": ["terza persona plurale dell'imperfetto indicativo di andare"],
    "tags": ["form-of"],
    "form_of": [{"word": "andare"}]
  }]
}
```

### Conjugation-tag limitation

The tags do not always encode mood. For example, `parlerei` appears with `tags: ["present"]` and `raw_tags: ["io"]`; `parli` in subjunctive context appears with `tags: ["present"]` and `raw_tags: ["che io"]`.

A normalized mood/tense table therefore requires either:

1. explicit grammatical wording from a separate form-of record;
2. a validated parser for known Kaikki conjugation-table layout/source page; or
3. a separately labelled deterministic generator.

Never infer mood merely from spelling or a `present` tag.

### Verb ambiguity

A lemma can have several POS records or verb records with different properties. `credere` has a transitive record with forms and a separate intransitive record without forms. Do not merge valency/senses indiscriminately.

## Known ambiguities and anomalies

- Source categories and metadata are not uniformly reliable; language filtering must use `lang_code`.
- Some definitions are placeholders, for example “definizione mancante”.
- Source forms can be incomplete, duplicated, compound, or ambiguous.
- `studente/studentessa` is a single source string and must not be split without explicit adapter policy.
- Some embedded verb form sequences contain alternate forms and source variants; retain them rather than silently correcting or replacing them.
- `sale` has three valid Italian analyses: salt noun, plural of `sala`, and third-person present of `salire`.
- `camera`, `case`, `fine`, `solo`, and `estate` demonstrate cross-language homography; `lang_code` is mandatory.
- Most Italian verb records are inflected-form records, while a much smaller subset carries embedded paradigms.

## Representative fixtures

The importer/API test suite should retain these factual fixtures:

| Query | Required behavior |
|---|---|
| `studenti` (`it`) | resolve source-backed relation to `studente`; retain form evidence |
| `case` (`it`) | resolve source-backed relation to `casa`, despite sampled lemma lacking forms |
| `andavano` (`it`) | resolve to `andare`; preserve source form-of record and/or embedded form evidence |
| `sale` (`it`) | return all Italian candidates; do not choose by default |
| `camera` (`it`) | return Italian candidate only when language is `it` |
| `bello` / `bella` / `belli` | preserve adjective variants and form-of relationships |
| `parlare` | expose source-backed embedded regular-style paradigm without calling it regular unless proven |
| `andare` | expose irregular source-backed forms and `essere` auxiliary |
| `finire` | preserve multiple/conditional auxiliary information |
| `casa` | tolerate sparse lemma fields and still find `case` |
