# Importing a release

How the Italian archive becomes a database the site can query, and what the
importer will and will not claim about the data on the way through.

## Run it

```sh
pnpm run import -- --release-id it-2026-07-20 --force
```

Defaults read `it-extract.jsonl.gz` from the repository root and write
`.data/lexema.sqlite`. Both are gitignored: the archive because redistributing
it is unsettled (#6), the database because it is regenerated in about two and a
half minutes.

`--force` deletes an existing database first. Without it a second run fails,
which is deliberate — silently overwriting an imported release is how you lose
one you meant to keep. `--limit n` stops early, for smoke runs.

Per ADR 0004 (`.decisions/0004-cloudflare-workers-d1-vinext.md`) this never runs
inside a request. It is a plain Node program; the Worker only reads what it
produced.

## What a run reports

From the current archive, unchanged across runs:

```
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
match the independent inspection in [DATASET_SPOT_CHECK.md](DATASET_SPOT_CHECK.md),
which was measured by a different program. Two counts agreeing is not proof, but
they were arrived at separately.

Malformed lines are counted exactly and the first fifty line numbers are
printed. A line that parses but lacks `word`, `pos` or `pos_title` counts as
malformed too, rather than being admitted with an invented empty string.

## Three properties the importer has to keep

**Bounded memory.** 799,600 lines and 391 MB of Italian JSON stream past one line
at a time. Nothing accumulates except counters, so the archive can grow without
the importer needing to change.

**Repeatable.** The same archive produces the same database. `record_id` follows
line order rather than insertion order, and `sense_id` is derived from it, so
two runs agree row for row. A test asserts this by importing one fixture twice
and comparing.

**Honest about the filter.** A record is admitted on `lang_code === "it"` and
nothing else — never the filename, the spelling, or the categories. The file is
not Italian-only despite its name: 239,243 of its lines are other languages.
`source_record` carries a `CHECK (lang_code = 'it')` so the filter stays visible
in the data itself.

The release row is committed as `importing` before the first record, records
land in batches of 25,000, and the flip to `complete` is the last transaction of
the run. Every canonical read filters on `complete`, so a crashed import leaves
something invisible rather than something half-served — and it does leave
something: a release stuck at `importing`, cleared with `pnpm run release --
discard`. See [RELEASES.md](RELEASES.md).

That last transaction also pins what the import *derived*. `archive_sha256`
covers the bytes that came in; `projection_sha256` and `projection_counts` cover
the tables built out of them, computed by reading those rows back rather than
from the importer's counters. A projection that lost a whole table would still
match its archive checksum, and this is what notices.

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

D1 allows 10 GB per database on the paid plan and 500 MB on free. So this fits
paid comfortably and does not fit free at all.

The single biggest object is the verbatim JSON, at 417 MB — about a third of the
total. Moving it to R2 and keeping D1 as the index is the original proposal in
[LEXEMA_SPEC.md](LEXEMA_SPEC.md), and these numbers are what #3 needs to decide
it. That decision is #3's, not this importer's; the schema already keeps the raw
JSON in its own table so either answer is a small change.

## What this does not do

No upload to D1 or R2. The importer writes a local SQLite file. Checking a
staged release, activating it and rolling it back are in
[docs/RELEASES.md](RELEASES.md); getting the bytes onto Cloudflare is still #19.

No repair of upstream extraction defects. `casa` still arrives with no usable
definition, because that is what the archive contains. The cause is measured in
#11 and the repair is #28.

No lookup API. Turning these rows into search results is #13.
