---
id: 0026
title: A recovered entry may also carry the pronunciation, etymology and synonyms its own page gives
status: accepted
date: 2026-10-03
tags: [data, provenance]
---

# 0026 — A recovered entry may also carry the pronunciation, etymology and synonyms its own page gives

**What this decides:** An entry built from a raw Italian page under [ADR 0024](0024-italian-pages-the-extraction-skips-are-recovered.md) may also carry the pronunciation, etymology and synonyms that same page gives. This amends ADR 0024 in part, which allowed a recovered entry only a word, a part of speech and definitions.

## Context

ADR 0024 lets about 23 Italian pages the extraction cannot read, `raccontare` and `fornire` among them, get an entry from the raw page. It limits that entry: "Nothing else: no forms table, pronunciation, etymology or other field. Carrying more is a new decision." Its binding constraint says the same: "A recovered entry carries only a word, a part of speech and definitions, each read from the raw page." So a recovered word loses the pronunciation, etymology and synonyms its page has, while a word seeded from the archive keeps them.

On 2026-10-02, told that the `raccontare` and `fornire` pages give pronunciation, etymology and synonyms the recovered entry drops, Huey said "we need those as well" ([#439](https://github.com/hueypov/lexema/issues/439)). He confirmed it on the board on 2026-10-03 in [his ruling on #451](https://github.com/hueypov/lexema/issues/451#issuecomment-5968688872). The question was "recovered words also get pronunciation, etymology and synonyms from the page?", and his answer was "yes to all 7".

## Decision

**A recovered entry may also carry pronunciation, etymology and synonyms, each only when the entry's own raw page gives it.**

- **Only from the entry's own page.** Each of the three fields is read from the same `raw_page` revision the entry is built from. A page that gives none of them gives an entry with none. Nothing is taken from another page, another release or the archive.
- **A fixed rule over the page layout.** The fields are read by a fixed rule over the page's layout, as the rest of ADR 0024 is. The same page always gives the same fields. No model, and no judgement of the text.
- **How each fact points to its page.** Each pronunciation, etymology and synonym names the page revision and the 1-based line it was read from, and keeps that line's wikitext verbatim, as the part of speech and definitions already do.
- **The raw source is kept as it is.** No archive record and no `source_record_json` line is created or changed for these fields.
- **The page shows no mark for them.** They read like the same fields on any other entry, as [ADR 0016](0016-page-shows-no-origin-marks.md) requires. The data keeps where every fact came from.

Everything else in ADR 0024 stands.

**Binding constraints.**

- A recovered entry carries only a word, a part of speech, definitions, and the pronunciation, etymology and synonyms its own raw page gives, each read from that page. This replaces ADR 0024's first binding constraint.
- Every recovered fact names its page revision and 1-based line, and keeps that line's wikitext verbatim.
- No archive record, and no `source_record_json` line, is created or changed for it.
- Only a fixed rule reading page layout reads these fields. None is added by hand, by a judgement of its content, or by generated text.
- This record grants nothing else. Forms and conjugation tables, generated text, other fields such as hyphenation, antonyms and derived words, recovering any page ADR 0024 does not already admit, and any write to the shared database each stay a new decision.

## Consequences

- A recovered word such as `raccontare` can show its pronunciation, etymology and synonyms like a word seeded from the archive. The build is [#439](https://github.com/hueypov/lexema/issues/439).
- A recovered entry still has no inflection table, so it still differs in that from an archive-seeded entry.

## Rejected

- **Carrying every field the page has.** The ruling names three fields. Hyphenation, antonyms, derived words and the forms table were not asked about, so they are not granted here.
