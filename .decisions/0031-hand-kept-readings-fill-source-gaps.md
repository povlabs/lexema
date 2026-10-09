---
id: 0031
title: Lexema may keep a cited, ruled reading the source lacks, beside the source data
status: accepted
date: 2026-10-09
tags: [data, provenance]
---

# 0031 — Lexema may keep a cited, ruled reading the source lacks, beside the source data

**What this decides:** When Italian Wiktionary has no section for a reading of a word, Lexema may keep that whole reading by hand, beside the source data, on Huey's ruling and citing a pinned en.wiktionary revision that shows it. This amends [ADR 0027](0027-curated-corrections-are-cited-exceptions.md) in part, and narrows ADR 0012, ADR 0024 and ADR 0008 as the Decision says.

## Context

Lexema shows `si` only as the musical note, and `come` only as an adverb and a preposition ([#745](https://github.com/povlabs/lexema/issues/745)). The source has no pronoun record for `si` and no conjunction for `come`, because Italian Wiktionary has no such section: it.wiktionary `si` revision 3890195 has only `{{-sost-|it}}`, and `come` revision 4075938 only `{{-avv-|it}}` and `{{-prep-|it}}`. Both revisions predate dump `itwiktionary-20260701`, so no recovery rule ([ADR 0024](0024-italian-pages-the-extraction-skips-are-recovered.md), [ADR 0029](0029-recovered-layer-reads-bullet-prose-lines.md)) can add these readings. en.wiktionary has both: `si` [revision 93469502](https://en.wiktionary.org/w/index.php?title=si&oldid=93469502) has a `====Pronoun====` under `===Etymology 1===`, and `come` [revision 93379611](https://en.wiktionary.org/w/index.php?title=come&oldid=93379611) has a `===Conjunction===`.

[ADR 0027](0027-curated-corrections-are-cited-exceptions.md) lets a curated correction set right one fact of a record or page-only entry that already exists. A missing reading is no fact of an existing record, so no correction can add it. Huey was asked: "should Lexema keep a short hand-kept list of whole readings, each citing an en.wiktionary revision, starting with "si" (pronoun) and "come" (conjunction), since the Italian Wiktionary itself has no such readings?" He answered, verbatim ([ruling](https://github.com/povlabs/lexema/issues/745#issuecomment-6080245573)):

> yes

The same comment says this needs an ADR change and that Huey approves the Italian wording on the pull request. This record transcribes that ruling. It is a new kind of curated data, not a refinement of ADR 0027's mechanics, so it amends ADR 0027 in part; ADR 0027's other decisions stand.

## Decision

**Lexema may keep a hand-kept reading: a whole reading the source lacks (a word, a part of speech, its Italian definitions), stored beside the source data, citing at least one pinned en.wiktionary revision that shows it, and added only on a ruling.**

- **What a reading is.** A word, a part of speech from the closed set (`POS_BY_TITLE` in `src/italian/partOfSpeech.ts`), and at least one Italian definition. Each definition is Lexema's wording, paraphrased from one sense line of the cited revision; English glosses are never copied. The type makes a reading without these unrepresentable (`handKeptReading` in `src/italian/handKeptReadings.ts`), and the table refuses the same with CHECKs.
- **The list.** The committed list `HAND_KEPT_READINGS` holds every reading, each with its evidence and the ruling that added it. The first two are `si` as a pronoun (`Pronome`) and `come` as a conjunction (`Congiunzione`), from the ruling above.
- **Storage.** The seed writes each reading as `hand_kept_definition` rows, one per definition, and `pnpm run correct:records` writes them into a master seeded before them. A reading keys to nothing in the source: no archive line, no raw page, no `recovered_entry` row. A lookup reads it beside the source's readings of its word, after them (`src/lookup/handKept.ts`).
- **No mark on the page.** The page shows a hand-kept reading as an ordinary reading, with no mark of where it came from ([ADR 0016](0016-page-shows-no-origin-marks.md)).
- **How it differs from a curated correction.** A correction sets right one fact of a record or entry that exists, and a later release that replaces the record drops it. A hand-kept reading adds a reading no record or entry holds, so no release replaces it. If the source later gains the same reading, whether to retire the hand-kept one is a new ruling.

**What it narrows.**

- [ADR 0012](0012-archive-is-the-release-seed.md) binds "No text authored by Lexema is written by the seed". The seed may also write each hand-kept reading's approved Italian wording into `hand_kept_definition`, and no other Lexema text. The archive line and every source row stay as imported. That the seed reads the list at all is a seed-time input this record allows, as ADR 0027 did for the correction list.
- [ADR 0024](0024-italian-pages-the-extraction-skips-are-recovered.md) binds that "an entry is not recovered by hand". A hand-kept reading is not a recovered entry and is not stored as one: it has no raw page, no page rule and no `recovered_entry` row. Recovered entries are still read only by rule from the page.
- [ADR 0008](0008-generated-explanations-are-labelled-and-reportable.md): approved wording is Lexema's text, not generated text, as its 2026-10-03 amendment says for #450. An agent may draft the definitions from the cited evidence. Once Huey approves the exact wording on the pull request, they show unlabelled. Wording no person approved is still generated text, and never enters the list.

**Binding constraints.**

- Every reading cites at least one en.wiktionary revision by its permanent link (`https://en.wiktionary.org/w/index.php?title=…&oldid=…`), and says what that revision shows.
- No reading without a ruling, and no wording without Huey's approval of the exact text on its pull request.
- No mark of a hand-kept reading on the page (ADR 0016).
- A hand-kept reading never edits `source_record_json` or any imported row.
- These readings reach the shared dictionary only through a change declaration and the dictionary deploy. No agent writes D1.

## Consequences

- `si` reads as a noun and a pronoun, and `come` as an adverb, a preposition and a conjunction. Any consumer of Lexema's readings sees them.
- Each further reading costs a ruling, a citation and Huey's approval of its wording, so the list stays short. `li` (pronoun) and `tre` (numeral) from the same report each need their own ruling.
- A hand-kept reading carries no forms, grammar, pronunciation or examples: only its definitions. A noun reading would show no articles.
- The API names a hand-kept reading by the revision it cites and its section line, as it names a page-only entry: `<release>:page:<revisionId>:<line>`.
