---
id: 0035
title: Lexema may write its own English meaning for each sense, labelled as generated in the data and never on the page
status: accepted
date: 2026-11-16
tags: [product, content, provenance]
---

# 0035 — Lexema may write its own English meaning for each sense, labelled as generated in the data and never on the page

**What this decides:** Each Italian sense may carry a short English meaning that Lexema adds, in its own field beside the definition. Source English is used first. A model picks or writes the rest offline. The database records that a model made it, but the page shows no "AI" label. Every meaning can be reported.

## Context

A reader app wants English for the sense of the word a reader taps. On release `it-0c432803`, 57% of the 68,676 headwords with real senses carry no English translation at all ([#932](https://github.com/povlabs/lexema/issues/932)). The translations the source does carry are placed on records by translation placement ([#928](https://github.com/povlabs/lexema/issues/928), `src/lookup/translationPlacement.ts`), and the rest are listed per page as `unplaced_translations`.

Three records forbid what this needs:

- [ADR 0004](0004-cloudflare-workers-d1-vinext.md), *Language*: definitions are shown in the Italian the source wrote, "we do not translate them, because a translation would be a lexical claim we cannot ground."
- [ADR 0008](0008-generated-explanations-are-labelled-and-reportable.md): "No generated text is shown without its label", the page marks generated text as generated "where it appears, in words", and its 2026-09-21 amendment ends "Nothing else on a result page is translated."
- [ADR 0016](0016-page-shows-no-origin-marks.md), binding constraint: "Text written by a model is outside this record. [0008] still requires it to be labelled as generated."

Huey ruled on 2026-11-16 ([ruling](https://github.com/povlabs/lexema/issues/932#issuecomment-6918507985)):

> Huey's ruling (2026-11-16): yes to Lexema-generated English meanings per sense, with your design (source English first, model picks from unplaced candidates, writes new only when none fits, own field per definition, keyed on definition hash, offline batch, never in a request). Change: the generated label is database-only provenance (model, prompt version, time); users never see an 'AI' label. Huey: "we cant show that to users, if it is only db-label that s ok". Keep the report path on every meaning.

## Decision

**Lexema may add its own English meaning to each Italian sense, chosen from the source's English first and written by a model only when none fits, stored in its own field and labelled as generated in the database only.**

1. **Source English comes first.** A translation that translation placement puts on a record wins for that record's sense. Lexema writes nothing in its place.
2. **Then a model picks from the page's candidates.** When placement puts no translation on the sense, a model picks, for each sense, from the page's `unplaced_translations`.
3. **New English only when no candidate fits.** The model writes its own English meaning only when none of those candidates fits the sense.
4. **Its own field, per definition.** Each English meaning lives in its own field, one per definition. It is never written into `translations`, and never into a source value.
5. **Keyed on the definition text.** Each meaning is keyed on a hash of the definition text it explains. A definition that a newer source changes under [ADR 0025](0025-newer-source-definitions-are-authoritative.md) gets a new key, so its meaning is generated again; a meaning is never shown beside a definition it was not made for.
6. **Offline, in batch.** Generation runs offline over the data, in batch, like the import. It never runs inside a request.
7. **The label is database provenance only.** Each meaning carries in the data the model, the prompt version and the generation time, as [ADR 0008](0008-generated-explanations-are-labelled-and-reportable.md) requires of generated text. Users never see an "AI" or "generated" label for it. Every meaning keeps the report path: a reader can flag it as wrong.

The definitions themselves stay in the Italian the source wrote. An English meaning sits beside a definition; it never replaces or rewrites it. This record allows the field. It does not build it or choose its schema; [#933](https://github.com/povlabs/lexema/issues/933) does that.

**What it amends.** This record amends three records in part, for English meanings only:

- **[ADR 0004](0004-cloudflare-workers-d1-vinext.md).** Source definitions stay Italian and are not translated. An English meaning per sense is allowed as Lexema's own field beside them.
- **[ADR 0008](0008-generated-explanations-are-labelled-and-reportable.md).** For English meanings, the generated label is database-only provenance and is never shown on the page, so "No generated text is shown without its label" and "The page marks generated text as generated where it appears" do not apply to them. The report path is kept, and generation is offline only. The 2026-09-21 amendment's "Nothing else on a result page is translated" no longer excludes them. Generated explanations and examples keep their shown label.
- **[ADR 0016](0016-page-shows-no-origin-marks.md).** Its line that model text must be labelled as generated does not apply to English meanings. They show with no mark, like every other fact on the page.

**What it keeps.** ADR 0008's rule that "A generated item that has been reported stays visible only with the report count shown, or is withheld, never shown clean" applies to English meanings unchanged. The ruling did not change it. Loosening it is a new question for Huey. ADR 0008's other binding constraints hold too: no source text is replaced by generated text, and generated text supplies no grammar fact.

**Binding constraints.**

- A placed source translation always wins over a generated English meaning for the same sense.
- An English meaning is never stored in `translations` or in any source value, and `source_record_json` stays byte for byte.
- An English meaning is generated offline only, never inside a request.
- Every English meaning carries its model, prompt version and generation time in the data, and none is shown with a generated label.
- Every English meaning is reportable, and a reported one shows only with its report count, or is withheld.
- A meaning is keyed on its definition's text hash and is never shown beside a definition whose hash differs.

## Consequences

A reader sees English for most senses, not only the 43% of headwords whose source carries some. The page cannot tell a reader which English came from Wiktionary and which a model wrote. The data still can, and the report path is the reader's way to flag a wrong one. Wrong English is a certainty at some rate, and it is Lexema's own content rather than a copied fact.

The cost is a batch generation job, storage for one meaning per definition with its provenance, a model budget, and the report path extended to meanings. Where the rows are stored, and how the seed and lookup read them, is [#933](https://github.com/povlabs/lexema/issues/933)'s, under ADR 0008's rule that generated content is stored beside the release it describes. ADR 0008's constraint that bulk generation waits for a small batch over the twelve spot-check words still holds, and the ruling asks for that batch first.

[docs/KNOWN_LIMITATIONS.md](../docs/KNOWN_LIMITATIONS.md) no longer says Lexema adds no translation.

## Records

New term **English meaning**, defined in [.glossary/TERMS.md](../.glossary/TERMS.md) in the same change. The `translation` row's *Not* column is reworded so it no longer says no Lexema translation exists.
