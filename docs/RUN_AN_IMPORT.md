# How to run an import

Turn the Italian archive into a local SQLite database. Why the importer behaves
the way it does is [IMPORT.md](IMPORT.md); this page is the operation.

## Before you start

- `it-extract.jsonl.gz` in the repository root.
- Roughly 1.5 GB free for the database, and a minute or two of runtime (66s for
  the full archive on the machine this was last measured on).

Both paths are gitignored: the archive because redistributing it is unsettled
(#6), the database because it is regenerated.

## Run it

```sh
pnpm run import -- --release-id it-2026-07-20 --force
```

Defaults read `it-extract.jsonl.gz` and write `.data/lexema.sqlite`.

## Flags

| Flag | What it does |
| --- | --- |
| `--release-id <id>` | Names the release row. Defaults to `it-local`; name the real dump when you mean to keep it. |
| `--input <path>` | The `.jsonl.gz` to read. Defaults to `it-extract.jsonl.gz`. |
| `--database <path>` | Where to write. Defaults to `.data/lexema.sqlite`. |
| `--force` | Delete an existing database first. Without it a second run fails, which is deliberate: silently overwriting an imported release is how you lose one you meant to keep. |
| `--limit <n>` | Stop after n admitted records, for a smoke run. The release ends as `partial` and no canonical read will serve it. |

`pnpm run import -- --help` prints the full list.

## Check the run worked

The summary ends with `status complete`. Anything else means the database is not
servable — see [IMPORT.md](IMPORT.md#what-a-run-reports) for what the counts
mean and what `partial` is for.

If the run stops with *"changed while it was being imported"*, something
rewrote the archive under it. Nothing was committed; run it again on a file
nobody is touching.

## Where it may not run

Per ADR 0004 (`.decisions/0004-cloudflare-workers-d1-vinext.md`) this never runs
inside a request. It is a plain Node program; the Worker only reads what it
produced.
