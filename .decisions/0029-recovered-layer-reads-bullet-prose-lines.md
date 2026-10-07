---
id: 0029
title: A recorded page's `*` bullet and plain prose lines under its part-of-speech heading are recovered definitions, written through a declaration
status: accepted
date: 2026-10-07
tags: [data, provenance]
---

# 0029 — A recorded page's `*` bullet and plain prose lines under its part-of-speech heading are recovered definitions, written through a declaration

**What this decides:** When a word's Wikizionario page writes a definition as a `*` bullet or as a plain line under the part-of-speech heading, instead of a `#` line, the recovered layer reads it as a definition of that section's archive record. A declared command writes these definitions into the shared dictionary. This amends [ADR 0012](0012-archive-is-the-release-seed.md) in part.

## Context

[ADR 0012](0012-archive-is-the-release-seed.md) lets the seed read raw pages to recover definitions the extraction dropped. The recovered layer (#28, [`src/italian/recovery.ts`](../src/italian/recovery.ts)) reads only lines below a `#` line. Only the seed writes it, so the shared dictionary gains a recovered definition only when it is seeded again.

The measurement for [#699](https://github.com/povlabs/lexema/issues/699), [Word pages with nothing to show](../reports/2026-10-06-empty-word-pages.md), counts 1,261 headwords of release `it-0c432803` whose word page shows no reading with anything in it. 182 of them have definition text on their page (dump `itwiktionary-20260701`) that no admitted rule reads. Every one has an archive record. The two largest layouts are a `*` bullet line under the part-of-speech heading (99 headwords, 81 of them numbers such as `centouno`) and a plain line with no list mark there (64, such as `bavaglio`).

Huey ruled on 2026-10-06, recorded in [his ruling on #699](https://github.com/povlabs/lexema/issues/699#issuecomment-6025241773):

> Ruling (Huey, 2026-10-06): "yes" — allow new recovery rules for the definition layouts the extraction misses, starting with the two big groups: `*` bullet lists (98 pages, 81 are numbers) and plain prose lines (55 pages). Source text copied byte for byte; every recovered word listed in the PR for review; through the normal dictionary-change path (declaration + CI deploy; no agent writes D1). […] The smaller groups (`:` list, headword lines, acronyms, mixed, `#*`) follow after review of the first two.

The ruling quotes counts from an earlier scratch run; the merged report counts 99 and 64. [#706](https://github.com/povlabs/lexema/issues/706) builds it.

## Decision

**A `*` bullet line or a plain prose line under an Italian part-of-speech heading is a recovered definition of that section's archive record, read by layout alone and written to the shared dictionary through a change declaration.**

- **Two layouts, two routes.** `bullet-line`: a line opening with a single `*`. `prose-line`: a line opening with no list, heading, table, tag or behaviour-switch mark that is not the headword line (it holds `{{Pn}}`, or opens with the headword in bold). Each sits in its section after the heading and before the next heading of any kind.
- **Only where no `#` line states a meaning.** A section whose `#` list states a meaning keeps its definitions there; a bullet or plain line beside them is not read.
- **Only text shown as a definition.** A line is read only when it shows words in neither bold nor italics, and sits inside no template or link that spans lines. Comments are blanked first. The line is rendered as every recovered line is: a template the renderer does not know leaves it unrendered and reported, never printed wrong.
- **The section of the record.** A record finds its section by its part-of-speech title, as the recovered layer already does. `{{-agg num-|it}}` is titled *Aggettivo numerale*, as the extraction titles it. That title is the recovered layer's alone: the shared table that `section-language/v1` ([ADR 0023](0023-foreign-records-are-hidden-not-deleted.md)) and the page-entry rules ([ADR 0028](0028-recovered-pages-any-part-of-speech.md)) read does not gain it, so their decisions do not move. A part-of-speech heading stacked directly on another, with only blank lines between, opens no section of its own: the two head one section, which the lower heading titles (`cinquantadue`'s `{{-agg num-|it}}` over `{{-card-|it}}` is *Aggettivo numerale*). A record titled by the upper heading of a stack does not find that section.
- **After the `#` list.** A section's bullet and prose definitions follow the definitions its `#` list gives, so a dictionary that gains them later lists them where a fresh seed does.
- **One command writes them.** `load:recovered-definitions`, with rules `recovered-bullet-line/v1` and `recovered-prose-line/v1`, reads the master's archive and dump and writes what a seed now writes for those lines, through a declaration and the dictionary deploy ([docs/DEPLOY.md](../docs/DEPLOY.md#load-recovered-definitions)). It writes no other route's definition. A definition that the record a feed applied in its place now carries as a gloss is not written ([ADR 0025](0025-newer-source-definitions-are-authoritative.md)).

**Binding constraints.**

- The rule reads layout only. No text is judged by meaning: a note written as a plain line (`fuoco artificiale`: `Vedi [[fuochi d'artificio]].`) is read like a definition.
- Every recovered definition keeps its source line's wikitext byte for byte, with its page revision and 1-based line.
- No archive record, and no `source_record_json` line, is created or changed.
- No agent writes D1; the shared dictionary changes only through a declaration the deploy applies.
- The page shows no mark for a recovered definition, as [ADR 0016](0016-page-shows-no-origin-marks.md) requires.
- The report's other layouts (`:` lines, a `#` line under a stray heading, `#*` with no `#` above, the headword line, the grammar stamp, `;` lines) stay a new decision.

## Consequences

- Over `it-0c432803` and its dump, the two rules read definitions for every headword of the report's `bullet-line` group and 61 of its `prose-line` group. `Kostia` (a bare `{{-nome-}}` heading), `furo` (words after its heading on the heading line) and `urgere` (an `{{Intransitivo}}` template the renderer does not know) gain nothing.
- The same layouts on a reading whose word page already shows another reading are read too: about 60 more headwords, such as `molto`'s pronoun and `beato`'s verb form. The pull request lists every one.
- A fresh seed writes the new routes, so `recovered_definition`'s `route` CHECK widens and `update:upgrade` rebuilds the recovered tables with their rows before the command writes.
- Pages written in the other layouts stay as they are until a later ruling.
