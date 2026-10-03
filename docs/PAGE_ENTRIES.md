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
- `pnpm run update:upgrade` creates the tables empty and writes no row
  ([update the dictionary](UPDATE_THE_DICTIONARY.md#once-a-dictionary-seeded-from-an-older-schema)).
  Serving does not need it.
- Loading entries into a seeded dictionary is
  [#440](https://github.com/hueypov/lexema/issues/440).
