---
id: 0026
title: A recovered entry may carry every field our word page shows, when its own page gives it
status: accepted
date: 2026-10-03
tags: [data, provenance]
---

# 0026 — A recovered entry may carry every field our word page shows, when its own page gives it

**What this decides:** An entry built from a raw Italian page under [ADR 0024](0024-italian-pages-the-extraction-skips-are-recovered.md) may carry every field our word page shows, expressions included, whenever that same page gives it. The list of fields is set by what Lexema's word page shows, not by which sections a Wiktionary page has. This amends ADR 0024 in part, which allowed a recovered entry only a word, a part of speech and definitions. It also amends [ADR 0012](0012-archive-is-the-release-seed.md) in part, as ADR 0024 did, since raw pages now give more than definitions at seed time.

## Context

ADR 0024 lets about 23 Italian pages the extraction cannot read, `raccontare` and `fornire` among them, get an entry from the raw page. It limits that entry: "Nothing else: no forms table, pronunciation, etymology or other field. Carrying more is a new decision." Its binding constraint says the same: "A recovered entry carries only a word, a part of speech and definitions, each read from the raw page." So a recovered word shows less than a word seeded from the archive.

Huey widened that in three steps, all on [#451](https://github.com/povlabs/lexema/issues/451):

1. On 2026-10-02, told that the `raccontare` and `fornire` pages give pronunciation, etymology and synonyms the recovered entry drops, he said "we need those as well" ([#439](https://github.com/povlabs/lexema/issues/439)). He confirmed it on 2026-10-03 in [his ruling on #451](https://github.com/povlabs/lexema/issues/451#issuecomment-5968688872). The question was "recovered words also get pronunciation, etymology and synonyms from the page?", and his answer was "yes to all 7".
2. On 2026-10-03, on this record's pull request, he widened it: "for 480 add also expressions and what we have in a word page" ([widening](https://github.com/povlabs/lexema/issues/451#issuecomment-5969613151)). That replaced the earlier exclusion of other fields. It still grants no generated text, no broader page admission ([#471](https://github.com/povlabs/lexema/issues/471), [#475](https://github.com/povlabs/lexema/issues/475)) and no shared-database write.
3. The same day he said which list he meant: "for 480 not wikti page i meant what ever our word page have" ([clarification](https://github.com/povlabs/lexema/issues/451#issuecomment-5969625420)). So the fields are the ones our word page shows, each filled only from the entry's own raw page under ADR 0024's rules, and nothing is generated.

## Decision

**A recovered entry may carry every field our word page shows, each only when the entry's own raw page gives it.**

The fields are those the word page shows today, read from [`web/lib/dictionary/wordPage.ts`](../web/lib/dictionary/wordPage.ts) and [`web/components/dictionary/`](../web/components/dictionary/) (`Word.tsx`, `Reading.tsx`, `Forms.tsx`, `Expressions.tsx`). Each is granted:

- **Part of speech**, as ADR 0024 already grants.
- **Gender and number**, shown in the reading's heading.
- **Definitions, with their labels and examples**, as ADR 0024 already grants.
- **The word it is a form of**, shown as a *Form of* line or a link in the definition.
- **Forms**: a verb's conjugation table, and a noun's or adjective's gender and number table, as the *Forms* block shows them.
- **Pronunciation.**
- **Etymology.**
- **Synonyms.**
- **Antonyms.**
- **Derived words.**
- **Expressions**, the *Expressions* section's phrases and their meanings.

Hyphenation is not on the list. The archive has it, but our word page does not show it.

These rules hold for every field above:

- **Only from the entry's own page.** Each field is read from the same `raw_page` revision the entry is built from. A page that does not give a field gives an entry without it. Nothing is taken from another page, another release or the archive.
- **A fixed rule over the page layout.** Each field is read by a fixed rule over the page's layout, as the rest of ADR 0024 is. The same page always gives the same fields. No model, and no judgement of the text.
- **Nothing is generated.** A value the page does not write is not made up, guessed or filled in.
- **How each fact points to its page.** Each fact names the page revision and the 1-based line it was read from, and keeps that line's wikitext verbatim, as the part of speech and definitions already do.
- **The raw source is kept as it is.** No archive record and no `source_record_json` line is created or changed for these fields.
- **The page shows no mark for them.** They read like the same fields on any other entry, as [ADR 0016](0016-page-shows-no-origin-marks.md) requires. The data keeps where every fact came from.

Everything else in ADR 0024 stands.

**Binding constraints.**

- A recovered entry carries only the fields listed above, each read from its own raw page. This replaces ADR 0024's first binding constraint.
- Every recovered fact names its page revision and 1-based line, and keeps that line's wikitext verbatim.
- No archive record, and no `source_record_json` line, is created or changed for it.
- Only a fixed rule reading page layout reads these fields. None is added by hand, by a judgement of its content, or by generated text.
- This record grants nothing else. A field not on the list above, recovering any page ADR 0024 does not already admit, and any write to the shared database each stay a new decision.

## Consequences

- A recovered word such as `raccontare` can show what a word seeded from the archive shows, wherever its page gives it. The build is [#439](https://github.com/povlabs/lexema/issues/439).
- ADR 0024's note that a recovered entry has no inflection table no longer holds where the page gives one.

## Rejected

- **Only pronunciation, etymology and synonyms.** That was the first ruling. Huey widened it to expressions and every field the word page shows.
- **Every section a Wiktionary page has.** Huey ruled the list is what our word page shows, not what Wiktionary's page has.
