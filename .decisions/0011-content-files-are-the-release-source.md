---
id: 0011
title: Content files in this repository are the only source a release is seeded from
status: accepted
date: 2026-09-21
tags: [stack, content, data]
---

# 0011 — Content files in this repository are the only source a release is seeded from

**What this decides:** No import writes to the serving database. The Wiktionary dump is converted into content files kept in this repository, Lexema's own explanations are more of those files, and a release is seeded from the files alone.

## Context

Until now the importer read `it-extract.jsonl.gz` and wrote D1 directly ([ADR 0004](0004-cloudflare-workers-d1-vinext.md)), and Lexema's own explanations were seeded from a TypeScript module ([#72](https://github.com/hueypov/lexema/issues/72)). That left two problems Huey named on 2026-09-21: re-importing the dump would overwrite anything Lexema wrote into the same records, and there was no one place a person could open and edit what the site says.

He ruled: "github seeds database d1, import wikti seeds database, we cannot let any import directly seed the database. everything will be in our folders." With, later, the option of moving those folders to a public repository and symlinking them back, and of adding more languages beside Italian.

The shape of the source decides the keying. Read from the release on that date: Wiktionary splits a word into **records** by part of speech and kind — `sale` is three, the salt noun, the inflected-form noun, and the verb form — and each record carries its own **senses**, five for the salt noun alone. Of 541,247 distinct Italian words, 524,455 have exactly one record and 16,792 have more.

## Decision

**A release is seeded from `content/` and from nothing else.**

- **`content/<language>/<letter>/<word>.json`.** Per-letter directories, one file per word. A word's file holds one entry per source record, so `content/it/s/sale.json` holds three and `content/it/c/casa.json` holds one.
- **Keyed per record.** An entry names the word and the part of speech that identifies its record, and where a word has two records of one part of speech, whatever further field the source states. A key matching no record in the release, or matching more than one, fails the build; it is never dropped in silence.
- **The dump is converted, not served.** Reading `it-extract.jsonl.gz` produces content files. That conversion runs when a new dump is fetched, which is rarely, and its output is reviewed like any other change. Nothing reads the archive at seed time.
- **Lexema's own text is more content.** An explanation or an example is a field on the same entry as the source-derived text it accompanies, written by a person or a model, and it survives a re-conversion because the conversion only fills the source-derived fields.
- **A re-conversion is a diff.** Fetching a newer dump rewrites the source-derived fields and leaves the rest, so what changed upstream is visible in the repository before it reaches anyone.
- **The directory can move.** `content/` is a subdirectory today. It may become its own public repository, reached from here, without changing the seeder's contract.

**Binding constraints.**

- The seeder reads `content/` only. A path that reads the archive at seed time is a defect.
- A content key that does not resolve to exactly one record fails the build.
- The conversion never overwrites a field it did not write.
- Every source-derived field keeps the provenance [ADR 0009](0009-two-licences-and-a-source-link.md) requires; the attribution page says the data comes from Wiktionary and that Lexema adds explanations and examples.

## Consequences

The database becomes reproducible from the repository: clone, seed, serve, with no 40 MB archive required. Editing what the site says is editing a file and opening a pull request, which is the workflow Huey asked for.

The cost is size. 541,247 files is a large repository, and the conversion has to be written before any of this runs. Whether every word ships as a file or only the words Lexema has written for, with the rest still projected from the archive at conversion time, is the first question the implementation answers; this record fixes the direction, not that detail.

`docs/RUN_AN_IMPORT.md`, `src/import/seedDev.ts` and the release path in [#18](https://github.com/hueypov/lexema/issues/18) all change shape under this decision.

## Records

Two terms for `.glossary/TERMS.md` once the directory exists: *content file* (a word's entries, the seed's only input) and *conversion* (the offline run that fills source-derived fields from a dump).
