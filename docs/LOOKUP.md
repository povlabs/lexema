# Exact lookup

One Italian surface in, every reading the source supports out. This is the
boundary the website calls; it does no ranking and makes no lexical claim the
source did not.

```ts
import { lookup } from "./src/lookup/lookup.js";
import { fromD1, fromNodeSqlite } from "./src/lookup/database.js";

// In a Worker:
const result = await lookup({ db: fromD1(env.DB), releaseId, query: "sale" });

// In a Node process, against the importer's output:
const local = await lookup({ db: fromNodeSqlite(sqlite), releaseId, query: "sale" });
```

## One query layer, two drivers

Lookup runs in a Worker against D1 and in Node against a local SQLite file. The
two APIs are incompatible — D1 is async and binds parameters separately;
`node:sqlite` is synchronous and takes them inline — so both go through one
tiny interface in [`src/lookup/database.ts`](../src/lookup/database.ts):

```ts
interface LookupDatabase {
  all<T>(sql: string, params: readonly (string | number)[]): Promise<T[]>;
}
```

It is async because D1 is. A synchronous interface would have forced the Worker
side to fake it, and faking it is how you end up with two query layers that
drift apart.

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

## Both directions of an edge are equally unresolved

An edge is matched on the target *word*, which means it lands on every record
spelling that word at once — in both directions.

Forward, `bella`'s link to `bello` carries all four `bello` records and picks
none. Backward, each of those four records lists `bella` under `inflections`,
and that link has to say the same thing: it carries `targetCandidates`, every
record the named word resolves to, itself included. More than one candidate
means the source chose none of them, and a caller must not render the reading as
*the* lemma of the inflected word.

One unresolved edge seen from four records is still one unresolved edge. Handing
each of them a settled relationship would manufacture four lexical facts the
source never stated — the same mistake as the forward direction, just harder to
notice.

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
materialises the whole thing first — every edge against every lookup row — and
then discards nearly all of it. Both forms return the same rows, which is why
this survives a rows-only test; the benchmark below times them side by side and
asserts they agree before reporting.

There is also a test asserting the query plan contains no `MATERIALIZE` and
still uses `form_of_edge_by_record`, and the same assertion on both inflection
queries.

Query 2a in `src/db/queries.sql` has the same shape and the same problem.

## Benchmark

```
pnpm run bench:lookup
```

No dataset needed. It generates a synthetic release at two scales, imports both,
and times the same queries against each. The corpus comes from a seed and
matches the real release's *shape* — 560,357 records, ~1.27 M lookup rows,
~609 K form_of edges, homographs skewed so some keys reach eight readings — so
the same command produces the same corpus anywhere. It is not Italian and does
not pretend to be; lookup cost depends on how many rows a key matches, not on
what the letters mean.

Two scales rather than one on purpose. A single column cannot show whether cost
follows the number of readings or the size of the release, and that is the only
claim here worth making.

Against the real archive instead, once it is imported per
[`docs/IMPORT.md`](IMPORT.md):

```
pnpm run bench:lookup -- --database .data/lexema.sqlite --release it-local
```

First run builds and imports both corpora (~5 minutes); later runs reuse them,
or pass `--rebuild`.

### Captured output

Verbatim from `pnpm run bench:lookup` on 2026-09-19. Local SQLite is not D1, so
these predict nothing about production latency — they show the shape of the
cost.

#### Environment

- Node v26.2.0, SQLite 3.53.1, `node:sqlite`
- Apple M1 Pro, 8 cores, 17 GB, darwin-arm64
- 25 timed iterations after 5 warmup runs; median reported

#### Corpus

| Release | Records | Lookup rows | form_of edges | Database |
| --- | ---: | ---: | ---: | ---: |
| 140,000 records | 140,000 | 318,407 | 152,184 | 0.25 GB |
| 560,357 records | 560,357 | 1,274,725 | 609,161 | 0.99 GB |

#### Lookup

| Readings | 140,000 records | 560,357 records |
| ---: | ---: | ---: |
| 1 | 0.18 ms | 0.17 ms |
| 2 | 0.31 ms | 0.35 ms |
| 4 | 0.61 ms | 0.63 ms |
| 8 | 1.23 ms | 1.28 ms |
| 0 (miss) | 0.03 ms | 0.03 ms |

Four times the release, the same cost per reading. That is the claim, and it is
the reason the column pair exists.

#### Lemma links: view LEFT JOINed vs. its join inlined

| Release | Via `form_of_candidate` | Inlined | Rows |
| --- | ---: | ---: | ---: |
| 140,000 records | 981.1 ms | 0.03 ms | 1 |
| 560,357 records | 6722.0 ms | 0.03 ms | 1 |

Same rows, four orders of magnitude apart — and the view form is the one that
gets worse as the release grows, which is exactly the cost the inlined query
exists to avoid.

## Not in scope

No prefix search or autocomplete (#15). No ranking, contextual or otherwise. No
HTTP layer — that arrives with the page in #14. Review rows are read but never
written; writing them is #12.
