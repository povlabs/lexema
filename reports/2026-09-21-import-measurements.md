# Import measurements: full archive, 2026-09-21

Measurement. One full run of the importer on PR #32's head, as merged with
`origin/huey/2-record-identity` at `4a3d1e2`, over the local archive. These
numbers back the size table in [IMPORT.md](../docs/IMPORT.md#size-and-what-it-means-for-d1)
and the runtime estimate in [RUN_AN_IMPORT.md](../docs/RUN_AN_IMPORT.md). They
describe this machine and this file; a different archive gives different rows.

## Setup

- Archive: `it-extract.jsonl.gz`, 39,890,237 bytes,
  SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`
  (the same file as [the dataset spot check](2026-09-18-dataset-spot-check.md)).
- Machine: Apple M1 Pro, 16 GB, macOS 27.0. Node v26.2.0, pnpm 10.13.1,
  `sqlite3` CLI 3.54.0 for the `dbstat` queries.
- Started 2026-09-21T11:00:19Z.

## Runtime and counts

```sh
/usr/bin/time -p pnpm run import -- --release-id it-2026-07-20 --database .data/measure.sqlite --force
```

Output, progress lines removed:

```
release          it-2026-07-20  (it-import/v1)
status           complete
archive sha256   0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf
archive bytes    39,890,237
lines read       799,600
admitted (it)    560,357
skipped (other)  239,243
malformed        0

rows written
  source_record       560,357
  source_record_json  560,357
  lookup_form         1,273,490
  form_of_edge        608,726
  sense               714,867
  sense_gloss         714,223
  sense_label         637,585
  grammar_claim       3,454,793

elapsed          58.4s

rejected lines   239,243 listed in .data/measure.sqlite.rejections.tsv
real 59.22
user 42.36
sys 13.76
```

The rejections file has one line per rejected input line and nothing else:

```sh
wc -l .data/measure.sqlite.rejections.tsv          # 239243
cut -f2 .data/measure.sqlite.rejections.tsv | sort | uniq -c
#  239243 other-language
head -3 .data/measure.sqlite.rejections.tsv
# 2	other-language	lang_code is "ca"
# 3	other-language	lang_code is "la"
# 4	other-language	lang_code is "pt"
```

## Size

File on disk: 1,441,595,392 bytes (`ls -l .data/measure.sqlite`), which is
351,952 pages of 4,096 bytes. `dbstat` accounts for 1,374.8 MiB of that:

```sh
sqlite3 -header -column .data/measure.sqlite \
  "SELECT name, printf('%.1f', sum(pgsize)/1048576.0) AS mb FROM dbstat GROUP BY name ORDER BY sum(pgsize) DESC;"
sqlite3 .data/measure.sqlite "SELECT printf('%.1f', sum(pgsize)/1048576.0) FROM dbstat;"
```

| Object | MiB |
| --- | ---: |
| `source_record_json` | 416.7 |
| `grammar_claim` | 199.8 |
| `grammar_claim_identity` | 117.3 |
| `lookup_form` | 116.3 |
| `grammar_claim_by_record` | 71.1 |
| `source_record` | 68.3 |
| `sense_gloss` | 64.8 |
| `lookup_form_by_key` | 48.6 |
| `form_of_edge` | 44.1 |
| `sqlite_autoindex_lookup_form_1` | 31.5 |
| `sense_label` | 26.4 |
| `form_of_edge_by_target` | 22.4 |
| `lookup_form_headword_by_key` | 20.9 |
| `sense` | 16.9 |
| `lookup_form_by_record` | 16.4 |
| `sqlite_autoindex_source_record_1` | 15.8 |
| `sqlite_autoindex_source_record_2` | 15.8 |
| `sqlite_autoindex_sense_label_1` | 12.5 |
| `sqlite_autoindex_sense_1` | 10.9 |
| `sqlite_autoindex_sense_gloss_1` | 10.9 |
| `sense_by_record` | 10.1 |
| `sqlite_autoindex_form_of_edge_1` | 9.3 |
| `form_of_edge_by_record` | 7.9 |
| everything else (`source_release`, `grammar_value`, `claim_review`, their indexes, `sqlite_schema`) | 0.0 |
| **total** | **1,374.8** |
