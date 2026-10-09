---
id: 0012
title: A release is seeded in one pass from the archive, and nothing Lexema writes is seeded
status: amended-in-part by [0008](0008-generated-explanations-are-labelled-and-reportable.md), [0016](0016-page-shows-no-origin-marks.md), [0019](0019-source-text-may-be-normalized.md), [0023](0023-foreign-records-are-hidden-not-deleted.md), [0024](0024-italian-pages-the-extraction-skips-are-recovered.md), [0025](0025-newer-source-definitions-are-authoritative.md), [0026](0026-recovered-entries-carry-what-the-word-page-shows.md), [0027](0027-curated-corrections-are-cited-exceptions.md), [0028](0028-recovered-pages-any-part-of-speech.md), [0029](0029-recovered-layer-reads-bullet-prose-lines.md), [0030](0030-corrections-may-fix-edges-and-cells.md), [0031](0031-hand-kept-readings-fill-source-gaps.md)
date: 2026-09-23
tags: [stack, data]
---

# 0012 — A release is seeded in one pass from the archive, and nothing Lexema writes is seeded

**What this decides:** The Wiktextract archive is the release's input. It is read in one streaming pass straight into D1, each record's line is stored as it was written, and raw Wiktionary pages may be read beside it to recover definitions the extraction dropped. There are no content files, and the seed carries no text Lexema wrote. This supersedes [ADR 0011](0011-content-files-are-the-release-source.md).

## Context

[ADR 0011](0011-content-files-are-the-release-source.md), accepted on 2026-09-21, made content files in the repository the only thing a release is seeded from, so that Lexema's own explanations could live beside the source text and survive a re-conversion of the dump. Two things undid its reason.

First, Lexema stopped writing its own text. Huey, 2026-09-22: "i have realized this is a dictionary, it is not a translator". Explanations are parked as a possible future feature in #90, and with them the only content a person would open and edit.

Second, the converted files turned out to be worse than the archive they came from. The converter wrote chosen fields out by name, so every field nobody listed was dropped: etymology on 550,358 records, hyphenation on 269,601, pronunciation on 54,976, sense examples on 18,143, and `forms[].source` on all 546,410 form entries that carried it. Huey ruled that a content file should be the source record exactly as written — "For now let's make the same as data source" — which made the 541,247 files copies of lines already in the archive, larger than the original and missing a fifth of it. Then: "i think data repo can keep only arch other than anything else, delete all". Both were said to the driver on 2026-09-22 and are recorded on [#94](https://github.com/povlabs/lexema/issues/94#issuecomment-5797978825). PRs #95 and #96 replaced the conversion with a seeder that reads the archive directly and deleted the content layer; PR #118 made that seed load a full release.

Separately, the extraction loses the definitions of some entries — `casa`, `pianoforte` and `manuale` among them — because their pages write definitions as `#*` lines, which Wiktionary conventionally reserves for quotations. Huey, 2026-09-23: "if wiktionary have this, we can render it". PR #119 reads the raw page to recover them.

## Decision

**A release is seeded from the archive, in one pass, and from raw Wiktionary pages where they recover what the archive lost.**

- **The archive is the input.** `it-extract.jsonl.gz` is read once, streaming, and each Italian record becomes its rows in D1 directly. The committed copy lives in `povlabs/lexema-data` under `source/`. By default the release id is `it-` followed by the first eight hex digits of the archive's SHA-256 — `it-0c432803` — so the release names the file it came from; a seed may override the id, and the release row always records the full checksum.
- **The record is kept as written.** Each record's archive line is stored verbatim in `source_record_json`. Structured rows exist so a query can be answered; the verbatim line is what a page reads for anything else.
- **Raw pages recover, they do not replace.** Where the extraction dropped a page's definitions, the raw Wiktionary page may be read at seed time, and what it yields is stored as its own layer beside the record, with its own provenance naming the page and revision. The record is never edited. A recovered definition is marked as recovered wherever it is shown.
- **Nothing Lexema writes is seeded.** No explanation (#90), and no dispute: Huey, 2026-09-23, "no disputes come from us". The one hand-written dispute still seeded is removed by #117.
- **A reader's report is stored, not applied.** A report of a mistake (#51) lands in `claim_review` (#12) and waits for a person. Huey, 2026-09-23: "we will not fix automatically, a human will fix later".
- **A release is servable only once verified.** The seed leaves the release `importing` and marks it `complete` only after its loaded rows and release row match what was generated (#118).
- **The dump is not chased.** A newer Wiktextract dump is not fetched as a matter of course; a re-seed happens when Lexema's own code needs fixing.

**Binding constraints.**

- The seeder reads the archive, and raw Wiktionary pages only to recover dropped definitions. Any other seed-time input is a new decision.
- The archive line of every record is stored unaltered.
- Recovered text never overwrites or edits a source record, and always carries the page and revision it came from.
- No text authored by Lexema is written by the seed.
- A release is not marked `complete` until its load is verified.
- Every source-derived fact keeps the provenance [ADR 0009](0009-two-licences-and-a-source-link.md) requires.

## Consequences

- There is no conversion step and nothing to review between a dump and a release; a change to what a page shows is a change to the seeder or the page, reviewed as code.
- Anything a page shows from the source is available without a schema change, because the verbatim line is stored. The cost is that only structured fields can be searched or filtered in SQL.
- Recovering definitions across the whole dictionary needs the raw page of every entry, most likely from the Italian Wiktionary dump. That is a further input and is not decided here; until it is, recovery covers the pages committed under `fixtures/`.
- #18, "Allow dictionary updates without rebuilding the website", and #37, the lookup benchmark, were written against the content-file design and should be reread against this one.

## Rejected

- **Keeping content files as the seed source.** Their purpose was a home for Lexema's own text, which no longer exists, and they held strictly less than the archive.
- **Converting once and discarding the archive.** The archive is the only thing that can rebuild the database, so it is kept, checksummed.
- **Correcting a record in place when a reader reports it.** Source data stays as imported; any correction is a person's decision, made later.
