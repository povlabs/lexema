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
| `releaseId` | `string` | the master to read: its `complete` release, which serves the changes applied from later releases with it ([UPDATES.md](UPDATES.md)) |
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

`fromD1` sends every statement queued before its caller next waits as one
`batch()` call, so a statement's promise settles with the rest of its batch,
and a statement D1 refuses fails every statement sent with it. Make one
adapter per request; one shared across requests would mix their reads in one
batch. Why it batches is in
[the design notes](LOOKUP_DESIGN.md#round-trips-not-statements-are-the-cost-on-d1).

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

1. Each word stands for its lemmas: itself, and every word the `form_of`
   edges on its headword records name (`vado` → `vado`, `andare`). A word
   stands for itself even when no record heads it: `l'amore` heads nothing,
   and `faccio l'amore` is still read as `fare l'amore`.
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
`{ kind: "phrase", phrases, forms }`. Each phrase is the headword `key`, its
`word` as the source spells it, and the typed `words` with the lemma each
stood for and the one word that stands for it (`inflected`: the participle of
a compound tense). A single word is never read this way, and neither is a
compound tense alone: `sono andati` is one place, so its verb is left to the
exact lookup, which finds it in `andare`'s table. `exists()` answers the same
way, so the two never disagree.

`forms` are the form lines the page shows for a phrase match (`phraseForms`,
[Huey's page-shape ruling](https://github.com/hueypov/lexema/issues/214#issuecomment-5906398940)).
For each word whose lemma is not itself, the records it heads, and in each one
every gloss of a sense whose `form_of` edge names that lemma, with the lemma
replaced by the phrase (`phraseGloss`): `vado`'s "prima persona singolare del
presente semplice indicativo di andare" becomes "… di andare via". Only the
last place the gloss writes the lemma as a whole word is replaced, and a gloss
that never writes it so is left out. One entry per record, in source order,
with its `pos_title` and each line's own `SourceRef`. `vada via` gives `vada`'s
five entries; `volto le spalle` gives one `volto` record with a line for
*voltare le spalle* and one for *volgere le spalle*. A compound tense's
participle also gives the glosses of its verb records that name the verb's past
participle, the hop the match read it through: `fatte`'s records name `fatto`,
not `fare`, so `hanno fatte fuori` gives `fatte`'s "participio passato plurale
femminile di fatto" as "… di fare fuori". `fatte`'s adjective and noun records
give none.

Before its form lines, each record shows the meanings of the expression they
name, the first time the page names it
([Huey's ruling](https://github.com/hueypov/lexema/issues/214#issuecomment-5909303467)).
They are the found result's own readings, the headword's records, read by the
same `definitionsOf` the headword's page uses, so nothing is read or stored
twice (`phrasePage`,
[`web/lib/dictionary/phrasePage.ts`](../web/lib/dictionary/phrasePage.ts)). A
headword with no gloss has none, and its lines stand alone: `faccio
l'abitudine` shows only `faccio`'s form line for *fare l'abitudine*. A
headword no form line names still shows its meanings, each of its records a
reading of its own after the searched words' records. Only a headword with
neither shows as a bare link.

Closed, a reading shows each expression's first meaning and every form line,
then the `+ more` every reading has; the other meanings are folded under the
first until it opens. The one *Source* links the page of the first headword shown, never the
searched words': `vado via` links to *andare via*'s page
([Huey's hand check](https://github.com/hueypov/lexema/issues/214#issuecomment-5910100974)).
Each form line keeps its record's provenance pointer, which reaches `vado`'s
page, and `/attribution` carries the full credit
([ADR 0009](../.decisions/0009-two-licences-and-a-source-link.md)).

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
| `wordFacts` | pronunciations, hyphenations, etymologies, synonyms, antonyms, derived words and `expressions` (below), read from the record's own line in `source_record_json`; one entry per distinct related spelling, every pointer kept; Wikizionario's missing-field placeholder is taken out of the hyphenations and etymologies (below) |
| `isAboutQuery` | `true` when at least one piece of evidence is a headword hit |
| `evidence[]` | every occurrence of the surface on this record, in source order |
| `senses[]` | source glosses, labels and `examples[].text`, the examples read from `source_record_json`; a gloss loses the missing-field placeholder (below), and one that was only that is not returned |
| `grammar` | claims split into `record`, `byForm` and `bySense` |
| `lemmaLinks[]` | the reading's lemma: outgoing `form_of` edges this record declares, each candidate with its `listing` and its own `expressions` |
| `inflections[]` | records declaring themselves forms of this one |
| `reviews[]` | review verdicts on this record's claims |
| `articles` | noun readings only: the articles `it-articles/v2` derives from the record's one stated gender and one stated number, plus the plural ones for the single plural form the source tags with the same gender; or, when withheld, the first reason (`ArticleWithholding` in `src/lookup/types.ts`) |

### `expressions`

`wordFacts.expressions` is the record's `proverbs[]`, one row per phrase, in
source order ([#213](https://github.com/hueypov/lexema/issues/213)). Each row
holds:

| Field | Holds |
| --- | --- |
| `phrase` | the item's `word`, under the four rules below |
| `meanings` | each distinct `sense` given for the phrase, verbatim, in source order; empty when none is |
| `hasEntry` | `true` when the phrase is an Italian headword: its normalized key is a headword row of `lookup_form`, so a search for it opens that entry |
| `refs` | every `/proverbs/<i>` item the row came from |

The four rules are source text normalizations
([ADR 0019](../.decisions/0019-source-text-may-be-normalized.md)) applied as the
line is read; `source_record_json` is not changed.

1. A phrase opening with `...` or `…` loses the dots: `...in bello` is `in bello`.
2. A phrase with no letter at all gives no row: the lone `:` on `battaglia` and `affare`.
3. A phrase wrapped in round brackets loses them: `(di secondo piano)` is `di secondo piano`.
4. The same phrase listed more than once is one row, its meanings joined in
   source order: `pancia`'s `mettere su pancia` has `oziare` and `ingrassare`.

The HTTP API's `/v1/lookup` returns each result's rows as `expressions`, each
`{ phrase, meaning, has_entry }`, with the meanings joined by `"; "` and `meaning`
`null` when there is none (`web/worker/api/lookupAnswer.ts`).

### The missing-field placeholder

Where a page has no hyphenation, definition, etymology or references,
Wikizionario prints a fixed request to add one, and the archive keeps it as the
field's text: `→ Etimologia mancante. Se vuoi, aggiungila tu.`,
`definizione mancante; se vuoi, aggiungila tu`. It is a template, not data, so
`withoutPlaceholder` (`src/italian/placeholder.ts`) takes it out when a reading
is read (#255). The joining punctuation and wikitext markup touching it go
with it: a `''` quote run, the `**` list marker of its own line. What is left
keeps its own pointer; a text left with only a bracketed label or punctuation
is no text. The stored rows and
`source_record_json` keep the sentence as imported.

### `SourceRef`

| Field | Holds |
| --- | --- |
| `releaseId` | the release these coordinates are in, the record's own: the master's, or the later release a change brought it from; line numbers mean nothing outside one |
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
own `/word`, `listing`, and `expressions`: the lemma record's own
[expressions](#expressions), so a form's page can show them (andavano shows
*Expressions with andare*).

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
await suggest({ db: fromD1(env.DB), releaseId, prefix: "ca" });
// { outcome: "suggested", prefix: { raw: "ca", key: "ca" },
//   suggestions: ["ca", …the first ten headwords under ca] }
```

**Query handling** is `normalizeItalianExact`, as above: case and apostrophes
fold, accents stay. `citt` suggests `città`; `citta` does not.

**Bounds.** A prefix under `MIN_PREFIX_LENGTH` (2) characters of the
normalized key, or one over `MAX_PREFIX_LENGTH` (the 128 of
`MAX_QUERY_LENGTH`), is `rejected` without reaching the index. Two letters is
Huey's call of 2026-10-01 (#387), to cut requests; one letter was enough
before. `SUGGESTION_LIMIT` is 10.

**A complete answer answers longer prefixes** (#387). An answer for a prefix of
one word with fewer than `SUGGESTION_LIMIT` spellings is every headword under
it, and it has no phrases. So a longer prefix of one word that starts with it
gets exactly that list's spellings whose `normalizeItalianExact` key starts
with the longer key, in the same order. `CompleteSuggestions` in
`src/lookup/suggest.ts` holds such an answer and narrows it; the search field
uses it to answer without a request. A full answer, or a prefix of several
words, is never narrowed. `test/suggest.test.ts` checks the narrowed list
against `suggest()` for every longer prefix of the fixture's headwords.

**What is suggested.** Headwords only, each spelling once however many records
carry it, as the source spells it. A spelling found only in another record's
`forms[]` is not suggested.

**Expressions being typed** (#214,
[Huey's hand check](https://github.com/hueypov/lexema/issues/214#issuecomment-5907869562)).
A prefix of two to 12 words also gets `phrases`: `phraseCompletions()` in
[`src/lookup/phrase.ts`](../src/lookup/phrase.ts) reads every word but the
last as its lemmas, as a phrase match does (above), and each multi-word
headword that begins with those lemmas, a space and the last word as typed is
offered as the typed words completed. `vado v` reads `andare v`, reaches
*andare via* and offers `vado via`, which opens that phrase's short page.
`andare v` offers *andare via* already as a headword, so the sequence that is
the typed words themselves is never probed again. Each offer carries the
`headwords` it reaches, as the source spells them, and only those a search for
the offer finds: every offer is read back the way `lookup()` reads it (see
"Every offer is searchable", below). Phrases follow the
headwords, none twice, and the two together stay within `SUGGESTION_LIMIT`
(`offered()` is the list the field shows).

What it costs, per keystroke. A prefix of one word, and a prefix whose own
headwords already fill ten, read nothing more. Otherwise, after the prefix
read:

| Read | Index | Rows | Round trips |
|---|---|---|---|
| `WORD_LEMMAS_SQL`: the lemmas of every word but the last, sent as one JSON array | `lookup_form_headword_by_key`, one equality probe per word, then `form_of_edge_by_record` | a few per word | 1 |
| `PAST_PARTICIPLE_SQL`, only for a word after an auxiliary (`sono andati v`) | `lookup_form_by_key`, then `grammar_claim_by_record` | a few per spelling | 1, its reads side by side |
| `HEADWORD_PREFIX_SQL`: one range probe per lemma sequence other than the typed words, at most `MAX_PHRASE_PREFIX_PROBES` (16) | `lookup_form_headword_by_key` range, in key order, no sort | at most the room left in the list | 1, its reads side by side |
| Only when some phrase is offered: `EXACT_KEY_SQL`, which of the offers the index spells exactly, sent as one JSON array, and `WORD_LEMMAS_SQL` again for the offers' words not read yet | `lookup_form_by_key`, one equality probe per offer; the lemma read as above | one per offer the index spells | 1, the two side by side |
| `PAST_PARTICIPLE_SQL` again, only for an offer's word after an auxiliary not read yet | as above | a few per spelling | 1, its reads side by side |

`vado v` costs four reads more than `vado`: two lemma reads, one range probe
and one exact read. A prefix that completes nothing (`vado f`) costs one lemma
read and its range probes, and reads nothing back. `test/phrase.test.ts`
asserts those counts and each read's query plan.

**Every offer is searchable.** Every phrase the field or "Did you mean"
offers (see "When nothing is found") is read back before it
is offered, by the same reading a search runs, and keeps only the headwords
that search finds. A completion is built from the typed words and a
headword's own, so the search could read it otherwise; an offer that would
reach none of its headwords is dropped rather than shown. An offer the index
spells exactly opens that entry, not a phrase match, so it keeps only the
headword that is the offer itself: `aerei a reazion` offers `aerei a reazione`
for *aerei a reazione*, not for *aereo a reazione*. `test/phrase.test.ts` searches
every phrase offered for every multi-word headword in the fixture, said
through each form of its first word.

**Order.** Alphabetical by normalized key: the first words in the dictionary
under what was typed. Huey's ruling, 2026-09-23: "it should show alphabetical
order like the first 10, if i write a it should show words from letter a from
database". The rows come back from `lookup_form_headword_by_key` already in key
order, so nothing is sorted and the walk stops after a few rows; a short
prefix costs what a long one does.

Keys compare by code point, so an accented letter sorts after every unaccented
one in the same position: `citt` gives `cittadino` before `città`. A dictionary's
own collation would put `città` first, but it would need every match under the
prefix read and sorted, which for `a` is some sixty thousand rows.

An earlier version of this branch ranked by definition and length instead;
Huey rejected it for alphabetical. The measurements of both are in
[the autocomplete measurements](../reports/2026-09-23-autocomplete-measurements.md).

`HEADWORD_PREFIX_SQL` in `src/lookup/keyRange.ts` is exported so a test can
assert it stays a range probe on `lookup_form_headword_by_key` with no sort
step. It reads one release, so a master with changes applied from a later
release runs it once per release and merges the rows in key order
([UPDATES.md](UPDATES.md#serving-a-master-of-several-releases)).

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
4. **The query corrected so that it reads as an expression** (#214,
   [Huey's updated ruling](https://github.com/hueypov/lexema/issues/214#issuecomment-5906146451)
   and [hand check](https://github.com/hueypov/lexema/issues/214#issuecomment-5907869562)):
   `nearPhrases()` in [`src/lookup/phrase.ts`](../src/lookup/phrase.ts), for a
   query of two to 12 words, reads it as a phrase match does (above). What it
   offers is the typed words corrected, never the headword: searching the
   offer is a phrase match, which opens its short page. Each offer is a
   `PhraseOffer`, the `phrase` to search and the `headwords` it reaches. The
   corrections are:
   - **one word misspelled:** that word replaced by a headword spelling one
     edit from it (`oneEditSpellings`, the edits `withinOneEdit` counts), when
     the query then reads as a headword. `vadoo via` and `vado vja` →
     `vado via`, `tiro fouri` and `tiro fuory` → `tiro fuori`. `vadp via` →
     `vada via` and `vado via`: both are one edit away, and neither is ranked.
   - **the last word unfinished:** completed from a headword that begins with
     the other words' lemmas, a space and the last word as typed, one range
     probe per sequence, at most `MAX_PHRASE_PREFIX_PROBES` (16).
     `tiro fuo` → `tiro fuori`.
   - **only part of the query:** a run of two or more neighbouring words, not
     all of them, that reads as a headword. `vado via adesso` → `vado via`.

   They come in that order, each once, at most eight. The query's words and
   every one-edit spelling of them are sent as one JSON array
   (`WORD_LEMMAS_SQL`), and every lemma sequence as another
   (`HEADWORD_SPELLING_SQL`), each probed through `json_each`. Every offer is
   then read back as a search reads it and names only the headwords that
   search finds ("Every offer is searchable", under Suggestions). This step runs
   beside the accent step: after an accent or a one-edit match the corrections
   follow the other offers as `phrases`; with neither, they are the offer.
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
| `{ kind: "phrase", best, others }` | the query corrected to read as an expression | "Did you mean vado via?", then other expressions |
| `{ kind: "prefix", words }` | words that begin with it | the words that fit on one line, then `+ more` |
| `{ kind: "none" }` | nothing | how to search instead |

## Not covered here

The HTTP layer (#14).
Review rows are read but never written; writing them is #12.
