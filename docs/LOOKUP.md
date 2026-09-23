# Exact lookup — reference

`lookup()` takes one Italian surface and returns every reading the release
supports. It does no ranking. Why it is shaped this way is in
[the lookup design notes](LOOKUP_DESIGN.md).

## `lookup(options)`

```ts
import { lookup } from "../src/lookup/lookup.js";
import { fromD1, fromNodeSqlite } from "../src/lookup/database.js";

await lookup({ db: fromD1(env.DB), releaseId, query: "sale" });
await lookup({ db: fromNodeSqlite(sqlite), releaseId, query: "sale" });
```

| Option | Type | Meaning |
| --- | --- | --- |
| `db` | `LookupDatabase` | a driver from `src/lookup/database.ts` |
| `releaseId` | `string` | the release to read; must be `complete` |
| `query` | `string` | the surface as typed |

Returns `Promise<LookupResult>`. Types are in
[`src/lookup/types.ts`](../src/lookup/types.ts).

### Drivers

`src/lookup/database.ts` exports one interface and two adapters.

```ts
interface LookupDatabase {
  all<T>(sql: string, params: readonly (string | number)[]): Promise<T[]>;
}
```

| Adapter | Argument | Used by |
| --- | --- | --- |
| `fromD1(db)` | a Worker's `env.DB` | the website |
| `fromNodeSqlite(db)` | a `node:sqlite` `DatabaseSync` | local runs and tests |

## Query handling

Applied in this order, by `normalizeItalianExact`:

| Step | Effect |
| --- | --- |
| trim | leading and trailing whitespace removed |
| NFC | Unicode composed form |
| case fold | `CITTÀ` and `città` probe the same key |
| apostrophes | `’` U+2019, `‘` U+2018 and `ʼ` U+02BC fold to `'` U+0027; nothing else does, and `´` U+00B4 in particular stays as typed |
| accents | **kept**; `città` and `citta` are different keys |

Length bound: `MAX_QUERY_LENGTH` is 128 characters, measured after trimming.

## What matches

The key is matched against every record's headword and every entry of its
`forms[]`, except an entry the source tags `auxiliary`. That entry names the
verb a record conjugates with — `andare` lists `essere` — so it is a fact about
`andare`, not a spelling of `essere`, and matching it made 309 other verbs
results for `essere` and 5,267 for `avere` (#109). The entry is still in the
record's `forms[]`, so the verb's card still states its auxiliary. The test is
the `form-role` = `auxiliary` grammar claim the importer writes for that tag,
applied at query time in `SEARCH_SQL`.

## Outcomes

| `outcome` | When | Carries |
| --- | --- | --- |
| `rejected` | the query never reached the index | `query.raw`, `rejection` |
| `not-found` | the index was probed, nothing matched | `query`, `release` |
| `found` | at least one record matched | `query`, `release`, `readings` |

`found` and `not-found` are separate types, not one type with a flag. A
`not-found` has no reading it can carry, and a `found`'s `readings` is
`[Reading, ...Reading[]]` — at least one. So a caller that wants one array
writes `result.outcome === "found" ? result.readings : []`, and neither
"found nothing" nor "did not find these" is a value either type can hold.

`rejection` is `{ reason: "empty" }` or
`{ reason: "too-long", length, limit }`.

### Throws

| Condition | Message |
| --- | --- |
| the release is absent, importing, failed or superseded | `no complete release '<id>'` |
| the release was built by a different normalizer version | `release '<id>' was built with normalizer '<v>', this build has '<v>'` |

## Result fields

A record matches when its headword or a `forms[]` entry spells the key. Every
match is a reading, with one exception: a record that matched only through its
table, and that a reading about the query names as its lemma, is that reading's
lemma instead. `sala` and `salire` list `sale`, and two `sale` readings say they
are forms of them, so a search for `sale` returns three readings, and `sala`
and `salire` arrive on those readings' `lemmaLinks` with the rows of their
tables that spell `sale`. A record that lists the query and is no reading's
lemma — `studentessa` for `studenti` — is still a reading.

| Field | Holds |
| --- | --- |
| `query.raw` | the caller's string, verbatim |
| `query.key` | the normalized key the index was probed with |
| `query.normalizer` | the release's normalizer version |
| `release` | id, normalizer, source url, retrieval date, licence, attribution — present on `not-found` too |
| `readings[]` | one entry per matching record, in source order, except a lemma (below); `found` only |

### `Reading`

| Field | Holds |
| --- | --- |
| `recordId` | the database's surrogate id, an artefact of one build — never publish it |
| `ref` | the whole record: `jsonPointer` is `""` |
| `word`, `pos`, `posTitle` | the record's own headword and part of speech, verbatim |
| `wordFacts` | pronunciations, hyphenations, etymologies, synonyms, antonyms and derived words, read from the record's own line in `source_record_json`; one entry per distinct related spelling, every pointer kept |
| `isAboutQuery` | `true` when at least one piece of evidence is a headword hit |
| `evidence[]` | every occurrence of the surface on this record, in source order |
| `senses[]` | source glosses, labels and `examples[].text`, the examples read from `source_record_json` |
| `grammar` | claims split into `record`, `byForm` and `bySense` |
| `lemmaLinks[]` | the reading's lemma: outgoing `form_of` edges this record declares, each candidate with its `listing` |
| `inflections[]` | records declaring themselves forms of this one |
| `reviews[]` | review verdicts on this record's claims |
| `articles` | noun readings only: the singular articles `it-articles/v1` derives from the record's stated gender and number, plus the plural ones for the single plural form the source tags with the same gender |

### `SourceRef`

| Field | Holds |
| --- | --- |
| `releaseId` | the release these coordinates are in; line numbers mean nothing outside one |
| `lineNo` | 1-based physical line in that release's `.jsonl.gz` |
| `jsonPointer` | RFC 6901 pointer into that line; `""` is the whole record |
| `lineSha256` | sha256 of the line's bytes, so the claim is checkable against the archive |

These are the four coordinates the schema names `release_id`, `line_no`,
`json_pointer` and `line_sha256` ([`.glossary/TERMS.md`](../.glossary/TERMS.md),
[record identity](RECORD_IDENTITY.md#identity)), spelled in this API's
camelCase.

A `ref` is on `Reading`, `Evidence`, `Sense`, every gloss, every label, every
`GrammarClaim`, every `LemmaLink`, every `LemmaCandidate`, every `InflectionOf`
and every `Review`. The two things without one are `query`, which is the
caller's own string, and `release`, which *is* the release rather than something
read out of it.

Where a ref sits on a link, it names the record the link was read from — an
`InflectionOf.ref` carries the declaring record's line, not the reading's, and a
`LemmaCandidate.ref` carries the candidate's own `/word`.

Pointers order by their segments, and an array index orders as a number:
`/forms/2/form` comes before `/forms/10/form`.

### `Evidence.origin`

| Value | Meaning |
| --- | --- |
| `headword` | the record is about the surface |
| `embedded-form` | the record lists the surface in a table |

### `GrammarClaim`

A four-way distinction. A dimension absent from the list carries no claim at
all; the three represented states are:

| `status` | Meaning | Also carries |
| --- | --- | --- |
| `stated` | the source gave a tag that maps to a known value | `dimension`, `value`, `sourceText` |
| `unclassified` | the source gave text that is not mapped | `sourceText` |
| `missing` | the dimension was checked and the source said nothing | `dimension` |

### `LemmaLink`

| `kind` | Meaning | Also carries |
| --- | --- | --- |
| `dangling` | `targetWord` matches no headword record | — |
| `candidates` | it matches one or more | `candidates[]` |

`candidates[]` is never narrowed to one. More than one entry means the source
did not choose. Each candidate is `recordId`, `word`, `pos`, a `ref` to its
own `/word`, and `listing`.

`listing` is where the candidate's own table spells the query: its whole
`forms[]` and the `evidence[]` rows the key hit, never empty. It is `undefined`
when the candidate's table does not list the query — for `sale`, the `sala`
verb record, which shares its spelling with the `sala` noun. A form reading
reads its person, number and tense off that row, and a page of one verb form
shows the lemma's whole table from it.

### `InflectionOf`

| Field | Holds |
| --- | --- |
| `recordId`, `word`, `pos` | the declaring (inflected) record |
| `ref` | the edge on that record |
| `targetWord` | the word the edge names, verbatim |
| `targetCandidates[]` | every headword record `targetWord` resolves to, this reading included |

More than one candidate means the source did not choose, and the reading must
not be rendered as *the* lemma of `word`.

### `Review`

`ref` (the claim under review), `status` (`disputed` or `corroborated`), `note`,
`evidenceUrl`, `reviewedAt`, `reviewedBy`. A review annotates a claim; it never
replaces it.

## Exported SQL

`SEARCH_SQL`, `LEMMA_LINK_SQL`, `INFLECTION_SQL` and `INFLECTION_CANDIDATE_SQL` are exported
so tests can assert their query plans. See
[the design notes](LOOKUP_DESIGN.md#the-view-that-costs-four-orders-of-magnitude).

## Not covered here

Prefix search and autocomplete (#15), ranking, and the HTTP layer (#14). Review
rows are read but never written; writing them is #12.
