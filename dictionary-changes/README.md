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

`expected` is the `counts` object a plan-only run of the command prints
(`--plan-only`, [src/update/planOnly.ts](../src/update/planOnly.ts)). A table
left out of `written` or `deleted` is expected to have no row.
