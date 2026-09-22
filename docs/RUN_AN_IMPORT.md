# Run an archive conversion

The archive remains an **offline conversion input**, not a development seed
input. `src/content/converter.ts` reads it through the streaming parser in
`src/import/importRelease.ts` and writes release content files. The parser keeps
its admission, rejection, checksum, provenance and form-of semantics; it no
longer writes a local SQLite database.

## Before you start

- `it-extract.jsonl.gz` in the repository root (not committed).
- Enough space for the generated content files.

The archive is gitignored because redistribution is unsettled. A data-repo
checkout is needed for a real release conversion, not for `pnpm run seed:dev`.

## Convert

```sh
pnpm run convert -- \
  --input it-extract.jsonl.gz \
  --output content \
  --release-id it-<release-id>
```

The converter reports files, words, records, rejected lines and refused
members. It preserves source locations in every generated value and leaves
existing editorial fields in place. A conversion that encounters malformed
input fails or reports the located rejection rather than silently dropping it.

## Development data

To run the site from the committed fifty-word release, use
[`DEV_SEED.md`](DEV_SEED.md). That path reads content files and emits SQL for a
separate local D1; it does not call this archive conversion and does not write
SQLite.

## What remains out of this operation

Deploying a full release to production D1 is a separate release operation. The
old archive-to-SQLite import command and its SQL export/prefix helpers are
retired; there is no `pnpm run import` command to run.
