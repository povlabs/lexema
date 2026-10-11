---
id: 0016
title: A result shows every fact as the dictionary's, with no mark for where it came from
status: amended-in-part by [0032](0032-wikidata-names-fill-proper-name-gaps.md)
date: 2026-09-27
tags: [product, provenance]
---

# 0016 — A result shows every fact as the dictionary's, with no mark for where it came from

**What this decides:** The result page no longer labels a fact as recovered, derived by rule, or placed by Lexema. Every fact reads as the dictionary's own. The data still records where each fact came from.

## Context

Lexema shows facts from three places: the kaikki extraction, definitions recovered from the raw Wiktionary page ([0012](0012-archive-is-the-release-seed.md)), and grammar Lexema works out by fixed rules, such as articles and the mood of a verb form. Until now the page said which was which. A recovered definition carried a *recovered* mark and a link to its page revision, as 0012 requires. A derived article was set apart. A conjugation whose congiuntivo and condizionale forms were placed by rule carried a note naming the rule (`web/app/Reading.tsx`).

On 2026-09-27, while planning the simplified result page (#142), the question came up whether a verb form's mood counts as source data or as Lexema's addition. The source tags most forms with tense and person only; the mood is read from the shape of each row. Huey ruled that the distinction does not matter to a reader: nothing is to be marked, and everything is treated as source.

This amends 0012 in part: its rule that a recovered definition is marked wherever it is shown no longer holds. The rest of 0012 stands, including that a recovered definition is stored as its own layer with its own provenance.

## Decision

**A result page shows every fact without a mark for where it came from.**

- A recovered definition shows like any other definition: no *recovered* label and no revision link beside it.
- An article, a mood, or any other grammar fact Lexema works out by rule shows like a source fact: no *derived* label and no note explaining the rule.
- The data layer is unchanged. Every value keeps the provenance [0009](0009-two-licences-and-a-source-link.md) requires, a recovered definition stays in its own layer, and a rule-derived value stays distinguishable in the data.
- The attribution page still says, in general terms, that Lexema adapted the material, which is what the licence asks. It does not list per-fact marks.

**Binding constraints.**

- No origin mark on a result page, for recovered, derived or source facts alike.
- Provenance is never dropped from the data because the page no longer shows it.
- Text written by a model is outside this record. [0008](0008-generated-explanations-are-labelled-and-reportable.md) still requires it to be labelled as generated.

## Consequences

The page is quieter, and a reader sees one dictionary rather than three sources. A reader can no longer tell from the page that a definition was recovered or that a mood was placed by rule. The Source link and the attribution page are where that trust now rests.

The web app loses its recovered marks, its derived-article treatment and its mood-rule note. The attribution page's list of changes stops promising per-fact marks; its redesign is #139.

## Records

no vocabulary impact

## Amendments

- **#794 — A name entry links its own Wikidata item (2026-10-11).** [ADR 0032](0032-wikidata-names-fill-proper-name-gaps.md) adds name entries from Wikidata, a second source. Each carries a small *Fonte* link to its Wikidata item, under its definition, because the page's one *Fonte* opens a Wiktionary page and a name entry does not come from there. That link is the source credit, like the page's *Fonte*, not an origin mark; no other mark is added, and every other rule here stands. *Note of 2026-10-11 ([#827](https://github.com/povlabs/lexema/issues/827)):* on Huey's ruling quoted at https://github.com/povlabs/lexema/issues/827#issuecomment-6110758089, no name entry carries a link of its own any more. Every page has one *Fonte*, in the footer beside *Segnala un errore*: to Wiktionary when the page has a Wiktionary reading, else to the first name entry's Wikidata item. It is the page's source credit, not a mark, so a name entry now carries no mark at all.
