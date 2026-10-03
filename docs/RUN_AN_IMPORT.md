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

## Normalize source text in a seeded database

The seed stores some source text rewritten by a fixed rule, a *source text
normalization* ([ADR 0019](../.decisions/0019-source-text-may-be-normalized.md)).
One rewrites a gloss opening "1ª/2ª/3ª persona" as "prima/seconda/terza
persona" ([#257](https://github.com/hueypov/lexema/issues/257)). Another drops
a `forms[]` entry spelled exactly "inserisci qui voce al plurale",
Wikizionario's empty plural template, so it is no searchable form and no row in
a forms table ([#342](https://github.com/hueypov/lexema/issues/342)). A third,
rule `it-gloss-stamp/v1`
([#317](https://github.com/hueypov/lexema/issues/317)), takes a gender and
number stamp off the end of a noun or adjective gloss (`casa ( approfondimento) f sing`)
and states it as the record's gender and number. A fourth, rule
`gloss-headword-lead/v1` ([#325](https://github.com/hueypov/lexema/issues/325)),
stores a gloss the headword line leads (`palo ( approfondimento) pezza
onorevole…`) as the definition after the link; a bare headword line stays as
written. A database seeded before a rule existed gets it from a one-off update,
with no reseed:

```sh
pnpm run normalize:source-text
```

It picks its database the way the seed does: the local D1 under `SEED_STATE`
(default `.data/seed-state`), or the remote D1 `SEED_REMOTE` names. It rewrites
only the `sense_gloss` rows a rule changes, and removes only the `lookup_form`
rows of a dropped form with the `grammar_claim` rows about that form. The stamp
rule reads each candidate record's raw line the way the seed does, trims or
drops the stamped gloss, adds the stated `grammar_claim` rows, and removes the
`missing` gender and number rows they answer. It never touches
`source_record_json`. It reads the rows back and fails if any still needs a
rule. It prints one line per rule, led by the rule's name and version:
`gloss-headword-lead/v1: sense_gloss: <n> row(s) changed`,
`gloss-person-ordinal/v1: sense_gloss: <n> row(s) changed`,
`form-plural-placeholder/v1: lookup_form: <n> row(s) removed, grammar_claim: <n> row(s) removed`
and `it-gloss-stamp/v1: sense_gloss: <n> row(s) changed, grammar_claim: <n> row(s) changed`.
The seed prints the first three ids on its `source text rules:` line; the stamp
rule is the importer's grammar policy
([grammarPolicy.ts](../src/import/grammarPolicy.ts)). A second run changes 0
rows.

For the full local seed:

```sh
SEED_STATE=.data/full-state pnpm run normalize:source-text
```

For the shared `lexema-dictionary`, from Huey's laptop, signed in to Wrangler
as for the upload above:

```sh
SEED_REMOTE=lexema-dictionary pnpm run normalize:source-text
```

Put `CLOUDFLARE_ACCOUNT_ID=<account id>` first if Wrangler lists more than one
account. On release `it-0c432803`, a database seeded before all three rules
prints `gloss-person-ordinal/v1: sense_gloss: 177 row(s) changed`,
`form-plural-placeholder/v1: lookup_form: 110 row(s) removed, grammar_claim: 111 row(s) removed`
and `it-gloss-stamp/v1: sense_gloss: 9 row(s) changed, grammar_claim: 30 row(s) changed`
(8 nouns: 16 stated claims added, 14 `missing` rows removed) on the first run,
and 0 on every later run. It writes through Wrangler from the laptop, never
through the Worker's read-only binding.

## Hide another language's records in a seeded database

The seed hides a record the archive tags Italian that is another language's, by
two rules ([ADR 0023](../.decisions/0023-foreign-records-are-hidden-not-deleted.md)):
`section-language/v1` reads it off the raw page, where another language's entry
sits under the Italian heading
([#382](https://github.com/hueypov/lexema/issues/382)), and
`form-of-foreign-lemma/v1` reads it off the archive, where a foreign record lists
the word among its forms ([#389](https://github.com/hueypov/lexema/issues/389)).
A database seeded before either gets the same records hidden by a one-off
update, with no reseed. Before a live hide, deploy the reader described in
[Card and suggestion cache identity](DEPLOY.md#card-and-suggestion-cache-identity),
which also explains compatibility with older masters and cache verification:

```sh
pnpm run hide:records
```

It needs `it-extract.jsonl.gz` and `itwiktionary-20260701-pages-articles.xml.bz2`
in the repository root (`SEED_INPUT` and `RAW_PAGES` name other copies). It
refuses an archive whose SHA-256 is not the one the database was seeded from,
and a dump whose size and SHA-1 are not the archive's dump. It picks its
database the way the seed does: the local D1 under `SEED_STATE` (default
`.data/seed-state`), or the remote D1 `SEED_REMOTE` names.

It writes one SQL file under `.data/updates/` and runs it as one transaction:
each record gets its `hidden_record` row and loses its `lookup_form` and
`form_of_edge` rows, and the nearby rows of the words they spelled are
recomputed. A `hidden_record` table written before #389 is rebuilt first in the
same transaction, every row kept, and the run says so. `source_record_json` is not touched. It then reads the records back
and fails if one is not hidden. It takes about a minute.

For the shared `lexema-dictionary`, from Huey's laptop, signed in to Wrangler
as for the upload above:

```sh
SEED_REMOTE=lexema-dictionary pnpm run hide:records
```

Put `CLOUDFLARE_ACCOUNT_ID=<account id>` first if Wrangler lists more than one
account. On release `it-0c432803` the rules find 30 records:
`30 record(s) the rules find (form-of-foreign-lemma/v1 7, section-language/v1 23)`.
On a database #382's run already updated, the run hides the 7, rebuilds the
table, and prints `23 already hidden; hidden now: 7`, one line per record, and
`rows deleted: lookup_form 7, form_of_edge 7`. On one seeded before #382 it
hides all 30. Every later run prints `30 already hidden; nothing to hide`.

## Write the curated corrections into a seeded database

A curated correction sets right a gender or number the source states wrongly,
checked by hand against a cited Wiktionary revision
([#420](https://github.com/hueypov/lexema/issues/420)). The committed list is
[`src/italian/curatedCorrections.ts`](../src/italian/curatedCorrections.ts):
each entry names its record by release, archive line and line digest, the
source text it overrides, and its evidence. The seed writes each entry keyed to
its release as `corrected_claim` rows beside the record. A database seeded
before an entry gets it by a one-off update, with no reseed and no archive:

```sh
pnpm run correct:records
```

It picks its database the way the seed does: the local D1 under `SEED_STATE`
(default `.data/seed-state`), or the remote D1 `SEED_REMOTE` names. It writes
one SQL file under `.data/updates/` and runs it as one transaction: it creates
`corrected_claim` and `correction_version` when the master lacks them, writes
each entry's rows, and increments the correction revision, so card and
suggestion addresses move ([cache identity](DEPLOY.md#card-and-suggestion-cache-identity)).
`source_record_json` and `grammar_claim` are not touched. It then reads the rows
back and fails if one differs. It prints one line per entry: written, already
written, or why not. An entry is not written when the master holds no record at
its line, when that record's digest is not the one the entry names, or when a
later release's change replaced the record: a correction never passes to a
replacing record, whose source may say something else, so the run names the
change and the replacing record to check against the entry's evidence.
`update:apply` and `update:auto` print the same for a correction on a record
they retire.

For the shared `lexema-dictionary`, from Huey's laptop, signed in to Wrangler
as for the upload above, once the Worker that reads corrections is deployed:

```sh
SEED_REMOTE=lexema-dictionary pnpm run correct:records
```

Put `CLOUDFLARE_ACCOUNT_ID=<account id>` first if Wrangler lists more than one
account. On `it-0c432803` the first run prints `written now: 12` and one line
per entry, 14 rows in all (`congiuntivi` and `maniaci` set gender and number).
Every later run prints `nothing to write` and `already written` for each. An
older Worker serves the master as before, since it never reads the new tables;
the deployed one reads no correction from a master without them.
