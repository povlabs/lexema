# Design-system manifest — rendered UI design law

The agent-readable design law a builder reads before generating any UI, the way it
reads [AGENTS.md](./AGENTS.md). It holds only the law Huey has ruled, transcribed by
an agent; an agent records a ruling here and never invents one. Where the law is
silent, ask Huey before painting; the gap is not filled here.

## Settled law

| Rule | Source |
|---|---|
| The interface is in English. | [ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md) |
| Definitions, examples, and forms appear in the Italian the source wrote them in, never translated or paraphrased. | [ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md) |
| Missing, ambiguous, and disputed data is shown as such, in words. It is never hidden, smoothed over, or signalled by colour alone. | [README.md](./README.md) |
| Every candidate a lookup returns is rendered. The interface may rank; it never drops. | [AGENTS.md](./AGENTS.md), the product rule |
| A generated short explanation may appear in Italian and in English, labelled as generated. Its example sentence, and everything from the source, stays Italian. | [ADR 0008](./.decisions/0008-generated-explanations-are-labelled-and-reportable.md), amendment of 2026-09-21 |
| One small *Source* link per result; no credit line on the search page. The full credit is on `/attribution`, linked from the footer. | [ADR 0009](./.decisions/0009-two-licences-and-a-source-link.md) |

## The page

Ruled by Huey on 2026-09-21: "put the search bar in the middle of the screen
first and then when I search, it goes top as right now."

| Rule | What it means on the page |
|---|---|
| **Two states.** | Before a query, the page is the search bar alone, centred on the screen with the site name above it and nothing else competing. With a query, the bar sits at the top and the results fill the page below it, as today. |
| **One bar, one route.** | The same form serves both states; the query stays in the URL so a result can be shared. Moving the bar is layout, not a second page. |

## The result card

Ruled by Huey on 2026-09-21 with Reverso's conjugation page as the reference
(https://conjugator.reverso.net/conjugation-italian-verb-andare.html), after the
first noun and adjective cards shipped as vertical lists: "why all of them as a
list". These rules bind every part-of-speech card, [#48](https://github.com/hueypov/lexema/issues/48)
onwards, and the repair of the shipped cards in [#60](https://github.com/hueypov/lexema/issues/60).

| Rule | What it means on the page |
|---|---|
| **Facts are laid out, not listed.** | Forms, agreements and conjugations render as tables and boxed groups, never as one bullet or sentence per fact. A list is for prose the source wrote, such as glosses. |
| **A header bar carries the headline facts.** | Under the headword: part of speech, then the few facts the source states for it (gender and number for a noun; infinitive, gerund, participle and auxiliary for a verb), on one line, labelled in small text with the value in large. |
| **Three boxes to a row.** | Paradigm boxes sit three across on a wide screen, in the order the source's vocabulary gives, wrapping to fewer on narrow screens. A verb card is rows of tense boxes; a noun or adjective card puts its agreement boxes (singular and plural, masculine and feminine) and, for a noun, its article box in that same slot. |
| **Paradigms are boxed groups side by side.** | Each tense (verb) or agreement set (noun, adjective) is one box with a heading; boxes sit in a row that wraps on narrow screens. Rows inside a box are `label value`, the label small and grey, the value in the reading language. Verb rows are labelled with the pronoun the source gives. |
| **Groups are ordered by the source's own vocabulary.** | Moods, then tenses, in the order the tag vocabulary lists them; forms the source leaves unplaced go in one last box named for what is missing, never scattered. |
| **The searched form is outlined where it sits.** | A query that is itself a form is marked inside the paradigm it belongs to, by a border, not by colour alone. |
| **Empty is said once.** | A section with nothing to show is omitted. One line near the top of the card names what the source does not state for this entry. A fact is never rendered twice on one card, and a related record is listed once with its count. |
| **Every form still appears.** | Layout never drops a form; a form that fits no box is in the unplaced box, verbatim, in `lang="it"`. |

## Role tokens: the dark scheme

Ruled by Huey on 2026-09-21: "for now let's work on dark palette, use like one
of the baseui's default dark ones." Base UI ships no styles; the palette its own
documentation paints every demo with is the source, copied verbatim from
`docs/src/demo-data/theme/css-modules/theme.css` in `mui/base-ui` at commit
`50c371c` (2025-11-04), the `prefers-color-scheme: dark` block. Dark is the only
scheme for now; a light scheme is a later ruling, not a fallback.

The scale, as the source writes it (oklch, alpha where given):

| Step | Value |
|---|---|
| gray-50 | `oklch(17% 0.25% 264deg)` |
| gray-100 | `oklch(28% 0.75% 264deg / 65%)` |
| gray-200 | `oklch(29% 0.75% 264deg / 80%)` |
| gray-300 | `oklch(35% 0.75% 264deg / 80%)` |
| gray-400 | `oklch(47% 0.875% 264deg / 80%)` |
| gray-500 | `oklch(64% 1% 264deg / 80%)` |
| gray-600 | `oklch(82% 1% 264deg / 80%)` |
| gray-700 | `oklch(92% 1.125% 264deg / 80%)` |
| gray-800 | `oklch(93% 0.875% 264deg / 85%)` |
| gray-900 | `oklch(95% 0.5% 264deg / 90%)` |
| gray-950 | `oklch(94% 0.375% 264deg / 95%)` |
| blue | `oklch(69% 50% 264deg)` |
| red | `oklch(80% 55% 31deg)` |

The roles below are Lexema's mapping onto that scale, not the source's; the
source declares the scale only. A component reaches for a role, never a step.

| Role | Step | Used for |
|---|---|---|
| `surface` | gray-50 | the page background |
| `surface-raised` | gray-100 | a box, a card, the search bar |
| `border` | gray-200 | box and table edges |
| `border-strong` | gray-300 | the searched-form outline |
| `text-muted` | gray-500 | labels in a box row, the silence line, the release line |
| `text` | gray-900 | body text, glosses, forms |
| `text-strong` | gray-950 | the headword |
| `accent` | blue | links, the focused control |
| `warning` | red | the disputed-claim mark and the report control |

These land as a Tailwind `@theme` block in `web/app/globals.css` under the same
names; the migration is [#67](https://github.com/hueypov/lexema/issues/67).

## Not yet ruled

The type ramp and font family (the Base UI docs use licensed fonts Lexema cannot
copy; a system stack or an open face is a separate ruling), component primitives
beyond Base UI's own, density, focus treatment beyond the `accent` ring, and a
light scheme. A builder who needs one of these stops and asks; the `taste-color`
skill now has a role layer to read for colour.
