# Import measurements: full archive, 2026-09-21

Measurement. One full run of the importer on PR #32's repair head — the head
that refuses malformed leaf values and writes the run's counts onto the release
row — over the local archive. These numbers back the size table in
[IMPORT.md](../docs/IMPORT.md#size-and-what-it-means-for-d1) and the runtime
estimate in [RUN_AN_IMPORT.md](../docs/RUN_AN_IMPORT.md). They describe this
machine and this file; a different archive gives different rows.

This run supersedes the earlier one on the same date at the pre-repair head. The
row counts are identical; the object sizes moved by a few MiB because the
database now also carries the counts and `release_table_rows`.

## Setup

- Archive: `it-extract.jsonl.gz`, 39,890,237 bytes,
  SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`
  (the same file as [the dataset spot check](2026-09-18-dataset-spot-check.md)).
- Machine: Apple M1 Pro, 16 GB, macOS 27.0. Node v26.2.0, pnpm 10.13.1,
  `sqlite3` CLI 3.54.0 for the `dbstat` queries.
- Started 2026-09-21T11:16:52Z.

The release is named `it-0c432803` after the archive checksum above, because the
upstream release date is
[not verified](2026-09-18-dataset-spot-check.md#status-and-method) and a
date-shaped name would state one. The download URL is the one that spot check
recovered from the file's own macOS `kMDItemWhereFroms` metadata.

## Runtime and counts

```sh
/usr/bin/time -p pnpm run import -- \
  --release-id it-0c432803 \
  --source-url https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz \
  --database .data/measure.sqlite --force
```

Output, progress lines removed:

```
release          it-0c432803  (it-import/v1)
status           complete
archive sha256   0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf
archive bytes    39,890,237
lines read       799,600
admitted (it)    560,357
skipped (other)  239,243
malformed        0
refused leaves   0

rows written
  source_record       560,357
  source_record_json  560,357
  lookup_form         1,273,490
  form_of_edge        608,726
  sense               714,867
  sense_gloss         714,223
  sense_label         637,585
  grammar_claim       3,454,793

elapsed          58.8s

rejected lines   239,243 listed in .data/measure.sqlite.rejections.tsv
                 every refused leaf is listed there too, as malformed-member
real 59.33
user 42.26
sys 13.49
```

`refused leaves 0` means no Italian record in this archive carries a gloss, tag,
form surface or `form_of` target of the wrong JSON type. The row counts are
unchanged from the pre-repair run, which is what that zero predicts.

The rejections file has one line per refusal and nothing else:

```sh
wc -l .data/measure.sqlite.rejections.tsv          # 239243
cut -f2 .data/measure.sqlite.rejections.tsv | sort | uniq -c
#  239243 other-language
head -3 .data/measure.sqlite.rejections.tsv
# 2	other-language	lang_code is "ca"
# 3	other-language	lang_code is "la"
# 4	other-language	lang_code is "pt"
```

## Counts on the release row

The same counts read back out of the database, with no reference to the console
output above:

```sh
sqlite3 -header -line .data/measure.sqlite \
  "SELECT source_url, retrieved_at, upstream_release, status, lines_read, admitted,
          skipped_other_language, malformed_lines, malformed_members FROM source_release;"
```

```
            source_url = https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz
          retrieved_at =
      upstream_release =
                status = complete
            lines_read = 799600
              admitted = 560357
skipped_other_language = 239243
       malformed_lines = 0
     malformed_members = 0
```

`retrieved_at` and `upstream_release` are empty because neither is verified for
this file. They are written as unknown, never guessed.

```sh
sqlite3 -header -column .data/measure.sqlite \
  "SELECT table_name, rows FROM release_table_rows ORDER BY table_name;"
```

```
table_name          rows
------------------  -------
form_of_edge         608726
grammar_claim       3454793
lookup_form         1273490
sense                714867
sense_gloss          714223
sense_label          637585
source_record        560357
source_record_json   560357
```

## Size

File on disk: 1,428,103,168 bytes (`ls -l .data/measure.sqlite`), which is
348,658 pages of 4,096 bytes — 1,361.9 MiB, all of which `dbstat` accounts for:

```sh
sqlite3 -header -column .data/measure.sqlite \
  "SELECT name, printf('%.1f', sum(pgsize)/1048576.0) AS mb FROM dbstat GROUP BY name ORDER BY sum(pgsize) DESC;"
sqlite3 .data/measure.sqlite "SELECT printf('%.1f', sum(pgsize)/1048576.0) FROM dbstat;"
```

Every row the first query printed, in its order, nothing aggregated:

| Object | MiB |
| --- | ---: |
| `source_record_json` | 416.7 |
| `grammar_claim` | 199.8 |
| `grammar_claim_identity` | 117.3 |
| `lookup_form` | 113.8 |
| `grammar_claim_by_record` | 71.1 |
| `source_record` | 67.1 |
| `sense_gloss` | 64.8 |
| `lookup_form_by_key` | 45.8 |
| `form_of_edge` | 42.9 |
| `sqlite_autoindex_lookup_form_1` | 31.5 |
| `sense_label` | 26.4 |
| `form_of_edge_by_target` | 20.9 |
| `lookup_form_headword_by_key` | 19.6 |
| `sense` | 16.9 |
| `lookup_form_by_record` | 16.4 |
| `sqlite_autoindex_source_record_1` | 14.7 |
| `sqlite_autoindex_source_record_2` | 14.6 |
| `sqlite_autoindex_sense_label_1` | 12.5 |
| `sqlite_autoindex_sense_1` | 10.9 |
| `sqlite_autoindex_sense_gloss_1` | 10.9 |
| `sense_by_record` | 10.1 |
| `sqlite_autoindex_form_of_edge_1` | 9.3 |
| `form_of_edge_by_record` | 7.9 |
| `sqlite_schema` | 0.0 |
| `sqlite_autoindex_source_release_1` | 0.0 |
| `sqlite_autoindex_release_table_rows_1` | 0.0 |
| `sqlite_autoindex_grammar_value_1` | 0.0 |
| `sqlite_autoindex_claim_review_1` | 0.0 |
| `source_release` | 0.0 |
| `release_table_rows` | 0.0 |
| `grammar_value` | 0.0 |
| `claim_review_by_record` | 0.0 |
| `claim_review` | 0.0 |
| **total** | **1,361.9** |
