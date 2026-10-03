---
id: 0025
title: Newer source definitions replace older ones automatically with their history retained
status: accepted
date: 2026-10-02
tags: [data, provenance]
---

# 0025 — Newer source definitions replace older ones automatically with their history retained

**What this decides:** Safely matched newer source definitions replace older definitions without routine human accuracy review; accuracy is investigated when a user reports a problem.

## Context

Huey's [2026-10-02 amendment on #431](https://github.com/hueypov/lexema/issues/431) states: "we don't need to check manually, i am saying just treat the newer source as correct 100% and when a user reports it we can check, i don't wanna add report for all new release words and check manually". The [settled transcription ruling on #432](https://github.com/hueypov/lexema/issues/432#issuecomment-5958082754) governs this record. The amendment replaces #431's earlier proposal for per-change old/new reports and later manual inspection of source history.

The questions settled are: May safely matched newer source definitions correct, reword or remove older definitions? Must people inspect every changed word or source history? When is accuracy investigated? The answers are yes, no, and on a user report.

This amends [ADR 0012](0012-archive-is-the-release-seed.md) only where its historical "dump is not chased" and re-seed-only wording would prohibit later source updates. [ADR 0018](0018-previews-on-workers-builds.md) already permits later releases as diffs, not full re-imports; its shared dictionary binding remains read-only. The selected-feed architecture of [#18](https://github.com/hueypov/lexema/issues/18), explained in [UPDATES](../docs/UPDATES.md), remains: imported source records are retained, not overwritten or deleted. This record replaces manual semantic selection and review, not that architecture or the review and merge that authorize a shared write.

The old-definition protection in [#377](https://github.com/hueypov/lexema/issues/377) and [#414](https://github.com/hueypov/lexema/issues/414), including their earlier-applied exemption, no longer governs safely matched newer definition updates. Their historical findings remain history. An absent older normalized gloss key or a reduced sense count proves neither source error nor a need to restore older wording. [#427](https://github.com/hueypov/lexema/issues/427)'s restoration proposal and withdrawal remain history; this decision does not authorize restoration based on absent wording. [#422](https://github.com/hueypov/lexema/issues/422)'s unmeasured shown-gloss interpretation is separate.

## Decision

**Newer source definitions are authoritative and their safely matched updates are applied automatically, including corrections, rewordings and definition removals, with older imported records and update history retained.**

- **Replacement, not normalization.** Import the later source record and retire the previously served record. Neither imported record is edited. A meaning-changing source correction is not a source text normalization under [ADR 0019](0019-source-text-may-be-normalized.md); that decision's fixed, meaning-preserving rules still govern structured rows.
- **Automatic selection, mechanical verification.** A deterministic rule selects eligible newer definition changes against the currently served record, including one written by an earlier apply. Matching, source ordering, import integrity and application are verified or refused. These checks do not judge whether the newer definition is semantically right, require old-key retention, or require increasing sense counts.
- **Definitions, not whole-record deletion.** A matched record may lose some or all definitions. A whole word/part-of-speech record absent from the later feed remains a reported, unapplied disappearance under #18. The master is not replaced by a full-release re-import.
- **Investigation on a user report.** No new per-word old/new review report, routine manual review or source-history accuracy gate precedes or follows an update. Investigate accuracy when a user reports a problem. ADR 0012's rule that a reader report is stored and waits for a person still holds; reports are not automatically applied as corrections.
- **Retained evidence, not a reporting product.** Keep every imported raw record byte-for-byte in `source_record_json`, its provenance and release identifiers, and the existing internal update history. Older records, including their senses, remain stored when their serving indexes are retired. Source-page attribution remains governed by [ADR 0009](0009-two-licences-and-a-source-link.md); an archive without revision identity cannot promise revision-specific source links.

**Binding constraints.**

- Preserve recovered and hand-added rows and their provenance beside retained records; later source updates do not erase those layers. [ADR 0024](0024-italian-pages-the-extraction-skips-are-recovered.md)'s fixed page-layout recovery remains separate, not an automatic response to absent older wording.
- Preserve deterministic matching and refusal of ambiguous pairs, fixed Italian language rules, hidden-record exclusions and form-of safety. [ADR 0023](0023-foreign-records-are-hidden-not-deleted.md)'s hiding rules and retained raw records remain authoritative.
- No AI-generated source text, invented definition, union of old and new source records, automatic recovery or whole-record deletion is authorized.
- This record grants no shared-D1 write, scheduling service or final control-plane sign-off of its own. CI writes the shared dictionary: an update reaches it only through the dictionary deploy workflow of [ADR 0018](0018-previews-on-workers-builds.md), after a reviewed merge declares it. Agents never hold the Cloudflare key, run that workflow or write the shared dictionary. Source authority does not replace that review and merge; ADR 0018's read-only dictionary binding still holds.

## Consequences

Newer corrections can reach readers without a person reviewing every word. A newer upstream mistake can reach them too: retaining old wording is not an accuracy oracle, and the accepted response is investigation after a user report. Retained source records and internal history identify what was imported without building a routine review product.

Implementation is [#431](https://github.com/hueypov/lexema/issues/431), separate from this policy record. It must replace the old selection restrictions while preserving the mechanical safeguards and retained layers above.

## Amendments

- **A definition lost to a blank is not a removal (2026-10-03).** Huey, asked on [#442](https://github.com/hueypov/lexema/issues/442) "when the new version is empty or just says 'definition missing', should we keep the old definition?": **yes**. This narrows "a matched record may lose some or all definitions". A later record with fewer real definitions is not applied when it puts a blank where ours had a real one: a sense with no gloss text (absent, null or empty glosses, which the source tags `no-gloss`), or only the "definizione mancante" placeholder. A later record that is only blanks, or has no sense, is the same case. The previously served record keeps serving whole; no union of old and new senses is made. `feed-selection/v4` skips it as `blank-replaces-definition` ([UPDATES](../docs/UPDATES.md#selection-and-source-ordering)). A removal with no blank in its place still applies as decided above.
- **#454 — CI writes the shared dictionary (2026-10-03).** Following [ADR 0018](0018-previews-on-workers-builds.md)'s amendment of the same day, which transcribes Huey's rulings on [#443](https://github.com/hueypov/lexema/issues/443) and [#446](https://github.com/hueypov/lexema/issues/446), a shared-D1 update is written by the dictionary deploy workflow after a reviewed merge, not by an operator's laptop run. Agents still never hold the key or write the shared dictionary.
- **A definition lost to a sense the page hides is not a removal either (2026-10-03).** Huey, asked on [#422](https://github.com/hueypov/lexema/issues/422) "treat a new definition the page hides (like `presina f`) as blank, so we keep the old one?": **yes** ([ruling](https://github.com/hueypov/lexema/issues/422#issuecomment-5968689489)). This widens the amendment above to a later sense whose text the word page hides: a gloss that only repeats the headword (`presina f`, stored as `presina`), or only a gender and number stamp (`m sing`). Ours keeps serving whole. `feed-selection/v5` reads senses the way the page does and skips such a record as `hidden-replaces-definition` ([UPDATES](../docs/UPDATES.md#selection-and-source-ordering)).
