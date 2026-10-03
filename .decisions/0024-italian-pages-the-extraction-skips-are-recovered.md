---
id: 0024
title: An Italian page the extraction cannot read gets its entry from the raw page, beside the archive
status: amended-in-part by [0008](0008-generated-explanations-are-labelled-and-reportable.md), [0026](0026-recovered-entries-carry-what-the-word-page-shows.md), [0028](0028-recovered-pages-any-part-of-speech.md)
date: 2026-10-01
tags: [data, provenance]
---

# 0024 — An Italian page the extraction cannot read gets its entry from the raw page, beside the archive

**What this decides:** When a word has a real Italian page on Wiktionary but the archive has no record for it, because the extraction cannot read that page's layout, the seed builds the word's entry from the raw page. The entry carries a part of speech and definitions, lives in the recovered layer beside the archive, and names the page revision and line of every fact. This amends [ADR 0012](0012-archive-is-the-release-seed.md) in part, which allowed raw pages only to add definitions to a record the archive already has.

## Context

Some everyday verbs have no entry of their own. `raccontare` has 54 form-of records pointing at it, and so do `fornire`, `dipendere`, `tremare` and `educare`, but the archive has no record for any of them. [#326](https://github.com/hueypov/lexema/issues/326) counted them from the #17 quality measurement: in release `it-0c432803`, 104 form-of targets with no record have a page of that title in `itwiktionary-20260701-pages-articles.xml.bz2`. `readItalianSections` in [`src/italian/wikitext.ts`](../src/italian/wikitext.ts) finds no Italian part-of-speech section on any of them.

The #28 recovery layer ([`src/italian/recovery.ts`](../src/italian/recovery.ts)) only adds definitions beside a record that exists: "The archive record is never edited. What comes out of here sits beside it". Nothing builds an entry the archive lacks, and ADR 0012 binds the seeder to read raw pages "only to recover dropped definitions".

Huey ruled on 2026-10-01 on [#326](https://github.com/hueypov/lexema/issues/326#issuecomment-5936337935), after checking the 104 against the archive and the newer build `it-78385b62` (itwiktionary-20260901), which adds only `ghindare`:

- About 80 are not Italian pages: Latin, Hungarian, Spanish or English entries and `{{W}}` stubs, such as `movere`, `testvér` and `skirmish`. They are broken form-of pointers, not missing words.
- About 23 are real Italian pages the extractor cannot read in any build: `{{Transitivo|it}}` or `{{Intransitivo|it}}` with no part-of-speech heading, or a hand-written `'''''Verbo'''''`. Among them are `raccontare`, `fornire`, `dipendere`, `tremare`, `educare` and `dismagare`.

The ruling: "fix our DB only, no upstream report", and "Extend the #28 recovery layer so it reads those page layouts from the raw Wiktionary page and recovers the ~23 words (part of speech + definitions), deterministic and sourced, raw kept as-is."

His [refined ruling](https://github.com/hueypov/lexema/issues/326#issuecomment-5936395029) the same day replaced the ruling's first point, about the 80, and kept the second: "Point 2 (recover the ~23 Italian pages via the #28 recovery layer) stands." The first point is recorded in [ADR 0023](0023-foreign-records-are-hidden-not-deleted.md): foreign records filed as Italian are hidden, and an Italian entry whose form-of target is an archaic or Latin lemma (`mossa` → `movere`) keeps its entry and shows that text with no link. `movere` and `scire` are not added as words.

## Decision

**An Italian page the extraction cannot read gets an entry built from the raw page, stored in the recovered layer, and never written into the archive.**

- **Only a real Italian page with no record.** A word is recovered when the archive has no Italian record for it and its raw page carries an Italian entry in a layout the extraction cannot read. A page in another language, or a stub with no Italian definition, gives nothing.
- **A fixed rule over the page layout.** The rule reads the layouts the ruling names: `{{Transitivo|it}}` or `{{Intransitivo|it}}` standing where a part-of-speech heading would be, and a hand-written `'''''Verbo'''''`. The same page always gives the same entry. No model, and no judgement of the text.
- **What a recovered entry may carry.** The word, which is the page's title; its part of speech, as the page's layout states it; and its definitions, in page order, with the labels and examples the #28 layer already reads for a recovered definition. Nothing else: no forms table, pronunciation, etymology or other field. Carrying more is a new decision.
- **How it points to its page.** The entry names its `raw_page` row: the wiki, the title, the revision id and the revision timestamp. Its part of speech and each of its definitions name the 1-based line of that revision they were read from and keep that line's wikitext verbatim, as `recovered_definition` already does.
- **The raw source is kept as it is.** No archive line is invented for the entry and no archive record is edited. The page's own text is what the entry rests on.
- **The entry is a word a reader can find.** It is the word's entry: a search for it reaches it, and the form-of records that name it lead to it.
- **Our database only.** Nothing is reported upstream to Wiktionary or Wiktextract.
- **The page shows no mark for it.** A recovered entry reads like any other, as [ADR 0016](0016-page-shows-no-origin-marks.md) requires. The data keeps where every fact came from.

**Binding constraints.**

- A recovered entry carries only a word, a part of speech and definitions, each read from the raw page.
- Every recovered fact names its page revision and line, and keeps that line verbatim.
- No archive record, and no `source_record_json` line, is created or changed for it.
- Only a fixed rule reading page layout builds one. An entry is not recovered by hand or by a judgement of its content.

## Consequences

- About 23 common words, `raccontare` among them, get an entry of their own, and their forms' pointers stop leading nowhere. The exact list is the first step of the build, [#403](https://github.com/hueypov/lexema/issues/403).
- An entry now exists in two shapes: one seeded from an archive record, and one recovered from a page alone. Every reader of entries has to accept both, and the recovered one has no inflection table.
## Rejected

- **Writing an archive-shaped line for the word.** It would be Lexema's text stored where the archive's own words go, and would break ADR 0012's rule that every archive line is stored as written.
- **Reporting the layouts upstream and waiting.** Huey ruled to fix our database only. The newer build `it-78385b62` still cannot read these pages.
- **Adding `movere`, `scire` and the other non-Italian targets as words.** They are not Italian entries; ADR 0023 covers how their pointers show.
