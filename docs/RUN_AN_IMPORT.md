# How to run an import

Turn the Italian archive into a local SQLite database. Why the importer behaves
the way it does is [IMPORT.md](IMPORT.md); this page is the operation.

## Before you start

- `it-extract.jsonl.gz` in the repository root.
- Roughly 1.5 GB free for the database, and a minute or two of runtime. The
  last measured full run is in
  [the import measurements report](../reports/2026-09-21-import-measurements.md),
  with the command that produced it.

Both paths are gitignored: the archive because redistributing it is unsettled
(#6), the database because it is regenerated.

## Run it

```sh
pnpm run import -- \
  --release-id it-0c432803 \
  --source-url https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz \
  --force
```

Defaults read `it-extract.jsonl.gz` and write `.data/lexema.sqlite`.

The release id names the archive by the first eight characters of its SHA-256,
and the URL is the one recovered from the file's own macOS download metadata —
both from [the dataset spot check](../reports/2026-09-18-dataset-spot-check.md#status-and-method).
A date-shaped id such as `it-2026-07-20` would be a guess: that same spot check
records the upstream release date as unverified, and the importer's rule is that
an unknown date is written as unknown, never invented. So there is no
`--retrieved-at` and no `--upstream` here either; both columns stay empty.
Check the archive you have is the one those flags describe:

```sh
shasum -a 256 it-extract.jsonl.gz
# 0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf
```

## Flags

| Flag | What it does |
| --- | --- |
| `--release-id <id>` | Names the release row. Defaults to `it-local`; name the real dump when you mean to keep it. |
| `--source-url <url>` | Where the archive was downloaded from. Stored on the release row; left empty when you do not know it. |
| `--retrieved-at <iso>`, `--upstream <id>` | Download time and upstream dump id, when you can show they are true. Omitted means unknown, which is what the release row then says. |
| `--input <path>` | The `.jsonl.gz` to read. Defaults to `it-extract.jsonl.gz`. |
| `--database <path>` | Where to write. Defaults to `.data/lexema.sqlite`. |
| `--force` | Delete an existing database first. Without it a second run fails, which is deliberate: silently overwriting an imported release is how you lose one you meant to keep. |
| `--limit <n>` | Stop after n admitted records, for a smoke run. The release ends as `partial` and no canonical read will serve it. |

`pnpm run import -- --help` prints the full list.

## Check the run worked

The summary says `status complete`. Anything else means the database is not
servable — see [IMPORT.md](IMPORT.md#what-a-run-reports) for what the counts
mean and what `partial` is for.

Every line that did not become a record is listed in `<database>.rejections.tsv`
next to the database — `.data/lexema.sqlite.rejections.tsv` by default — as line
number, kind and reason, one per line. The summary's `rejected lines` count is
the number of lines in that file. `malformed 0` is the expected answer for the
current archive; anything else names a line to go and look at.

`refused leaves 0` is the expected answer too. It counts values inside records
that did land but were the wrong JSON type — a gloss that is not a string, say.
Each one is in the same file as `malformed-member`, located by line number and
JSON pointer.

The counts are on the release row as well, so a database you were handed can be
checked without the output of the run that made it:

```sh
sqlite3 -line .data/lexema.sqlite \
  "SELECT status, lines_read, admitted, skipped_other_language,
          malformed_lines, malformed_members FROM source_release;"
sqlite3 -column .data/lexema.sqlite \
  "SELECT table_name, rows FROM release_table_rows ORDER BY table_name;"
```

If the run stops with *"changed while it was being imported"*, something
rewrote the archive under it. Nothing was committed; run it again on a file
nobody is touching.

## Where it may not run

Per [ADR 0004](../.decisions/0004-cloudflare-workers-d1-vinext.md) this never
runs inside a request. It is a plain Node program; the Worker only reads what it
produced.
