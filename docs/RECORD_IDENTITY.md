# Record identity and lookup rows

How an imported source record is identified, what rows a search reads, and how ambiguity survives storage. The DDL is [`src/db/schema.sql`](../src/db/schema.sql); the reference read queries are [`src/db/queries.sql`](../src/db/queries.sql).

Target is Cloudflare D1, which is SQLite. The original `.jsonl.gz` stays in R2, untouched.

Everything below is checked against the local file (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`, 560,357 Italian records). Counts, line numbers and pointers were produced by loading the real records into the real schema, not written from memory. **These are observations about what this file says, not linguistic conclusions about Italian.**

## The three facts the shape rests on

1. A record's `word` and every `forms[].form` are both searchable surfaces. 560,357 headwords, 713,133 embedded forms.
2. The record holding a form is often not the base word. `studentessa` lists `studenti`. `bellissimo` lists `bella`. Resolving a form hit to its containing record would print the wrong lemma.
3. A `form_of` edge names a **word**, never a record. In this file every `form_of` array has length 1 and every entry has exactly one key, `word`. Noun `bella` points at `bello`, and `bello` is three separate records.

So the schema has no column anywhere that resolves a form to a lemma record. That resolution is a query, and it can return more than one answer.

## Identity

A source record is identified by `(release_id, line_no)`.

- `line_no` is the 1-based physical line in the `.jsonl.gz`.
- `release_id` names one exact file, pinned by `source_release.archive_sha256` and its R2 key. Line numbers only mean something inside one release.

Nothing else is stable. The file carries no id field, and `(word, pos)` is not unique: 1,435 Italian `(word, pos)` groups hold more than one record, up to 5. `sale` is one noun record for salt and a second noun record for the plural of `sala`.

`source_record.record_id` is a surrogate integer so the child tables index cheaply. It is an artefact of one database build. It must never appear in a URL or an API response.

### Pointers

A JSON pointer is RFC 6901, rooted at the single JSON object on that line. `""` is the whole record; `/senses/0/glosses/0` is one gloss; `/forms/53/tags/0` is one tag.

Every row that can end up on a screen carries the pointer of the field it was actually read from. That is the rule [#16](https://github.com/hueypov/lexema/issues/16) exists because the current adapter breaks: it shows the form `studenti` but cites `studente`'s `/word`, so following the pointer lands on a different word than the one displayed.

### Verbatim

`source_record_json.raw_json` holds the exact line text — unparsed, unreordered, unmodified. Nothing downstream writes to it. It sits in its own table because it is 391 MB across the Italian records, and keeping it out of `source_record` keeps the table that every lookup joins small.

Reviews (below) never edit it either.

## Lookup rows

`lookup_form` holds one row per searchable surface occurrence. The load-bearing column is `origin`:

| `origin` | what the record claims |
| --- | --- |
| `headword` | this record **is** about that surface |
| `embedded-form` | this record **mentions** that surface in a table; it may or may not be the base word |

An `embedded-form` hit is never evidence that the container is the lemma. Lemma claims come only from `form_of_edge`.

Duplicates are kept. `studente` lists `studenti` twice, at `/forms/0` (tagged masculine, plural) and again at `/forms/3` (tagged plural). Both rows exist, because merging them would throw away one of the two tag sets.

Surfaces are stored verbatim and never split or cleaned. `studente` `/forms/1/form` is the literal string `studente/studentessa`, which upstream really does contain — it comes from a `Tabs` template argument. Its `surface_key` is therefore the whole string, so a search for `studente` does not match it. That gap is real and visible; splitting it would be invention. Same for `salire` `/forms/0/form`, the string `avere o essere`, which names the auxiliary rather than an inflected form. It is stored, and its `auxiliary` tag says what it is.

`surface_key` is `surface` run through the release's normalizer (`source_release.normalizer`, currently `it-normalize/v1`: trim, NFC, unify apostrophes, lowercase). Keys are only comparable inside one release.

## Ambiguity

`form_of_edge` stores the edge exactly as declared, on the inflected side, and there is **no `target_record_id` column**. Storage preserves the unresolved declaration. This does not prevent a consumer from selecting one result incorrectly; consumers must return all candidates.

Callers read `form_of_candidate`, a view that expands an edge into every headword record it could mean. A dangling edge gives zero rows, an ambiguous one gives several. The `2a` query in `queries.sql` is the recommended public contract: its left join distinguishes "points nowhere" from "points at one thing". Query 2 is only a candidate list and drops dangling edges.

The ambiguity is symmetric. Because the three edges naming `studente` match *any* headword record spelled `studente`, both the noun (37883) and the verb (37884) list `studenti`, `studentessa` and `studentesse` as their inflected entries.

## Serving boundary and import validation

Both serving views and every query in `queries.sql` return rows only for `complete` releases. Direct base-table reads are import diagnostics, not serving reads. `test/record-identity.test.ts` runs in `pnpm test` and in CI: it loads `schema.sql` into an in-memory SQLite database with foreign keys on and exercises every reference query in `queries.sql`. Importing, partial, failed and superseded releases return nothing; a complete release retains multiple candidates and dangling edges. `partial` is a run that ended early on `--limit`: it read the archive cleanly but only to a point, so its checksum describes more of the file than its rows do and it is never promoted.

Foreign keys alone do not prove a release is ready. Before promotion, the importer must validate one verbatim raw JSON row per source record, every stored pointer against that JSON (including the value it cites), and exactly one headword row per record matching `/word`. It must also check full input consumption and expected embedded-form coverage. The schema does not enforce these coverage checks; promotion without them is invalid importer behavior.

The original 27-record loader was not retained. The worked tables below are historical observations, not outputs reproduced by the synthetic regression test.

## Senses stay separate

One `sense` row per `senses[]` entry, in source order. Nothing is merged on matching spelling and nothing is merged across records.

Glosses are copied source text, never a Lexema definition. A non-empty gloss array does not mean a usable definition: `casa`'s two glosses are `casa ( approfondimento) f sing` and `casa ( citazioni)`, and `sala` sense 1 reads *definizione mancante; se vuoi, aggiungila tu*. 667 senses are tagged `no-gloss` and have no gloss rows at all.

`sense_label` holds register and usage labels (`figuratively`, `rare`, `form-of`, `scuola`) verbatim, with no closed vocabulary — that is the source's vocabulary, not ours.

## Missing, unclassified, disputed, absent

Four different things, kept apart.

| state | how it looks | example |
| --- | --- | --- |
| **absent** | no `grammar_claim` row | nothing expected a `person` on a noun |
| **`stated`** | dimension + value + the literal tag | `città` `/tags/0` → gender = feminine |
| **`unclassified`** | literal text kept, no dimension, no value guessed | `salire` `/forms/6/raw_tags/0` = `lui/lei` |
| **`missing`** | dimension named, value NULL, pointer at the container that should have carried it | `casa` has no gender tag anywhere |

`grammar_value` is a seeded table and `grammar_claim` references it with a composite foreign key. An unmapped tag therefore *cannot* enter as a newly invented value — it has to land as `unclassified`. Widening the vocabulary is an `INSERT` in a migration somebody has to read.

Which dimensions are "expected" for which part of speech is importer policy ([#10](https://github.com/hueypov/lexema/issues/10)), not schema. The schema only guarantees the four states stay distinguishable.

The sharpest `missing` case: **no form in this entire file carries a structural mood tag.** `parlerei` at line 37 `/forms/53` is tagged only `present`, with raw tag `io`. The conditional is stated in prose on a different record (line 140699) and in the rendered upstream table. That is a gap the data has, and it shows up as a row rather than as silence.

One known limit: grammar prose that hides in a *sense* `raw_tags`, like `casa` `/senses/0/raw_tags/0` = `pl.: case`, stays in `sense_label` verbatim. It is not promoted into `grammar_claim`, because deciding it means "plural: case" is parsing, not reading.

### Disputed

`claim_review` attaches a note to one exact claim, by pointer, written by review rather than by import. A `disputed` row labels the claim; it never deletes or corrects it. The table is the shape only — who reviews, on what evidence, and how a verdict is reached is [#12](https://github.com/hueypov/lexema/issues/12) and is not decided here.

---

# Worked examples

Real rows, produced by loading the actual source lines into `schema.sql`. `record_id` is shown as the line number for readability.

## `sale` — three records, two of them not about salt

Search hits (`surface_hit`, five rows):

| line | record word | pos | origin | pointer | form source |
| ---: | --- | --- | --- | --- | --- |
| 21651 | sale | noun | headword | `/word` | |
| 21652 | sale | noun | headword | `/word` | |
| 21653 | sale | verb | headword | `/word` | |
| 41460 | sala | noun | embedded-form | `/forms/0/form` | |
| 49483 | salire | verb | embedded-form | `/forms/6/form` | `Appendice:Coniugazioni/Italiano/salire` |

Three records are about `sale`; two merely list it. Line 21651 keeps five senses (sodium chloride, the chemical class, two figurative ones, `sale aromatico`) as five separate `sense` rows, with `figuratively` on senses 2 and 3 in `sense_label`.

Edges declared by the `sale` records, expanded:

| from | pointer | target word | candidate | pos |
| ---: | --- | --- | ---: | --- |
| 21652 | `/senses/0/form_of/0/word` | sala | 41460 | noun |
| 21652 | `/senses/0/form_of/0/word` | sala | 41461 | verb |
| 21653 | `/senses/0/form_of/0/word` | salire | 49483 | verb |

The `sala` edge is ambiguous too — `sala` is a noun record *and* a verb record. Part of speech narrows it to one here, but the schema stores no choice.

Line 21653's gloss says *terza persona singolare, modo indicativo, tempo presente del verbo salire*. The mood is in that prose only. The matching embedded form at `salire` `/forms/6` carries `singular`, `third-person`, `present` as `stated` rows, raw tag `lui/lei` as `unclassified`, and mood as `missing`. Prose and structured tags are different kinds of evidence and are not mixed.

## `studenti` — the container is not the lemma

Five hits, and only one of them is a record about `studenti`:

| line | record word | pos | origin | pointer |
| ---: | --- | --- | --- | --- |
| 37883 | studente | noun | embedded-form | `/forms/0/form` |
| 37883 | studente | noun | embedded-form | `/forms/3/form` |
| 112278 | studenti | noun | headword | `/word` |
| 551446 | studentessa | noun | embedded-form | `/forms/1/form` |
| 551449 | studentesse | noun | embedded-form | `/forms/1/form` |

Four evidence paths, not four meanings. Reporting the container as the lemma would print `studentessa` and `studentesse` as base words for `studenti`. `origin = 'embedded-form'` is what stops that. Line 37883 contributes two rows because it lists `studenti` twice with different tags.

The one headword record declares an edge, and that edge is ambiguous:

| from | pointer | target | candidate | pos |
| ---: | --- | --- | ---: | --- |
| 112278 | `/senses/0/form_of/0/word` | studente | 37883 | noun |
| 112278 | `/senses/0/form_of/0/word` | studente | 37884 | verb |

Two candidates, because `studente` is a noun record and a verb record. A caller may filter to the same part of speech and get one; nothing in the data does that for it.

## `bella` — the case with no right answer

Nine hits, two headwords and seven embedded forms:

| line | record word | pos | origin | pointer |
| ---: | --- | --- | --- | --- |
| 33645 | bello | adj | embedded-form | `/forms/1/form` |
| 50970 | bellissimo | adj | embedded-form | `/forms/2/form` |
| 56435 | bella | adj | headword | `/word` |
| 56436 | bella | noun | headword | `/word` |
| 56442 | belli | adj | embedded-form | `/forms/1/form` |
| 56445 | bellissime | adj | embedded-form | `/forms/2/form` |
| 56447 | bellissimi | adj | embedded-form | `/forms/2/form` |
| 114003 | bellissima | adj | embedded-form | `/forms/2/form` |
| 138942 | belle | adj | embedded-form | `/forms/2/form` |

Both headword records declare an edge to `bello`, and `bello` is three records:

| from | from pos | target | candidate | candidate pos |
| ---: | --- | --- | ---: | --- |
| 56435 | adj | bello | 33645 | adj |
| 56435 | adj | bello | 33646 | noun |
| 56435 | adj | bello | 33647 | noun |
| 56436 | noun | bello | 33645 | adj |
| 56436 | noun | bello | 33646 | noun |
| 56436 | noun | bello | 33647 | noun |

The adjective edge narrows to one candidate by part of speech. **The noun edge does not.** Line 33646 is the invariable masculine noun (*categoria positiva dell'estetica*) and 33647 is the masculine singular noun (*individuo di particolare fascino*) — two different senses, and the source says only *femminile di bello*. Both stay. A `target_record_id` column would have forced an importer to guess here, silently, once, for everyone.

## `studente` — a disputed reading

Two headword records:

| line | word | pos | origin | gloss |
| ---: | --- | --- | --- | --- |
| 37883 | studente | noun | headword | chi è regolarmente iscritto in un corso di studi |
| 37884 | studente | verb | headword | participio presente singolare maschile di studiare |

Both are returned. The verb record's edge resolves cleanly to `studiare` (line 50118, one candidate), so the shape has no structural complaint about it.

The complaint is external. Italian Wiktionary's rendered `studiare` conjugation table and Treccani's `studiare` entry both give the present participle as `studiante`; Treccani's `studente` entry calls it a noun from Latin `studens`. So a `claim_review` row hangs off the exact gloss:

| record | pointer | status | evidence |
| ---: | --- | --- | --- |
| 37884 | `/senses/0/glosses/0` | `disputed` | <https://www.treccani.it/vocabolario/studiare/> |

Line 37884 itself is unchanged, and `raw_json` still holds the original line byte-for-byte. A result page shows the verb reading **with** its dispute attached. Deleting it would be overwriting source data; showing it unmarked would be repeating a claim we have contrary evidence for.

This does not prove no historical or regional verb use exists. It records that two independent sources disagree with the import.

## Also worth seeing: `casa` and `città`

`casa` (line 1) is the clearest `missing` case. The record has no `tags` at all:

| scope | pointer | status | dimension | value |
| --- | --- | --- | --- | --- |
| record | `""` | `missing` | gender | |
| record | `""` | `missing` | number | |

Its `pl.: case` sits in `sense_label` as a raw tag, unparsed. Meanwhile line 8864, `case`, does carry feminine and plural tags and an edge to `casa` — the relation exists even though `casa`'s own entry has nothing.

`città` (line 31998) is `stated` on both dimensions — gender feminine, number invariable — and still cannot get an article, because `invariable` is not a number an article agrees with. That is a question for the article rule, not a gap in the data.

---

## Still open

- **Normalization.** `it-normalize/v1` does not touch accents. Whether a search for `citta` should also find `città` is undecided. Any accent-folded discovery must use a separately versioned approximate key; the accent-preserving exact key and form-of matching remain unchanged.
- **Composite surfaces.** `studente/studentessa` and `avere o essere` are stored whole and will not match a search for their parts. Splitting them needs a rule nobody has validated.
- **Expected-dimension policy.** Which dimensions get a `missing` row for which part of speech is [#10](https://github.com/hueypov/lexema/issues/10)'s call.
- **Review workflow.** `claim_review` is a shape with one example row. [#12](https://github.com/hueypov/lexema/issues/12) owns the rest.
- **Search beyond exact match.** No full-text index here. First release is exact word search.
