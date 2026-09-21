# Development seed

What `pnpm run seed:dev` ([`src/import/seedDev.ts`](../src/import/seedDev.ts))
reads, writes and covers. To run it, see
[RUN_THE_SITE.md](RUN_THE_SITE.md); why it works through generated SQL is in
[WEB.md](WEB.md).

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `SEED_RECORDS` | `25000` | records cut from the head of the archive |
| `SEED_RELEASE` | `it-dev` | release id written, and the value `LEXEMA_RELEASE` must match |

## Paths

| Path | Role |
|---|---|
| `it-extract.jsonl.gz` | input archive, repository root |
| `.data/it-dev.jsonl.gz` | the prefix archive the release is made from; named after `SEED_RELEASE`, deleted at start |
| `.data/dev.sqlite` | intermediate SQLite database; deleted at start, with `-wal` and `-shm` |
| `.data/dev.sql` | generated SQL; deleted at start |
| `.data/dev-rejections.tsv` | every line the importer refused, located; deleted at start |
| `web/.wrangler/state` | wrangler persist directory, passed absolute |
| `web/.wrangler/state/v3/d1` | local D1 database; **deleted at start** |

The generated SQL creates the schema and inserts the release, so loading it over
an existing seed collides on duplicate rows. Deleting the local D1 database
first is what makes the script repeatable.

## The release is complete, and why that took a prefix file

The seed used to import the full archive with `limit`. That stops the importer
before the last line, so the release landed `partial` — and every canonical read
hides a release that is not `complete`, so the page answered every query with
*the lookup failed* (#47).

So the seed cuts the prefix into **its own archive** under `.data/` and imports
that file whole, with no `limit`. The release is then honestly `complete` for
the file it names, and the `archive_sha256` and `archive_bytes` on it describe
the prefix — the bytes that were actually read — rather than a full archive
nobody imported. The lookup needs no development-only exception.

The cut counts records with the importer's own admission test
(`admitsRecord`, [`src/import/importRelease.ts`](../src/import/importRelease.ts)),
so the prefix holds exactly `SEED_RECORDS` records and not merely that many
lines. Line numbers and record ids are unchanged by the cut: both count from
the start of the file, and the prefix starts where the archive does.

## Coverage at the default

The seed is a **prefix of the archive, not a sample**: coverage stops at a
source line number rather than being spread across the alphabet.

| Fact | Value |
|---|---|
| Records | 25,000 |
| Last source line reached | 60,501 |
| Release status | `complete` |
| Prefix archive | 8.3 MB |
| Runtime | about 85 seconds |
| Generated SQL | about 142 MB, 2,341 statements |
| `lookup_form` rows | 186,830 |

Surfaces present at the default: `casa`, `case`, `sale`, `sala`, `salire`,
`studente`, `studenti`, `bella`, `bello`, `andare`, `andavano`, `città`,
`parlare`. Surfaces past line 60,501 are absent, and the page reports finding
nothing.

`SEED_RECORDS=560000` covers the whole release: the prefix is then the whole
archive, and the seed says so. The generated SQL is gigabytes and the loader is
slow.

Measured on 2026-09-21 by running the recipe in
[RUN_THE_SITE.md](RUN_THE_SITE.md) at the default.

## Statement batching

`exportSql` batches inserts to **64 KiB** per statement
(`maxStatementBytes`, [`src/import/exportSql.ts`](../src/import/exportSql.ts)).
The limit was found by bisection against `wrangler d1 execute --local`: around
119 KB it fails with a bare `SQLITE_TOOBIG`, and around 60 KB it succeeds.
Batching by row count does not work, because a `source_record_json` row is
kilobytes and a `lookup_form` row is bytes.

## Full release

Loading a full release into a deployed D1 is #18. This script is for
development only.
