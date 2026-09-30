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

### A query of several words that nothing spells

When the key matches nothing and has two to `MAX_PHRASE_WORDS` (12) words,
`lookup()` reads it word by word (#214, rule `it-phrase/v1` in
[`src/italian/phrase.ts`](../src/italian/phrase.ts), reads in
[`src/lookup/phrase.ts`](../src/lookup/phrase.ts)):

1. Each word stands for its lemmas: itself when it is a headword, and every
   word the `form_of` edges on its headword records name (`vado` → `vado`,
   `andare`).
2. An auxiliary (a word whose lemmas include `essere` or `avere`) followed by a
   past participle stands for the participle's verb, and for nothing else. A
   participle is a word, or one of its lemmas, that a verb record's `forms[]`
   lists tagged `participle` and `past`: `andati` names `andato`, `andare`'s
   past participle, so `sono andati via` is read as `andare via`.
3. Every sequence of one lemma per place, joined by single spaces, is probed
   as an exact headword key, at most `MAX_PHRASE_PROBES` (256) of them; a query
   with more sequences is read as no phrase. Every sequence that is a
   headword is a match, and only a record's headword counts.

The readings are those headwords' records, and `route` says how they were
reached: `{ kind: "surface" }` for every other `found`, or
`{ kind: "phrase", phrases }`, each phrase the headword `key` and the typed
`words` with the lemma each stood for. A single word is never read this way,
and neither is a compound tense alone: `sono andati` is one place, so its verb
is left to the exact lookup, which finds it in `andare`'s table. `exists()`
answers the same way, so the two never disagree.

## Outcomes

| `outcome` | When | Carries |
| --- | --- | --- |
| `rejected` | the query never reached the index | `query.raw`, `rejection` |
| `not-found` | the index was probed, nothing matched | `query`, `release` |
| `found` | at least one record matched | `query`, `release`, `route`, `readings` |

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

## Suggestions

`suggest()` in [`src/lookup/suggest.ts`](../src/lookup/suggest.ts) takes a
prefix and returns at most ten headword spellings that start with it, in
alphabetical order. The search field shows them as a list while a reader types
(#15); choosing one runs `lookup()` for it.

```ts
await suggest({ db: fromD1(env.DB), releaseId, prefix: "a" });
// { outcome: "suggested", prefix: { raw: "a", key: "a" },
//   suggestions: ["a", …the first ten headwords under a] }
```

**Query handling** is `normalizeItalianExact`, as above: case and apostrophes
fold, accents stay. `citt` suggests `città`; `citta` does not.

**Bounds.** An empty prefix, or one over `MAX_PREFIX_LENGTH` (the 128 of
`MAX_QUERY_LENGTH`), is `rejected` without reaching the index. One letter is
enough. `SUGGESTION_LIMIT` is 10.

**What is suggested.** Headwords only, each spelling once however many records
carry it, as the source spells it. A spelling found only in another record's
`forms[]` is not suggested.

**Order.** Alphabetical by normalized key: the first words in the dictionary
under what was typed. Huey's ruling, 2026-09-23: "it should show alphabetical
order like the first 10, if i write a it should show words from letter a from
database". The rows come back from `lookup_form_headword_by_key` already in key
order, so nothing is sorted and the walk stops after a few rows; a one-letter
prefix costs what a long one does.

Keys compare by code point, so an accented letter sorts after every unaccented
one in the same position: `citt` gives `cittadino` before `città`. A dictionary's
own collation would put `città` first, but it would need every match under the
prefix read and sorted, which for `a` is some sixty thousand rows.

An earlier version of this branch ranked by definition and length instead;
Huey rejected it for alphabetical. The measurements of both are in
[the autocomplete measurements](../reports/2026-09-23-autocomplete-measurements.md).

`SUGGEST_SQL` is exported so a test can assert it stays a range probe on
`lookup_form_headword_by_key` with no sort step.

## When nothing is found

`findNearby()` in [`src/lookup/nearby.ts`](../src/lookup/nearby.ts) is what the
page offers after `lookup()` answers `not-found` (board 24). The web layer calls
it (`web/lib/dictionary/searchAttempt.ts`); `lookup()` itself is unchanged. It tries five
steps, each only when the one before found nothing (step 4 also joins steps 2
and 3):

1. **Exact lookup**, which already failed.
2. **Accent.** The query's key with its accents taken off (`foldKey`: NFD,
   combining marks removed) is probed in `accent_fold`, which holds every
   `surface_key` whose folded spelling differs from it. `citta` → `città`. An
   accented query also tries its unaccented spelling.
3. **One edit** (a SymSpell deletion index). `typo_key` holds every distinct
   lemma headword key (a record declaring no `form_of`) under itself and each
   spelling with one character left out. The query's own deletions and itself
   are probed in one `IN` query; every candidate is then checked with a true
   restricted Damerau–Levenshtein distance of one (`withinOneEdit`), so an
   insertion, deletion, replacement or swap of neighbours counts. `mangare` →
   `mangiare`. Keys under 4 characters are not tried (`bab` is one edit from
   `AB`, `BA`, `bar`, `bau`, `bob`, none a better guess than the words that
   begin with it), nor keys over 30: their deletions are bound parameters, and
   D1 allows 100.
4. **Expressions it nearly spells** (#214,
   [Huey's updated ruling](https://github.com/hueypov/lexema/issues/214#issuecomment-5906146451)):
   `nearPhrases()` in [`src/lookup/phrase.ts`](../src/lookup/phrase.ts), for a
   query of two to 12 words, reads it as a phrase match does (above) and
   offers the multi-word headwords it reaches off by one of:
   - **one word misspelled:** that word stands for the lemmas of every headword
     one edit from it (`oneEditSpellings`, the edits `withinOneEdit` counts,
     sent as one JSON array and probed through `json_each`, so a form's
     headword counts too: `vadp` reaches `vado`, and so `andare`); every other
     word for its own. `tiro fouri` → `tirare fuori`, `vadp via` → `andare via`.
   - **the last word unfinished:** every word but the last stands for its
     lemmas, and a headword that begins with those lemmas, a space and the
     last word as typed is offered, one range probe per sequence, at most
     `MAX_PHRASE_PREFIX_PROBES` (16). `tiro fuo` → `tirare fuori`.
   - **only part of the query:** a run of two or more neighbouring words, not
     all of them, spells a headword. `vado via adesso` → `andare via`.

   They come in that order, each once, at most eight. This step runs beside the
   accent step: after an accent or a one-edit match the expressions follow the
   other offers as `phrases`; with neither, they are the offer.
5. **Words that begin with it:** `suggest()` for the query.

Candidates rank by fewest edits, then the most translation languages, then
the most senses and forms, then a headword before a form, then shorter, then
alphabetical (`rankCandidates`); the best leads, and up to eight more follow.
The two scores are counted at seed time over the key's lemma records
(`seedSql.ts`) and stored in `accent_fold` and `typo_key` beside the key:
`languages` is the number of distinct `translations[].lang_code` values, and
`richness` is senses plus forms. `mangiare` has 51 languages and `magnare`
none, so `mangare` offers `mangiare` first. A key with no lemma record scores
0 on both. Every probe is one indexed read on a primary key; nothing scores
the word list per request. Expressions are not ranked: they keep step 4's order.

| Answer | Case | Page |
|---|---|---|
| `{ kind: "accent", best, others, phrases }` | the same letters with an accent | "Did you mean città?", then other words that begin with the query, then the expressions |
| `{ kind: "typo", best, others, phrases }` | one edit away | "Did you mean mangiare?", then other close spellings, then the expressions |
| `{ kind: "phrase", best, others }` | an expression it nearly spells | "Did you mean tirare fuori?", then other expressions |
| `{ kind: "prefix", words }` | words that begin with it | the words that fit on one line, then `+ more` |
| `{ kind: "none" }` | nothing | how to search instead |

## Not covered here

The HTTP layer (#14).
Review rows are read but never written; writing them is #12.
