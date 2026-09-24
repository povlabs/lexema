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
web/app/SearchField.tsx the search form, and the suggestion list under it
web/app/suggest/route.ts  GET /suggest, the list's JSON
web/app/Reading.tsx     how one entry renders
web/app/params.ts       the query as it arrives in the URL
web/app/attempt.ts      a lookup, or the fact that it did not happen
web/app/db.ts           the D1 binding
web/worker/index.ts     the Worker's entry: the rate limits, then vinext
web/worker/rateLimit.ts which requests are counted, and against whose count
src/lookup/             the query layer, shared with the importer's tests
web/test/page.test.tsx  the page, rendered over a fixture release
web/test/rateLimit.test.ts  the limits, with a fake binding
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

## Why the suggestion list is the one thing the browser fetches

Suggestions answer keystrokes, which the URL cannot carry, so the field is the
one client component and `GET /suggest?q=` is the one request the page makes
after it loads. The route returns JSON rather than a rendered page, so an
answer costs the prefix query and nothing else. The browser keeps an answer
five minutes, so a reader retyping a prefix sends no request. There is no edge
cache: Cloudflare bills a cache hit as a request, so it would save none. Everything else above still
holds: the server renders the field as a plain `<input name="q">` in a GET form,
and without JavaScript Enter searches as it always did.

Base UI's Autocomplete owns the combobox: focus stays in the field, the arrow
keys move a highlight, Enter on a highlighted row opens that word, Enter with
none searches what was typed, and Escape closes the list. A polite live region
says how many suggestions opened. The field waits 150 ms after a keystroke
before asking, and a newer keystroke aborts the older request, so a slow answer
for `ca` is never drawn over the list for `cas`.

The form sits inside the Autocomplete root, not around it. The root renders a
second, typeless input, and a form with two text fields and no submit button is
one Enter cannot submit.

## Why the rate limits sit in front of vinext

Requests are the cost (#19), so a visitor gets 15 searches and 120 suggestions a
minute ([#128](https://github.com/hueypov/lexema/issues/128)). The numbers are
Cloudflare's rate-limit bindings in `web/wrangler.jsonc`, with Huey's reasons
beside them. The binding counts per Cloudflare location and has only 10 s and
60 s windows.

The check is `web/worker/index.ts`, the Worker's `main`. It wraps vinext's own
App Router entry, so it runs before any route and in one place. A request counts
as a suggestion when its path is `/suggest`, and as a search when it carries a
non-empty `q`. That rule covers the HTML page and an RSC request for the same URL
alike, and every spelling of the path vinext would normalize back to `/`. Static
assets never reach the Worker, and the home page has no `q`.

A visitor is `CF-Connecting-IP`, with an IPv6 address cut to its /64, since one
host can use any address in its /64. A block is logged by which limit it was,
never by the address.

A blocked suggestion is answered in the entry with a 429 and
`{"outcome":"limited"}`; the field shows nothing for it. A blocked search still
has to render the page, with the field, so the entry marks the request and
passes it on. `page.tsx` sees the mark, renders `Limited` in place of the lookup,
and the entry sends that page as a 429 with `Retry-After: 60`. This is the one
page status a server component could not set by itself: the limit is decided
before the render starts. A mark sent by the client is removed first.

## Why the page is visibly silent

This dictionary's data is incomplete, and the page's job is to make that legible
instead of smoothing it over. Eight silences it refuses to hide:

**A lemma is where a reading points, not a match.** Searching `sale` returns
three entries, the three records whose headword is `sale`. Two of them say what
they are a form of, `sala` and `salire`, and those lemmas come back inside the
reading that names them rather than as entries of their own. Each is drawn as
that reading's lemma panel, with a link to its own page. A reader never sees
`salire` offered as a meaning of `sale`, because the source only ever said one
of `sale`'s readings is a form of it.

**An ambiguous lemma link.** `sale` says it is the plural of `sala`, and `sala`
is two entries, a noun and a verb. The page says two entries share the spelling
instead of picking one, because picking one would invent a fact.

**Grammar the source never stated.** `casa` says in a sentence that the source
states neither a gender nor a number for the entry, where a noun would
otherwise show them on its header bar. That has to read differently from a word
whose gender was never expected in the first place, and it is said once, not
drawn as empty fields.

**Definitions that define nothing.** `casa`'s two glosses are page furniture and
`sala` carries the source's own *"definizione mancante"*. Both are shown
verbatim. Filtering them would hide how incomplete this data is, which is the
one thing this page must not do.

**Definitions the extraction dropped or misfiled.** Where the raw Wiktionary page states a
definition the record does not carry as a definition (#28) — absent, or filed
under an example — the seed recovers it into a layer beside the
record, and the card lists it after the record's own definitions with a small
*recovered* mark, and its examples the same way. Each section that shows one
says once which page revision it was read from, linked. The record's furniture
stays under *Source notes*. `casa` now shows its seven definitions this way.
When the record filed a recovered definition as an example (`lap steel
guitar`), the card shows that text once, as the definition, with a note that
the source record files it as an example, and leaves it out of *Examples*.
An item of a list a definition opens with a colon (`accollato`'s
`attributo araldico che si applica a:`) sits inside that definition as a
bulleted list, whether the definition is the record's or itself recovered
(#123, Huey's ruling: "nest"). Only the top of the list is numbered and counted.
An item nests only where recovery matches the line that opens its list. A
recovered definition is matched by its page line. A sense the record carries is
matched by text: exactly one sense has a gloss equal to the line's text, and no
other `#` line in the section has that text. A gloss that only quotes the line
matches nothing. When there is no match, the item stays numbered at the top of
the list, as before (`filetto`'s heraldic items). A sense that opens such a list is a definition, never *Source
notes* furniture, even when its gloss starts like `casa`'s.

**A lookup that did not happen.** No release, a D1 error, or a release built by
a different normalizer all produce a page that says the lookup failed. That is
deliberately not the "found nothing" message: a reader must be able to tell *we
could not look* from *we looked and the word is not here*. The
reason is logged and not printed: a database message names releases, tables and
bindings, which is the operator's business and not the reader's.

**A form the source listed, and one it did not.** A noun or adjective shows its
plural and feminine on the header bar and, when the source files spellings under
both genders, a gender-and-number box. A verb shows its conjugation in tense
boxes: which box a form goes in is rule `it-moods/v1`
(`src/italian/moods.ts`), which reads the tenses the source tags and, for the
congiuntivo and condizionale, the pronoun it writes beside the form. A row with
a tense and no person is congiuntivo when its pronoun begins *che*, and
condizionale when its tense is present or past and its pronoun is bare, as in
*io*. The page says so under the conjugation's header, the way
the articles box says `it-articles/v1` derived its articles. Whatever the rule
cannot place stays in one box that says so. A section with nothing in it is
absent.

**Ambiguity in both directions.** A `form_of` edge names a word, and a word can
be several records. A form reading ends in a lemma panel that names the word,
lists every record spelling it when there is more than one, and says the
source does not choose. The panel is the whole of the reading's lemma: the
lookup returns every record the query matches as a card, and a lemma the query
also matched through its table — `sala` and `salire` for `sale` — is not one of
those records but the lemma of the reading that points to it
([the lookup reference](LOOKUP.md#result-fields)). Its table's row is what the
form's header bar reads, and on a page of one verb form its whole conjugation
renders on the card. A panel names and links the lemma; its meanings are on
its own page. Any record that lists the query and is no reading's lemma keeps a
card of its own, saying it does not define the query.

**Once per word.** Pronunciation, syllables, etymologies, synonyms, antonyms
and derived words are read from `source_record_json` and render once: the strip
under the headword, and the sections after the last card. The source usually
repeats them on every record of a headword, but not always. In release
`it-0c432803`, 16,659 of the 16,792 headwords with more than one record carry
the six fields identically on each; 133 do not. So the page shows the union of
what the records carry, each item once, rather than one record's copy. Several etymologies are labelled *reading
not given*, because the source does not say which reading each belongs to.

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

The page ends with one link to the Italian Wiktionary page for the headword —
one per headword when a listing record from another page has a card. It is
labelled *Source* and nothing more:
[ADR 0009](../.decisions/0009-two-licences-and-a-source-link.md) puts one small
link on a result and keeps the credit itself on `/attribution`, which the site
footer reaches from every page. Its accessible name is longer than its text —
"Wiktionary page for X, the source of this page".

The release stores no per-record URL, so the link is *constructed* from the
headword rather than recorded with the data. Each card still carries its
record's archive line as `data-line`, so the page stays checkable against the
release without printing the line on every card.

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

Local D1 is reached through `wrangler d1 execute --file`. The archive parser
streams each admitted record into batched D1 SQL; there is no SQLite staging
database, prefix cutter, or second import/export path. The development seed
uses the committed fifty-word `fixtures/dev-seed.jsonl` and applies that SQL to
an isolated `.data/seed-state` database. The full archive is maintained at
[`source/it-extract.jsonl.gz`](https://github.com/hueypov/lexema-data/blob/main/source/it-extract.jsonl.gz);
a local copy at the repository root remains gitignored. The same seed loads a
full release in numbered SQL parts
([RUN_AN_IMPORT.md § Run it](RUN_AN_IMPORT.md#run-it)).

## Why local work uses a committed fixture

The fixture is a bounded, reviewable fifty-word set with its transitive
`form_of` closure. It lets a fresh checkout exercise the same parser,
provenance, lookup, and grammar projection without downloading the archive or
silently serving an incomplete archive as a complete release. A query for a
word outside that set is an honest empty result. To run against another archive,
set `SEED_INPUT`; the local full-archive copy is conventionally
`it-extract.jsonl.gz` at the repository root.

## Known rough edges

- No favicon, so the dev log carries a 404 for it.
- A verb record the source tags as the auxiliary sense, one each for `essere`
  and `avere`, shows `FORM-ROLE auxiliary` on its header bar.

## Not in scope

The page at phone width (#101). Attaching D1 in production and smoke tests
against a real URL (#19). Deploying is [DEPLOY.md](DEPLOY.md).
