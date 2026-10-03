# Page-only entry seed and readers

Under [ADR 0024](../.decisions/0024-italian-pages-the-extraction-skips-are-recovered.md), the seed stores page-only entries beside, never inside, `source_record` and
`source_record_json`. POS, definitions and examples retain revision/physical
line/verbatim wikitext evidence. No inflection table, pronunciation or etymology
is recovered. Page entries have separate `entryId` identities; API IDs use
`<release>:page:<revisionId>`, while archive IDs remain `<release>:<lineNo>`.

For a disposable local seed, follow [the import guide](../docs/RUN_AN_IMPORT.md)
with `SEED_INPUT=it-extract.jsonl.gz`, the verified dump in the repository root,
and a fresh local `SEED_STATE`; run `pnpm run seed:dev` without `SEED_REMOTE`.
The existing development fixture does not include the new form records; for a
small reproduction concatenate `fixtures/dev-seed.jsonl` and
`fixtures/page-entry-forms.jsonl` into a local input file and set `SEED_INPUT` to
it. Its pages are already committed under `fixtures/`.

**An already-seeded dictionary.** It lacks the four page-entry tables. Lookups
read which tables exist once per lookup, from `sqlite_schema`
(`dictionaryTables` in [served.ts](../src/lookup/served.ts)). Without the tables
they send no statement that names them and answer as before, with no page-only
entries. Some of the four without the rest is refused, not read as either.
`pnpm run update:upgrade` creates the tables empty and writes no row
([update the dictionary](UPDATE_THE_DICTIONARY.md#once-a-dictionary-seeded-from-an-older-schema));
serving does not need it. Loading the entries into a seeded dictionary is
[#440](https://github.com/hueypov/lexema/issues/440). The existing
update/feed-selection contracts are unchanged. Random selection still draws archive line numbers;
page-only entries are reachable by exact search and existing form-of links.
