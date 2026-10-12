---
id: 0033
title: Wikidata lexemes answer an Italian word only when no Wiktionary reading does
status: accepted
date: 2026-10-11
tags: [data, provenance, licensing]
---

# 0033 — Wikidata lexemes answer an Italian word only when no Wiktionary reading does

**What this decides:** Lexema may answer an Italian word that Italian Wiktionary lacks from Wikidata's free (CC0) Italian lexemes, kept in a layer of their own beside the source data, and never in place of a Wiktionary reading. This amends [ADR 0009](0009-two-licences-and-a-source-link.md) in part.

## Context

Common Italian words such as *stanotte*, *domattina*, *oddio* and *paralimpico* get no answer from `/v1/lookup` and no page on lexema.fyi, because it.wiktionary has no page Lexema reads for them ([#802](https://github.com/povlabs/lexema/issues/802)). The count for that epic ([reports/2026-10-11-missing-common-words.md](../reports/2026-10-11-missing-common-words.md), [#807](https://github.com/povlabs/lexema/issues/807)) looked up the 20,000 most frequent subtitle words, plus 14 words the brief names, through Lexema's real lookup on release `it-0c432803`. It found 1,162 missing words: 965 are our bug, 137 are in no source, and **60 are in Wikidata's Italian lexemes**. Of those 60, 20 have a sense with an Italian gloss; the other 40 have none. *paralimpico* is lexeme [L1247138](https://www.wikidata.org/wiki/Lexeme:L1247138).

Wikidata publishes its Lexeme namespace under CC0: "All structured data from the main, Property, Lexeme, and EntitySchema namespaces is available under the [...] Creative Commons CC0 License" ([Wikidata:Copyright, revision 1523614187](https://www.wikidata.org/w/index.php?title=Wikidata:Copyright&oldid=1523614187)). It ships every lexeme in a weekly dump, `https://dumps.wikimedia.org/wikidatawiki/entities/latest-lexemes.json.gz` (dated 2026-10-07 when this was written).

Huey was told that Wikidata's ~65,000 Italian words are CC0 (public domain) but mostly without meanings. He answered, in chat on 2026-10-11, quoted verbatim in [#802's brief](https://github.com/povlabs/lexema/issues/802):

> ok we can get them

This record transcribes that ruling. Until now every reading Lexema serves comes from Italian Wiktionary, or from en.wiktionary on a ruling ([ADR 0031](0031-hand-kept-readings-fill-source-gaps.md)), so a second source needs its own record. Wikidata proper names ([#794](https://github.com/povlabs/lexema/issues/794): items, not lexemes) are a separate decision with their own ADR, which had not landed when this was written. This record sets the refresh and the credit so that record can cite them.

## Decision

**Lexema may keep Wikidata words: Italian lexemes from Wikidata (CC0), stored as imported in their own layer beside the source data, and read for a spelling only when no Wiktionary reading answers it.**

- **What it adds.** A Wikidata word is an Italian lexeme (language Q652) with its lemma, its part of speech, its forms and the Italian (`it`) glosses of its senses. Its part of speech is its lexical category, mapped by a fixed table onto the closed set (`POS_BY_TITLE` in `src/italian/partOfSpeech.ts`); a lexeme whose category the table does not map is not kept. Glosses in other languages are never shown. A lexeme is kept when at least one of its spellings, lemma or form, is a spelling no Wiktionary reading answers. The 60 words of the count are the first measured set.
- **Wiktionary wins.** A lookup reads the Wikidata layer for a spelling only after every Wiktionary reading of it, and only when there is none: no source record, recovered entry, declared lemma or hand-kept reading answers it. A hidden record ([ADR 0023](0023-foreign-records-are-hidden-not-deleted.md)) answers nothing, so it neither shows nor blocks a Wikidata word. Where both have a word, only the Wiktionary entry shows. When a later Wiktionary release or a lookup fix starts answering a spelling, its Wikidata word stops showing for it, with no ruling and no deletion; the rows stay.
- **Kept apart.** The layer is its own table, keyed by lexeme id, like `hand_kept_definition` ([ADR 0031](0031-hand-kept-readings-fill-source-gaps.md)). It keys to no archive line, raw page or source row. `source_record_json` and every source row stay as imported. The Wiktionary diff feed ([ADR 0025](0025-newer-source-definitions-are-authoritative.md)) neither reads nor writes the layer, so it never overwrites or deletes a Wikidata word.
- **Refresh.** The input is a pinned snapshot of Wikidata's Italian lexemes, taken from the lexeme dump, with its dump date and SHA-256 recorded, as a Wiktionary release records its own. A newer snapshot is diffed against the layer by lexeme id, never re-imported whole, and the master is never re-seeded for it. In the spirit of ADR 0025, newer Wikidata data is authoritative for this layer and applied without per-word review: a new lexeme is added, and a changed lexeme replaces the one served while the older rows are kept as history. A lexeme absent from the newer snapshot is reported and left serving, as a lost source record is. Accuracy is investigated when a user reports a problem.
- **Credit and link.** On a Wikidata word's page, *Fonte* links to its lexeme, `https://www.wikidata.org/wiki/Lexeme:L<n>`. The Licenza page carries one Wikidata credit, which every Wikidata layer shares ([ADR 0009](0009-two-licences-and-a-source-link.md), as amended by this record).
- **API.** Each result's `attribution` field for a Wikidata word names Wikidata as the source, the lexeme URL as `source_url`, and CC0 1.0 (`https://creativecommons.org/publicdomain/zero/1.0/`) as the licence: Lexema passes a Wikidata word on under CC0, as it received it, so ADR 0009's CC BY-SA 4.0 for everything Lexema publishes does not reach it. A Wiktionary result's field is unchanged.
- **No meta notes.** A Wikidata word shows as an ordinary entry, with no mark of where it came from ([ADR 0016](0016-page-shows-no-origin-marks.md)). A word with no Italian gloss shows its part of speech and forms, and no note about the meaning it lacks. The 2026-10-12 [amendment](#amendments) loads no such word.
- **The source-data rule.** AGENTS.md's "Source-derived lexical data is read-only" rule holds for Wikidata words as for Wiktionary data: they are kept as imported, keep where each fact came from, and every valid candidate is returned.

**Binding constraints.**

- No Wikidata word shows for a spelling any Wiktionary reading answers.
- No Wikidata write edits `source_record_json` or any source row, and no Wiktionary update edits or deletes a Wikidata row.
- Every Wikidata word keeps its lexeme id and the snapshot it came from, and its *Fonte* link and `attribution` field reach its lexeme.
- No text is invented or generated for a Wikidata word, and no gloss in another language is translated into Italian.
- Wikidata words reach the shared dictionary only through a change declaration and the dictionary deploy ([ADR 0018](0018-previews-on-workers-builds.md)). No agent writes D1.
- Proper names (Wikidata items) are outside this record; [#794](https://github.com/povlabs/lexema/issues/794) decides them.

## Consequences

- Words such as *stanotte*, *oddio* and *paralimpico* get an entry. Most of them show no meaning at first, because about two thirds of the counted lexemes carry no Italian gloss. The 2026-10-12 [amendment](#amendments) serves only the glossed ones instead.
- Lexema has two sources. The Licenza page, the API and the *Fonte* link each say which one an entry comes from, while the page itself shows no origin mark.
- Wikidata is edited openly, so a lexeme can carry a mistake or vandalism, and a refresh can bring one in. As with ADR 0025, that is investigated on a user report.
- The layer adds rows to D1. The import ([#812](https://github.com/povlabs/lexema/issues/812)) checks their size and cost before it lands.
- Nothing above is legal advice. As [ADR 0013](0013-site-public-behind-rate-limits.md) requires of any change to what is published or how it is credited, the credit was checked against the source's licence: CC0 asks for none, and Lexema gives one anyway.

## Records

New term **Wikidata word**, defined in [.glossary/TERMS.md](../.glossary/TERMS.md) in the same change.

## Amendments

- **Only a lexeme with an Italian gloss is served (2026-10-12).** A preview showed *paralimpico* as a bare "Aggettivo" with no meaning. 44 of the 63 lexemes of the first snapshot carry no Italian gloss. Huey was asked "Ship only the 19 Wikidata words that have a definition, and put the 44 on the add-by-hand list?" and answered "yes" ([ruling](https://github.com/povlabs/lexema/issues/802#issuecomment-6132217647)). So `load:wikidata-words` writes a lexeme only when at least one of its senses has an Italian gloss; a lexeme with none stays in the committed snapshot as imported and is not loaded. This narrows "What it adds" and replaces "A word with no Italian gloss shows its part of speech and forms" under *No meta notes*, and the first consequence: *stanotte*, *oddio* and *paralimpico* get no Wikidata entry, and the 44 go on the add-by-hand list ([#803](https://github.com/povlabs/lexema/issues/803)). *Wiktionary wins* and every binding constraint above stand as written.
