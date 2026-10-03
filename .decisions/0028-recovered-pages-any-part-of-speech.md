---
id: 0028
title: An Italian page in a measured layout is recovered as any part of speech its layout states, never a guessed one
status: accepted
date: 2026-10-03
tags: [data, provenance]
---

# 0028 — An Italian page in a measured layout is recovered as any part of speech its layout states, never a guessed one

**What this decides:** Page-only recovery under [ADR 0024](0024-italian-pages-the-extraction-skips-are-recovered.md) widens from three verb layouts to the Italian layouts the 2026-10-03 measurement reads with a stated part of speech, plus two templates that name one the table does not yet know. A recovered entry may be any part of speech the page layout states, and a page with several Italian part-of-speech sections gives one entry per section. Pages copied from English Wiktionary stay excluded. This amends ADR 0024 in part. It also amends [ADR 0012](0012-archive-is-the-release-seed.md) in part, as ADR 0024 and ADR 0026 did, since the seed now reads every raw page as a candidate, not only the form-of targets ADR 0024 counted.

## Context

ADR 0024 recovers an entry from the raw page when the archive has no Italian record for a real Italian page. Its rule reads three layouts only, all verbs: `{{Transitivo|it}}` or `{{Intransitivo|it}}` where a part-of-speech heading would be, and a hand-written `'''''Verbo'''''`. Rule `italian-page-entry/v1` in [`src/italian/pageEntry.ts`](../src/italian/pageEntry.ts) also refuses a page with more than one part-of-speech section as `ambiguous-layout`.

Epic [#471](https://github.com/hueypov/lexema/issues/471) found many more such pages. The measurement for [#474](https://github.com/hueypov/lexema/issues/474), [Italian pages with definitions and no record, by layout](../reports/2026-10-03-unrecorded-page-layouts.md), counts 245 pages in dump `itwiktionary-20260701` with Italian `#` definitions and no Italian record in release `it-0c432803`. Its fixed detector reads 192 of them with a part of speech the layout states. Rule `italian-page-entry/v1` recovers 13. Of the 245, 19 pages have several Italian part-of-speech sections, and 42 have no part-of-speech signal at all, `motteggio` among them.

Huey ruled on 2026-10-03, recorded in [his ruling on #475](https://github.com/hueypov/lexema/issues/475#issuecomment-5969563963). Asked "Widen it?" about these pages, he answered:

> yes widen it

Then asked "a page with several parts of speech (say noun + adjective) gives one entry per part of speech? My rec: yes. Our dictionary already works that way for normal words, so it's consistent.", he answered:

> yes to both

That ruling left three of the report's groups open. Huey answered them the same day, recorded in [his answer on #475](https://github.com/hueypov/lexema/issues/475#issuecomment-5969974580). He was asked:

> 1. 17 pages copied from English Wiktionary, often with English definitions. My rec: keep out. Picking out the Italian ones would mean judging the text.
> 2. 2 pages using rare templates: "verbal phrase" (`{{-loc veb-|it}}`) and "pronoun" (`{{-pron-|it}}`). My rec: admit. Both map cleanly to a part of speech.
> 3. `irrequieti`, filed under an English "Adjective" heading. My rec: keep out. It's one odd page and just a plural form.
>
> OK with all 3?

His answer:

> yes to all 3

## Decision

**A real Italian page with no record is recovered when its layout is one admitted below, and the entry takes the part of speech that layout states, whatever it is.**

- **Any part of speech the layout states.** A recovered entry is no longer only a verb. Its part of speech is the one its section's layout states, in one of the four ways the [report's detector](../reports/2026-10-03-unrecorded-page-layouts.md#the-detector) reads: a `{{-x-|it}}` template the part-of-speech table `POS_TITLE_BY_TEMPLATE` knows, stray spaces read as one space; a bare `{{-x-}}` template that table knows; `{{Transitivo|it}}`, `{{Intransitivo|it}}` or `{{Riflessivo|it}}` with no heading open, which states a verb; or a written Italian title from that table, such as `'''''Verbo'''''` or `=== Verbo transitivo ===`.
- **Two more templates.** `{{-loc veb-|it}}` states *Locuzione verbale*, as `{{-loc verb-|it}}` does, and `{{-pron-|it}}` states *Pronome*, as `{{-pronome-|it}}` does. The report's detector reads neither today, because the table does not know them; the rule reads both.
- **The admitted layouts.** These are the report's groups the rule recovers, and only these:

  | Layout (report group) | Pages |
  |---|---:|
  | No language heading; `{{-sost-\|it}}` template (`none-heading/template`) | 86 |
  | Bare `{{-it-}}` line; `{{-sost-\|it}}` template (`bare-heading/template`) | 42 |
  | `== {{-it-}} ==`; template with stray spaces (`standard-heading/spaced-template`) | 21 |
  | Several part-of-speech sections (`several-parts-of-speech`) | 16 |
  | Bare `{{-it-}}` line; bare `{{-sost-}}` template (`bare-heading/bare-template`) | 8 |
  | `== {{-it-}} ==`; `{{Transitivo\|it}}`, `{{Intransitivo\|it}}` or `{{Riflessivo\|it}}`, no part-of-speech heading (`standard-heading/verb-label`) | 6 |
  | Broken `{{-it-}}` heading; `{{-sost-\|it}}` template (`malformed-heading/template`) | 4 |
  | `== {{-it-}} ==`; `{{-loc veb-\|it}}` or `{{-pron-\|it}}` template (`standard-heading/unknown-template`) | 2 |

  A page in one of these layouts is recovered only when every Italian definition on it sits in a section with a stated part of speech, read as above. ADR 0024's verb layouts stay admitted: the 13 pages rule `italian-page-entry/v1` recovers all sit in these groups.
- **One entry per part-of-speech section.** A page with several Italian part-of-speech sections gives one entry for each section, each with that section's part of speech and definitions. This replaces `ambiguous-layout`'s refusal for those pages.
- **No copy of English Wiktionary.** A page marked `{{Trasfen}}` (`english-wiktionary-copy`) gives nothing, whatever part of speech its layout states. Its definitions are often English (`mezz'ora`: "half an hour"), and keeping only the Italian ones would mean judging the text. This holds for the 3 copies with several part-of-speech sections too (`insino`, `tuttavolta`, `vale a dire`).
- **No part-of-speech signal, no entry.** A page whose layout states no part of speech is excluded, as ADR 0024 already holds: `motteggio`, `denunziare`, `tardamente` and the RAL colour pages give nothing. So does `irrequieti`, whose only section is an English heading, `===Adjective===` (`bare-heading/english-heading`). No part of speech is guessed from the text.
- **Every page, not only form-of targets.** Any raw page in an admitted layout is a candidate, whether or not a form-of record points at it.

Everything else in ADR 0024 stands, as amended by [ADR 0026](0026-recovered-entries-carry-what-the-word-page-shows.md). This record changes which pages are recovered and which part of speech an entry may have; which fields an entry carries stays as ADR 0026 sets it.

**Binding constraints.**

- Only a fixed rule reading page layout builds a recovered entry. No entry and no part of speech comes from a model, from a judgement of the text, or by hand.
- Every recovered fact names its page revision and 1-based line, and keeps that line's wikitext verbatim.
- No archive record, and no `source_record_json` line, is created or changed for it.
- Nothing is reported upstream to Wiktionary or Wiktextract.
- The page shows no mark for a recovered entry, as [ADR 0016](0016-page-shows-no-origin-marks.md) requires.
- A page with no part-of-speech signal, such as `motteggio`, is excluded.
- A page copied from English Wiktionary is excluded.
- A layout not in the table above stays a new decision, even when a later dump shows it.

## Consequences

- Up to 185 pages in the July dump can get an entry, against 13 today: the report's 192, less the 9 English Wiktionary copies, plus the 2 template pages. Words such as `mastoide`, `talora`, `lungo`, `piacione`, `piangere sul latte versato` and `tantundem` become findable. The rule is [#476](https://github.com/hueypov/lexema/issues/476), and the seed's candidate set is [#477](https://github.com/hueypov/lexema/issues/477).
- A word recovered from one page can have several entries, one per part of speech, as words seeded from the archive already do.
- The rule needs a way to tell a `{{Trasfen}}` page apart, and to read `loc veb` and `pron` as the parts of speech above.
- The 17 English Wiktionary copies, `follare`, `mezz'ora` and `volerci` among them, stay unfindable until the archive or a later decision gives them an entry.
- The seed must read every raw page, not only form-of targets, so it needs a way to list raw page titles. That is the widening of ADR 0012's raw-page exception this record makes.

## Rejected

- **Keeping a page with several part-of-speech sections excluded as `ambiguous-layout`.** Huey ruled one entry per part of speech, as the dictionary already does for archive words.
- **Admitting the English Wiktionary copies.** Their definitions are often English, and picking out the Italian ones would mean judging the text. Huey kept them out.
- **Keeping `{{-loc veb-|it}}` and `{{-pron-|it}}` out.** Each names one part of speech plainly, so a fixed rule reads it with no guess. Huey admitted them.
- **Admitting `irrequieti`.** Its English heading states no Italian part of speech, it is one page, and it is a plural form. Huey kept it out.
- **Guessing a part of speech for a page with no signal.** It would rest an entry on a judgement of the text, which ADR 0024 bans.
