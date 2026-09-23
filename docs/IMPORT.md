# Why the importer works this way

How the Italian archive becomes a D1 projection the site can query, and what the
streaming parser will and will not claim about the data on the way through. To
actually run one, see [RUN_AN_IMPORT.md](RUN_AN_IMPORT.md).

## What a run reports

From the current archive, unchanged across runs:

```
status           complete
lines read       799,600
admitted (it)    560,357
skipped (other)  239,243
malformed        0
refused leaves   0

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

Every line that does not become a record is counted exactly and located —
rejected non-Italian lines as well as malformed ones, so a run can be audited
either way. The importer hands each rejection to its caller the moment it is
met, with the line number, the kind and the reason, and the seed writes them
to `rejections.tsv` beside the generated SQL parts, one per line. Nothing
is sampled and nothing is held: all 239,243 skipped lines are listed, and the
importer's memory does not grow with them because the caller writes each one and
forgets it.

A line that parses but lacks `word`, `pos` or `pos_title` counts as malformed,
rather than being admitted with an invented empty string. So does an empty or
whitespace-only line: it carries no record and must not vanish under a reported
zero. And so does an Italian record whose `forms`, `senses` or `form_of` is
present but is not an array of objects — `forms: [null]`, say. The shape is
checked before the record's first write, so a bad line is one located rejection
with the JSON pointer in its reason, never a crash in the middle of the run.

A single bad *leaf* inside an otherwise good record costs that leaf and nothing
more. `glosses: [42, "valido"]` is a record worth keeping with one value that is
not a gloss, so the record lands, the `42` is refused as a `malformed-member`
rejection at `/senses/0/glosses/0`, and the surviving gloss is stored at
`/senses/0/glosses/1` — the index the archive gave it. Closing that gap would
renumber the pointer, and a reader who opened the archive at the stored pointer
would find a different value there. `refused leaves` counts these. The current
archive has none; the behaviour exists so that a later one cannot lose a value
in silence.

Every count above is written onto the release row when the run finishes —
`lines_read`, `admitted`, `skipped_other_language`, `malformed_lines`,
`malformed_members`, and the rows per table in `release_table_rows`. A database
can be audited on its own, without the console output of the run that made it.
They are written in the same transaction as the status flip, so a release that
is servable has always counted.

## Three properties the importer has to keep

**Bounded memory.** 799,600 lines and 391 MB of Italian JSON stream past one line
at a time. Nothing accumulates except counters, so the archive can grow without
the importer needing to change.

**Repeatable.** The same archive produces the same D1 SQL projection.
`record_id` follows line order rather than insertion order, and `sense_id` is
derived from it, so two runs agree row for row. A test asserts this by running
one fixture twice and comparing every emitted table — records, preserved JSON,
lookup rows, edges, senses, glosses, labels and grammar claims — not a chosen
few columns.

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

## Projection size, and what it means for D1

The full D1 projection is **1.4 GB** (1,428,103,168 bytes), measured with
`dbstat` on 2026-09-21; the commands, the machine and the full per-object
output are in
[the import measurements report](../reports/2026-09-21-import-measurements.md):

| Object | Size |
| --- | ---: |
| `source_record_json` | 416.7 MiB |
| `grammar_claim` | 199.8 MiB |
| `grammar_claim_identity` index | 117.3 MiB |
| `lookup_form` | 113.8 MiB |
| `grammar_claim_by_record` index | 71.1 MiB |
| `source_record` | 67.1 MiB |
| `sense_gloss` | 64.8 MiB |
| everything else | 311.3 MiB |

D1's maximum database size is 10 GB on Workers Paid and 500 MB on Free
([D1 limits](https://developers.cloudflare.com/d1/platform/limits/), checked
2026-09-19). So this fits paid comfortably and does not fit free at all.

The single biggest object is the verbatim JSON, at 417 MiB — about a third of the
total. Moving it to R2 and keeping D1 as the index is the original proposal in
[LEXEMA_SPEC.md](LEXEMA_SPEC.md), and these numbers are what #3 needs to decide
it. That decision is #3's, not this importer's; the schema already keeps the raw
JSON in its own table so either answer is a small change.

## What this does not do

The parser does not upload to D1 or R2 itself. `seed:dev` streams the committed
fifty-word fixture (or an explicitly supplied archive) into generated SQL and
loads local D1; getting a full release onto Cloudflare, activating it and
rolling it back is #18. The source archive is maintained at
[`source/it-extract.jsonl.gz`](https://github.com/hueypov/lexema-data/blob/main/source/it-extract.jsonl.gz),
and a local root copy remains gitignored. A full release seeds into local D1
in parts ([RUN_AN_IMPORT.md § Run it](RUN_AN_IMPORT.md#run-it)).

No repair of upstream extraction defects. `casa` still arrives with no usable
definition, because that is what the archive contains. The cause is measured in
#11 and the repair is #28.

No lookup API. Turning these rows into search results is #13.
