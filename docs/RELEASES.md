# Updating the dictionary

How a new dictionary release goes live, and how to get back off it.

The rule the whole flow rests on: **one lookup is served entirely from one
release.** The Worker reads `LEXEMA_RELEASE`, and every query, count and
attribution line on the page comes from that release alone. There is no query
anywhere that spans two.

## What a release is

One imported source file. `source_release` pins which bytes it was
(`archive_sha256`, `archive_r2_key`), which normalizer produced its search keys,
and which importer and schema wrote it. Its `status` is the whole lifecycle:

| status | meaning | visible to readers |
| --- | --- | --- |
| `importing` | the import is running, or it crashed partway | no |
| `complete` | every line landed | yes, if `LEXEMA_RELEASE` names it |
| `superseded` | retired by hand after a newer one proved out | no |
| `failed` | written off | no |

Every canonical read filters on `status = 'complete'`, so a half-imported
release is unreachable rather than half-served. The status flip to `complete` is
the last write of the import transaction — that is what makes a crash safe.

Two releases live in the same database at once. `record_id` is one key space
across the whole file, so a second import counts up from where the first
stopped; within one release the ids still follow line order, which is what keeps
an import repeatable.

## Adding a release

A new release is staged next to the live one. Nothing about it is visible until
the activation step.

```sh
pnpm run import -- --input it-extract.jsonl.gz --database .data/lexema.sqlite \
  --release-id it-2026-09 --retrieved-at 2026-09-19T00:00:00Z
```

Re-using a release id is refused, and so is importing into a database built by a
different schema version. Both are how you lose a release you meant to keep.

## Checking it before it goes live

```sh
pnpm run release -- check --release-id it-2026-09 --against it-2026-07
```

The gate is `src/release/validate.ts`. It runs every check even after one fails,
so the output is the full list of what is wrong:

- **exists / complete** — the release is there and its import finished.
- **normalizer** — its search keys were built by the normalizer this build
  reads. A mismatch means every query misses, so `lookup()` refuses it outright.
- **schema** — its schema version matches this build.
- **not-empty** — it has records and lookup forms.
- **size** — it has at least 90% of the records the live release has. Releases
  drift between upstream dumps; losing a tenth of them is a broken import.
- **probe:…** — `sale`, `studenti`, `bella` and `casa` all still answer, through
  the real lookup path rather than a row count. Each is a known shape in the
  data, and a dropped table costs you one of these before it costs row count.

The checks run through `LookupDatabase`, so the same code judges a local SQLite
file and the real D1. Check the database you are about to activate, not a copy.

## Activating and rolling back

Activation is one variable. `web/wrangler.jsonc` sets `LEXEMA_RELEASE`; change
it and deploy. The flip is atomic per request — a request either ran entirely
against the old release or entirely against the new one.

Rollback is the same variable, set back. The old release is still `complete` and
still in the database, so nothing has to be rebuilt or re-imported.

There is no cache today. If one is added it must be keyed by release id, or a
rollback serves the new release's answers from the old release's page.

## Retiring an old release

Only once the new one has been live long enough to trust:

```sh
pnpm run release -- retire --release-id it-2026-07    # hide it
pnpm run release -- restore --release-id it-2026-07   # undo that
```

`retire` sets `superseded`, which hides the release from every read without
deleting a row. It does **not** check whether `LEXEMA_RELEASE` still points at
it — retiring the live release takes the site down, and `restore` is the way
back. Deleting a release for real is `DELETE FROM source_release WHERE
release_id = ?`; the foreign keys cascade the rest.

## Recovering from a bad import

| what happened | what you see | what to do |
| --- | --- | --- |
| import crashed partway | release stuck at `importing` | nothing is served from it. Delete the row and re-import; the cascade clears its children. |
| import finished but `check` fails | `FAIL` lines naming the check | leave `LEXEMA_RELEASE` alone. The live release is untouched. |
| activated and it is wrong | bad answers on the page | set `LEXEMA_RELEASE` back, deploy. |
| retired one you still needed | every query errors with `no complete release` | `restore` it, then set `LEXEMA_RELEASE` back. |

## The open problem: reviews across releases

`claim_review` hangs off `record_id`, and `record_id` belongs to one release.
Re-importing the same source file produces new `record_id`s, so reviews written
against the old release do not follow to the new one.

Nothing here solves that, and nothing here silently guesses at it either — a
review stays attached to the exact record and JSON pointer it was written about.
Carrying reviews across a re-import needs an identity that survives one, which
is #12's question, not this file's.
