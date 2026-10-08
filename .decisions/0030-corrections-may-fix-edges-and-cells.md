---
id: 0030
title: A curated correction may also add or fix a form_of edge and set a conjugation cell, never edit the record
status: accepted
date: 2026-10-07
tags: [data, provenance]
---

# 0030 — A curated correction may also add or fix a form_of edge and set a conjugation cell, never edit the record

**What this decides:** Besides gender and number, Lexema may correct two more kinds of source fact beside the record: a form's `form_of` edge (adding a missing one, or fixing one that names the wrong word), and one cell of a verb's conjugation table. Each still needs evidence and a ruling, and the imported record stays byte for byte. This amends [ADR 0027](0027-curated-corrections-are-cited-exceptions.md) in part.

## Context

[ADR 0027](0027-curated-corrections-are-cited-exceptions.md) allows a curated correction to set a record's gender or number (`CorrectableValues` in `src/italian/curatedCorrections.ts`). Its Consequences say a new dimension extends the layer under its rules, but the census of every word page ([#707](https://github.com/povlabs/lexema/issues/707)) found source facts of other kinds that the page cannot set right without guessing:

- **A form record with no `form_of` edge.** `aerei`'s noun record says "plurale di aereo", and `costruttori`'s says "plurale di costruttore", but neither carries an edge, so the page reads each as a word of its own ([#715](https://github.com/povlabs/lexema/issues/715) measured 753 pages with such a record). The manifest's "no edge is invented" and [ADR 0019](0019-source-text-may-be-normalized.md)'s rule that a normalization adds no fact both forbid the page from adding the edge itself.
- **An edge that names the wrong word.** `parti`'s senses 2 and 3 are about `parto`, whose table lists `parti`, but their edges name `neonato` and `Parti` ([#701](https://github.com/povlabs/lexema/issues/701)).
- **A wrong conjugation cell.** `assorbire`'s plural essere cells read `siamo assorbito, assorti, assorti` as the source stores them ([#685](https://github.com/povlabs/lexema/issues/685); assorbire's line in `fixtures/essere-compound-cells.jsonl`).

On 2026-10-07 Huey answered every question on [#708](https://github.com/povlabs/lexema/issues/708) "all yes" ([ruling](https://github.com/povlabs/lexema/issues/708#issuecomment-6047197445)), each question's recommended answer being the ruling. Questions 7 to 10 ([asked here](https://github.com/povlabs/lexema/issues/708#issuecomment-6037557199)) approve these three corrections. This record transcribes that ruling. It is a new ruling, not a refinement of ADR 0027's own mechanics, so it amends ADR 0027 in part; ADR 0027's other decisions stand.

## Decision

**A curated correction may add a missing `form_of` edge, replace an edge that names the wrong word, or set one cell of a verb's conjugation table, each beside the record on cited evidence and a ruling, and never by editing the record.**

- **A `form_of` edge added by a ruled rule (Q7, Q8).** A ruled rule adds a `form_of` edge to a word X on a form record that has no edge, only when both hold: the record's gloss names X after "di", and X's own forms table lists the record's word. `aerei` and `costruttori` then read as forms of `aereo` and `costruttore`. Every record the rule does not confirm stays as the source states it. The rule is named and versioned like `it-plural-gloss-number` (ADR 0027's first amendment), reads only the record's archive line and the evidence it cites, and changing what it confirms is a new version and a new ruling.
- **A wrong edge fixed on the same evidence (Q9).** The same kind may replace an edge that names the wrong word, under the same two conditions: the gloss names X after "di", and X's table lists the word. `parti`'s senses 2 and 3 then point to `parto`.
- **A conjugation cell set by hand (Q10).** A hand correction sets one cell of a verb's conjugation table, citing the pinned Wiktionary conjugation page by revision id. The first are `assorbire`'s plural essere cells.
- **The same layer, the same rules.** These are new dimensions of ADR 0027's layer, not a new exception to the read-only rule. Where and how each kind is stored is the building issue's work.

**Binding constraints.**

- Every binding constraint of [ADR 0027](0027-curated-corrections-are-cited-exceptions.md) holds for these kinds: `source_record_json` and the record's imported rows stay byte for byte; no correction without a cited source revision and a ruling; no mark of a correction on the page ([ADR 0016](0016-page-shows-no-origin-marks.md)); no correction carried onto a record that replaces the corrected one.
- The page never guesses an edge. An edge exists on the page only where the source states it or a correction of this kind adds or fixes it.
- An edge correction requires both the gloss naming X after "di" and X's own forms table listing the word. A gloss alone, or a table alone, is not evidence.
- A cell correction sets one cell, and cites the pinned conjugation page that shows it. Its spelling is the page's, never one Lexema writes ([ADR 0012](0012-archive-is-the-release-seed.md)'s "No text authored by Lexema is written by the seed" stands).
- [ADR 0023](0023-foreign-records-are-hidden-not-deleted.md) still holds: a hidden record has no `form_of_edge` rows, and no edge correction gives it one.
- These corrections reach the shared dictionary only through a change declaration and the dictionary deploy. No agent writes D1.

## Consequences

- [#709](https://github.com/povlabs/lexema/issues/709)'s tests and the fixes after them have a written rule for `aerei`, `costruttori`, `parti` and `assorbire`.
- How many records the edge rule corrects is not measured; the fix issue measures it ([#715](https://github.com/povlabs/lexema/issues/715) counted 753 pages with a form record and no edge).
- Only `parti` is known to have a wrong edge, and only `assorbire` a wrong cell. Other verbs with two participles are not measured, and each further cell needs its own ruling.
- A feed update that replaces a corrected record reports the correction and drops it, as for gender and number; whether to correct the new record is a new ruling.

## Amendments

- **An edge correction cites the two Wiktionary pages it comes from (2026-10-08).** The building issue first had each edge correction cite two lines of Lexema's archive: the record's own gloss and the base word's forms cell. Huey ruled against it ([ruling](https://github.com/povlabs/lexema/issues/722#issuecomment-6058471600), verbatim: "no who cares about our data, we got that from wikti, cite wikti that's all"). So an edge correction cites two it.wiktionary pages, each pinned by revision id: the record's own page, which shows the gloss naming X after "di", and X's page, whose forms table lists the word. The revision is the one in the dump the archive was extracted from (`itwiktionary-20260701` for `it-0c432803`), so each link shows the text the archive read. The rule reads that dump only for those revision ids, and a sense whose page or X's page has no revision there gets no edge. The two conditions above are unchanged: the gloss and the table are still the evidence, and the pages are where they are cited.
