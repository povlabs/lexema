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
a local copy at the repository root remains gitignored. Full-release seeding
currently fails when Wrangler reads the generated SQL because Node's maximum
string length is exceeded (#97), so this page does not claim that a full release
seeds successfully.

## Why local work uses a committed fixture

The fixture is a bounded, reviewable fifty-word set with its transitive
`form_of` closure. It lets a fresh checkout exercise the same parser,
provenance, lookup, and grammar projection without downloading the archive or
silently serving an incomplete archive as a complete release. A query for a
word outside that set is an honest empty result. To run against another archive,
set `SEED_INPUT`; the local full-archive copy is conventionally
`it-extract.jsonl.gz` at the repository root.

## Known rough edges

- `form-of` renders as an *unclassified* grammar chip next to the "Form of"
  section, which is redundant. It is left in rather than filtered, because
  hiding source data by hand is how you stop noticing what the source contains.
- No favicon, so the dev log carries a 404 for it.
- Styling is deliberately plain. This is the first working page, not a design.

## Not in scope

Autocomplete (#15). Pronunciation and examples (#20). Deployment, rate limits
and smoke tests against a real URL (#19).
