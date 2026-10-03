# Words only their forms name: what the page shows now

Measurement for [issue #453](https://github.com/hueypov/lexema/issues/453), run 2026-10-03.
About 9,000 Italian lemmas have no record of their own, but the bot-made records of
their forms say which form they are. Huey ruled on 2026-10-03 that searching such a
word shows it with its forms table, with no definition and no note. This report counts
how many of those words now get a page, how full the tables are, and which edges the
rules leave unplaced.

## What was measured

| | |
|---|---|
| Master | `it-0c432803`, `it-extract.jsonl.gz` (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`), seeded fresh into a local SQLite file with `seedSql` and the raw pages of `itwiktionary-20260701-pages-articles.xml.bz2`, so both hiding rules ran: `section-language/v1` hid 23 records, `form-of-foreign-lemma/v1` hid 7 |
| Applied feed | the 268 changes of [2026-10-01-first-feed-selection.ids](2026-10-01-first-feed-selection.ids) from `it-78385b62` (SHA-256 `78385b6229d19ed990ada6f6f33930585701c3bdc146fb1c849818df72a3e8d4`), through `planApply`: 214 new records, 54 changed |
| Code | this branch: `searchAttempt` (web/lib/dictionary/searchAttempt.ts), `declaredLemma` (src/lookup/declaredLemma.ts), `it-verb-form-gloss/v1` (src/italian/verbFormGloss.ts), `it-plural-gloss/v1` |
| Script | [`tools/measureDeclaredLemmas.ts`](../tools/measureDeclaredLemmas.ts), read-only, about 5 seconds |

Run it with
`TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx tools/measureDeclaredLemmas.ts <master.sqlite> it-0c432803`.
It takes every served `form_of` target that no served record heads, searches it the way
the page does, and counts what came back. It prints aggregates only.

## The words

9,037 targets of served `form_of` edges have no served headword record, named by
284,879 edges. These are the issue's numbers.

| What a search for the word shows now | Words |
|---|---:|
| Its word page, with a forms table | **8,770** |
| What it showed before: a record lists it among its own forms | 136 |
| Still "No entry": no form takes a cell | 131 |

Every page has a non-empty table: a word whose forms take no cell gets no page, so
8,770 words get a page and 8,770 a non-empty table. By part of speech:

| Readings on the page | Words |
|---|---:|
| Verbo | 6,464 |
| Sostantivo | 1,326 |
| Aggettivo | 972 |
| Aggettivo + Sostantivo | 6 |
| Verbo + Aggettivo | 2 |

## How full the verb tables are

The glosses name the seven simple tenses, the imperative and two non-finite forms, so a
verb page can fill at most 49 slots: six persons in each simple tense, five in the
imperative, the gerundio and the participio. Compound tenses and the auxiliary are not
in these glosses, so those stay empty on every such page.

| Of the 49 slots, empty | Verb pages |
|---|---:|
| none | 3,299 |
| 1 to 5 | 1,322 |
| 6 to 20 | 396 |
| 21 or more | 1,449 |

The slots most often empty are the present persons the source most often does not give
a record of their own: imperativo *lui, lei* (2,079 pages), congiuntivo presente *io*,
*tu* and *lui, lei* (1,926 each), indicativo presente *tu* (1,916), congiuntivo presente
*voi* (1,825), indicativo presente *io* (1,662) and imperativo *tu* (1,599). An empty
slot is a dash, as on every table.

## The edges

| What the rules make of an edge | Edges |
|---|---:|
| Read, and its form placed in a cell | 261,919 |
| Read, on a page, but no cell holds it | 22,315 |
| Read, but its word gets no page (136 listed elsewhere, 131 "No entry") | 324 |
| Refused by `it-verb-form-gloss/v1` | 93 |
| Refused by `it-plural-gloss/v1`, adjective records | 164 |
| Refused by `it-plural-gloss/v1`, noun records | 63 |
| Declared by a pronoun record, which no rule reads | 1 |
| **Total** | **284,879** |

The 22,315 read but not placed are the agreement forms a conjugation has no cell for:
the participio passato's *maschile plurale*, *femminile singolare* and *femminile
plurale* (`verbalizzati`, `verbalizzata`, `verbalizzate`) and the *participio presente
plurale* (`verbalizzanti`), plus plurals whose record states no gender (`tassofoni`).
A verb's own record lists only the masculine singular participle, so these are left
out the same way.

The 93 refused verb glosses are written by hand in other shapes: `prima persona
singolare dell'indicativo presente del verbo lussare`, `terza persona plurale
congiuntivo presente del verbo gingillare`, `participio passato di incoronare.
incoronarsi`. The 227 refused noun and adjective glosses are mostly `femminile di
<word>`, a feminine singular, which `it-plural-gloss/v1` does not read.

## Limits

- The numbers describe this local master. The served D1 was not read.
- Only the shapes the two rules read are counted as placed. A refused gloss is not a
  wrong one: `femminile di calabro` is true, and the grid just has no rule to place it.
