# Why the search page works this way

One search box, one result page, rendered on a Cloudflare Worker with D1
underneath. This page is the reasoning. To run it, see
[RUN_THE_SITE.md](RUN_THE_SITE.md); the seed's numbers are in
[DEV_SEED.md](DEV_SEED.md); the query layer it calls is
[LOOKUP.md](LOOKUP.md).

## Where the parts live

```
web/app/page.tsx        reads the query, runs the lookup, streams the answer
web/app/SearchPage.tsx  the shell, and the five states a query can be in
web/app/Reading.tsx     how one entry renders
web/app/params.ts       the query as it arrives in the URL
web/app/attempt.ts      a lookup, or the fact that it did not happen
web/app/db.ts           the D1 binding
src/lookup/             the query layer, shared with the importer's tests
web/test/page.test.tsx  the page, rendered over a fixture release
```

The markup is split from the wiring so it can be rendered without a Worker.
`db.ts` reaches D1 through `cloudflare:workers`, which exists only inside
workerd; everything else runs in plain Node, which is how the rendered-page test
runs in CI with no archive and no database.

`web/` is a workspace package rather than a separate repository, so there is
still exactly one lockfile at the root — which is what ADR 0002 asks for. It
reaches the lookup layer through a Vite alias rather than a copy, because two
copies of a query layer drift apart and the divergence shows up as a wrong
answer rather than a build error.

Server code reaches D1 through the Workers runtime's own `env`, not a framework
helper — vinext offers no `getCloudflareContext()`:

```ts
import { env } from "cloudflare:workers";
const db = fromD1(env.DB);
```

The spike in #27 established that. `env.LEXEMA_RELEASE` picks which imported
release is served; flipping it safely is #18.

## Why a server component and no client fetching

The query arrives in the URL, the D1 read happens on the Worker, and the HTML
that comes back already holds the answer. Two things follow, and each was the
point rather than a side effect: the page works before any JavaScript loads, and
a result is shareable by copying the address bar.

The loading state is a `Suspense` boundary around the D1 read, and nothing else.
The shell — heading, form, the query still in the box — flushes as soon as the
request is understood, and `Pending` stands in the result's place until the read
answers. It needs no client JavaScript and cannot disagree with the result,
because it is the same render. Against local D1 the read usually finishes before
the first flush, so a reader does not see it; it was
[shown to exist](../reports/2026-09-21-web-page-measurements.md#other-states) by
slowing the read down and watching the first flush arrive without it.

The cost is that a server component here has no way to set a response status, so
even the failed-lookup page returns 200. The state the reader needs is on the
page; the status code cannot carry it.

## Why the page is visibly silent

This dictionary's data is incomplete, and the page's job is to make that legible
instead of smoothing it over. Five silences it refuses to hide:

**A record that only mentions the word.** Searching `sale` returns five entries,
and two of them — `sala` and `salire` — merely list `sale` in their own tables.
Each is labelled as a mention. Without that label a reader would take `salire`
to be the lemma of `sale`, which the source never said.

**An ambiguous lemma link.** `sale` says it is the plural of `sala`, and `sala`
is two entries, a noun and a verb. The page says two entries share the spelling
instead of picking one, because picking one would invent a fact.

**Grammar the source never stated.** `casa` shows gender and number as *not
stated in the source*, drawn as dashed chips. That has to read differently from
a word whose gender was never expected in the first place.

**Definitions that define nothing.** `casa`'s two glosses are page furniture and
`sala` carries the source's own *"definizione mancante"*. Both are shown
verbatim. Filtering them would hide how incomplete this data is, which is the
one thing this page must not do.

**A lookup that did not happen.** No release, a D1 error, or a release built by
a different normalizer all produce a page that says the lookup failed. That is
deliberately not the "found nothing" message: a reader must be able to tell *we
could not look* from *we looked and the word is not here*. The release footer
drops out in that state, because there is no release to name. The
reason is logged and not printed: a database message names releases, tables and
bindings, which is the operator's business and not the reader's.

**A form the source listed, and one it did not.** Each entry shows its own
`forms[]` with the grammar the source stated about each one, grouped by tense
under *Grouped conjugations*, and an *Articles* section. Where the source is
silent — no forms, no tense, no article anywhere in this release — the section
says so in words. Nothing is derived: an article follows from gender and number,
which this source often leaves out, and inventing one is the failure this whole
page is built against.

**Ambiguity in both directions.** A `form_of` edge names a word, and a word can
be several records. That is shown on the outgoing side (*Form of*) and on the
incoming side (*Forms pointing here*) the same way: every candidate listed, none
chosen.

## Why a disputed claim is a row and not a code path

A disputed claim renders with a warning and a link to the evidence, and the
claim itself is left untouched. The verdicts come from `claim_review` rows, and
the development seed writes the ones this repository has evidence for — today,
the `studente` verb claim that
[the source research](../reports/2026-09-18-source-research.md) contradicts. Who
reviews, on what evidence, and how a verdict is reached is still #12; what is
settled is that a claim later research disagreed with never renders as an
ordinary verified fact.

The verdicts are written after the import, not by it. The importer copies the
source and says nothing about whether it is right; a review is a claim about
the source, made on evidence the source does not contain, so it is a separate
write over the release the import just made.

## Why the source link is labelled the way it is

Each reading ends with a link to the Italian Wiktionary page for that record's
own headword, sitting next to the release line number and the JSON pointers the
reading was built from. It is labelled *Source* and nothing more:
[ADR 0009](../.decisions/0009-two-licences-and-a-source-link.md) puts one small
link on a result and keeps the credit itself on `/attribution`, which the site
footer reaches from every page.

Its accessible name is longer than its text — "Wiktionary page for X, the source
of this noun entry" — because *Source* repeated once per reading tells a screen
reader nothing about which reading it belongs to.

The release stores no per-record URL, so the link is *constructed* from the
headword rather than recorded with the data. That is why the accessible name
says "Wiktionary page for X" instead of presenting the link as a citation of the
reading: the line number and pointers are the exact source location, and the
link is only the part a reader can click. On a mention row the link points at
`sala` or `salire` — the page the record actually came from, not the word
searched for.

## Why the credit is on its own page

The search page carries no credit line, no licence name and no contributor text.
That is ADR 0009's ruling, and the licence permits it: CC BY-SA 4.0 lets the
credit be satisfied by a link to a page that carries the required information.
`/attribution` is that page — the contributors, the page histories where their
names are, the licence with its link, what Lexema restructured, and the identity
of the release being served.

It is built the way the search page is: `app/Attribution.tsx` is the markup with
no database in it, and `app/attribution/page.tsx` is the wiring that reads the
release from D1. A column the import did not record renders as *not recorded* in
words, and a field the draft in
[ATTRIBUTION_NOTICES.md](ATTRIBUTION_NOTICES.md) leaves open renders as open,
naming what would settle it. Neither a blank nor a plausible-looking value is
allowed to stand in for either.

## Why the seed goes through generated SQL

Local D1 is only reachable through `wrangler d1 execute --file`. The importer
already produces a SQLite file, but there is no way to hand that file to
miniflare, so the development seed re-emits it as SQL and loads it statement by
statement. It is slower and larger than a file copy, and it is the only route
that exists.

## Why the seed is a prefix file, not a limited import

The first seed imported the full archive with `limit`. That stops the importer
before the last line, so the release landed `partial`, and every canonical read
hides a release that is not `complete`: the page answered every query with *the
lookup failed* (#47).

Both rules are worth keeping. `partial` exists so a smoke run can never be
served as if it were the whole dictionary, and the page serving only `complete`
is what makes that hold. So the seed does not ask for an exception; it changes
what it imports. It cuts the head of the archive into its own file and imports
that file whole. The release is then honestly `complete` for the file it names,
and its checksum and byte count describe the bytes that were actually read
rather than a full archive nobody imported. The lookup needs no
development-only branch, and a deployed release and a development one are told
apart by which file they name, not by a flag.

## Known rough edges

- `form-of` renders as an *unclassified* grammar chip next to the "Form of"
  section, which is redundant. It is left in rather than filtered, because
  hiding source data by hand is how you stop noticing what the source contains.
- No favicon, so the dev log carries a 404 for it.
- Styling is deliberately plain. This is the first working page, not a design.

## Not in scope

Autocomplete (#15). Pronunciation and examples (#20). Deployment, rate limits
and smoke tests against a real URL (#19).
