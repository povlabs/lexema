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
| One small *Source* link for each Wiktionary page whose content the result shows, usually one; no credit line on the search page. The full credit is on `/attribution`, linked from the footer. | [ADR 0009](./.decisions/0009-two-licences-and-a-source-link.md) |

## The page

Ruled by Huey on 2026-09-21: "put the search bar in the middle of the screen
first and then when I search, it goes top as right now."

| Rule | What it means on the page |
|---|---|
| **Two states.** | Before a query, the page is the search bar alone, centred on the screen with the site name above it and nothing else competing. Under the name, centred, sit its pronunciation `/lekˈsɛːma/` in mono, muted, as a word's pronunciation is drawn, and *a simple dictionary* in italic serif (board 00). With a query, the bar sits at the top and the results fill the page below it. |
| **One bar, one route.** | The same form serves both states; the query stays in the URL so a result can be shared. Moving the bar is layout, not a second page. The `×` in the bar empties it and keeps the cursor there; the result stays until a new search is sent. ⌘K on a Mac, Ctrl+K elsewhere, scrolls to the top (smoothly, or at once for a reader who asks for reduced motion) and puts the cursor in the bar with its text selected, on the home page and on a result; not while a dialog is open or the reader is typing in another field. While the bar does not have the cursor, a small muted `⌘K` (`Ctrl K`) sits where the `ENTER` hint does, left of the `×` when there is text; a touch-only screen does not show it. |

## The result

Ruled by Huey on 2026-09-27, on boards 08 to 21. These rules replace the result-card
rules of 2026-09-21 (boxed paradigms, header bars, three boxes to a row).

### Layout

| Rule | What it means on the page |
|---|---|
| **One layout for every word type.** | Headword, then its readings in source order, then the facts about the word, then *Source*. No box or card surrounds a reading; readings are separated by a thin rule. |
| **The headword carries its pronunciation.** | The IPA sits under the headword. Syllable breaks are not shown. A word with no pronunciation shows none. |
| **Jump links only for three or more readings.** | Under the headword, one link per reading, `1 Aggettivo`. A page with one or two readings has none. |
| **A reading is a heading and blocks.** | The heading is `1 · Sostantivo`: the number, then the record's `pos_title`. A reading that takes a gender × number grid adds, muted, the gender and number its record states, in Italian: `1 · Aggettivo · maschile, singolare`, `2 · Sostantivo, forma flessa · femminile, plurale`; both numbers when it states both (`khmer`: `maschile, singolare e plurale`), only the one it states when it states one, and nothing when it states neither. Verbs, *Voce verbale*, proper names and other readings without a grid add nothing. On a phone the heading wraps. Then *Definitions*, then *Forms*. A block with nothing to show is left out. |
| **Section labels are plain.** | A small grey label (*Definitions*, *Forms*, *Etymology*, *Synonyms*). No count, no rule beside it, no box around the block. |
| **One expand control, no count.** | Closed, a block shows its first part, then a small accent `+ more` right at the end of what shows. Open, it shows everything, then `less` at the very end. No control carries a count. It works with no script: the whole content is in the HTML. *Etymology*: one line cut with an ellipsis, `+ more` right after it; open, `less` follows the text's last word; a text that fits on its line has no control. *Synonyms*, *Antonyms*, *Derived words* and the not-found offers: the words that fit on one line, `+ more` after the last of them on that line; open, every word, then `less`; words that all fit have no control. *Definitions*: the first definition and its own first example, or none if it has none of its own (no other definition's example stands in), then `+ more` under it; open, every definition with all its examples in order, then `less`. Ruled by Huey on 2026-09-27. |
| **Word facts come once, after the readings, unless the source ties them to a reading.** | *Etymology* as prose, one line, in every Etymology block, in a reading or after the readings, on a phone too. *Synonyms* as a run of words separated by `·`. Both open with the one expand control. On a word with two readings or more, an etymology whose opening bracket names a part of speech (`(sostantivo plurale) vedi sala`) shows in that reading, after *Forms*, without the bracket; a synonym group the source opens with a part-of-speech label (`sostantivo`, `verbo`) shows in that reading in the same style. Only a label that names exactly one reading moves its text; a label that names two, whether two parts (`medico`'s `(aggettivo e sostantivo)`) or two readings of one kind (`svolta`'s two *Voce verbale* readings), is never copied into both. Whatever names no single reading (such a label, a topic label such as `(sport)`, an unlabelled text or list) stays once after the readings, with no note. A text that is only its label leaves no block. Ruled by Huey on 2026-09-27. |
| **Source and report sit together at the bottom.** | `Source ↗ · Report a mistake`, with the same space above it and at least that space below it; on a page shorter than the window, the footer sits at the bottom of the window and the extra room falls between Source and the footer. A result that shows content from more than one Wiktionary page, such as `andavano` with `andare`'s table, has one *Source* link per page, each naming its word. What the report box asks is on board 22 and in [#51](https://github.com/hueypov/lexema/issues/51). |

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
| **A searched form is marked only in a conjugation.** | In a verb table the searched form is underlined in the accent colour, and its person and tense labels take the accent. A grid does not mark it; it is obvious there. |
| **A searched verb form leads to its lemma's table.** | Searching `andavano` shows its own reading, whose definition links to `andare`, and under it *Forms of andare*, opened where `andavano` sits. When one spelling fills two cells (`andassi`), both are marked. |
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
| **Say it, then offer what is close.** | The heading is `No entry for "<query>"`, serif, large, with the page's own search bar above it and the footer at the foot of the window. Under it, the first of these that finds something: the same letters with an accent (`Did you mean città?`, the word in the accent colour, then *Other words that begin with "citta"*); a spelling one edit away (`Did you mean mangiare?`, then *Other close spellings*; among spellings equally close, the word translated into the most languages leads, so `mangare` offers `mangiare` before `magnare`); the words that begin with what was typed (*Suggestions*, one line, then `+ more`); or, with nothing close, "Lexema has no word spelled this way. Check the spelling, or search for the word's base form: the infinitive of a verb, the singular of a noun." |
| **Every word offered is a search.** | Each links to its own result, in the same style as a synonym run. The page does not say how an offer was found. |

## Role tokens: the dark scheme

The nine colour roles take the values of the design file's `variables`, moved
into the token layer by [#102](https://github.com/hueypov/lexema/pull/102). They
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

Three families, served from this repository: **Spectral** for the headword,
definitions, examples, etymology and synonyms; **Inter** for labels, controls and
grammar labels; **IBM Plex Mono** for forms, articles and pronunciation. The dark
scheme is the only scheme.

## Not yet ruled

A light scheme; the attribution and licence page ([#139](https://github.com/hueypov/lexema/issues/139));
the phone version of the report box. A builder who needs one of these stops and
asks. Sizes and spacing not stated here follow the boards.
