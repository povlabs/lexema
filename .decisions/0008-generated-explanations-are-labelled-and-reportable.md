---
id: 0008
title: Generated explanations ship in Italian and English, labelled and reportable
status: accepted
date: 2026-09-21
tags: [product, content]
---

# 0008 — Generated explanations ship in Italian and English, labelled and reportable

**What this decides:** Each result may carry an AI-generated short explanation and one basic example, in Italian and in English, shown beside the source definition, marked as generated, and reportable by any reader.

## Context

The search page landed on 2026-09-21 ([#34](https://github.com/hueypov/lexema/pull/34)) showing only what the source dictionary states: Italian definitions, forms, and grammar tags. Looking at it, Huey asked for what a learner actually wants from a verb page: an explanation of the searched form, a basic example, and both in English as well as Italian, with the English switchable off later.

Two standing rules bear on this. [0004](0004-cloudflare-workers-d1-vinext.md) fixes the interface as English and keeps source definitions in the Italian the source wrote, untranslated, because a translation would be a lexical claim Lexema cannot ground. The specification excludes AI generation from the first version for the same reason. Both rules protect one thing: a reader must always be able to tell a copied fact from a made-up one.

Huey chose generation over hand-writing, for now, and asked for a way to report mistakes. That request is the explicit one the specification said generation would need.

## Decision

**Lexema may generate a short explanation and one basic example per result, in Italian and in English, and shows them only as generated, never as source.**

- Source definitions stay in Italian and untouched. Generated text lives in its own field, never overwrites or rewrites a source value, and carries the `lexema-generated` source type with the model, prompt version, and generation time.
- The page marks generated text as generated where it appears, in words, not only by placement or colour. A reader can hide the English later through a setting; the setting is future work, the field layout allows it now.
- Generation runs offline, over a release, like the import. It never runs inside a request. Content is stored beside the release it describes, keyed to the record and form it explains.
- Every generated item is reportable. A reader can flag it as wrong from the page, and a report is kept beside the item it targets until a reviewer acts on it. How reports are reviewed is [#12](https://github.com/hueypov/lexema/issues/12)'s question, extended to generated text.
- A grammatical paraphrase built from source tags by rule ("first person singular, present, of *andare*") is `lexema-deterministic`, not generated, and may appear in English as interface text under [0004](0004-cloudflare-workers-d1-vinext.md).

**Binding constraints.**

- No generated text is shown without its label, and no source text is ever replaced by generated text.
- Generated text never supplies a grammar fact the source or the deterministic modules do not state; it explains, it does not assert forms, genders, or moods.
- A generated item that has been reported stays visible only with the report count shown, or is withheld, never shown clean.
- Bulk generation waits for a small labelled batch over the twelve spot-check words to settle layout and wording.

## Consequences

The page gains the two things a learner asks for first, at the cost of the first content Lexema is responsible for rather than merely copying. Wrong generated text is a certainty at some rate; the label, the report path, and the untouched source definition beside it are what keep that from becoming a wrong dictionary.

0004's language rule stands for source definitions. What changes is that English now also appears in a labelled generated field, not only in the interface. The specification's "no AI generation in MVP" is superseded by this record for explanations and examples only; candidate suppression and invented grammar remain excluded.

Costs: a generation pipeline, storage for generated rows and reports, a model budget, and a review path. The setting to hide English is deferred.

## Records

No vocabulary impact yet: "generated explanation" and "report" earn glossary rows when the fields exist in the schema.
