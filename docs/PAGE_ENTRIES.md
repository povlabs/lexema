# Page-only entries

A page-only entry is an Italian word the archive has no record for, read from
its Wiktionary page by the rules of
[ADR 0024](../.decisions/0024-italian-pages-the-extraction-skips-are-recovered.md).
To build one in a local seed, see
[run an archive seed](RUN_AN_IMPORT.md#page-only-entries).

## What is stored

- The seed stores page-only entries in `recovered_entry`, `entry_definition`,
  `entry_label` and `entry_example`, beside `source_record` and
  `source_record_json`, never inside them.
- An entry holds its word, its part of speech, its definitions, and their labels
  and examples. Each fact keeps the page revision, its 1-based page line and that
  line's wikitext, verbatim.
- No inflection table, pronunciation or etymology is recovered.

## Identity

- A page-only entry has an `entryId`, never a `recordId`; a reading is exactly
  one of the two (`EntryIdentity` in [types.ts](../src/lookup/types.ts)).
- API ids are `<release>:page:<revisionId>`. Archive ids stay `<release>:<lineNo>`.
- A report names a source record or the word. A page-only entry is not offered
  as a reading to report, so its report is about the word.

## Corrected definitions

Some pages state a definition wrongly, and the rule reads them faithfully.
`grufolare` gives the sense of *grugnire*, and `tremare`'s first sense has no
verb ([#450](https://github.com/hueypov/lexema/issues/450)). These are fixed
by curated corrections, never by an edit of the entry:

- Each one is an entry of the committed list,
  [curatedCorrections.ts](../src/italian/curatedCorrections.ts). It names the
  page title and dump revision, the definition's place, its page line and the
  page's text, verbatim, plus the new wording and at least one cited revision.
  Huey approves the wording ([ADR 0008](../.decisions/0008-generated-explanations-are-labelled-and-reportable.md#amendments)).
- The seed writes it as a `corrected_definition` row beside the entry, and so
  does `load:page-entries` for each entry it
  [loads](#load-them-into-a-seeded-dictionary). A database that already holds
  the entry gets a later correction from `pnpm run correct:records`
  ([run an archive seed](RUN_AN_IMPORT.md#write-the-curated-corrections-into-a-seeded-database)).
  `entry_definition` keeps the page's own words.
- A lookup reads the new wording as the definition's `text`, and keeps the
  page's words in `correction.replaces`. The page shows only the wording, with
  no mark ([ADR 0016](../.decisions/0016-page-shows-no-origin-marks.md)).
- An entry read from another revision of the page, or a title with no entry,
  does not get the correction. The seed and `correct:records` report it as not
  written ([ADR 0025](../.decisions/0025-newer-source-definitions-are-authoritative.md)).

## Where it is reached

- Exact search and existing form-of links reach page-only entries.
- Random selection draws archive line numbers only.

## A dictionary without the tables

A dictionary seeded before these tables does not have them. Lookups read which
tables exist once per lookup, from `sqlite_schema` (`dictionaryTables` in
[served.ts](../src/lookup/served.ts)):

- Without the tables, lookups send no statement that names them, and answer as
  before, with no page-only entries.
- With some of the four but not all, lookups refuse to answer.
- `pnpm run update:upgrade` creates the tables and `corrected_definition`
  empty, and writes no row
  ([update the dictionary](UPDATE_THE_DICTIONARY.md#once-a-dictionary-seeded-from-an-older-schema)).
  Serving does not need it.
- `pnpm run load:page-entries` loads the entries
  ([below](#load-them-into-a-seeded-dictionary)).

## Load them into a seeded dictionary

`pnpm run load:page-entries` ([loadPageEntries.ts](../src/import/loadPageEntries.ts),
[#440](https://github.com/hueypov/lexema/issues/440)) gives a dictionary seeded
before these entries the rows a seed now writes for them, with no reseed:

- It reads the archive the master was seeded from (`SEED_INPUT`, default
  `it-extract.jsonl.gz`) only to check it is the master's, and that archive's
  dump (`RAW_PAGES`, default the dump in the repository root), checked by size
  and SHA-1.
- A title gets an entry by the seed's rule, read off the dictionary as it is
  now: a served record points at it with `form_of`, no record of any release
  spells it, hidden or replaced records included, and the rule reads its page
  as one Italian verb.
- For each entry it writes the `raw_page` row of its revision, the four tables'
  rows, the [corrected definitions](#corrected-definitions) the list gives it,
  and the `accent_fold` and `typo_key` rows of its word. It creates no table:
  `pnpm run update:upgrade` creates the tables and `corrected_definition`, and
  the load refuses to write without them. The dictionary deploy runs the
  upgrade itself first ([DEPLOY.md](DEPLOY.md#the-dictionary-deploy)).
- It touches no record, applied change or hide. `source_record_json` stays
  byte for byte.
- It writes one SQL file under `.data/updates/` and runs it as one transaction,
  then reads each entry back. An entry already held is left alone, so a second
  run writes nothing. `--plan-only` prints the counts and writes nothing.

On `it-0c432803` it loads the 14 entries of the
[measurement](../reports/2026-10-02-page-entry-recovery.md) and
`grufolare`'s and `tremare`'s corrected definitions.

### On the shared dictionary

The [dictionary deploy](DEPLOY.md#the-dictionary-deploy) runs the command when a
merged change declaration names it
([dictionary-changes/README.md](../dictionary-changes/README.md)). An agent runs
it against a local D1 only. One run does both halves, in this order:

1. **Data.** The deploy records a Time Travel bookmark and, when the tables
   are missing, runs the upgrade as its own transaction, which creates all four
   and `corrected_definition` at once, empty. A dictionary with the tables and
   no entries answers as one without them. The deploy then checks the plan's
   counts against the declaration, runs the rows as one transaction and reads
   them back. Then it looks up its fixed words, `raccontare` among them.
2. **Reader.** The deploy fast-forwards `production` to the merge, and Workers
   Builds uploads that commit's Worker, which reads the tables (since
   [#438](https://github.com/hueypov/lexema/pull/438)).

Until step 2, the Worker already deployed keeps serving. A Worker from before
#438 never names the tables, so it answers as before; a later one shows the
entries as soon as step 1 commits.

To undo the load, restore the bookmark the deploy run names, with the command
in its summary ([the dictionary deploy](DEPLOY.md#the-dictionary-deploy)). The
bookmark is from before the first write of that run, so the restore also undoes
any other declaration the same run wrote.

### How cached lookups move

The load does not change the served data identity: the release, the last
applied change and the hide and correction revisions stay the same. Card and
suggestion addresses move with the Worker version instead
([cache identity](DEPLOY.md#card-and-suggestion-cache-identity)). Step 2 uploads
a new version, so pages rendered after it ask for new addresses, and a cached
"not found" for `raccontare` is not used again. Between steps 1 and 2, the old
Worker keeps its old addresses, so a card it cached before the load can still
be served until step 2.
