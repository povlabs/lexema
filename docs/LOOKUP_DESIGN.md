# Why exact lookup is shaped this way

The field-by-field account of what `lookup()` returns is in
[the lookup reference](LOOKUP.md). This page is the argument behind it.

Lookup is the boundary the website calls. Its one job is to hand back what the
source says and nothing else, which sounds easy until you look at what the data
actually does.

## The two mistakes it is built to avoid

Both look like working code.

**Turning repeated evidence into repeated results.** `studenti` sits on five
lookup rows across four records. That is four readings carrying five pieces of
evidence, not five readings. So hits are grouped by record before anything else
happens.

**Asserting a lemma the source did not.** Two traps here. A record that lists a
form in its table is not thereby that form's lemma — `studentessa` lists
`studenti`, and it is the feminine, not the base word. And an edge naming a word
has not chosen between that word's records: `bella` points at `bello`, which is
four records in this release, and nothing says which.

So `isAboutQuery` marks the difference between "this record IS the surface" and
"this record mentions it", and a resolved lemma link carries every candidate
with no winner.

## Four states, not three and a null

`GrammarClaim` is a union rather than a record with nullable fields, because
collapsing any two of these would be a lie:

- **no claim at all** — the dimension was never expected here.
- **`stated`** — the source gave a tag that maps to a known value.
- **`unclassified`** — the source gave text we will not guess at. `essi/esse`
  obviously means third person; mapping it is #4's job, with tests.
- **`missing`** — we looked and the source said nothing. `casa` states neither
  gender nor number.

Lemma links are a union for the same reason. A `dangling` edge stays visible,
because dropping it would turn "points somewhere we cannot follow" into "points
nowhere".

## Both directions of an edge are equally unresolved

An edge is matched on the target *word*, which means it lands on every record
spelling that word at once — in both directions.

Forward, `bella`'s link to `bello` carries all four `bello` records and picks
none. Backward, each of those four records lists `bella` under `inflections`,
and that link has to say the same thing: it carries `targetCandidates`, every
record the named word resolves to, itself included.

One unresolved edge seen from four records is still one unresolved edge. Handing
each of them a settled relationship would manufacture four lexical facts the
source never stated — the same mistake as the forward direction, just harder to
notice.

The forward side always carries a list, even a list of one, rather than having a
special unambiguous case. Both directions then read the same way, and a caller
that handles the ambiguous case handles every case.

## No ranking

Every reading comes back in source order. Ordering by anything else would imply
a judgement about which meaning the reader wanted, and lookup has no basis for
one. Contextual ordering is a later, advisory thing built on top.

## One query layer, two drivers

Lookup runs in a Worker against D1 and in Node against a local SQLite file. The
two APIs are incompatible — D1 is async and binds parameters separately,
`node:sqlite` is synchronous and takes them inline — so both go through one
tiny interface in [`src/lookup/database.ts`](../src/lookup/database.ts).

It is async because D1 is. A synchronous interface would have forced the Worker
side to fake it, and faking it is how you end up with two query layers that
drift apart.

## Accents are meaning

Normalization folds case, whitespace and apostrophe variants, but keeps accents:
`città` and `citta` are different words, and folding them would merge distinct
entries.

The 128-character bound is well past the longest headword in this release. It
exists so a pathological query cannot become a pathological index probe.

A lookup against a release that is absent, still importing, failed or superseded
throws rather than returning "no results" — those are different claims. And
because the stored keys were produced by the release's own normalizer, a release
built by a different one is refused rather than mis-probed.

## The view that costs four orders of magnitude

Resolving lemma links inlines the `form_of_candidate` view's join instead of
`LEFT JOIN`ing the view.

SQLite cannot push `record_id = ?` through a LEFT JOIN onto a view, so it
materialises the whole thing first — every edge against every lookup row — and
then discards nearly all of it. At release scale that is seconds against
fractions of a millisecond, for identical rows, and the gap widens as the
release grows.

Identical rows is why a rows-only test sails straight past this. So there is a
test asserting the query plan contains no `MATERIALIZE` and still uses
`form_of_edge_by_record`, and the same assertion on both inflection queries.
[The benchmark](LOOKUP_BENCHMARK.md) measures what the mistake costs.

Query 2a in `src/db/queries.sql` has the same shape and the same problem.

## Not in scope

No prefix search or autocomplete (#15). No ranking, contextual or otherwise. No
HTTP layer — that arrives with the page in #14. Review rows are read but never
written; writing them is #12.
