---
id: 0023
title: A record its page shows is another language's entry is hidden from readers, and kept
status: accepted
date: 2026-10-01
tags: [data, provenance]
---

# 0023 — A record its page shows is another language's entry is hidden from readers, and kept

**What this decides:** When a fixed rule reading the raw Wiktionary page, or the archive's own records, finds that a record the archive tags Italian is another language's entry, the seed keeps the record whole and hides it: no search, suggestion, page, random pick or API lookup reaches it. This amends [ADR 0012](0012-archive-is-the-release-seed.md) in part, which allowed raw pages only for recovering definitions and read the archive only once.

## Context

Wiktextract gives a record the language of the `== {{-xx-}} ==` heading it sits under and reads nothing else, so another language's entry written under a page's Italian heading comes out as Italian. `curie` carries a Dutch noun, `dolmen` an English one. [The investigation for #29](../reports/2026-10-01-non-italian-sections.md) counted 52 such records in release `it-0c432803` and gave a rule, `blockLanguage` in [`src/italian/sectionLanguage.ts`](../src/italian/sectionLanguage.ts), that finds 23 of them with no false positive: a block is another language when a bare language line such as `{{-nl-}}` stands above it, or when its heading names another language and it comes after the Italian entry's translation box. It reads page structure only.

Huey ruled on 2026-10-01 on [#29](https://github.com/povlabs/lexema/issues/29#issuecomment-5936092738): "yes, fix it with the rule this issue proposes, as a deterministic rule under ADR 0019 (raw `source_record_json` kept byte-for-byte; the rule is named and versioned; counts from release it-0c432803 in the PR)". His refined ruling on [#326](https://github.com/povlabs/lexema/issues/326#issuecomment-5936395029) says foreign records filed as Italian are hidden "via #29's rule", while an Italian entry whose form-of target has no Italian record keeps its entry and shows "its form-of text without a dead link". [#382](https://github.com/povlabs/lexema/issues/382) asks for the records to be hidden from pages, search, suggestions and the API, with the raw record kept.

[ADR 0012](0012-archive-is-the-release-seed.md) binds the seeder to read "raw Wiktionary pages only to recover dropped definitions. Any other seed-time input is a new decision." Reading the page to judge a record's language is that second use, so it needs this record.

The page rule cannot see a foreign plural whose page carries only an Italian heading: `zapateros`, `testvérek`, `skirmishes`. [#389](https://github.com/povlabs/lexema/issues/389) found that the archive gives them away instead. Each is a form-of record whose target has no Italian record, only a record in another language, and that record lists this exact word among its own forms. Huey ruled on 2026-10-01 on [#389](https://github.com/povlabs/lexema/issues/389#issuecomment-5941178853): "yes — hide these 7 with the second rule `form-of-foreign-lemma/v1` as proposed".

## Decision

**A record the section-language rule finds in another language is hidden, never deleted and never edited.**

- **The rule is fixed and versioned.** It is `section-language/v1`: `blockLanguage` over the blocks `readItalianPosBlocks` reads, applied only where a title's records line up one to one with its page's blocks (`foreignRecordsOf`). The language codes come from the dump's own `== {{-xx-}} ==` headings, stored in [`fixtures/section-language/regressions.json`](../fixtures/section-language/regressions.json). No word list and no judgement of content. A change to what the rule decides is a new version and its own issue, with its counts.
- **A second rule reads the archive alone.** It is `form-of-foreign-lemma/v1` (`ForeignLemmaIndex` in [`src/italian/formOfForeignLemma.ts`](../src/italian/formOfForeignLemma.ts)). It hides an Italian record when every `form_of` target has no Italian record, every target has a record in another language in the same archive, and that record lists the hidden record's word in its `forms`. All three conditions are needed: the first two alone take in Italian verb forms whose infinitive is also a Latin word (`amaricasti` → `amaricare` [la]). Its `hidden_record` row names the reason `lemma-lists-form`, the claiming record's language and its archive line, which is not seeded. A record both rules find is hidden once, by `section-language/v1`.
- **Raw pages may be read for it.** The seed reads the raw page beside the archive to apply the rule, as it already does to recover definitions. Every hidden record names the page revision and line the verdict was read from.
- **The seed reads the archive in a first pass for the rules.** The page rule lines up all of a title's records with its page's blocks before it judges any one of them, and the second rule needs other-language records that can sit anywhere in the archive, so the seed must read both before its seeding pass reaches the first record. It reads the archive once for the rules (`readRulePass` in [`src/import/hiddenLayer.ts`](../src/import/hiddenLayer.ts)), then once to seed. This amends ADR 0012's rule that the archive is read once, in one pass: the seeding pass is still one streaming read, and the first pass keeps only each Italian record's title, line number, part-of-speech heading and form-of targets, and each other-language record's forms.
- **Hidden means reached by nothing a reader asks.** The record is seeded with every row but its `lookup_form` and `form_of_edge` rows, so no search, suggestion, nearby offer, page or `/v1/lookup` answer reaches it, and a random pick passes over it. Its `hidden_record` row states the rule, the reason, the language and the page line.
- **The record is kept.** `source_record_json` keeps the archive line byte for byte, and the record's senses, glosses and grammar rows stay, so a hide can be audited and reversed.
- **A form-of edge naming a hidden word shows its text with no link.** When no Italian record is left for the word, the edge is one with no candidate, and the page shows the gloss as text, as it already does for any word the release has no entry for.
- **A seeded dictionary gets the same through a one-off update.** `pnpm run hide:records` hides in a seeded dictionary what a fresh seed would, by both rules, can be run twice with no further effect, and reports what it changed. A `hidden_record` table written before the second rule is rebuilt in the same transaction, every row kept. Like ADR 0019's updates, CI writes it to the shared dictionary: the dictionary deploy workflow of [ADR 0018](0018-previews-on-workers-builds.md) applies it through Wrangler after the merge that declares it, never through the Worker's read-only binding. Agents never hold the Cloudflare key, run that workflow or write the shared dictionary.
- **The page says nothing about it.** A hidden record is absent, with no note, as [ADR 0016](0016-page-shows-no-origin-marks.md) requires.

**Binding constraints.**

- A hidden record's `source_record_json` row is never changed, and no row of it is deleted but its `lookup_form` and `form_of_edge` rows.
- Every hidden record has a `hidden_record` row naming the rule version and its evidence: the raw page revision and line for `section-language/v1`, the claiming record's archive line for `form-of-foreign-lemma/v1`.
- Only a fixed, versioned rule reading page structure or the archive's records hides a record. No spelling, script or word list is read. A record is not hidden by hand or by a judgement of its content.
- The seed and the one-off update hide the same records for the same archive and dump.

## Consequences

- In release `it-0c432803` the rule hides 23 records on 20 titles: 6 by a language line and 17 by a late heading. They lose 23 `lookup_form` and 2 `form_of_edge` rows. Every hidden word keeps an Italian record of its own, so no form-of edge in the release is left pointing at nothing because of a hide.
- 29 records the investigation labelled foreign stay visible to `section-language/v1`. Among them are whole pages written as Italian, such as `hatefulness`, and the `zapateros`, `testvérek` and `skirmishes` named in #326, whose pages carry only an Italian heading.
- In release `it-0c432803`, `form-of-foreign-lemma/v1` hides 7 records, none of which the page rule finds: `zapateros` (es), `skirmishes` (en), and `testvérek`, `nagymamák`, `diplomáciák`, `születések`, `boldogságok` (hu). Its targets have no Italian record, so no form-of edge is left pointing at nothing because of these hides either.
- A record a change from a later release writes (`pnpm run update:apply`) is not judged, because a feed is read without its raw pages. A foreign record written that way is visible until a later rule or update judges it.
- Lookup reads stay as they were: a hidden record is unreachable because its search rows are absent, the same way a [retired record](../.glossary/TERMS.md) is. Only the random pick needed a change, since it draws by line number.

## Rejected

- **Deleting the record.** It loses the source line and cannot be undone without a reseed.
- **Hiding every record any structural signal points at.** That is 119 records, 67 of them Italian entries such as `sushi`, `baseball` and `bellicose` ([report §4](../reports/2026-10-01-non-italian-sections.md#4-recommendation)).
- **Keeping the search rows and filtering every read.** Every lookup, suggestion, phrase, batch and nearby query would have to carry the filter and stay in step with it. Removing the rows reuses the retired-record shape that every read already respects.

## Amendments

- **#389 — A second rule, `form-of-foreign-lemma/v1` (2026-10-01).** Huey, on [#389](https://github.com/povlabs/lexema/issues/389#issuecomment-5941178853): "yes — hide these 7 with the second rule `form-of-foreign-lemma/v1` as proposed (form-of whose target has no Italian record but whose target's foreign record lists this exact word as its own plural). Raw kept; any shared-D1 write is a command for Huey." The decision above now names two rules. `hidden_record` gains `lemma_line`, and its page columns hold only for `section-language/v1`; the seed's first pass is always run, since the second rule needs no raw pages.
- **#454 — CI writes the shared dictionary (2026-10-03).** Following [ADR 0018](0018-previews-on-workers-builds.md)'s amendment of the same day, which transcribes Huey's rulings on [#443](https://github.com/povlabs/lexema/issues/443) and [#446](https://github.com/povlabs/lexema/issues/446), `hide:records` on the shared dictionary is run by the dictionary deploy workflow, not from Huey's laptop. Agents still never hold the key or write the shared dictionary.
