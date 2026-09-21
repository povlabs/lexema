# Why the importer works this way

How the Italian archive becomes a database the site can query, and what the
importer will and will not claim about the data on the way through. To actually
run one, see [RUN_AN_IMPORT.md](RUN_AN_IMPORT.md).

## What a run reports

From the current archive, unchanged across runs:

```
status           complete
lines read       799,600
admitted (it)    560,357
skipped (other)  239,243
malformed        0

source_record       560,357
source_record_json  560,357
lookup_form       1,273,490
form_of_edge        608,726
sense               714,867
sense_gloss         714,223
sense_label         637,585
grammar_claim     3,454,793
```

Those first four numbers, and the 713,133 embedded forms inside `lookup_form`,
match the independent inspection in [the dataset spot check](../reports/2026-09-18-dataset-spot-check.md),
which was measured by a different program. Two counts agreeing is not proof, but
they were arrived at separately.

Every line that does not become a record is counted exactly, and the first fifty
line numbers of each kind are printed — rejected non-Italian lines as well as
malformed ones, so a run can be audited either way. Keeping all 239,243 skipped
line numbers would break the bounded-memory property, so the counts are exact and
the locations are a sample.

A line that parses but lacks `word`, `pos` or `pos_title` counts as malformed,
rather than being admitted with an invented empty string. So does an empty or
whitespace-only line: it carries no record and must not vanish under a reported
zero.

## Three properties the importer has to keep

**Bounded memory.** 799,600 lines and 391 MB of Italian JSON stream past one line
at a time. Nothing accumulates except counters, so the archive can grow without
the importer needing to change.

**Repeatable.** The same archive produces the same database. `record_id` follows
line order rather than insertion order, and `sense_id` is derived from it, so
two runs agree row for row. A test asserts this by importing one fixture twice
and comparing every row of every table — records, preserved JSON, lookup rows,
edges, senses, glosses, labels and grammar claims — not a chosen few columns.

**Honest about the filter.** A record is admitted on `lang_code === "it"` and
nothing else — never the filename, the spelling, or the categories. The file is
not Italian-only despite its name: 239,243 of its lines are other languages.
`source_record` carries a `CHECK (lang_code = 'it')` so the filter stays visible
in the data itself.

The release row is written as `importing` and flipped to `complete` only after
the last line of the archive lands. Every canonical read filters on `complete`,
so a crashed import leaves something invisible rather than something
half-served.

A run stopped early by `--limit` ends as `partial` instead. It holds the
checksum and byte count of the whole archive but only a prefix of its records,
and the canonical reads hide it for the same reason they hide a crash. The rows
stay on disk for diagnosis; it is serving that is refused.

The checksum describes the bytes that were imported, not a path. The archive is
opened once; the hashing pass and the import pass both read that one open file,
and the file is re-checked before anything commits. Hashing a name and then
re-opening that name is two reads of a *name*, and a file swapped in between
would be stored under another file's digest — which would quietly break the
`(release_id, line_no)` identity that the rest of the system rests on. A run
whose archive moves under it fails and commits nothing.

The digest still covers the whole file rather than the part that was read: a
`partial` run is honest because its status says so, not because its checksum
lies about the prefix.

## Grammar: what gets mapped, and what deliberately does not

[`src/import/grammarPolicy.ts`](../src/import/grammarPolicy.ts) holds this. The
schema owns the four states and the closed vocabulary; deciding which tag means
what is the importer's call, and it is made conservatively.

**Structural `tags[]` are mapped** when they land in the schema's vocabulary —
`masculine` to `gender`, `imperfect` to `tense`, and so on. Anything outside it
is kept verbatim as `unclassified` rather than pushed into a nearby value.

**`raw_tags[]` are never mapped.** `essi/esse` plainly means third person to an
Italian reader, and it is still recorded as `unclassified`. Reading those tags is
exactly what #4 exists to establish and test; doing it here would put an
unvalidated guess in the database wearing a `stated` label.

**`missing` is recorded where a dimension was expected and not found.** Two
narrow cases:

- Nouns, adjectives and names are expected to state gender and number. `casa`
  states neither, so it gets two `missing` rows. That is a different fact from a
  word nobody expected a gender from, and the difference is what lets the site
  say "the source does not say" instead of showing nothing.
- A verb form already inflected for person, number or tense is expected to state
  a mood. None in this file does — `parlerei` is tagged only `present`, with
  "conditional" written in prose on a separate record — so 592,277 `missing`
  mood rows record the largest gap in this dataset instead of letting it read as
  absence. Auxiliary entries are excluded: `salire` `/forms/0` is the string
  `avere o essere`, not an inflected form, so it is owed no mood.

Sense `raw_tags` land in both `sense_label` and `grammar_claim`. That duplication
is intentional: the importer cannot tell a topic label (`scuola`) from grammar
written in words (`pl.: case` on `casa`, which is the only place that plural
appears), so the text sits where either reader will find it.

## Size, and what it means for D1

The database is **1.3 GB**. Measured with `dbstat`:

| Object | Size |
| --- | ---: |
| `source_record_json` | 416.7 MB |
| `grammar_claim` | 199.0 MB |
| `grammar_claim_identity` index | 116.9 MB |
| `lookup_form` | 116.3 MB |
| `grammar_claim_by_record` index | 70.8 MB |
| `source_record` | 68.3 MB |
| `sense_gloss` | 64.8 MB |
| everything else | ~250 MB |

D1's maximum database size is 10 GB on Workers Paid and 500 MB on Free
([D1 limits](https://developers.cloudflare.com/d1/platform/limits/), checked
2026-09-19). So this fits paid comfortably and does not fit free at all.

The single biggest object is the verbatim JSON, at 417 MB — about a third of the
total. Moving it to R2 and keeping D1 as the index is the original proposal in
[LEXEMA_SPEC.md](LEXEMA_SPEC.md), and these numbers are what #3 needs to decide
it. That decision is #3's, not this importer's; the schema already keeps the raw
JSON in its own table so either answer is a small change.

## What this does not do

No upload to D1 or R2. The importer writes a local SQLite file; getting a
release onto Cloudflare, activating it and rolling it back is #18.

No repair of upstream extraction defects. `casa` still arrives with no usable
definition, because that is what the archive contains. The cause is measured in
#11 and the repair is #28.

No lookup API. Turning these rows into search results is #13.
