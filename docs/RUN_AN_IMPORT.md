# Run an archive seed

The development seed streams an archive through the parser, emits D1 SQL, and
loads a separate local D1 with Wrangler. The complete procedure and fixture
contract are in [`DEV_SEED.md`](DEV_SEED.md).

## Run it

Use the committed development fixture:

```sh
pnpm run seed:dev
```

To seed another archive without touching the demo database, set `SEED_INPUT`
and use a private SQL and Wrangler state path:

```sh
SEED_INPUT=/path/to/it-extract.jsonl.gz \
SEED_SQL=.data/archive-seed.sql \
SEED_STATE=.data/archive-seed-state \
pnpm run seed:dev
```

The seeder reads the archive once, preserves each admitted source line and its
provenance, and writes the source, lookup, form-of, sense, and grammar rows in
foreign-key order. Rejections are written beside the generated SQL. It never
seeds or writes the demo's `web/.wrangler` database.

Loading a complete release into deployed D1 remains a separate release
operation.
