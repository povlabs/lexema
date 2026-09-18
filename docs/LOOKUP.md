# Exact lookup

One Italian surface in, every reading the source supports out. This is the
boundary the website calls; it does no ranking and makes no lexical claim the
source did not.

```ts
import { lookup } from "./src/lookup/lookup.js";

const result = lookup({ db, releaseId: "it-2026-07-20", query: "sale" });
```

## The two mistakes it is built to avoid

The data invites both, and both look like working code.

**Turning repeated evidence into repeated results.** `studenti` sits on five
lookup rows across four records. That is four readings carrying five pieces of
evidence, not five readings. Hits are grouped by record before anything else
happens.

**Asserting a lemma the source did not.** Two separate traps here. A record that
lists a form in its table is not thereby that form's lemma — `studentessa` lists
`studenti`, and it is the feminine, not the base word. And an edge naming a word
has not chosen between that word's records: `bella` points at `bello`, which is
four records in this release, and nothing in the source says which.

So `isAboutQuery` marks the difference between "this record IS the surface" and
"this record mentions it", and a resolved lemma link carries *every* candidate
with no winner.

## What a result carries

| Field | What it holds |
| --- | --- |
| `query.raw` | exactly what was typed, so a page can echo it back |
| `query.key` | the normalized key the index was probed with |
| `release` | id, normalizer, source url, licence — present even on `not-found`, so a page can attribute the source with nothing to show |
| `readings[]` | one per matching record, in source order |

Each reading carries its evidence, senses, grammar, lemma links, the inflections
that point back at it, and any review verdicts. Every value carries a
`{ lineNo, pointer }` so it can be checked against the archive.

## Four states, kept apart

`GrammarClaim` is a union rather than a record with nullable fields, because
these are four different facts and collapsing any two of them is a lie:

- **no claim at all** — the dimension was never expected here.
- **`stated`** — the source gave a tag that maps to a known value.
- **`unclassified`** — the source gave text we will not guess at. `essi/esse`
  obviously means third person; mapping it is #4's job, with tests.
- **`missing`** — we looked and the source said nothing. `casa` states neither
  gender nor number.

Lemma links are a union too: `dangling` when the target word matches no record,
`candidates` when it matches one or more. A dangling edge stays visible, because
dropping it would turn "points somewhere we cannot follow" into "points
nowhere".

## Query handling

Trim, NFC, case-fold, normalize apostrophe variants. **Accents are kept** —
`città` and `citta` are different words, and folding them would merge distinct
entries.

Empty and over-long queries are `rejected` rather than searched for, and the
rejection says which. The limit is 128 characters, well past the longest
headword in this release; it exists so a pathological query cannot become a
pathological index probe.

A lookup against a release that is absent, still importing, failed or superseded
**throws**. Returning "no results" would be a different and false claim.

The stored keys were produced by the release's own normalizer, so a release
built by a different one is refused rather than mis-probed.

## One performance trap worth knowing about

Resolving lemma links inlines the `form_of_candidate` view's join instead of
`LEFT JOIN`ing the view.

SQLite cannot push `record_id = ?` through a LEFT JOIN onto a view, so it
materialises the whole thing first — all 608,726 edges against 1,273,490 lookup
rows — and then discards nearly all of it. Measured on the real release for
`bella`: **2,686 ms via the view, 0.1 ms inlined**, returning the same four rows.

Rows-only tests cannot see that, so there is a test asserting the query plan
contains no `MATERIALIZE` and still uses `form_of_edge_by_record`.

Query 2a in `src/db/queries.sql` has the same shape and the same problem.

## Measured on the real release

560,357 records, warm cache, local SQLite:

| Query | Readings | Time |
| --- | ---: | ---: |
| `città` | 1 | 1.5 ms |
| `casa` | 1 | 3.0 ms |
| `andavano` | 2 | 8.9 ms |
| `studenti` | 4 | 12.8 ms |
| `bella` | 9 | 13.1 ms |
| `sale` | 5 | 21.6 ms |
| unknown word | 0 | 0.5 ms |

Local SQLite is not D1, so these predict nothing about production latency. They
are here to show the shape of the cost, and that it scales with the number of
readings rather than the size of the release.

## Not in scope

No prefix search or autocomplete (#15). No ranking, contextual or otherwise. No
HTTP layer — that arrives with the page in #14. Review rows are read but never
written; writing them is #12.
