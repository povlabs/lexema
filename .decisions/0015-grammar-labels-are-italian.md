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

A reader-chosen interface language is a separate, later feature ([#138](https://github.com/povlabs/lexema/issues/138)). This record does not decide it.

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

## Amendments

- **The word page's interface is Italian too (2026-10-09).** Huey, in chat, quoted on [#789](https://github.com/povlabs/lexema/issues/789): "ok now we need to make all the english parts in italian in the word page", and, asked whether the footer and the rest of the site change too, "not footer, only word page". Every interface word on a word page and on the no-entry page is now Italian: the section labels (*Definizioni*, *Forme*, *Etimologia*, *Sinonimi* and the rest), the controls and links (`+ altro` / `meno`, *Fonte*, *Segnala un errore*), the report box, the no-entry state and the names a screen reader reads. The English list in the Decision above no longer covers the word page. The footer, the landing page, the search box, the legal pages and the developer site stay English, and so do the tab's title and the share cards. The design manifest names the labels.
- **The whole dictionary site is Italian (2026-10-10).** Huey, in chat, quoted on [#791](https://github.com/povlabs/lexema/issues/791): "ok for now we have to go with only italian, we are changing whole website to italian, a simple dictionary", and, asked to confirm "un dizionario semplice" and an Italian footer, landing page and search box, "yes good". The previous amendment's English list no longer holds on lexema.fyi: the header, the search box, the footer, the landing page, the legal pages (a faithful Italian version of the approved text), the tab's titles and the share cards are Italian, and the site line is *Lexema — un dizionario semplice*. The developer site and the API stay English.

## Records

no vocabulary impact
