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

**An already-seeded dictionary.** It lacks the four page-entry tables, and the
readers fail on every lookup until it has them. `pnpm run update:upgrade`
creates them empty, with the update tables and views, and writes no row
([update the dictionary](UPDATE_THE_DICTIONARY.md#once-a-dictionary-seeded-from-an-older-schema)).
Run it before these readers serve from that database; lookups then answer as
before, with no page-only entries. Loading the entries into a seeded dictionary
is [#440](https://github.com/hueypov/lexema/issues/440). The existing
update/feed-selection contracts are unchanged. Random selection still draws archive line numbers;
page-only entries are reachable by exact search and existing form-of links.
