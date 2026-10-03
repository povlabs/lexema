# Definitions wrapped onto the line after their `#`, 2026-10-01

Measurement for [issue #28](https://github.com/povlabs/lexema/issues/28), phase three.
[Phase two](2026-09-23-recovered-definitions-full-release.md) recovered the definitions
the extraction drops below `#` lines. It left out a second route, first named in
[why `casa` has no definition](2026-09-18-definition-loss.md#a-second-separate-loss-route):
the page writes a `#` item's definition on the next physical line, outside the list.
The list reader ends the item at the newline, so that line never reaches a sense.

Inputs are phase two's: the archive `it-extract.jsonl.gz` (`0c432803c672…`, 560,357
Italian records) and the 2026-07-01 dump it was built from
(`itwiktionary-20260701-pages-articles.xml.bz2`, SHA-1 `2bdd4442…`). Re-run with
`pnpm run measure:recovery`.

## The rule

`src/italian/wikitext.ts` reads the line right after a `#` line as that item's
definition, with route `wrapped-prose`, only when all of these hold:

- the `#` line is a page control: it has no prose of its own, only templates,
  labels, an italic stamp or a comment, and it is not `{{Nodef}}`;
- the next line opens with no list, heading, table, tag, indent or `__` mark;
- that line shows prose outside italics, so a picture or a category link does not
  count, and it is not a quotation or something said (`!`, `?`), as for every route.

Only that one line is read. The usage labels on the `#` line label the definition,
because they open the same item (`pantomima`: `#{{Fig}}`, so *figurato*).

## What a looser rule would have read

A one-off scan of every Italian part-of-speech section in the dump, not kept in the
repository, found a prose line right after a `#` line in these cases, once lines
opening with a picture or category link are set aside:

| After a `#` line that… | Lines | Read as a definition |
| --- | ---: | :---: |
| carries only page controls | 5 | yes |
| is `{{Nodef}}` | 15 | no |
| states a meaning of its own | 85 | no |

After `{{Nodef}}` the page says it gives no definition, and the lines there are
mostly usage sentences or a part of speech (`malaccorto`: *Nel loro essere malaccorti
furono ridicoli*; `immischiare`: *transitivo*). This is the rule phase two already
applies below `{{Nodef}}`. After a `#` line that states a meaning, the next line is
the rest of a gloss the record already holds, or a usage sentence, an etymology or a
reader's comment (`melone`: *In estate è un rinfrescante il melone*). Reading those
would put text on the page as a definition when it is not one.

## Results

| Count | Phase two | Now |
| --- | ---: | ---: |
| records with full loss | 6 | **9** |
| records with partial loss | 442 | **443** |
| definitions recovered | 889 | **893** |
| by `wrapped-prose` | — | **4** |

Every other count in phase two is unchanged: the records matched and skipped, the
other three routes (17, 561, 311), the 17 examples, the 51 held as examples and the
332 nested items.

The four are `vaglielo` (verb, full: its one sense has no gloss), `scledense` (full),
`magrebina` (full) and `pantomima` (noun, partial: it keeps the theatre sense and
gains the figurative one). `magrebina`'s `#` line is an italic stamp,
*Femminile singolare di magrebino.*, and its wrapped line is
`• aggettivo: Del Magreb, …`, kept as the page words it.

`verde`, the case the route was named after, is read by the parser but not
recovered. Its page has two noun sections, so its noun record matches neither, as
phase two counts for 1,474 records.

A database seeded before this change takes the new rows only after
`pnpm run seed:dev` runs again. Until then it reads as before.

## Attribution

Page content quoted here is from Italian Wiktionary, CC BY-SA 4.0, at the revisions
in the 2026-07-01 dump.
