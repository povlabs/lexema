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

Loading a complete release into deployed D1 remains a separate release
operation.
