---
id: 0032
title: Wikidata is a second source, for proper names Wiktionary does not explain
status: accepted
date: 2026-10-11
tags: [data, provenance, licensing]
---

# 0032 — Wikidata is a second source, for proper names Wiktionary does not explain

**What this decides:** Lexema adds proper names from Wikidata (CC0) as *name entries*: places, groups, languages, currencies and holidays with an Italian label, an Italian description and an Italian Wikipedia page. Wiktionary stays the source of everything else. A name entry fills only a spelling the dictionary has nothing to read for, is kept beside the source data, and is refreshed as a diff. This amends [ADR 0009](0009-two-licences-and-a-source-link.md) in part and narrows [ADR 0016](0016-page-shows-no-origin-marks.md) and [ADR 0012](0012-archive-is-the-release-seed.md) as the Decision says.

## Context

Names in real Italian texts come back from Lexema with no entry: a reader app built on the API taps *Hormuz* or *Brent* in a news text and gets nothing, and each client of the API would otherwise build its own table of names ([#794](https://github.com/povlabs/lexema/issues/794)). Wikidata has the names, each with an Italian label and a short Italian description, under CC0.

Huey ruled on 2026-10-11, in chat, quoted verbatim on [#794](https://github.com/povlabs/lexema/issues/794). Shown the counts of names with an Italian Wikipedia page by category (countries, continents, seas, rivers, lakes, mountains, islands, Italian comuni, cities over 100,000 people, international organisations, political parties, listed companies, football clubs, languages, currencies, holidays and festivals; about 49,000):

> rivers+seas+countries.. what else?

> no for now, let's add these, they are fine. for people idk

Asked "Add all the listed categories (~49,000), not just a 13,000 starter set?":

> yes all of them, for people can we get just well-knowns?

Asked "People: those with a Wikipedia page in 50+ languages, plus anyone with an Italian page who appears in a news test text. Count first and show Huey the number before adding anyone?":

> yes

## Decision

**A name entry is a proper name from Wikidata: one item, its Italian label, its Italian description and the category that admitted it. It is stored beside the source data, shown after the source's readings of its spelling, and only where the dictionary has nothing to read for that spelling.**

- **What it adds.** One entry per Wikidata item of the ruled categories (`NAME_CATEGORIES` in `src/names/nameCategories.ts`) that has an Italian label, an Italian description and an Italian Wikipedia page. The label is the item's Italian label, or the label Wikidata keeps for every language (`mul`), which it shows as the Italian one where none is set (`euro`). An item with no Italian description is left out: it would be an entry with nothing to read. The entry reads as `Nome proprio`, and its one definition is the description, verbatim.
- **Wiktionary stays the source of everything else.** A name entry adds a reading; it never edits, hides or reorders a source record, a recovered definition, a page-only entry or a hand-kept reading. No Wiktionary row is touched.
- **Only where nothing answers.** An item is left out when its label's search key already finds something to read: a served record headed by that key with a meaning the page shows, any served record whose table lists it, a page-only entry with a definition, a hand-kept reading, or, for a key nothing spells, a multi-word headword the key's words spell ([#214](https://github.com/povlabs/lexema/issues/214)) or an essere agreement cell it names ([#676](https://github.com/povlabs/lexema/issues/676)). The lookup tries a name entry before those two routes, so the load reads them as the lookup does. Search ignores capitals, so `Sale` the comune is left out because `sale` the salt noun answers its key, and `Iran` and `Italia` because Wiktionary explains them. A record headed by the key with no meaning (`Giulia`, whose one sense has no gloss) answers nothing, so the name is added after it. So every page that shows something today shows exactly that afterwards.
- **One label, several items.** Every item a label names is its own entry, and all of them are shown, as every candidate is ([AGENTS.md](../AGENTS.md)). They come in the list's category order, then the older item (lower number) first: `Europa` reads the continent, then the island. A commodity no category admits (*Brent* crude, *WTI*) is not added, and no hand list adds one.
- **Kept apart.** Name entries live in their own table, `name_entry`, keyed to nothing in the source. The committed snapshot `names/wikidata-names.jsonl` holds them, one item per line in shown order; `pnpm run names:fetch` writes it from Wikidata, one SPARQL query per category.
- **Refreshed as a diff.** `pnpm run load:names` writes the snapshot into a seeded master: an item the master lacks or holds with other text is written, and an item no longer served (gone from the snapshot, or its key now answered by the source) is removed. It reaches the shared dictionary only through a change declaration and the dictionary deploy ([ADR 0018](0018-previews-on-workers-builds.md)). [ADR 0025](0025-newer-source-definitions-are-authoritative.md)'s diff feed reads only Wiktionary records and never touches `name_entry`; a refresh of the names is a pull request whose snapshot diff is the names that changed, applied the same way.
- **People wait.** Well-known people (an Italian Wikipedia page and pages in 50 or more Wikipedias, or named in a news test text) are counted on #794 and added only after Huey's OK there, as a further category.

**What it amends and narrows.**

- [ADR 0009](0009-two-licences-and-a-source-link.md): a name entry's credit is its Wikidata item, under CC0, which CC BY-SA 4.0 publication allows. Its amendment of 2026-10-11 records the page, footer, `/licence` and API changes.
- [ADR 0016](0016-page-shows-no-origin-marks.md) binds "no origin mark on a result page". A name entry carries its own small *Fonte* link to its Wikidata item, because the page's one *Fonte* opens a Wiktionary page, which is not where a name entry comes from. It is the credit the licence asks for, in the same style as the page's *Fonte*, and nothing else marks the entry.
- [ADR 0012](0012-archive-is-the-release-seed.md) binds "Any other seed-time input is a new decision". This record allows one: a development seed of a fixture (`pnpm run seed:dev`, not an archive) reads `fixtures/names/dev-names.jsonl`, a few items of the snapshot verbatim, and writes them as `load:names` writes the snapshot, under the same rule, so the fixture dictionary shows name entries as the shared one does. A seed of an archive reads no names: its names come from `load:names`.

**Binding constraints.**

- No name entry changes a source row, a recovered row, a corrected row or a hand-kept row.
- No name entry is served for a key the dictionary already answers.
- Every name entry has an Italian description and points at its Wikidata item.
- No person is added without Huey's OK on #794.
- Name entries reach the shared dictionary only through a change declaration and the dictionary deploy. No agent writes D1.

## Consequences

- *Hormuz*, *mar Mediterraneo*, *Brent* (the Thames tributary) and about 28,700 other names read with an Italian description on the site and through `/v1/lookup` and `/v1/lookup/batch`, each credited to its Wikidata item.
- About 17,000 items of the ruled categories have no Italian description and are not added; a later ruling may say what such an entry would show.
- A name entry carries no forms, grammar, pronunciation or examples, and no translations.
- A name whose key Wiktionary later explains stays served until the next `load:names` removes it; until then both show.
- The API names a name entry `<release>:wikidata:<item>`, and its `attribution` names Wikidata, CC0 1.0 and the item's page.
