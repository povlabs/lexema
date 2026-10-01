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
- **`stated`** — the source gave a tag that maps to a known value. The one
  exception is a gloss grammar stamp (`casa ( approfondimento) f sing`), which
  rule `it-gloss-stamp/v1` reads as gender and number
  ([`grammarPolicy.ts`](../src/import/grammarPolicy.ts)).
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

## Two outcomes, two types

`found` and `not-found` were one type with an `outcome` flag and a plain
`Reading[]`. That type could hold `found` with an empty list and `not-found`
with readings in it — two states the reference says do not exist, kept out only
by the one function that builds them.

They are separate types now. `found.readings` is `[Reading, ...Reading[]]`, and
`not-found` has no `readings` field at all, so neither contradiction is a value
anyone can construct. `lookup()` builds the tuple from the first group plus the
rest rather than from an array it then checks, so the non-emptiness is the
construction and not an assertion about it.

What both still carry is the release: a page that found nothing still has to say
which source it found nothing in.

## One provenance ref, and the release travels in it

Every value read out of the source carries a `SourceRef` of release, line,
pointer and line digest — the four coordinates
[`.glossary/TERMS.md`](../.glossary/TERMS.md) names and `source_record` stores.
A line number means nothing without the release that pins the bytes it was
counted in, so carrying the line without the release was a ref that could not
actually be checked.

The fields are the schema's `release_id`, `line_no`, `json_pointer` and
`line_sha256`, spelled in camelCase as `releaseId`, `lineNo`, `jsonPointer` and
`lineSha256`. The digest is required rather than optional: every value a lookup
returns was read from a line whose bytes were hashed on import, so a ref without
one would be a ref nothing could check.

There is one `lineNo` per ref and no second copy beside it. A `Reading` with
both `lineNo` and `ref.lineNo` is two places one fact can be written and one
place it can be written wrong.

## Pointers order as pointers, not as text

A pointer's array segments are numbers, so `/forms/2/form` precedes
`/forms/10/form`. Ordering pointers as text reverses that, and a verb table in
this release runs to fifty-odd forms — so "in source order" was false for any
record listing the searched surface at index 10 or beyond, which is most verbs.

SQLite has no numeric-aware collation to fix it in an `ORDER BY`, so everything
keyed by a pointer is ordered in one comparator in
[`src/lookup/lookup.ts`](../src/lookup/lookup.ts): segment by segment, numbers
numerically, and a container before what it holds, so the `missing` grammar
claim hanging on `/forms/10` comes before the tag at `/forms/10/tags/0`.

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

Normalization folds case, whitespace and three apostrophe variants (U+2019,
U+2018, U+02BC, all to U+0027), but keeps accents:
`città` and `citta` are different words, and folding them would merge distinct
entries.

The 128-character bound is well past the longest headword in this release: the
longest is 51 characters and none reaches 128, measured over the archive in
[the lookup measurements](../reports/2026-09-21-lookup-measurements.md#longest-headword).
The bound exists so a pathological query cannot become a pathological index
probe.

A lookup against a release that is absent, still importing, failed or superseded
throws rather than returning "no results" — those are different claims. And
because the stored keys were produced by the release's own normalizer, a release
built by a different one is refused rather than mis-probed.

## The view that costs four orders of magnitude

Resolving lemma links inlines the `form_of_candidate` view's join instead of
`LEFT JOIN`ing the view.

SQLite cannot push `record_id = ?` through a LEFT JOIN onto a view, so it
materialises the whole thing first — every edge against every lookup row — and
then discards nearly all of it. At release scale that is about a second against
a few hundredths of a millisecond, for identical rows. The gap widens as the
release grows.

`pnpm run bench:lookup` measures it. On the real release `it-0c432803`, a
reading that declares a form-of edge costs 996 ms through the view and 0.022 ms
inlined. That is a ratio of about 4.6 × 10⁴. A reading with no edge costs the
same both ways. On the benchmark's synthetic corpus, the view's cost per reading
goes from about 280 ms at 140,000 records to about 1,300 ms at 560,000. The
inlined cost stays under 0.06 ms at both sizes. So the view's cost follows the
size of the release, and the inlined join's cost follows the readings. The
runs, the machine and what the figures do and do not show are in
[the lookup benchmark](../reports/2026-10-01-lookup-benchmark.md).

Identical rows is why a rows-only test sails straight past this. So there is a
test asserting the query plan contains no `MATERIALIZE` and still uses
`form_of_edge_by_record`, and the same assertion on both inflection queries.
That test proves the plan's shape, not its timing.

Query 2a in `src/db/queries.sql` has the same shape and the same problem.

## Not in scope

Prefix suggestions are covered in [LOOKUP.md § Suggestions](LOOKUP.md#suggestions)
(#15); they list headwords alphabetically and rank nothing. No ranking of lookup
results, contextual or otherwise. No HTTP layer — that arrives with the page in #14. Review rows are read but never
written; writing them is #12.
