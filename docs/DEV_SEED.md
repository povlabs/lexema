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

## The prefix archive

The seed cuts the first `SEED_RECORDS` records into `.data/it-dev.jsonl.gz` and
imports that file whole, without `limit`. The release is `complete`, and its
`archive_sha256` and `archive_bytes` describe the prefix file. Why the seed is
shaped this way is [WEB.md](WEB.md#why-the-seed-is-a-prefix-file-not-a-limited-import);
[`test/seedComposition.test.ts`](../test/seedComposition.test.ts) pins the
composition.

The cut counts records with the importer's own admission test
(`admitsRecord`, [`src/import/importRelease.ts`](../src/import/importRelease.ts)),
so the prefix holds exactly `SEED_RECORDS` records and not merely that many
lines. Line numbers and record ids are unchanged by the cut: both count from
the start of the file, and the prefix starts where the archive does.

## Coverage at the default

The seed is a **prefix of the archive, not a sample**: coverage stops at a
source line number rather than being spread across the alphabet.

Surfaces present at the default: `casa`, `case`, `sale`, `sala`, `salire`,
`studente`, `studenti`, `bella`, `bello`, `andare`, `andavano`, `città`,
`parlare`. Surfaces past the cutoff are absent, and the page reports finding
nothing.

How many records that is, which source line it stops at, how long it takes and
how much SQL it writes are measurements, and they live in
[the dated report](../reports/2026-09-21-web-page-measurements.md#the-development-seed-at-its-default).

The archive holds **560,357** admitted records
([import measurements](../reports/2026-09-21-import-measurements.md)), so
`SEED_RECORDS=560357` takes every one of them: the cut stops on the line that
carries the last record, and any larger value reports the archive exhausted. The
generated SQL is then gigabytes and the loader is slow.

## What the seed writes that the importer does not

After the import, the seed writes the review verdicts in
[`src/import/knownDisputes.ts`](../src/import/knownDisputes.ts) into
`claim_review` — today, the one on the `studente` verb record that
[the source research](../reports/2026-09-18-source-research.md) contradicts.

A dispute whose record is past the prefix cutoff writes nothing, and the seed
says so on its own line. Why verdicts are written after the import rather than
by it is in [WEB.md](WEB.md#why-a-disputed-claim-is-a-row-and-not-a-code-path).

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
