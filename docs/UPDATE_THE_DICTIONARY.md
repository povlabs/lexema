# Update the dictionary from a later kaikki release

Apply eligible newer source definitions automatically to the master, without
rebuilding it. [UPDATES.md](UPDATES.md) explains the design and ordering checks;
[ADR 0025](../.decisions/0025-newer-source-definitions-are-authoritative.md)
governs source trust. Do not review every changed word or inspect source
history routinely. Investigate accuracy when a user reports a problem.

## Before you start

- Keep the later archive and the Wiktionary dump its build log names. Fetch
  using [REFETCH_A_RELEASE.md](REFETCH_A_RELEASE.md), preserving headers,
  checksum and build log. A release id is a hash, not a date. A changed
  download timestamp alone does not establish newer source content.
- Ensure checksum-bound archive facts exist in
  [archiveFacts.ts](../src/source/archiveFacts.ts) and the dump's size and SHA-1
  in [KNOWN_DUMPS](../src/source/wiktionaryDump.ts). Unknown ordering, regressive
  input and distinct archives from one dump are refused, not guessed.
- Commands default to the local D1 under `SEED_STATE` (default
  `.data/seed-state`). `SEED_REMOTE` names a remote database. They run through
  Wrangler, never the Worker's read-only dictionary binding
  ([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)).
- CI writes the shared `lexema-dictionary`. The dictionary deploy workflow
  applies a change after a reviewed merge to `main` declares it, with the one
  D1 Edit Cloudflare token ADR 0018 allows. It fetches the archive and dump from
  `hueypov/lexema-data` with its own read-only token; only the monthly release
  job holds the token that writes that repository. Its steps, secrets and
  settings are [the dictionary deploy](DEPLOY.md#the-dictionary-deploy).
- Agents never hold the Cloudflare key, run the deploy workflow, or write the
  shared dictionary. An agent runs these commands against the local D1 only.

## Once: a dictionary seeded from an older schema

Before new lookup code serves an old dictionary lacking `served_release` (#18),
run:

```sh
pnpm run update:upgrade
```

This adds the update tables and views, and the empty page-entry tables (#403),
without writing records. It names what it adds; running it again changes
nothing. The first apply also upgrades, but lookups need the views before any
change is applied. Lookups do not need the page-entry tables
([a dictionary without them](PAGE_ENTRIES.md#a-dictionary-without-the-tables)).

## 1. Keep a restore point

Copy the local `SEED_STATE` directory. For the shared dictionary, the deploy
workflow records the D1 Time Travel bookmark in its run before it writes.

## 2. Run the automatic operation

```sh
pnpm run update:auto <later.jsonl.gz> --pages <its-dump.xml.bz2>
```

Only the deploy workflow runs it with `SEED_REMOTE=lexema-dictionary`. No
person supplies word ids or inspects old/new reports. The command compares
against currently served records, verifies source ordering and the language
dump, selects with `feed-selection/v4`, and plans through the existing importer.
Ambiguous groups, hidden/non-Italian exclusions, new-word form-of checks and
whole-record disappearance remain safeguarded.

It writes executable apply SQL to `.data/updates/` (or `--out <dir>`), runs that
file atomically through `wrangler d1 execute --file`, then reads back every
applied change and record's row counts. It prints aggregate change and table
counts, not a per-word review artifact. No eligible changes means nothing is
written, including no SQL file. Run the operation again to re-diff: applied
records are no longer offered; remaining eligible records from that same latest
feed still apply. Do not replay a saved SQL file expecting a supported no-op.

## Optional diagnostics and selected apply

Existing `update:diff` and `update:select` remain read-only diagnostics, not
routine accuracy gates:

```sh
pnpm run update:diff <later.jsonl.gz>
pnpm run update:select <later.jsonl.gz> --pages <its-dump.xml.bz2>
```

They retain their Markdown/JSON output; selection also writes an ids file.
The lower-level selected apply remains available for explicitly chosen subsets:

```sh
pnpm run update:apply <later.jsonl.gz> <id> <id> ...
pnpm run update:apply <later.jsonl.gz> --ids <file>
```

An ids file accepts whitespace and `#` comments. Apply re-diffs and refuses
stale/invalid ids or lost-word ids before writes; it also verifies source
ordering. It does not replace automatic eligibility checks: use `update:auto`
for the supported automatic path. Selected apply prints its existing per-change
execution receipt, not a newly added review product.

## If an apply stops

A refusal writes nothing. If execution fails, D1 rolls the whole file back.
Fix the mechanical cause and invoke the operation again. A read-back failure is
different: the apply ran but does not match its plan. Locally, restore the
directory copy and file an issue with the output and SQL file. On the shared
dictionary, the deploy run goes red and names its bookmark and the restore
command; it never restores by itself. Huey runs the restore:

```sh
pnpm --dir web exec wrangler d1 time-travel restore lexema-dictionary --bookmark=<bookmark>
```

The [first-feed report](../reports/2026-10-01-first-feed-release.md), its
[ids](../reports/2026-10-01-first-feed-selection.ids), and
[#414 audit](../reports/2026-10-02-first-feed-retention.md) remain historical
records, not current selection instructions. No restoration follows merely
from older wording being absent.
