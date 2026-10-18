---
id: 0034
title: A spelled Italian cardinal up to 999.999 that nothing answers gets one rule-built reading
status: accepted
date: 2026-10-19
tags: [data, provenance, licensing]
---

# 0034 — A spelled Italian cardinal up to 999.999 that nothing answers gets one rule-built reading

**What this decides:** When a lookup finds nothing for a spelled Italian cardinal from 0 to 999.999, such as `duemilauno`, rule `it-cardinal/v1` answers it with one reading and one fixed Lexema definition. It stands beside [ADR 0031](0031-hand-kept-readings-fill-source-gaps.md) and [ADR 0008](0008-generated-explanations-are-labelled-and-reportable.md), and amends [ADR 0009](0009-two-licences-and-a-source-link.md) in part, for these readings only.

## Context

A reader app turns digits into Italian words (2001 → `duemilauno`) and looks the words up. Lexema answers `Nessuna voce per` for most of them, because Italian Wiktionary lists only some number words ([#804](https://github.com/povlabs/lexema/issues/804)). On release `it-0c432803` the archive heads `cinquantanove` (line 39076), `ventitré` (41858) and `duemila` (43015), and no line heads `duemilauno`, `centoventitré` or `millenovecentottanta`.

Readings the source lacks already come from beside it: hand-kept readings ([ADR 0031](0031-hand-kept-readings-fill-source-gaps.md)), name entries ([ADR 0032](0032-wikidata-names-fill-proper-name-gaps.md)) and Wikidata words ([ADR 0033](0033-wikidata-words-fill-wiktionary-gaps.md)). Each is stored one by one. A cardinal is not: there are a million of them, and their meaning follows from their spelling, so a rule can make the reading at lookup time.

Huey ruled on 2026-10-18 ([ruling](https://github.com/povlabs/lexema/issues/804#issuecomment-6255375569)):

> yes, bounded. A deterministic rule it-cardinal/v1 parses a spelled Italian cardinal up to 999.999 and answers only when the source has no reading for it, with a fixed Lexema definition ("numero cardinale corrispondente a N"). Record it in a new ADR beside ADR 0031 and ADR 0008. Huey approves the exact definition wording on the PR.

Asked where the page's one *Fonte* goes for such a reading, which has no source page, he ruled the same day ([ruling](https://github.com/povlabs/lexema/issues/804#issuecomment-6255635117)):

> yes. On a page whose only reading is rule-built by it-cardinal/v1, the one Fonte opens /licence, and the API credits Lexema (not Wiktionary / CC BY-SA) for that reading. Accentless spellings (ventitre → 23) are accepted, matching #846.

## Decision

**A spelled Italian cardinal from 0 to 999.999 that no other reading answers gets one reading, built by rule `it-cardinal/v1`, defined as "numero cardinale corrispondente a N", with N its value in digits.**

- **The rule.** `parseItalianCardinal` in `src/italian/cardinal.ts` reads one written word into its value, and nothing else. A ten drops its final vowel before `uno` and `otto` (`ventuno`, `trentotto`) and only there. A hundred drops its `o` before `ottanta` (`centottanta`), and may keep or drop it before `uno` and `otto` (`centouno` and `centuno`). One thousand is `mille`; more are `-mila` (`duemila`), and a multiplier ending in `uno` may drop its `o` there (`ventunmila`, `ventunomila`). A space, a hyphen, an `e` between the parts, a digit, an ordinal, a fraction, and any number from a million up (`unmilione`) are not read. A malformed spelling (`centocento`, `ventiuno`) is not read.
- **The accent.** A compound's final `tre` may carry its accent or not: `ventitré` and `ventitre` both read 23, as an accentless query already opens its headword ([#846](https://github.com/povlabs/lexema/issues/846)). `tre` alone, and a `tre` before more letters (`tremila`), carries none, so `tré` and `trémila` are not read.
- **Last, and only where nothing answers.** The rule runs after every other route of `lookup()`: the source's records, curated cells, page-only entries, hand-kept readings, name entries, phrases, the essere agreement, word shapes, pronominal pairs, Wikidata words, and the headword an accentless query opens. A word a form-of record names as its lemma is a declared lemma ([#453](https://github.com/povlabs/lexema/issues/453)) and gets no rule-built reading. So a number word the source lists (`cinquantanove`) keeps exactly its source readings, and `ventitre` opens the source's `ventitré`. When a later release lists a cardinal, its rule-built reading stops showing, with no ruling and no deletion.
- **One reading.** Its word is the query's key, its part of speech `adj`, *Aggettivo numerale*, as the source files its numerals, and its one definition the fixed text. It states no grammar, no form and no other fact. Its identity is the rule and the value (`CardinalIdentity` in `src/lookup/types.ts`); nothing is stored.
- **Every route agrees.** `lookup()`, `exists()` and `lookupBatch()` read the rule in one place (`src/lookup/cardinal.ts`), and the word page shows what `lookup()` returns, so the four routes give one answer.
- **No mark on the page.** The reading shows like any other reading, with no note that a rule made it or that the source lacks it ([ADR 0016](0016-page-shows-no-origin-marks.md)). The definition is fixed, deterministic Lexema text whose exact wording Huey approves on the pull request that builds the rule, so it is `lexema-deterministic` under ADR 0008, not generated text, and carries no label.
- **Credit.** The page's one *Fonte* opens `/licence`, Lexema's Licenza page. The API's `attribution` for such a reading names `Lexema` as the source, `https://lexema.fyi/licence` as `source_url`, and CC0 1.0 as the licence, in `/lookup`, `/lookup/batch` and `/exists` alike; its id is `<release>:cardinal:<value>`. This amends ADR 0009's one-licence amendment for these readings only: no source text is in them, so they credit neither Wiktionary nor CC BY-SA. Every other result's field is unchanged.

**Binding constraints.**

- No rule-built cardinal shows for a spelling any other reading answers, or a declared lemma's page answers.
- The rule reads no number above 999.999, and no ordinal, fraction or digit input.
- The definition is the fixed text and nothing else; no text is generated for it, and no grammar is stated.
- The rule writes nothing to the dictionary, and edits no source row.

## Consequences

- `duemilauno`, `duemilaventi` and every other well-formed cardinal up to 999.999 get an entry, so a reader app can look up any year.
- A cardinal's entry says only what number it is. It carries no grammar, pronunciation or example, because no source states them.
- The rule is a parser beside the source, with its own tests (`test/cardinal.test.ts`); a spelling it reads wrongly is a bug in that one module.
- This record changes no text of the Licenza page, whose text is Huey's approved wording; a sentence there about rule-built readings would need its own ruling.
- [#803](https://github.com/povlabs/lexema/issues/803), number words the source has with no meaning, stays separate.

## Records

New term **rule-built cardinal**, defined in [.glossary/TERMS.md](../.glossary/TERMS.md) in the same change. The design manifest's *Fonte* rows name the `/licence` link.
