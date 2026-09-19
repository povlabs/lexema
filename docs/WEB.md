# Why the search page works this way

One search box, one result page, rendered on a Cloudflare Worker with D1
underneath. This page is the reasoning. To run it, see
[RUN_THE_SITE.md](RUN_THE_SITE.md); the seed's numbers are in
[DEV_SEED.md](DEV_SEED.md); the query layer it calls is
[LOOKUP.md](LOOKUP.md).

## Where the parts live

```
web/app/page.tsx      the search form and the four outcomes
web/app/Reading.tsx   how one entry renders
web/app/db.ts         the D1 binding
src/lookup/           the query layer, shared with the importer's tests
```

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
that comes back already holds the answer. Three things follow, and each was the
point rather than a side effect: the page works before any JavaScript loads, a
result is shareable by copying the address bar, and there is no loading state to
get wrong.

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
a different normalizer all produce a page that says the lookup failed and shows
the reason. That is deliberately not the "found nothing" message: a reader must
be able to tell *we could not look* from *we looked and the word is not here*.
The attribution footer drops out in that state, because there is no release to
attribute.

A disputed claim renders with a warning and a link to the evidence, and the
claim itself is left untouched. Nothing writes those rows yet — that is #12.

## Why the source link is labelled the way it is

Each reading ends with a link to the Italian Wiktionary page for that record's
own headword, sitting next to the release line number and the JSON pointers the
reading was built from.

The release stores no per-record URL, so the link is *constructed* from the
headword rather than recorded with the data. That is why it reads "Wiktionary
page for X" instead of being presented as a citation of the reading: the line
number and pointers are the exact source location, and the link is only the part
a reader can click. On a mention row the link points at `sala` or `salire` — the
page the record actually came from, not the word searched for.

## Why the seed goes through generated SQL

Local D1 is only reachable through `wrangler d1 execute --file`. The importer
already produces a SQLite file, but there is no way to hand that file to
miniflare, so the development seed re-emits it as SQL and loads it statement by
statement. It is slower and larger than a file copy, and it is the only route
that exists.

## Known rough edges

- `form-of` renders as an *unclassified* grammar chip next to the "Form of"
  section, which is redundant. It is left in rather than filtered, because
  hiding source data by hand is how you stop noticing what the source contains.
- No favicon, so the dev log carries a 404 for it.
- Styling is deliberately plain. This is the first working page, not a design.

## Not in scope

Autocomplete (#15). Pronunciation and examples (#20). Deployment, rate limits
and smoke tests against a real URL (#19).
