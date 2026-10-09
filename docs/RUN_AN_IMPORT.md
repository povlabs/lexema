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
and use a private SQL directory and Wrangler state path. The seed reads only
the path it is given, so first fetch the archive and its dump from
`povlabs/lexema-data` into the source cache, `.data/source/`, where both are
checked ([sourceCache.ts](../src/source/sourceCache.ts)):

```sh
pnpm run source:fetch
SEED_INPUT=.data/source/it-extract.jsonl.gz \
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

On an Apple M1 Pro with 16 GB the full release takes nine to ten minutes and
peaks at 3.4 to 3.7 GB of memory, with the Wiktionary dump in the repository
root; those figures include reading the dump's raw pages
([measurements](../reports/2026-10-04-full-release-seed-on-main.md)). It ends
by printing the loaded row counts: 560,357 `source_record` and 1,273,350
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
`lexema-dictionary`, and the Worker never writes to it
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)). A release goes
into it once, from Huey's laptop, where the archive lives. It is not a workflow:
the [dictionary deploy](DEPLOY.md#the-dictionary-deploy) applies only the
changes a merge declares.

The one run, for release `it-0c432803`:

1. Run `pnpm run source:fetch`. It fetches `it-extract.jsonl.gz` and the
   Wiktionary dump it was built from out of `source/` in `povlabs/lexema-data`
   into `.data/source/`, and checks both. The seed reads the dump from there,
   as a local seed does.
2. Sign Wrangler in to the Cloudflare account, once:
   `pnpm --dir web exec wrangler login`. The account must be on Workers Paid:
   the Free plan's per-database cap does not hold this release.
3. From the repository root, run:

   ```sh
   SEED_INPUT=.data/source/it-extract.jsonl.gz \
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
   SEED_INPUT=.data/source/it-extract.jsonl.gz \
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
`source_record` and 1,273,350 `lookup_form` rows, then
`source_release: 1 row, complete`, and last:

```text
remote D1 lexema-dictionary database id: <id>
```

Paste that line as a comment on
[#172](https://github.com/povlabs/lexema/issues/172). Production's binding
([#19](https://github.com/povlabs/lexema/issues/19)) and the Previews' `DB`
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
persona" ([#257](https://github.com/povlabs/lexema/issues/257)). Another drops
a `forms[]` entry spelled exactly "inserisci qui voce al plurale",
Wikizionario's empty plural template, so it is no searchable form and no row in
a forms table ([#342](https://github.com/povlabs/lexema/issues/342)). A third,
rule `it-gloss-stamp/v1`
([#317](https://github.com/povlabs/lexema/issues/317)), takes a gender and
number stamp off the end of a noun or adjective gloss (`casa ( approfondimento) f sing`)
and states it as the record's gender and number. A fourth, rule
`gloss-headword-lead/v1` ([#325](https://github.com/povlabs/lexema/issues/325)),
stores a gloss the headword line leads (`palo ( approfondimento) pezza
onorevole…`) as the definition after the link; a bare headword line stays as
written. A fifth, rule `rendered-label-punctuation/v1`
([#712](https://github.com/povlabs/lexema/issues/712)), stores a definition
read off a page without the comma, semicolon or colon that only separated its
usage labels (`{{Term|matematica|it}}, {{Term|aritmetica|it}} [[numero]]…` is
`numero…`), as the renderer now prints it
([wikitext.ts](../src/italian/wikitext.ts), `renderInline`). A database seeded
before a rule existed gets it from a one-off update, with no reseed:

```sh
pnpm run normalize:source-text
```

It picks its database the way the seed does: the local D1 under `SEED_STATE`
(default `.data/seed-state`), or the remote D1 `SEED_REMOTE` names. It plans
every rule into one SQL file under `.data/updates/` and runs that file in one
step, so a run that stops leaves the database as it was; a later rule reads the
glosses an earlier one rewrites from the plan. It rewrites
only the `sense_gloss` rows a rule changes, and removes only the `lookup_form`
rows of a dropped form with the `grammar_claim` rows about that form. The stamp
rule reads each candidate record's raw line the way the seed does, trims or
drops the stamped gloss, adds the stated `grammar_claim` rows, and removes the
`missing` gender and number rows they answer. The label rule renders the page
line each `recovered_definition`, `recovered_example`, `entry_definition` and
`entry_example` row keeps in `wikitext` again, and rewrites `text` only where
it still holds what the renderer printed before #712; labels and every other
column stay. It never touches
`source_record_json`. It reads the rows back and fails if any still needs a
rule. It prints one line per rule, led by the rule's name and version:
`gloss-headword-lead/v1: sense_gloss: <n> row(s) changed`,
`gloss-person-ordinal/v1: sense_gloss: <n> row(s) changed`,
`form-plural-placeholder/v1: lookup_form: <n> row(s) removed, grammar_claim: <n> row(s) removed`,
`it-gloss-stamp/v1: sense_gloss: <n> row(s) changed, grammar_claim: <n> row(s) changed`
and `rendered-label-punctuation/v1: recovered_definition: <n> row(s) changed, …`.
The seed prints the first three ids on its `source text rules:` line; the stamp
rule is the importer's grammar policy
([grammarPolicy.ts](../src/import/grammarPolicy.ts)). A second run changes 0
rows. `pnpm run normalize:source-text --plan-only` is a plan-only run: it
writes the file and prints its counts as JSON, and runs nothing on the
database. `hide:records`, `correct:records`, `load:page-entries`, `update:auto`
and `update:upgrade` take the same flag
([src/update/planOnly.ts](../src/update/planOnly.ts)).

For the full local seed:

```sh
SEED_STATE=.data/full-state pnpm run normalize:source-text
```

On the shared `lexema-dictionary`, the dictionary deploy workflow runs the
command after a merged change declaration names it
([dictionary-changes/README.md](../dictionary-changes/README.md),
[The dictionary deploy](DEPLOY.md#the-dictionary-deploy)). An agent runs it
against a local D1 only. On release `it-0c432803`, a database seeded before
all three rules prints `gloss-person-ordinal/v1: sense_gloss: 177 row(s) changed`,
`form-plural-placeholder/v1: lookup_form: 110 row(s) removed, grammar_claim: 111 row(s) removed`
and `it-gloss-stamp/v1: sense_gloss: 9 row(s) changed, grammar_claim: 30 row(s) changed`
(8 nouns: 16 stated claims added, 14 `missing` rows removed) on the first run,
and 0 on every later run. A seed of it and its dump from before #712 holds 7
`recovered_definition` and 4 `entry_definition` rows the label rule rewrites,
and none of the two example tables. It writes through Wrangler, never through the
Worker's read-only binding.

## Hide another language's records in a seeded database

The seed hides a record the archive tags Italian that is another language's, by
two rules ([ADR 0023](../.decisions/0023-foreign-records-are-hidden-not-deleted.md)):
`section-language/v1` reads it off the raw page, where another language's entry
sits under the Italian heading
([#382](https://github.com/povlabs/lexema/issues/382)), and
`form-of-foreign-lemma/v1` reads it off the archive, where a foreign record lists
the word among its forms ([#389](https://github.com/povlabs/lexema/issues/389)).
A database seeded before either gets the same records hidden by a one-off
update, with no reseed. Before a live hide, deploy the reader described in
[Card and suggestion cache identity](DEPLOY.md#card-and-suggestion-cache-identity),
which also explains compatibility with older masters and cache verification:

```sh
pnpm run hide:records
```

It reads the master's `it-extract.jsonl.gz` and
`itwiktionary-20260701-pages-articles.xml.bz2` from the source cache,
`.data/source/`, and fetches either one from `povlabs/lexema-data` when the
cache lacks it (`SEED_INPUT` and `RAW_PAGES` name other copies). It
refuses an archive whose SHA-256 is not the one the database was seeded from,
and a dump whose size and SHA-1 are not the archive's dump. It picks its
database the way the seed does: the local D1 under `SEED_STATE` (default
`.data/seed-state`), or the remote D1 `SEED_REMOTE` names.

It writes one SQL file under `.data/updates/` and runs it as one transaction:
each record gets its `hidden_record` row and loses its `lookup_form` and
`form_of_edge` rows, and the nearby rows of the words they spelled are
recomputed. The file holds no DDL: on a database without `hidden_record` or
`hide_version`, or with a `hidden_record` written before #389, the command
refuses to write and names `pnpm run update:upgrade`, which creates or rebuilds
them, every row kept. `source_record_json` is not touched. It then reads the records back
and fails if one is not hidden. It takes about a minute.

On the shared `lexema-dictionary`, the dictionary deploy workflow runs the
command after a merged change declaration names it
([dictionary-changes/README.md](../dictionary-changes/README.md),
[The dictionary deploy](DEPLOY.md#the-dictionary-deploy)). An agent runs it
against a local D1 only. On release `it-0c432803` the rules find 30
records:
`30 record(s) the rules find (form-of-foreign-lemma/v1 7, section-language/v1 23)`.
On a database #382's run already updated, `update:upgrade` rebuilds the table
first; the run then hides the 7 and prints `23 already hidden; hidden now: 7`, one line per record, and
`rows deleted: lookup_form 7, form_of_edge 7`. On one seeded before #382 it
hides all 30. Every later run prints `30 already hidden; nothing to hide`.

## Write the curated corrections into a seeded database

A curated correction sets right a gender or number the source states wrongly,
checked by hand against a cited Wiktionary revision
([#420](https://github.com/povlabs/lexema/issues/420)). The committed list is
[`src/italian/curatedCorrections.ts`](../src/italian/curatedCorrections.ts):
each entry names its record by release, archive line and line digest, the
source text it overrides, and its evidence. The seed writes each entry keyed to
its release as `corrected_claim` rows beside the record. An entry may instead
set cells of a verb's conjugation table, each named by its place in `forms[]`
and the text the line holds there
([ADR 0030](../.decisions/0030-corrections-may-fix-edges-and-cells.md),
[#723](https://github.com/povlabs/lexema/issues/723)); the seed writes those
as `corrected_form` rows, one per cell, and refuses an entry that misquotes its
line. Each row carries its spelling's search key, so a search finds the corrected
spelling, `siamo assorbiti`, beside the source's, which `lookup_form` keeps
([#743](https://github.com/povlabs/lexema/issues/743)). The list also sets a
sense's `form_of` edge where the source states none or names the wrong word
([ADR 0030](../.decisions/0030-corrections-may-fix-edges-and-cells.md),
[#722](https://github.com/povlabs/lexema/issues/722)): `aerei`'s noun sense
gets an edge to `aereo`, and `parti`'s two lines about `parto` name it in
place of `neonato` and `Parti`. Each cites two it.wiktionary pages, at the
revisions in the dump the archive was extracted from: the record's own, whose
gloss names the word after "di", and that word's, whose forms table lists the
record's word. Rule `it-form-of-gloss-edge/v2` makes most of them: it adds
the missing edges v1 added
([report](../reports/2026-10-08-form-of-gloss-edges.md)), and replaces each
edge that names another word, `porta`'s `presente` with `portare`
([#733](https://github.com/povlabs/lexema/issues/733),
[report](../reports/2026-10-09-form-of-gloss-edges-v2.md)). Rule
`it-form-of-meaning-edge/v1` removes the edge of a meaning sense, whose gloss
names no form, citing the record's own page, or points it at the record's own
base word where a real form sense names one: `mele`'s "percosse" reads
`mela`, and `scandinava`'s "relativa alla Scandinavia" no edge
([#755](https://github.com/povlabs/lexema/issues/755),
[report](../reports/2026-10-09-form-of-meaning-edges.md)). The seed writes each
as a `corrected_edge` row with its links, a removal's naming no word, and a
lookup reads it in place of the sense's own edges. A hidden record gets none.
An entry may also hide one recovered definition whose line states no
dictionary word, `diplomatizzare`'s keyboard test text `hhhhhhhh`
([#773](https://github.com/povlabs/lexema/issues/773)): it names the line by
its place on the record's own page, with its wikitext and text, and cites that
page's revision and Huey's ruling. The seed writes it as a
`hidden_recovered_definition` row only where the record's recovered definition
at that line, from that revision, is the one it quotes, and reports it
otherwise; a lookup then reads the record as having no such definition. A
database seeded
before an entry gets it by a one-off update, with no reseed and no archive:

```sh
pnpm run correct:records
```

It picks its database the way the seed does: the local D1 under `SEED_STATE`
(default `.data/seed-state`), or the remote D1 `SEED_REMOTE` names. It writes
one SQL file under `.data/updates/` and runs it as one transaction: it writes
each entry's rows, and increments the correction revision, so card and
suggestion addresses move ([cache identity](DEPLOY.md#card-and-suggestion-cache-identity)).
`source_record_json`, `grammar_claim`, `lookup_form`, `form_of_edge` and the
`recovered_*` rows are not touched. The file holds no DDL: on a master without
`corrected_claim`, `corrected_form`, `corrected_edge`,
`hidden_recovered_definition`, `correction_version` or
`corrected_definition`, or with a `corrected_form` from before its
`surface_key`, the command refuses to write and names
`pnpm run update:upgrade`, which creates them and keys the cells. It then reads the rows
back and fails if one differs. It prints one line per entry: written, already
written, or why not. An entry is not written when the master holds no record at
its line, when that record's digest is not the one the entry names, or when a
later release's change replaced the record: a correction never passes to a
replacing record, whose source may say something else, so the run names the
change and the replacing record to check against the entry's evidence.
`update:apply` and `update:auto` print the same for a correction on a record
they retire. `pnpm run correct:records --plan-only` writes the file and prints
its counts as JSON, with one line per entry under `entries`, and runs nothing
on the database.

The same run writes definition corrections: a page-only entry's definition the
page states wrongly ([#450](https://github.com/povlabs/lexema/issues/450),
[page-only entries](PAGE_ENTRIES.md#corrected-definitions)). Each is one
`corrected_definition` row, created with its table when the master lacks it.
`entry_definition` is not touched. It is written only to the master's entry of
the page title that was read from the revision the correction names, where the
definition at its place is the line and text it quotes. Otherwise the run
prints why not: the master holds no entry of that title, its entry was read
from another revision, or the definition differs. The plan's counts name its
`corrected_definition` rows; a definition entry changes no record.

On the shared `lexema-dictionary`, the dictionary deploy workflow runs the
command after a merged change declaration names it
([dictionary-changes/README.md](../dictionary-changes/README.md),
[The dictionary deploy](DEPLOY.md#the-dictionary-deploy)). An agent runs it
against a local D1 only. The declaration has no inputs: it writes the list as
it stands at the deploy's commit, and its `expected` counts pin what that list
writes. A new correction reaches the shared dictionary in one pull request:

1. The pull request adds the entry to the list and a declaration
   `{"command": "correct:records"}` under `dictionary-changes/`, with no
   `expected` yet.
2. The [pull request plan check](DEPLOY.md#the-pull-request-plan-check) plans
   it with the pull request's own code, goes red and prints the declaration
   with its `expected` counts. Copy it into the file and push; the check then
   goes green.
3. Its merge writes the correction. The deploy plans it again and stops red
   if the counts no longer match.

Add one declaration per pull request: the check counts only the first
declaration a pull request adds.

Deploy the Worker that reads corrections before the first such declaration. On
`it-0c432803` the first run prints `written now: 252` and one line per entry,
288 rows in all: the 20 hand entries write 22 (`congiuntivi` and `maniaci` set
gender and number), and the 232 that rule `it-plural-gloss-number/v3` makes
([#483](https://github.com/povlabs/lexema/issues/483),
[#515](https://github.com/povlabs/lexema/issues/515),
[#516](https://github.com/povlabs/lexema/issues/516)) write 266 (34 set
gender and number). On a master that already holds the 20 hand entries of
[#420](https://github.com/povlabs/lexema/issues/420) and
[#449](https://github.com/povlabs/lexema/issues/449) and the 195 v2 made, it
prints `written now: 37` and `already written` for the 215. Every later run prints
`nothing to write` and `already written` for each. Before a master holds
page-only entries, the two definition corrections print `not written; the master holds no page-only entry`.
[Loading the entries](PAGE_ENTRIES.md#load-them-into-a-seeded-dictionary)
writes them with the entries, as a seed does, so a run after the load prints
`already written` for both. An
older Worker serves the master as before, since it never reads the new tables;
the deployed one reads no correction from a master without them.

## Page-only entries

The seed also stores page-only entries: it reads every raw page whose title no
Italian record spells, whether or not a form names it, and keeps the pages with
a ruled Italian layout (ADR 0024, ADR 0028). On the full release and the July
dump that is 186 pages and 203 entries
([page-only entries](PAGE_ENTRIES.md)): the 185 pages and 202 entries of the
[measurement](../reports/2026-10-03-unrecorded-page-layouts.md#what-the-production-rule-recovers),
which predates [#495](https://github.com/povlabs/lexema/issues/495), and
`Aglio`, which the rule reads since #495.
A small fixture has records for few words, so a plain `.jsonl` input offers
only the release's record-less titles, not every page it lacks a record for
([development seed](DEV_SEED.md#what-is-emitted)). What the seed
stores is in [page-only entries](PAGE_ENTRIES.md). To see them in a disposable
local seed:

1. For the full release, fetch the verified dump into the source cache with
   `pnpm run source:fetch`, and run the full-release command in [Run it](#run-it) with a fresh
   `SEED_STATE`. Leave `SEED_REMOTE` unset.
2. For a small reproduction, join the development fixture and the two form
   records that point at page-only entries into one local file, and seed it.
   Their pages are already committed under `fixtures/`.

   ```sh
   cat fixtures/dev-seed.jsonl fixtures/page-entry-forms.jsonl > .data/page-entry-input.jsonl
   SEED_INPUT=.data/page-entry-input.jsonl \
   SEED_SQL=.data/page-entry-sql \
   SEED_STATE=.data/page-entry-state \
   pnpm run seed:dev
   ```

3. Search for `raccontare` or `fornire`, or for the forms `racconto` and
   `fornito`, which lead to them.

A database seeded before these entries gets them from
`pnpm run load:page-entries`, with no reseed
([load them into a seeded dictionary](PAGE_ENTRIES.md#load-them-into-a-seeded-dictionary)).
