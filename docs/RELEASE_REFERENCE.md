# Releases: the model and the checks

Reference for [docs/RELEASES.md](RELEASES.md), which is the runbook. Nothing here
is a step to run; it is what the words in that runbook mean.

## What a release is

One imported source file. `source_release` pins which bytes it was
(`archive_sha256`, `archive_r2_key`), which normalizer produced its search keys,
which importer and schema wrote it, and what those derived from it
(`projection_sha256`, `projection_counts`). Its `status` is the whole lifecycle:

| status | meaning | visible to readers |
| --- | --- | --- |
| `importing` | the import is running, or it crashed partway | no |
| `complete` | every line landed | yes, if `LEXEMA_RELEASE` names it |
| `superseded` | retired by hand after a newer one proved out | no |
| `failed` | written off | no |

Every canonical read filters on `status = 'complete'`, so a half-imported
release is unreachable rather than half-served.

The importer commits the release row as `importing` **before** the first record,
writes records in batches, and flips to `complete` in its own last transaction.
So a crash leaves a visible wreck — a release stuck at `importing`, holding
whatever batches landed, hidden from every read — and `discard` is how you clear
it. One giant transaction would have been simpler and would have left nothing
behind at all, including nothing to notice.

## Two checksums, two questions

| column | answers |
| --- | --- |
| `archive_sha256` | were these the bytes we downloaded? |
| `source_record.line_sha256` | is this record the line it claims to be? |
| `projection_sha256` | are the derived tables the ones this import built? |
| `projection_counts` | is any derived table gone or short? |

The first two cover what came in. The last two cover what was built out of it —
lookup rows, form_of edges, senses, glosses, labels, grammar claims — because a
projection that lost a whole table still matches its archive checksum perfectly.
Both are written by reading the rows back at the end of the import, never from
the importer's own counters, and `src/release/projection.ts` defines the stream
that is hashed.

Two releases live in the same database at once. `record_id` is one key space
across the whole file, so a second import counts up from where the first
stopped; within one release the ids still follow line order, which is what keeps
an import repeatable.

Because those ids shift, the digest does not hash them. Each derived row names
its record by `line_no` — the line's position in the archive — so the same
archive imported twice into the same database digests the same both times, and a
digest difference is always a content difference.

## The gate's checks

`src/release/validate.ts`. It runs every check even after one fails, so the
output is the full list of what is wrong.

- **exists / complete** — the release is there and its import finished.
- **normalizer** — its search keys were built by the normalizer this build
  reads. A mismatch means every query misses, so `lookup()` refuses it outright.
- **schema** — its schema version matches this build.
- **not-empty** — it has records, lookup forms and form_of edges.
- **projection** — every derived table holds the number of rows the import
  recorded. This is the cheap check that catches a missing table.
- **projection-digest** — with `--verify-projection`, every derived row is
  re-hashed and compared with `projection_sha256`. This is the expensive check
  that catches a single edited row. It is a full scan of the release.
- **size** — it has at least 90% of the records in the release named by
  `--against`. Releases drift between upstream dumps; losing a tenth of them is
  a broken import. There is no way to leave this out: either name a baseline, or
  pass `--first-release`, which only passes when the database really does hold
  no other release. A mistyped `--against` is a failure, not a skip.
- **probe:…** — `sale`, `studenti`, `bella`, `casa` and `studente` answered
  through the real lookup path, and each one must come back with the
  *relationships* it is known to have: a resolving form_of edge, an embedded
  form, a gloss, grammar, an inflection pointing back. Asserting only "something
  was found" would let a release that lost every `form_of_edge` row pass, since
  the headword rows alone answer all five words.

`--probes a,b,c` overrides the list, but an overridden probe only requires one
reading — it is a weaker gate, for a partial release such as the dev seed.

The checks run through `LookupDatabase`, so the same code judges a local SQLite
file and the real D1.
