# Development seed

What `pnpm run seed:dev` ([`src/import/seedDev.ts`](../src/import/seedDev.ts))
reads, writes and covers. To run it, see
[RUN_THE_SITE.md](RUN_THE_SITE.md); why it works through generated SQL is in
[WEB.md](WEB.md).

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `SEED_RECORDS` | `25000` | records imported from the head of the archive |
| `SEED_RELEASE` | `it-dev` | release id written, and the value `LEXEMA_RELEASE` must match |

## Paths

| Path | Role |
|---|---|
| `it-extract.jsonl.gz` | input archive, repository root |
| `.data/dev.sqlite` | intermediate SQLite database; deleted at start, with `-wal` and `-shm` |
| `.data/dev.sql` | generated SQL; deleted at start |
| `web/.wrangler/state` | wrangler persist directory, passed absolute |
| `web/.wrangler/state/v3/d1` | local D1 database; **deleted at start** |

The generated SQL creates the schema and inserts the release, so loading it over
an existing seed collides on duplicate rows. Deleting the local D1 database
first is what makes the script repeatable.

## Coverage at the default

The seed is a **prefix of the archive, not a sample**: coverage stops at a
source line number rather than being spread across the alphabet.

| Fact | Value |
|---|---|
| Records | 25,000 |
| Last source line reached | 60,501 |
| Runtime | about 90 seconds |
| Generated SQL | about 142 MB |
| `lookup_form` rows | 186,830 |

Surfaces present at the default: `casa`, `case`, `sale`, `sala`, `salire`,
`studente`, `studenti`, `bella`, `bello`, `andare`, `andavano`, `città`,
`parlare`. Surfaces past line 60,501 are absent, and the page reports finding
nothing.

`SEED_RECORDS=560000` covers the whole release. The generated SQL is then
gigabytes and the loader is slow.

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
