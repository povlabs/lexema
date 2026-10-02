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

**Seed-only delivery.** An already-seeded dictionary lacks the four new tables
and rows. This change does not migrate/reseed it or choose an operational update;
a schema/data rollout must be arranged before deploying these readers to that
database. No shared D1 writes were performed. The existing update/feed-selection
contracts are unchanged. Random selection still draws archive line numbers;
page-only entries are reachable by exact search and existing form-of links.
