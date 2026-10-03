# Lexema specification

> Historical proposal, not the current build plan. The owner has replaced the API-first/no-UI milestone with a website-first approach. [GitHub milestones and issues](https://github.com/povlabs/lexema/milestones) hold current scope and decisions. Technical choices and factual claims below require fresh validation; this document is retained for context.

## Purpose

Lexema is a multilingual lexical search engine and versioned API. It is **not** a language-learning platform. Applications such as news readers, browser extensions, mobile apps, and AI tools send a word, language, and optional sentence; Lexema returns reliable, source-grounded lexical candidates.

The first language is Italian. Adding a language must require a language adapter and a data release, not a redesign of the common API.

## Product principles

- Dictionary source data, initially Kaikki/Wiktextract derived from Wiktionary, is the lexical source of truth.
- Preserve every valid interpretation. A lookup of Italian `sale` must expose the salt noun, plural of `sala`, and form of `salire`; context may rank candidates later but must not erase them.
- Never invent definitions, pronunciation, grammar, or inflections.
- Keep original spelling in responses while using language-specific normalized keys for lookup.
- Missing, inconsistent, and ambiguous source data must remain unavailable or explicitly ambiguous—not guessed.

## Data and provenance

Lexema separates three layers:

1. **Source-derived data**: Wiktionary/Kaikki/Wiktextract definitions, examples, forms, tags, pronunciations, translations, and other extracted fields.
2. **Lexema data**: structural normalization, deterministic grammar output, and future original examples/explanations.
3. **Application code**: API, frontend, import tooling, and infrastructure. It is distinct from the licensed dictionary content and need not be open source solely because Lexema uses that content.

Every major lexical value should carry provenance where practical:

```json
{
  "sourceType": "wiktionary-derived",
  "source": "Kaikki/Wiktextract",
  "datasetRelease": "it-<release-id>",
  "sourceRecordId": "…",
  "sourcePointer": "/senses/0/glosses/0",
  "license": ["CC-BY-SA-4.0", "GFDL"],
  "modified": false
}
```

Use these source types:

- `wiktionary-derived`: source content copied from the dataset.
- `lexema-normalized`: a structural mapping with no new lexical claim.
- `lexema-deterministic`: a rule-derived result, such as an Italian article.
- `rule-generated`: a future deterministic morphology engine result.
- `lexema-generated`: future original or AI-generated explanation/example.
- `lexema-reviewed`: future human-authored or reviewed content.

Source definitions and Lexema explanations must remain separate. Source text is never overwritten by generated text.

## Licensing, attribution, and commercial use

Lexema may be commercial. Wiktionary-derived Kaikki data is commercially usable subject to its applicable licence terms, including attribution and ShareAlike/GFDL obligations. This is an operational requirement, not a blocker.

Store an immutable R2 source release with source URL, retrieval date, checksum, release ID, and import metadata. Provide:

```http
GET /v1/attribution
GET /attribution
```

The API endpoint and public page must identify Wiktionary, Kaikki/Wiktextract, applicable licences, release metadata, and that Lexema restructures/indexes the source. Retain provenance for copied/adapted lexical material. Linked audio/media should not be copied by default without separate provenance review.

## Cloudflare direction

Initial serving architecture:

```text
clients -> Cloudflare Worker API -> D1 serving projection
                                  -> R2 immutable sources/releases
                                  -> optional KV immutable hot cache
```

- **Workers**: versioned public API, input validation, response shaping, CORS/rate controls.
- **D1**: read-optimized projection for exact forms, prefix lookup, candidates, relations, release metadata, and initially entry payloads.
- **R2**: original `.jsonl.gz`, manifest/checksum, rejected-record report, and reproducible import artifacts. R2 remains the archival source layer.
- **KV**: optional cache only, keyed by immutable data version; never the primary lexical database because it has no relational querying and globally eventual writes.
- **Queues**: optional durable dispatch for independently retryable import chunks, with retries and a dead-letter queue; not part of lookup requests.

D1 paid-plan sizing must be benchmarked against the generated Italian projection before commitment. Initial data is small enough to investigate D1, but indexes and simultaneous staging releases determine the real database size. If payload plus indexes cannot fit comfortably, keep D1 as the index and move immutable entry shards to R2.

The full gzip dataset must not be decompressed or imported in a request Worker. Use a controlled external streaming importer. Each release is staged, validated, then atomically activated; source data is never overwritten.

## Lookup behavior

### Normalization

Italian exact lookup uses a versioned language normalizer:

1. trim outer whitespace;
2. Unicode NFC normalization;
3. Unicode case-folding;
4. canonicalize apostrophe variants;
5. retain accents.

Accent-insensitive discovery may be added later as a clearly labelled approximate mode; it is not exact lookup. Preserve query and source spelling in the response.

### Indexing

Index both:

1. every source record's `word` as a `headword` match;
2. every embedded `forms[].form` as a `declared-form` match.

This dual index is required because an inflection can occur only as a separate `form-of` record, only in a lemma's `forms[]`, or both. It enables `case -> casa`, `studenti -> studente`, and `andavano -> andare` without an AI or guessed lemmatizer.

A form may resolve to several candidates. `form_of` references are source evidence; a target entry is resolved only when unambiguous. Keep all record-level evidence and do not collapse distinct parts of speech or senses incorrectly.

### Search modes

- Exact lookup: source-grounded candidates for one surface form.
- Prefix autocomplete: bounded prefix lookup on the same normalized form index.
- Batch lookup: one bounded request for multiple words; return ordered found/not-found results.
- Contextual lookup: future advisory ranking only. It must always return the complete exact candidate set and must not create facts.

Definition full-text search and semantic search are not MVP requirements. Do not assume a particular D1 full-text extension until a deployed compatibility/performance spike proves it.

## Normalized response model

The common multilingual response contains language, query, candidate/lemma evidence, part of speech, source definitions, pronunciations, examples, provenance, and `languageData`.

Italian-specific grammar belongs below `languageData.it`; generic clients must not be forced to understand Italian articles or partitives.

```json
{
  "apiVersion": "v1",
  "dataVersion": "it-<release-id>",
  "query": {"surface": "studenti", "normalized": "studenti", "language": "it"},
  "results": [
    {
      "entryId": "…",
      "lemma": {"value": "studente", "sourceType": "lexema-normalized"},
      "matchedForm": "studenti",
      "partOfSpeech": "noun",
      "definitions": {"source": [], "lexema": []},
      "pronunciations": [],
      "examples": {"source": [], "lexema": []},
      "languageData": {"it": {}},
      "provenance": {"datasetRelease": "it-<release-id>"}
    }
  ]
}
```

Raw source records remain retrievable separately or through an explicit include option; the default API is normalized and application-friendly.

## Italian noun enrichment

Return noun forms as a list of provenance-bearing variants, not only a fixed singular/plural object. A convenience map may be exposed when one paradigm is unambiguous.

Generate articles only when gender, number, and surface form are explicit or safely inherited from source evidence. The Italian article module is rule-based, never AI-based.

Support:

- definite: `il`, `lo`, `l'`, `la`, `i`, `gli`, `le`;
- indefinite: `un`, `uno`, `una`, `un'`;
- partitive, plural only: `dei`, `degli`, `delle`. The singular partitive (`del pane`) goes with mass nouns, and the source never says a noun is one.

Article classes are ordinary consonants, vowels, and `s` + consonant, `z`, `x`, `gn`, `ps`, `pn` (the `lo` group). An initial whose sound the spelling does not settle — `h`, `j`, `w`, `y`, `i` before a vowel, a cluster Italian spelling does not use — takes the first sound from the record's own `sounds[].ipa` when every transcription agrees on it (`hotel` /oˈtɛl/, `l'hotel`; `yoga` /ˈjɔɡa/, `lo yoga`). It is withheld when there is no IPA, when the transcriptions disagree, or when they agree on a sound the references give no article: /h/ (`hobby`), /w/ (`web`, where `l'` and `il` both occur) and clusters Italian does not use, such as /pt/ (`pterodattilo`). The spelling reads `ch` before `e`/`i` as Italian /k/ (`il chilo`). Agreed IPA overrides that reading (`chef` /ʃɛf/, `lo chef`). With no IPA, or IPA that only ever opens on /k/, the /k/ stands. When the transcriptions disagree and one opens on another sound, such as /ʃ/ and /k/, the article is withheld. Composites and acronyms are withheld. The one lexeme exception is `dei`/`dèi` (`gli dei`). There is no Italian indefinite plural article; plural indefinite-style output uses partitives, labelled partitive. The rules and their references are in [reports/2026-10-01-italian-articles.md](../reports/2026-10-01-italian-articles.md).

A generated display form is deterministic and labelled accordingly:

```json
{
  "kind": "definite",
  "gender": "masculine",
  "number": "singular",
  "article": "lo",
  "displayForm": "lo studente",
  "sourceType": "lexema-deterministic",
  "rule": "it-articles/v3"
}
```

## Italian verb enrichment

Return source-backed verb facts when available:

- infinitive and lemma relation;
- auxiliary options;
- transitive/intransitive tags;
- explicit irregular/reflexive/pronominal evidence;
- source definitions and pronunciation;
- provenance-bearing conjugation entries.

A normalized conjugation entry has `mood`, `tense`, `person`, `number`, `surface`, source evidence, and source type. Preserve forms that cannot be safely classified in `unclassifiedForms`.

Do not infer mood from spelling. Some Kaikki embedded forms encode only `present` plus raw person labels, making conditional and subjunctive classification ambiguous without a validated Italian conjugation-table adapter or a direct form-of record. Do not generate regular verb forms in MVP. If later added, only verified regular paradigms may use `rule-generated`; irregular verbs must not be produced by suffix replacement.

## Italian adjective enrichment

Return source-backed masculine/feminine and singular/plural variants when available, plus comparative/superlative data where source tags permit. Preserve incomplete or compound source strings rather than splitting or completing them heuristically. Do not generate missing adjective forms in MVP.

## Examples

Source examples are returned only if they contain the exact searched form after language-aware surface matching. If no qualifying source example exists, return an empty list. Future generated examples must be grammatically natural, identify the selected meaning and surface form, and be visibly separate:

```json
{
  "sentence": "Lo studente prepara l'esame.",
  "sourceType": "lexema-generated"
}
```

No generated examples or AI explanations are part of MVP.

## API design

```http
GET  /v1/languages
GET  /v1/lookup?language=it&word=sale
POST /v1/lookup/batch
GET  /v1/suggest?language=it&prefix=sal&limit=10
GET  /v1/entries/{entryId}
POST /v1/contextual-lookup              # future advisory endpoint
GET  /v1/meta
GET  /v1/attribution
GET  /health/live
GET  /health/ready
```

The API version (`v1`) and data release version are independent. Responses always expose the release version used. Batch requests are explicitly bounded and must return a result for every submitted word.

## MVP boundaries

MVP includes:

- Italian source ingestion, immutable releases, and provenance;
- exact lemma/form lookup with all valid candidates;
- normalized factual response model;
- conservative noun article enrichment;
- source-backed forms/conjugations only;
- prefix lookup, bounded batch lookup, health, metadata, and attribution.

MVP excludes:

- AI-generated explanations/examples;
- AI disambiguation or candidate suppression;
- invented grammar, complete paradigms, or fallback pronunciations;
- full-text/semantic search commitments;
- a full language-learning product;
- full application/frontend implementation before the importer and factual API foundation are proven.
