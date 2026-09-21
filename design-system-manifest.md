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

## Not yet ruled

Role tokens, the type ramp, colour roles, component primitives, density, focus
treatment, and dark mode. The first UI issue settles these with Huey. Until then
there is no role-token layer for the `taste-color` skill to read, and a builder
who needs one stops and asks.
