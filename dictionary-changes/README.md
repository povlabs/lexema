# Change declarations

Each `*.json` file here is one **change declaration**: one write to the shared
dictionary, its inputs, and the counts its plan is expected to have
([.glossary/TERMS.md](../.glossary/TERMS.md)). One file per change, so two pull
requests never edit one list. The parser is
[src/update/declaration.ts](../src/update/declaration.ts); it refuses a file it
cannot read as one, naming the file.

```json
{
  "command": "update:auto",
  "inputs": { "feedRelease": "it-78385b62" },
  "expected": {
    "records": { "added": 2, "changed": 2, "removed": 0 },
    "written": { "source_record": 4, "applied_change": 4 },
    "deleted": { "lookup_form": 3 }
  }
}
```

| `command` | `inputs` |
|---|---|
| `update:upgrade` | none |
| `update:auto` | `feedRelease`: the feed release id |
| `hide:records` | `archive`: the release id the master was seeded from; `rules`: every hiding rule |
| `normalize:source-text` | `rules`: every source text rule the command applies |
| `correct:records` | none: it writes the committed lists of curated corrections and hand-kept readings ([ADR 0031](../.decisions/0031-hand-kept-readings-fill-source-gaps.md)), and `expected` pins what those lists write ([RUN_AN_IMPORT.md](../docs/RUN_AN_IMPORT.md#write-the-curated-corrections-into-a-seeded-database)) |
| `load:page-entries` | `archive`: the release id the master was seeded from, whose dump the rule reads; `rules`: every page-entry and page-fact rule ([PAGE_ENTRIES.md](../docs/PAGE_ENTRIES.md#load-them-into-a-seeded-dictionary)) |
| `load:recovered-definitions` | `archive`: the release id the master was seeded from, whose records and dump the rules read; `rules`: `recovered-bullet-line/v1`, `recovered-prose-line/v1`, `recovered-verb-part/v1`, `recovered-every-route/v1` and `page-entry-definitions/v1`. It writes every definition a fresh seed recovers that the dictionary lacks, on every route a seed writes, record-backed and page-only, and removes a record's recovered definitions that sit in another record's verb-type part ([DEPLOY.md](../docs/DEPLOY.md#load-recovered-definitions)) |

`expected` is the `counts` object a plan-only run of the command prints
(`--plan-only`, [src/update/planOnly.ts](../src/update/planOnly.ts)). A table
left out of `written` or `deleted` is expected to have no row.

A change and its declaration land in one pull request. Add the declaration
with no `expected`, or with the counts you expect. The
[pull request plan check](../docs/DEPLOY.md#the-pull-request-plan-check)
plans it with the pull request's own code: green when the counts match, red
otherwise, printing the declaration with the plan's counts to copy in. Add
one declaration per pull request, since the check counts only the first.
This holds for `update:auto`, `hide:records`, `load:page-entries` and
`load:recovered-definitions` too: the
check reads their archive and dump from `povlabs/lexema-data` with a read-only
token.

The [monthly release](../docs/DEPLOY.md#the-monthly-release) writes one
`<release id>.json` here, an `update:auto` of the new kaikki release.

After a merge to `main`, the [dictionary deploy](../docs/DEPLOY.md#the-dictionary-deploy)
applies every declaration the merge adds, in the order their commits reached
`main`, and stops red when a plan's counts differ from `expected`. Changing or
deleting a declaration that is already deployed does nothing.

## Words the deploy looks up

A declaration may name up to 10 of its own words in `lookups`. After every
declaration is written and read back, the deploy looks each one up with the
site's own lookup, beside its fixed word list, and stops red before
`production` moves when one does not show what the item says:

```json
{
  "command": "correct:records",
  "lookups": [
    { "word": "mastoide" },
    { "word": "finora", "gloss": "fino" },
    { "word": "inesistentissimo", "found": false }
  ],
  "expected": { "records": { "added": 0, "changed": 2, "removed": 0 }, "written": { "corrected_claim": 3, "correction_version": 1 } }
}
```

| Item | Passes when the lookup |
|---|---|
| `{ "word": "mastoide" }` | finds the word, with at least one reading |
| `{ "word": "finora", "gloss": "fino" }` | finds it, and some definition of some reading holds the text: a sense's gloss, or a definition read from the page |
| `{ "word": "inesistentissimo", "found": false }` | does not find it |

`lookups` is optional. When present it lists 1 to 10 items, each with a
non-empty `word` the lookup accepts, and no word twice. `found` is `true` or
`false` (`true` when left out), and a `gloss` goes only on a found word. The
[pull request plan check](../docs/DEPLOY.md#the-pull-request-plan-check)
lists the words and keeps them in the file it prints, but does not look them
up, since the change is not written yet.
