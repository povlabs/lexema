# Run an archive seed

The development seed streams an archive through the parser, emits D1 SQL, and
loads a separate local D1 with Wrangler. The complete procedure and fixture
contract are in [`DEV_SEED.md`](DEV_SEED.md).

## Run it

Use the committed development fixture:

```sh
pnpm run seed:dev
```

To seed the full release without touching the demo database, set `SEED_INPUT`
and use a private SQL directory and Wrangler state path:

```sh
SEED_INPUT=it-extract.jsonl.gz \
SEED_SQL=.data/full-sql \
SEED_STATE=.data/full-state \
pnpm run seed:dev
```

The seeder reads the archive once, preserves each admitted source line and its
provenance, and writes the source, lookup, form-of, sense, and grammar rows in
foreign-key order. The SQL is about 1 GB, too big for Wrangler to read as one
file, so it is written as 64 MiB parts and applied in order
([DEV_SEED.md § Parts](DEV_SEED.md#parts)). Rejections go to `rejections.tsv`
in the SQL directory. It never seeds or writes the demo's `web/.wrangler`
database, and it clears no state directory except `SEED_STATE`.

On an Apple M1 Pro with 16 GB the full release takes about seven minutes and
peaks at about 2.8 GB of memory
([measurements](../reports/2026-09-23-full-release-seed-measurements.md)). It
ends by printing the loaded row counts: 560,357 `source_record` and 1,273,490
`lookup_form` rows for release `it-0c432803`.

## If a seed stops

The seed stops when a part fails to apply, or when the loaded database does not
match what was generated. Either way the state directory is not usable; what
each case leaves is in [DEV_SEED.md § Failure states](DEV_SEED.md#failure-states).

1. Read the error. It names the failing part and the parts already applied, or
   the tables and release fields that differed.
2. Fix the cause.
3. Seed again, into a new `SEED_STATE` path or the same one, which the seed
   clears before it loads.

Do not apply the remaining parts by hand: a part that failed may have applied
some of its statements.

## Load a release into Cloudflare D1

Production and every Preview read one shared dictionary D1,
`lexema-dictionary`, and code never writes to it
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)). A release goes
into it once, from Huey's laptop, where the archive lives. It is not a workflow,
since a workflow would need a Cloudflare token in GitHub.

The one run, for release `it-0c432803`:

1. Put `it-extract.jsonl.gz` in the repository root. Its durable copy is
   `source/` in `hueypov/lexema-data`. The Wiktionary dump beside it is read
   too when it is there, as for a local seed.
2. Sign Wrangler in to the Cloudflare account, once:
   `pnpm --dir web exec wrangler login`. The account must be on Workers Paid:
   the Free plan's per-database cap does not hold this release.
3. From the repository root, run:

   ```sh
   SEED_INPUT=it-extract.jsonl.gz \
   SEED_SQL=.data/full-sql \
   SEED_REMOTE=lexema-dictionary \
   pnpm run seed:dev
   ```

   If `pnpm --dir web exec wrangler whoami` lists more than one account, put
   the account id first. The seed runs Wrangler with `CI=1`, so Wrangler cannot
   ask which account, and the run stops at `wrangler d1 list`, before anything
   is written:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=<account id> \
   SEED_INPUT=it-extract.jsonl.gz \
   SEED_SQL=.data/full-sql \
   SEED_REMOTE=lexema-dictionary \
   pnpm run seed:dev
   ```

`SEED_REMOTE` names the remote D1; without it the seed stays local, as above.
With it, the seed:

- finds `lexema-dictionary`, and creates it with `wrangler d1 create` when it
  is absent;
- refuses the database if it already holds a table, before it reads the archive;
- applies the same 64 MiB parts in order, each with
  `wrangler d1 execute lexema-dictionary --remote --file`. The
  `seed SQL: <n> part(s)` line says how many; the count depends on whether the
  Wiktionary dump was read;
- runs the same row-count and `source_release` checks against the remote
  database, and only then marks the release `complete`.

It builds no app table there, and it never deletes or clears a database.
`SEED_STATE` is refused beside `SEED_REMOTE`, since a remote seed keeps no
local state.

On success it ends by printing the loaded counts, including 560,357
`source_record` and 1,273,490 `lookup_form` rows, then
`source_release: 1 row, complete`, and last:

```text
remote D1 lexema-dictionary database id: <id>
```

Paste that line as a comment on
[#172](https://github.com/hueypov/lexema/issues/172). Production's binding
([#19](https://github.com/hueypov/lexema/issues/19)) and the Previews' `DB`
binding use that id.

### If the upload stops

A run that did not print the database id line did not finish. If it stopped
before the first `part 1 of` line, no part was loaded: fix the cause and run the same
command again. Otherwise the remote database holds part of the release, or a
release marked `failed`, and is not usable. The error
names the failing part and the parts applied before it, or the tables and
release fields that differed.

1. Read the error and fix the cause.
2. Delete the database: `pnpm --dir web exec wrangler d1 delete lexema-dictionary`.
   The seed never does this for you.
3. Run the same command again. It creates the database afresh, with a new id;
   paste that one on #172.

Do not apply the remaining parts by hand, and do not run the seed again over
the old database: it refuses a database that already holds tables.

### Later releases

A later release is not uploaded again in full. Chosen changes from it are
applied to the same database: the steps are
[UPDATE_THE_DICTIONARY.md](UPDATE_THE_DICTIONARY.md), and why it works that way
is [UPDATES.md](UPDATES.md). The seed cannot load a second release over the
first, since it refuses a database with tables.

## Update glosses in a seeded database

The seed stores some source text rewritten by a fixed rule, a *source text
normalization* ([ADR 0019](../.decisions/0019-source-text-may-be-normalized.md)).
The first rewrites a gloss opening "1ª/2ª/3ª persona" as "prima/seconda/terza
persona" ([#257](https://github.com/hueypov/lexema/issues/257)). A database
seeded before a rule existed gets it from a one-off update, with no reseed:

```sh
pnpm run normalize:glosses
```

It picks its database the way the seed does: the local D1 under `SEED_STATE`
(default `.data/seed-state`), or the remote D1 `SEED_REMOTE` names. It rewrites
only `sense_gloss` rows the rule changes, never `source_record_json`, then reads
the rows back and fails if any still needs the rule. It ends by printing
`sense_gloss: <n> row(s) changed`. A second run changes 0 rows.

For the full local seed:

```sh
SEED_STATE=.data/full-state pnpm run normalize:glosses
```

For the shared `lexema-dictionary`, from Huey's laptop, signed in to Wrangler
as for the upload above:

```sh
SEED_REMOTE=lexema-dictionary pnpm run normalize:glosses
```

Put `CLOUDFLARE_ACCOUNT_ID=<account id>` first if Wrangler lists more than one
account. On release `it-0c432803` the first run prints
`sense_gloss: 177 row(s) changed`, and every later run prints 0. It writes
through Wrangler from the laptop, never through the Worker's read-only
binding.
