# Design-system manifest — rendered UI design law

The agent-readable design law a builder reads before generating any UI, the way it
reads [AGENTS.md](./AGENTS.md). It holds only the law Huey has ruled, transcribed by
an agent; an agent records a ruling here and never invents one. Where the law is
silent, ask Huey before painting; the gap is not filled here.

The drawings are in [`lexema-design.pen`](./lexema-design.pen). Boards 08 to 22 are
the current design; frames 00 to 07 and their notes are the earlier design, kept for
history. Where a board and this file disagree, this file wins and the board is fixed.

## Settled law

| Rule | Source |
|---|---|
| Headings, section names, controls and links are in English. Grammar labels on a result are Italian: the part of speech, moods, tenses, persons, gender, number, and the non-finite labels. | [ADR 0015](./.decisions/0015-grammar-labels-are-italian.md) |
| Definitions, examples, and forms appear in the Italian the source wrote them in, never translated or paraphrased. | [ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md) |
| The result page shows data only. It adds no note explaining missing, unplaced, derived or disputed data: an empty slot is a dash in its cell or simply absent, a form the page cannot place in a grid or table is not shown, and a disputed claim is not marked on the page (the review stays in the data). Where there is no data, the page shows nothing. | [README.md](./README.md); ruled by Huey on 2026-09-27 |
| Every candidate a lookup returns is rendered. The interface may rank; it never drops. | [AGENTS.md](./AGENTS.md), the product rule |
| A generated short explanation may appear in Italian and in English, labelled as generated. Its example sentence, and everything from the source, stays Italian. | [ADR 0008](./.decisions/0008-generated-explanations-are-labelled-and-reportable.md), amendment of 2026-09-21 |
| One small *Source* link per result page, to the Wiktionary page of the spelling in its title; a searched expression's short page links to the expression's page; a page for a word only its forms name links the page of the first form its forms table shows; no credit line on the search page. The full credit is on `/attribution`, linked from the footer. | [ADR 0009](./.decisions/0009-two-licences-and-a-source-link.md), amendments #281 and #459 |

## The page

Ruled by Huey on 2026-09-21: "put the search bar in the middle of the screen
first and then when I search, it goes top as right now."

| Rule | What it means on the page |
|---|---|
| **Two states.** | Before a query, the page is the search bar alone, centred on the screen with the site name above it and nothing else competing. Under the name, centred, sit its pronunciation `/lekˈsɛːma/` in mono, muted, as a word's pronunciation is drawn, and *a simple dictionary* in italic serif (board 00). With a query, the bar sits at the top and the results fill the page below it. |
| **One bar, one route.** | The same form serves both states; the query stays in the URL so a result can be shared. Moving the bar is layout, not a second page. The `×` in the bar empties it and keeps the cursor there; the result stays until a new search is sent. ⌘K on a Mac, Ctrl+K elsewhere, scrolls to the top (smoothly, or at once for a reader who asks for reduced motion) and puts the cursor in the bar with its text selected, on the home page and on a result; not while a dialog is open or the reader is typing in another field. While the bar does not have the cursor, a small muted `⌘K` (`Ctrl K`) sits where the `ENTER` hint does, left of the `×` when there is text; a touch-only screen does not show it. |
| **Suggestions include expressions.** | While a reader types several words, the list under the bar also offers what they are typing completed as an expression, in their own words: `andare v` offers *andare via*, `vado v` offers *vado via*. It is offered only when it finds a stored multi-word headword, after the words that begin with what was typed. Ruled by Huey on 2026-09-30 ([#214](https://github.com/povlabs/lexema/issues/214#issuecomment-5907869562)). |

## The result

Ruled by Huey on 2026-09-27, on boards 08 to 21. These rules replace the result-card
rules of 2026-09-21 (boxed paradigms, header bars, three boxes to a row).

### Layout

| Rule | What it means on the page |
|---|---|
| **One layout for every word type.** | Headword, then its readings in source order, then the facts about the word, then *Source*. No box or card surrounds a reading; readings are separated by a thin rule. |
| **The headword carries its pronunciation.** | The IPA sits under the headword. Syllable breaks are not shown. A word with no pronunciation shows none. |
| **Jump links only for three or more readings.** | Under the headword, one link per reading, `1 Aggettivo`; a reading with no number is its label alone, `Sostantivo`. A page with one or two readings has none. |
| **A reading is a heading and blocks.** | The heading is `1 · Sostantivo`: the number, then the record's `pos_title`. A reading that takes a gender × number grid adds, muted, the gender and number its record states, in Italian: `1 · Aggettivo · maschile, singolare`, `2 · Sostantivo, forma flessa · femminile, plurale`; both numbers when it states both (`khmer`: `maschile, singolare e plurale`), only the one it states when it states one, and nothing when it states neither. Verbs, *Voce verbale*, proper names and other readings without a grid add nothing. A reading with no definition has no number: its heading is its `pos_title` alone (`Locuzione verbale`), with its muted grammar if it has one, and the readings that have a definition number 1, 2, 3 among themselves, so the numbers never skip. The report dialog lists a reading the same way. Ruled by Huey on 2026-09-30 (#250). On a phone the heading wraps. Then *Definitions*, then *Forms*. A block with nothing to show is left out. |
| **Section labels are plain.** | A small grey label (*Definitions*, *Forms*, *Etymology*, *Synonyms*). No count, no rule beside it, no box around the block. |
| **One expand control, no count.** | Closed, a block shows its first part, then a small accent `+ more` right at the end of what shows. Open, it shows everything, then `less` at the very end. No control carries a count. It works with no script: the whole content is in the HTML. *Etymology*: one line cut with an ellipsis, `+ more` right after it; open, `less` follows the text's last word; a text that fits on its line has no control. *Synonyms*, *Antonyms*, *Derived words* and the not-found offers: the words that fit on one line, `+ more` after the last of them on that line; open, every word, then `less`; words that all fit have no control. *Definitions*: the first definition and its own first example, or none if it has none of its own (no other definition's example stands in), then `+ more` under it; open, every definition with all its examples in order, then `less`. Ruled by Huey on 2026-09-27. |
| **Word facts come once, after the readings, unless the source ties them to a reading.** | *Etymology* as prose, one line, in every Etymology block, in a reading or after the readings, on a phone too. *Synonyms* as a run of words separated by `·`. Both open with the one expand control. On a word with two readings or more, an etymology whose opening bracket names a part of speech (`(sostantivo plurale) vedi sala`) shows in that reading, after *Forms*, without the bracket; a synonym group the source opens with a part-of-speech label (`sostantivo`, `verbo`) shows in that reading in the same style. Only a label that names exactly one reading moves its text; a label that names two, whether two parts (`medico`'s `(aggettivo e sostantivo)`) or two readings of one kind (`svolta`'s two *Voce verbale* readings), is never copied into both. Whatever names no single reading (such a label, a topic label such as `(sport)`, an unlabelled text or list) stays once after the readings, with no note. A text that is only its label leaves no block. Ruled by Huey on 2026-09-27. |
| **Source and report sit together at the bottom.** | `Source ↗ · Report a mistake`, with the same space above it and at least that space below it; on a page shorter than the window, the footer sits at the bottom of the window and the extra room falls between Source and the footer. Exactly one *Source*, with no word after it, to the Wiktionary page of the spelling in the title: `macchina` links to *macchina*'s page, which holds both its readings, and `andavano` to *andavano*'s, though it shows `andare`'s table. A searched expression's short page links to the expression's page instead. Ruled by Huey on 2026-09-30 ([#281](https://github.com/povlabs/lexema/issues/281)). On a page for a word only its forms name, *Source* opens the page of the first form its forms table shows, in the order the table renders and skipping the title spelling a grid puts in its own cell: `verbalizzare` links to *verbalizzando*'s page, `fratellino` to *fratellini*'s. That is where the shown data comes from, and the title word almost never has a page. Ruled by Huey on 2026-10-03 ([#459](https://github.com/povlabs/lexema/issues/459#issuecomment-5969625294)). What the report box asks is on board 22 and in [#51](https://github.com/povlabs/lexema/issues/51). |

### Forms: three shapes

A reading's *Forms* block takes the shape its data has. Nothing else about the
reading changes with the word type.

| Shape | Used for | What it means on the page |
|---|---|---|
| **None** | adverbs, proper names, abbreviations, prefixes and suffixes, grammar words, most phrases | No *Forms* block. |
| **Gender × number grid** | nouns, adjectives, phrases that inflect | Columns *singolare* and *plurale*; rows *maschile* and *femminile*, only the rows the source has. Each cell is the form, with its definite and indefinite article under it (`il bello · un bello`; on a phone, on two lines). An adjective's superlative is a second grid of the same shape, labelled *superlativo*. |
| **Conjugation** | verbs, and the lemma of a searched verb form | One line of non-finite forms (*gerundio*, *participio*, *ausiliare*). Then mood tabs (*Indicativo*, *Congiuntivo*, *Condizionale*, *Imperativo*), then a table with persons down and the simple tenses across, named in Italian. The compound tenses wait behind the one `+ more` right after that table; opened, *Tempi semplici* and *Tempi composti* are named and `less` ends them. The tabs open on the mood of the searched form, else *Indicativo*. |

| Rule | What it means on the page |
|---|---|
| **A searched form is marked only in a conjugation.** | In a verb table the searched form is underlined in the accent colour, and its person and tense labels take the accent. A grid does not mark it; it is obvious there. Ruled by Huey on 2026-09-23 ([#111](https://github.com/povlabs/lexema/issues/111)): marking stays with verbs, never a noun or adjective box. |
| **A searched verb form leads to its lemma's table.** | Searching `andavano` shows its own reading, whose definition links to `andare`, and under it *Forms of andare*, opened where `andavano` sits. When one spelling fills two cells (`andassi`), both are marked. |
| **A searched expression gets a short page.** | Searching `vado via` shows a page like `andavano`'s without any table. It has only the heading, what was typed (`vado via`), and a reading for each record of the conjugated word, headed by its part of speech (`1 · Voce verbale`). Its *Definitions* are first the expression's own meanings, copied from its entry with their labels and examples, then that word's own form entries with the lemma swapped for the expression, which links to its entry: "prima persona singolare del presente semplice indicativo di *andare via*". Closed, the first meaning shows, then the form lines, numbered on from it (`2.`), then `+ more`; open, the other meanings show under the first and the form lines' numbers count them (`4.`), then `less`: the one expand control, as on every reading. A word with several form entries shows each one (`vada via`: the first meaning, then five form lines). An expression with no gloss shows only its form lines. An expression no form line names still shows its meanings, as a reading of its own record headed by its part of speech (`1 · Locuzione verbale`). No *Forms* and no pronunciation. The footer has one *Source*, to the expression's page (`Source ↗ · Report a mistake`), never the searched word's. Ruled by Huey on 2026-09-30 ([page shape](https://github.com/povlabs/lexema/issues/214#issuecomment-5906398940), [meanings first](https://github.com/povlabs/lexema/issues/214#issuecomment-5909303467), [folded, one Source](https://github.com/povlabs/lexema/issues/214#issuecomment-5910100974)). |
| **Forms and synonyms are links.** | Every form in a conjugation table and every synonym links to its own search. No underline and no hover colour; the pointer cursor is the only cue. A cell holding several spellings links each one. |
| **Groups follow the source's own vocabulary.** | Moods, then tenses, in the order the tag vocabulary lists them. A form that fits no cell, such as `mangiarsi (coniugazione)`, is not shown, and nothing says so. |

### On a phone

| Rule | What it means on the page |
|---|---|
| **Same order, re-stacked.** | Boards 19 to 21. Nothing the wide page shows is dropped, and nothing scrolls sideways. |
| **Grids stack by gender.** | The gender label sits above each singular and plural pair. |
| **Conjugations show two tenses at a time.** | The four mood tabs stay on one line. The table shows two tenses side by side, then the next two below. The non-finite forms are three short rows. |
| **Synonyms stay one line until opened.** | Closed, the words that fit on the phone's line; open, the run wraps onto as many lines as it needs. |

## When a search finds nothing

Ruled by Huey on 2026-09-27, board 24.

| Rule | What it means on the page |
|---|---|
| **Say it, then offer what is close.** | The heading is `No entry for "<query>"`, serif, large, with the page's own search bar above it and the footer at the foot of the window. Under it, the first of these that finds something: the same letters with an accent (`Did you mean città?`, the word in the accent colour, then *Other words that begin with "citta"*); a spelling one edit away (`Did you mean mangiare?`, then *Other close spellings*; among spellings equally close, the word translated into the most languages leads, so `mangare` offers `mangiare` before `magnare`); a search of several words corrected so that it reads as an expression, kept as typed, with one word misspelled, the last word unfinished, or only part of it an expression (`Did you mean vado via?` for "vadoo via", `Did you mean tiro fuori?` for "tiro fuory", then *Other expressions*; each opens that search's short page); the words that begin with what was typed (*Suggestions*, one line, then `+ more`); or, with nothing close, "Lexema has no word spelled this way. Check the spelling, or search for the word's base form: the infinitive of a verb, the singular of a noun." A search that finds a word still offers it with an accent or a final apostrophe when a headword writes it so (`citta` finds `citto`'s form and offers `città`; `e` offers `è`, `po` offers `po'`), never a spelling that drops a mark the query has. It is one line right under the search bar, above the result, which shows unchanged below it: `Did you mean città?` in the not-found offer's form, smaller, as board 32 draws it (*Did you mean* in small muted sans, the first ranked word in the accent colour in serif, linked to its search). Ruled by Huey on 2026-10-03 ([ruling](https://github.com/povlabs/lexema/issues/478#issuecomment-5969664345), [board 32](https://github.com/povlabs/lexema/issues/478#issuecomment-5969753067)). |
| **Expressions join the list.** | After an accent or a one-edit match, the corrected searches that read as expressions follow the other offers in the same list. Ruled by Huey on 2026-09-30 ([#214](https://github.com/povlabs/lexema/issues/214#issuecomment-5906146451)). |
| **An expression is offered as typed.** | The offer is the reader's own words with the typo fixed, never the headword they lead to: "vadoo via" offers *vado via*, not *andare via*. Ruled by Huey on 2026-09-30 ([#214](https://github.com/povlabs/lexema/issues/214#issuecomment-5907869562)). |
| **Every word offered is a search.** | Each links to its own result, in the same style as a synonym run. The page does not say how an offer was found. |
| **One report link at the bottom.** | Below the offers, in the word page's footer row and trigger style, one `Report a missing word`, with no *Source* beside it and no note that the word is missing. It opens the word page's report box on the query, titled `Report a missing word`; the box asks no "What's wrong?", names no reading, and its details are optional, hinted `Anything to add? (optional)`; the report is stored as a missing word. Ruled by Huey on 2026-10-03 ([same box](https://github.com/povlabs/lexema/issues/441#issuecomment-5968691300), [missing kind](https://github.com/povlabs/lexema/issues/441#issuecomment-5968896110), [details hint](https://github.com/povlabs/lexema/issues/441#issuecomment-5969133681)). |

## Role tokens: the dark scheme

The nine colour roles take the values of the design file's `variables`, moved
into the token layer by [#102](https://github.com/povlabs/lexema/pull/102). They
land as oklch in the `@theme` block of `web/app/globals.css`. A component reaches
for a role, never a value.

| Role | Design file | Used for |
|---|---|---|
| `surface` | `#121110` | the page background |
| `surface-raised` | `#1A1917` | the search bar, the report box |
| `border` | `#2C2A26` | thin rules between readings and sections |
| `border-strong` | `#4E4940` | control outlines |
| `text-muted` | `#8B8579` | labels, grammar labels, articles, examples |
| `text` | `#C4BEB2` | body prose, etymology |
| `text-strong` | `#F4F0E6` | the headword, definitions, forms, synonyms |
| `accent` | `#D2A85C` | reading numbers, links, the `+ more` control, the searched form in a conjugation |
| `warning` | `#D9704F` | no use on the result page, which marks no dispute |

When a colour changes in Pencil, re-export the design file's variables to
[`web/test/fixtures/design-variables.json`](web/test/fixtures/design-variables.json);
`web/test/tokens.test.ts` fails until the stylesheet matches that snapshot.

Three families, served from this repository: **Spectral** for the headword,
definitions, examples, etymology and synonyms; **Inter** for labels, controls and
grammar labels; **IBM Plex Mono** for forms, articles and pronunciation. The dark
scheme is the only scheme.

## Not yet ruled

A light scheme; the attribution and licence page ([#139](https://github.com/povlabs/lexema/issues/139));
the phone version of the report box. A builder who needs one of these stops and
asks. Sizes and spacing not stated here follow the boards.
