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

## Amendments

- **A hand-kept table may give a pronominal verb the base table the source does not settle (2026-10-16).** Rule `it-regular-conjugation/v1` gives a pronominal verb with no base table the regular cells of the class the source settles, and declines 24 verbs whose class it does not ([#838](https://github.com/povlabs/lexema/issues/838), [report](../reports/2026-10-16-pronominal-regular-tables.md)): `-ire` with or without `-isc-`, another `-iare`, the second conjugation, verbs made on `fare`, `dare` or `trarre`, and a call that overrides forms. Huey's ruling on #838 already said that such a verb gets a hand-kept table citing an en.wiktionary revision, or is listed for him, and is never guessed ([ruling](https://github.com/povlabs/lexema/issues/838#issuecomment-6214333127)). Asked on 2026-10-16 "Should I start the 24 hand-added tables next?", each table citing Wiktionary, he answered "yes" (quoted verbatim in [#844](https://github.com/povlabs/lexema/issues/844)). The Consequences above say a hand-kept reading carries no forms; a hand-kept table is the one place Lexema keeps forms by hand, and only as this amendment allows.
  - **What may be kept.** The base verb's table of one pronominal verb the rule declines, in one of two ways: a regular class `regularCells` builds, on a stem (`impadronirsi`: `ire-b` on `impadron-`), where the cited call names that class; or the base verb's own simple forms, slot by slot, where it names none (`avvedersi`: *avvidi*, *avvisto, avveduto*). Nothing else: no pronominal spelling, no compound tense, no auxiliary. `it-pronominal-conjugation/v1` builds the pronominal table on the kept cells exactly as on a record's, essere and `it-essere-agreement/v2` included, and the page draws it with no mark ([ADR 0016](0016-page-shows-no-origin-marks.md)). The rule's own answer goes first: a table is read only for a verb it declines.
  - **The list.** The committed list `HAND_KEPT_TABLES` in `src/italian/handKeptTables.ts`. Each entry names its verb, its base, what it keeps, at least one en.wiktionary revision of the verb's page or the base's by permanent link, with the `{{it-conj}}` call that revision's Conjugation section writes, and the #838 ruling. The constructor `handKeptTable` refuses an entry with no permanent link, no ruling, a base that is not the verb's, a class that does not write the base on its stem, or a kept slot that is not a form.
  - **How it is checked.** Each cited revision's wikitext is pinned under `fixtures/hand-kept-tables/`, its SHA-1 equal to the one the MediaWiki API states, beside the table its call expands to (`action=expandtemplates`). `test/handKeptTables.test.ts` checks every kept cell, and every pronominal cell built on it, against that table, cell for cell. A verb en.wiktionary has no page for, nor for its base, gets no table and is listed for Huey: `attremirsi`, `sdarsi` and `inostrarsi`.
  - **What it narrows in [ADR 0012](0012-archive-is-the-release-seed.md).** Every conjugation spelling built by rule is "built when the page is built and never stored". A hand-kept table is not stored either: it lives in the committed list in `src/`, the seed writes no row for it, and the page reads it when it is built. The archive line and every source row stay as imported, and no table edits `source_record_json` or any imported row.
  - **How it changes.** Adding, changing or retiring a table is a pull request on a ruling, its cells checked against the pinned revisions. If the source later settles a verb's class, the rule's answer takes the page, and retiring the kept table is a new ruling.
- **A hand-kept reading may be another spelling of a word the source has, and lead to it (2026-10-17).** The Constitution writes `eguaglianza` (art. 3); the source has no record of it, it.wiktionary has no page, and en.wiktionary's ([revision 71378670](https://en.wiktionary.org/w/index.php?title=eguaglianza&oldid=71378670)) is a noun whose one sense line is `# {{alt form|it|uguaglianza}}` ([#830](https://github.com/povlabs/lexema/issues/830)). The issue proposed a hand-kept reading citing that revision, "leading to `uguaglianza`", and Huey answered ([ruling](https://github.com/povlabs/lexema/issues/830#issuecomment-6233334459)): "yes to all three as proposed".
  - **What it adds.** A definition whose cited sense line names the reading another spelling of an Italian word (`{{alt form|it|…}}`, `{{alternative form of|it|…}}`, `{{alt sp|it|…}}`, `{{alternative spelling of|it|…}}`; `alternativeOf` in `src/italian/handKeptReadings.ts`) gives the reading a lemma link to that word, at that definition, read as a page-only form's link is (`src/lookup/handKept.ts`). The definition must write the word, and `handKeptReading` refuses one that does not, so the page links it there. Nothing new is stored: the link is read from the cited line the `hand_kept_definition` row already holds.
  - **What the page shows.** The reading is a form of that word, as a source record that says "variante di" is: `eguaglianza`'s page shows "variante di uguaglianza", the word linked, then uguaglianza's *Definitions* and *Forme di uguaglianza*. The Consequences' "carries no forms" still holds: the grid is uguaglianza's own record's.
  - Every binding constraint above holds: a permanent link, a ruling, wording Huey approves on the pull request, and no mark on the page.
