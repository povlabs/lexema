---
id: 0027
title: A source fact may be corrected by a cited, ruled layer beside the record, never by editing the record
status: accepted
date: 2026-10-03
tags: [data, provenance]
---

# 0027 — A source fact may be corrected by a cited, ruled layer beside the record, never by editing the record

**What this decides:** When the source states a fact wrongly, Lexema may set it right by hand, one cited fact at a time and only on Huey's ruling. The imported record is never changed; the correction sits beside it.

## Context

AGENTS.md says source-derived lexical data is read-only, with one exception: the fixed, rule-based rewrite of [ADR 0019](0019-source-text-may-be-normalized.md). PR [#448](https://github.com/povlabs/lexema/pull/448) ([#420](https://github.com/povlabs/lexema/issues/420)) added a second kind of change: hand-made *curated corrections* that set a record's gender or number right, each citing a Wiktionary revision. Huey ruled on #420 to "fix it now", in our curated master, which may carry hand-added facts that cite their evidence ([#18](https://github.com/povlabs/lexema/issues/18)). No record allowed this layer, so a future agent following AGENTS.md could remove the corrections or refuse to add more. More corrections are coming through the same layer ([#449](https://github.com/povlabs/lexema/issues/449), [#450](https://github.com/povlabs/lexema/issues/450), [#470](https://github.com/povlabs/lexema/issues/470)).

Huey ruled on 2026-10-03 to record the layer as an ADR and name it in AGENTS.md as the second exception ([ruling on #472](https://github.com/povlabs/lexema/issues/472#issuecomment-5969543528): "yes write it, 448 merged"). This record transcribes that ruling and the rulings already made about the layer. It describes the layer as it exists on `main`; it adds no new dimension.

This record amends [ADR 0012](0012-archive-is-the-release-seed.md) in part. Its binding constraint "Any other seed-time input is a new decision" is met here: the seed also reads the committed correction list and writes it as its own layer. ADR 0012's rule that the archive line of every record is stored unaltered stands, and so does its rejection of correcting a record in place, because a correction never edits the record.

## Decision

**Lexema may correct a fact the source states wrongly through a curated correction: a cited, separately stored layer beside the record, added only on a ruling, while the imported record stays byte for byte.**

- **A separate layer, never an edit.** A correction names one record by release, archive line and line digest, and sets one or more facts. The record's line in `source_record_json` stays byte for byte, and so do its `grammar_claim` rows. Today the facts are gender and number (`CorrectableValues` in `src/italian/curatedCorrections.ts`). They are stored as `corrected_claim` rows, written at seed by `src/import/correctedLayer.ts` and into an already seeded master by `src/import/correctRecords.ts`. A lookup reads them in place of the source's claim in that dimension (`correctRecordClaims` in `src/lookup/types.ts`).
- **Every correction is cited, and added only on a ruling.** Each entry carries at least one Wiktionary revision id and what that revision shows (`Evidence`, `evidenceUrl` in `src/italian/curatedCorrections.ts`). The committed list says "Add an entry only with its evidence, and only on a ruling." Rulings so far: [#420](https://github.com/povlabs/lexema/issues/420) ("fix it now") and [#450](https://github.com/povlabs/lexema/issues/450).
- **Plain data on the page.** The page shows the corrected fact as ordinary data and says nothing about the correction ([ADR 0016](0016-page-shows-no-origin-marks.md)).
- **A later release does not inherit a correction.** When a feed change replaces a corrected record, the update reports the correction (`retiredCorrections` in `src/update/apply.ts`) and does not carry it onto the new record. The correction stays on the retired record. The newer source may state the fact differently, so whether to correct the new record is a new ruling. This sits beside [ADR 0025](0025-newer-source-definitions-are-authoritative.md), whose binding constraints already keep hand-added rows when later source updates land.
- **Wording Lexema writes needs Huey's approval.** Per the [#450 ruling](https://github.com/povlabs/lexema/issues/450#issuecomment-5968691876), a builder may write a corrected definition paraphrased from cited dictionaries, and Huey approves the exact wording on the PR. How such text is labelled is [ADR 0008](0008-generated-explanations-are-labelled-and-reportable.md)'s question, and how it meets ADR 0012's "No text authored by Lexema is written by the seed" is open too; both are #450's work, not this record's.
- **How it differs from ADR 0019.** [ADR 0019](0019-source-text-may-be-normalized.md)'s source text normalization is a fixed rule over many rows that never changes meaning. A curated correction is a single cited fact about one record that changes meaning on purpose, because the source is wrong. Neither rewrites `source_record_json`.

**Binding constraints.**

- A correction never edits the record: `source_record_json` and the record's imported rows stay as imported.
- No correction without at least one cited source revision, and none without a ruling.
- No mark of a correction on the page.
- A correction is never carried onto a record that replaces the corrected one; the update reports it.
- No definition wording Lexema writes lands without Huey's approval of the exact wording on its PR.
- No AI-generated fact enters this layer. Wording an agent drafts enters only after Huey approves it on the PR (#450).

## Consequences

- The corrections from #420 are allowed law, not a breach of the read-only rule, and new ones have a known route: an issue, a ruling, cited evidence, an entry in the committed list.
- Each correction costs a ruling and a citation. That is on purpose, so the list stays short and every entry is provable.
- A feed update can leave a word uncorrected again when it replaces the record. The update's report names each such correction, so a person can decide whether to rule again.
- Adding a new dimension (such as definitions in #450) extends this layer under these rules; it is that issue's work, not a new exception.

## Amendments

- **A ruled rule may make corrections, each citing the pinned revision that confirms it (2026-10-03).** About 290 records gloss themselves "plurale di …" and are tagged singular, and many also carry the wrong gender ([#483](https://github.com/povlabs/lexema/issues/483)). Huey ruled to fix them with one rule, not by hand ([ruling](https://github.com/povlabs/lexema/issues/483#issuecomment-5970891514): "ok"). This narrows "by hand, one cited fact at a time" for that rule only.
  - **What may confirm a correction.** A real plural's number, and its gender where wrong, change only where the record's own en.wiktionary page confirms them. A singular noun whose gloss wrongly says "plurale di" (`mima`, "femminile plurale di mimo") may also be confirmed by the it.wiktionary table of forms (`{{Tabs|…}}`) on its lemma's page, pinned by revision. Huey accepted that on 2026-10-03 for these nouns only ([ruling](https://github.com/povlabs/lexema/issues/483#issuecomment-5971809939): "yes a"); it is the kind of evidence #420 used for `ammaliatrice`. Six of the 15 corrected nouns cite only that table: `mima`, `tuttologa`, `sicaria`, `smacchiatrice`, `giostraia` and `bucaniera`.
  - **How the rule runs.** Rule `it-plural-gloss-number/v1` (`src/italian/pluralGlossNumber.ts`) is named and versioned like an [ADR 0019](0019-source-text-may-be-normalized.md) rule, but it changes meaning on purpose, so it is a curated correction and not a normalization. It reads only the record's archive line and Wiktionary revisions pinned by revision id (`src/italian/pluralGlossEvidence.ts`, written by `pnpm run measure:plural-gloss`). So the same release and the same revisions always give the same corrections, and no record is judged by hand.
  - **What each correction is.** An entry of the committed list like a hand entry: keyed to its archive line and digest, citing the revision that confirms it, stored as `corrected_claim` rows beside a record whose line stays byte for byte, and shown on the page with no mark ([ADR 0016](0016-page-shows-no-origin-marks.md)). A record a hand entry names is never also corrected by the rule. A record no pinned revision confirms stays as the source states it, listed in the report with the reason.
  - **How it changes.** Changing what the rule confirms is a new version and a new ruling. Re-pinning its revisions is a pull request whose changed corrections show in the diff. Every binding constraint above still holds.
