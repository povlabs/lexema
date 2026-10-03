---
id: 0019
title: Source-derived text may be rewritten by fixed rules for consistency, never the raw record it came from
status: accepted
date: 2026-09-30
tags: [data, provenance]
---

# 0019 — Source-derived text may be rewritten by fixed rules for consistency, never the raw record it came from

**What this decides:** Lexema may store small, rule-based rewrites of source text so the same meaning reads the same way across the dictionary. The raw imported record is never touched, so the original text can always be shown.

## Context

Wikizionario's volunteers write the same thing in different ways. *vado*'s form gloss reads "1ª persona singolare…" while *faccio*'s reads "prima persona singolare…". Across the Italian release, 499,427 form glosses start with "prima/seconda/terza persona" and only 177 with "1ª/2ª/3ª persona" ([#257](https://github.com/hueypov/lexema/issues/257)).

Until now the rule was to keep source data exactly as imported. AGENTS.md says "Source-derived lexical data is read-only: keep it as imported", and [ADR 0012](0012-archive-is-the-release-seed.md) rejects "correcting a record in place", saying "Source data stays as imported".

Huey ruled on 2026-09-30, in conversation, recorded on [#257](https://github.com/hueypov/lexema/issues/257) ("Ruling: change it in our database") and [#258](https://github.com/hueypov/lexema/issues/258): "we might bend the rules a little to keep the consistency across the db". He asked for the rule to be saved as an ADR.

This record amends ADR 0012 in part: its rule that source data stays as imported now allows the rewrites below in the structured rows. Its binding constraint that every archive line is stored unaltered in `source_record_json` stands, and so does its ruling that a reader's report is never applied automatically.

## Decision

**Lexema may store a small, fixed, rule-based rewrite of source-derived text, a *source text normalization*, when it makes the same meaning read the same way across the dictionary, and the raw imported record stays byte-for-byte as imported.**

- **What may change.** Only spelling or wording that does not change meaning, such as an abbreviation written out the way most of the source already writes it. Never new facts, never generated or invented text, and never a fix to what a definition says.
- **How it is written.** Each rewrite is a fixed rule: the same input always gives the same output, and it matches a narrow, exact pattern. No model and no judgement call is involved.
- **One issue per rewrite.** Each rewrite is its own issue, stating its pattern and how many rows it changes in the current release, and it lands with a test of what it changes and what it leaves alone.
- **The raw record stays.** `source_record_json` keeps the archive line byte-for-byte, so the original text and where it came from can always be proven.
- **Applied at import.** The seed writes the rewritten text into the structured rows. A database already seeded gets the same change through a one-off update that can be run twice with no further effect and reports the rows it changed.
- **First case.** [#257](https://github.com/hueypov/lexema/issues/257): a form gloss starting "1ª/2ª/3ª persona" is stored as "prima/seconda/terza persona", in 177 glosses of release `it-0c432803`.

**Binding constraints.**

- A rewrite never changes meaning and never adds text Lexema wrote.
- `source_record_json` is never rewritten.
- Every rewrite has its own issue, its row count and a test.
- A rewrite runs the same at import and in the one-off update, and the update is safe to run twice.
- Every rewritten value keeps the provenance [ADR 0009](0009-two-licences-and-a-source-link.md) requires, pointing at the record it came from.

## Consequences

- The dictionary reads more evenly, and a page shows one spelling where the source used two.
- The structured rows no longer always match the source text word for word. The raw record is where the original lives, so the difference is always provable, and [ADR 0016](0016-page-shows-no-origin-marks.md) still holds: the page shows no mark for a rewritten value.
- The attribution page's statement that Lexema restructured the text ([ADR 0009](0009-two-licences-and-a-source-link.md)) already covers these rewrites; CC BY-SA allows adaptation.
- CI writes the one-off update to the shared `lexema-dictionary`: the dictionary deploy workflow of [ADR 0018](0018-previews-on-workers-builds.md) applies it through Wrangler after the merge that declares it. Agents never hold the Cloudflare key, run that workflow or write the shared dictionary. The update does not go through the Worker's dictionary binding, which stays read-only.
- Each new rewrite costs an issue, a ruling and a test. That is on purpose, so the list stays short.

## Records

Coins **source text normalization**, added to [.glossary/TERMS.md](../.glossary/TERMS.md) in the same change, kept apart from the Italian search normalization in `src/italian/normalize.ts`.

## Amendments

- **#454 — CI writes the shared dictionary (2026-10-03).** Following [ADR 0018](0018-previews-on-workers-builds.md)'s amendment of the same day, which transcribes Huey's rulings on [#443](https://github.com/hueypov/lexema/issues/443) and [#446](https://github.com/hueypov/lexema/issues/446), the one-off update of the shared dictionary is written by the dictionary deploy workflow, not from Huey's laptop. Agents still never hold the key or write the shared dictionary.
