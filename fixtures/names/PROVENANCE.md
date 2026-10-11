# Name entry fixtures

Inputs of [test/names.test.ts](../../test/names.test.ts) and of the dev seed's
name entries ([ADR 0032](../../.decisions/0032-wikidata-names-fill-proper-name-gaps.md), #794).

- `archive-lines.jsonl`: archive lines 1284 (`Iran`, a name with a meaning),
  21651 (`sale`, the salt noun) and 30901 (`Giulia`, a name whose one sense has
  no gloss) of release it-0c432803, verbatim.
- `dev-names.jsonl`: nine items of `names/wikidata-names.jsonl` as fetched on
  2026-10-11, verbatim, in its format: eight places, and one person, Alex
  Zanardi, from the QLever mirror. The dev seed writes them as `load:names`
  writes the snapshot: `Sale`, `Fine` and `Bella` are left out, because the
  fixture's words `sale`, `fine` and `bella` already answer their keys.
