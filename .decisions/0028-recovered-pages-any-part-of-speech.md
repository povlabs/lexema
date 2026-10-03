---
id: 0028
title: An Italian page in a measured layout is recovered as any part of speech its layout states, never a guessed one
status: accepted
date: 2026-10-03
tags: [data, provenance]
---

# 0028 — An Italian page in a measured layout is recovered as any part of speech its layout states, never a guessed one

**What this decides:** Page-only recovery under [ADR 0024](0024-italian-pages-the-extraction-skips-are-recovered.md) widens from three verb layouts to every layout the 2026-10-03 measurement reads with a stated part of speech. A recovered entry may be any part of speech the page layout states, and a page with several Italian part-of-speech sections gives one entry per section. This amends ADR 0024 in part.

## Context

ADR 0024 recovers an entry from the raw page when the archive has no Italian record for a real Italian page. Its rule reads three layouts only, all verbs: `{{Transitivo|it}}` or `{{Intransitivo|it}}` where a part-of-speech heading would be, and a hand-written `'''''Verbo'''''`. Rule `italian-page-entry/v1` in [`src/italian/pageEntry.ts`](../src/italian/pageEntry.ts) also refuses a page with more than one part-of-speech section as `ambiguous-layout`.

Epic [#471](https://github.com/hueypov/lexema/issues/471) found many more such pages. The measurement for [#474](https://github.com/hueypov/lexema/issues/474), [Italian pages with definitions and no record, by layout](../reports/2026-10-03-unrecorded-page-layouts.md), counts 245 pages in dump `itwiktionary-20260701` with Italian `#` definitions and no Italian record in release `it-0c432803`. Its fixed detector reads 192 of them with a part of speech the layout states. Rule `italian-page-entry/v1` recovers 13. Of the 245, 19 pages have several Italian part-of-speech sections, and 42 have no part-of-speech signal at all, `motteggio` among them.

Huey ruled on 2026-10-03, recorded in [his ruling on #475](https://github.com/hueypov/lexema/issues/475#issuecomment-5969563963). Asked "Widen it?" about these pages, he answered:

> yes widen it

Then asked "a page with several parts of speech (say noun + adjective) gives one entry per part of speech? My rec: yes. Our dictionary already works that way for normal words, so it's consistent.", he answered:

> yes to both

The ruling comment concludes: "So the ADR 0024 amendment admits any part of speech and the measured layouts, and a page with several part-of-speech sections yields one entry per section."

## Decision

**A real Italian page with no record is recovered when its layout is one the measurement reads with a stated part of speech, and the entry takes that part of speech, whatever it is.**

- **Any part of speech the layout states.** A recovered entry is no longer only a verb. Its part of speech is the one its section's layout states, in one of the four ways the [report's detector](../reports/2026-10-03-unrecorded-page-layouts.md#the-detector) reads: a `{{-x-|it}}` template the part-of-speech table `POS_TITLE_BY_TEMPLATE` knows, stray spaces read as one space; a bare `{{-x-}}` template that table knows; `{{Transitivo|it}}`, `{{Intransitivo|it}}` or `{{Riflessivo|it}}` with no heading open, which states a verb; or a written Italian title from that table, such as `'''''Verbo'''''` or `=== Verbo transitivo ===`.
- **The admitted layouts.** These are the report's groups with at least one page read with a stated part of speech, and only these:

  | Layout (report group) | Pages read |
  |---|---:|
  | No language heading; `{{-sost-\|it}}` template (`none-heading/template`) | 86 |
  | Bare `{{-it-}}` line; `{{-sost-\|it}}` template (`bare-heading/template`) | 42 |
  | `== {{-it-}} ==`; template with stray spaces (`standard-heading/spaced-template`) | 21 |
  | Copied from English Wiktionary, `{{Trasfen}}` (`english-wiktionary-copy`) | 9 of 17 |
  | Several part-of-speech sections (`several-parts-of-speech`) | 16 |
  | Bare `{{-it-}}` line; bare `{{-sost-}}` template (`bare-heading/bare-template`) | 8 |
  | `== {{-it-}} ==`; `{{Transitivo\|it}}`, `{{Intransitivo\|it}}` or `{{Riflessivo\|it}}`, no part-of-speech heading (`standard-heading/verb-label`) | 6 |
  | Broken `{{-it-}}` heading; `{{-sost-\|it}}` template (`malformed-heading/template`) | 4 |

  A page in one of these layouts is recovered only when every Italian definition on it sits in a section with a stated part of speech, as the report counts it. ADR 0024's verb layouts stay admitted: the 13 pages rule `italian-page-entry/v1` recovers all sit in these groups.
- **One entry per part-of-speech section.** A page with several Italian part-of-speech sections gives one entry for each section, each with that section's part of speech and definitions. This replaces `ambiguous-layout`'s refusal for those pages.
- **No part-of-speech signal, no entry.** A page whose layout states no part of speech is excluded, as ADR 0024 already holds: `motteggio`, `denunziare`, `tardamente` and the RAL colour pages give nothing. So do the layouts the report reads with none: a template the part-of-speech table does not know (`standard-heading/unknown-template`) and an English heading (`bare-heading/english-heading`). No part of speech is guessed from the text.
- **Every page, not only form-of targets.** Any raw page in an admitted layout is a candidate, whether or not a form-of record points at it.

Everything else in ADR 0024 stands, as amended by [ADR 0026](0026-recovered-entries-carry-what-the-word-page-shows.md). This record changes which pages are recovered and which part of speech an entry may have; which fields an entry carries stays as ADR 0026 sets it.

**Binding constraints.**

- Only a fixed rule reading page layout builds a recovered entry. No entry and no part of speech comes from a model, from a judgement of the text, or by hand.
- Every recovered fact names its page revision and 1-based line, and keeps that line's wikitext verbatim.
- No archive record, and no `source_record_json` line, is created or changed for it.
- Nothing is reported upstream to Wiktionary or Wiktextract.
- The page shows no mark for a recovered entry, as [ADR 0016](0016-page-shows-no-origin-marks.md) requires.
- A page with no part-of-speech signal, such as `motteggio`, is excluded.
- A layout not in the table above stays a new decision, even when a later dump shows it.

## Consequences

- Up to 192 pages in the July dump can get an entry, against 13 today. Words such as `mastoide`, `talora`, `lungo` and `piacione` become findable. The rule is [#476](https://github.com/hueypov/lexema/issues/476), and the seed's candidate set is [#477](https://github.com/hueypov/lexema/issues/477).
- A word recovered from one page can have several entries, one per part of speech, as words seeded from the archive already do.
- The report notes that in the 9 admitted English Wiktionary copies the definitions are often in English (`mezz'ora`: "half an hour"). The rule reads layout, not the language of the text, so those definitions are recovered as the page writes them.
- The seed must read every raw page, not only form-of targets, so it needs a way to list raw page titles.

## Rejected

- **Keeping a page with several part-of-speech sections excluded as `ambiguous-layout`.** Huey ruled one entry per part of speech, as the dictionary already does for archive words.
- **Guessing a part of speech for a page with no signal.** It would rest an entry on a judgement of the text, which ADR 0024 bans.
- **Admitting every layout the report counts.** Three groups state no part of speech, so a fixed rule cannot read one there.
