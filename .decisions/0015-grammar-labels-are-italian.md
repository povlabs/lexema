---
id: 0015
title: Grammar labels on a result are Italian, and the rest of the interface stays English
status: accepted
date: 2026-09-27
tags: [product, language]
---

# 0015 — Grammar labels on a result are Italian, and the rest of the interface stays English

**What this decides:** Every grammar term on a result, such as the part of speech, mood, tense, person, gender and number, is shown in Italian. Page headings, section names, buttons and links stay in English.

## Context

[0004](0004-cloudflare-workers-d1-vinext.md) fixed the interface as English and kept source text in the Italian the source wrote. At the time, grammar labels counted as interface: a reading said `noun`, a table said `present` and `masculine`.

On 2026-09-27 Huey reviewed a simplified result page in `lexema-design.pen` (boards 09 to 21). He ruled that the page keeps English titles with Italian content, and then that the grammar inside it should be Italian too: tense names first, then *singolare* and *plurale*, then the part of speech, then moods and genders. These are the terms a reader meets in Italian grammars and dictionaries, and they sit beside Italian forms.

The part of speech needs no translation. Every source record carries its own Italian heading in `pos_title` (*Sostantivo*, *Verbo*, *Voce verbale*, *Locuzione nominale*), and the database already stores it (`src/db/schema.sql`). It is also more precise than the English `pos` code: `phrase` covers four different Italian headings.

A reader-chosen interface language is a separate, later feature ([#138](https://github.com/hueypov/lexema/issues/138)). This record does not decide it.

[0008](0008-generated-explanations-are-labelled-and-reportable.md) lets a grammatical paraphrase built by rule appear in English. The simplified page shows the source's own Italian gloss for a form and no paraphrase, so this record leaves 0008 as it is.

This amends 0004 in part. Its rule that source text is never translated still stands; its rule that the interface is English now excludes grammar labels.

## Decision

**Grammar labels on a result are Italian. Everything else in the interface stays English.**

Italian:

- the part of speech, as the record's `pos_title`;
- moods: *Indicativo*, *Congiuntivo*, *Condizionale*, *Imperativo*;
- tenses: *presente*, *imperfetto*, *passato remoto*, *futuro semplice*, and the compound tenses by their Italian names;
- persons: *io*, *tu*, *lui, lei*, *noi*, *voi*, *loro*;
- gender and number: *maschile*, *femminile*, *singolare*, *plurale*;
- the non-finite forms and related labels: *infinito*, *gerundio*, *participio*, *ausiliare*, *superlativo*.

English: page and section headings (Definitions, Forms, Etymology, Synonyms), controls and links (more definitions, compound tenses, Source, Report a mistake), the footer, and the attribution page.

**Binding constraints.**

- A reading's part of speech is the record's `pos_title`, shown as the source wrote it. It is never a translation of the `pos` code.
- A grammar value with no Italian label in Lexema's table is shown as the source states it. It is never translated on the fly.
- Nothing else in the interface changes language because of this record.

## Consequences

A result page is deliberately in two languages: English for the structure around the data, Italian for everything that describes the Italian word. A reader who knows no Italian grammar terms loses some help. The terms are standard, and the forms beside them are Italian anyway.

The web app needs an Italian label for each grammar value it shows today, and the part-of-speech heading reads `pos_title` instead of mapping `pos`. The design manifest's first rule, "The interface is in English", changes to match.

## Records

no vocabulary impact
