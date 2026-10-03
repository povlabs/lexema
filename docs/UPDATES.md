# Why a later release is applied as selected changes

The dictionary database is the **master**: the release it was seeded from,
plus selected changes from later kaikki releases. A later release is a
**feed**, never a replacement. Huey ruled this on 2026-10-01
([#18](https://github.com/hueypov/lexema/issues/18#issuecomment-5933489252)),
keeping [ADR 0018](../.decisions/0018-previews-on-workers-builds.md)'s line
that later releases apply as diffs, not full re-imports.

This page explains the design. The steps to run are in
[UPDATE_THE_DICTIONARY.md](UPDATE_THE_DICTIONARY.md).

## Why not re-import

A re-import would replace every row the master holds, and the master holds rows
no kaikki release has: the recovered definitions read off raw Wiktionary pages
(`raw_page`, `recovered_*`, [#28](https://github.com/hueypov/lexema/issues/28)),
the notes in `claim_review`, and any layer added later. Each of them hangs off a
source record by `record_id`, with `ON DELETE CASCADE`
([src/db/schema.sql](../src/db/schema.sql)). Deleting or replacing a record
would delete them with it, without a word.

So the master is never rebuilt. A later file is compared with its currently
served records, and a deterministic selection is applied automatically through
`update:auto`, under [ADR 0025](../.decisions/0025-newer-source-definitions-are-authoritative.md).
Newer source definitions are trusted, including corrections, rewordings and
removals of some or all definitions in a matched record. Retired records stay
stored; a missing whole word/part-of-speech record is still not applied.
Accuracy investigation follows a user report, not routine per-word review.

## Selection and source ordering

`feed-selection/v4` keeps the existing new-word and raw-gloss interpretation.
For changed definitions it permits replacements of earlier-applied records and
requires neither old gloss-key containment nor increasing sense counts.
`fills-gloss` and `adds-sense` remain descriptive reasons; rewritten definitions
use `replaces-definitions`, and reduced real definitions use
`removes-definitions`. Formatting-only, unchanged-gloss and duplicate-gloss
additions still stay skipped, as do non-definition changes.

v4 differs from v3 in one skip, `blank-replaces-definition`
([#442](https://github.com/hueypov/lexema/issues/442)). A later record with
fewer real definitions is not applied when it has more blank senses than ours,
or only blank senses or none at all. A blank sense has no gloss text once the
"definizione mancante" placeholder is taken out: glosses absent, null or empty,
which is what the source tags `no-gloss`, or only the placeholder. Such a loss
is an extraction gap, not an edit: `passata` (verb) losing its only sense to
`{"tags": ["no-gloss"]}`, `civetta` (noun) losing "locandina" to the
placeholder. Ours keeps serving whole; no old and new senses are merged. A
removal with no blank in its place, such as `gay`, `gastronomia` or `logografo`
in it-78385b62, still applies.

Source ordering is checked against checksum-bound dump dates in
[src/source/archiveFacts.ts](../src/source/archiveFacts.ts), not hash order,
line numbers or download time. A feed must be later than the seed and every
already applied feed. Remaining eligible changes from the identical latest
feed are allowed; an older feed, unknown facts, or a different archive from the
same dump is refused. Only two real archives currently have these facts.
The July dump's recorded catalog entry has an explicitly inferred basis; it
is not a revision identity. New archives need evidenced catalog facts and a
verified language dump before automatic selection can run.

The automatic operation emits aggregate counts and the existing executable
apply SQL, not an old/new word-review report. Optional `update:diff` and
`update:select` diagnostics remain available; inspecting them is not an
accuracy gate. Operator authorization to invoke a shared write is separate
from source authority.

## Matching records across two files

Neither file carries a stable id. `line_no` moves whenever a line is added
above it, and `record_id` is an artefact of one database build
([RECORD_IDENTITY.md](RECORD_IDENTITY.md#identity)). The diff therefore matches
by content, inside each `(word, pos)` group
([src/update/changes.ts](../src/update/changes.ts)):

1. A later line byte for byte equal to a master line is the same record.
2. A later line with the same content in another key order is the same record
   too. Content is the line's JSON with every object's keys sorted
   ([src/update/content.ts](../src/update/content.ts)).
3. What is left in the group decides the change:
   - only later records: each is **new**;
   - only master records: each is **lost**;
   - one on each side: the record **changed**;
   - anything else, such as two `sale` nouns on each side: the group is
     **ambiguous**. The schema notes groups of up to five records. Pairing them
     by likeness would be a guess, so the diff names the group and offers no
     change for it.

A changed record is filed by what changed: **changed or fixed senses** when its
`senses` differ, **other changes** when only other fields do. The split keeps
the report readable. kaikki's build of 28 September 2026 added
`etymology_links` to almost every record, which makes almost every record
"changed" while its senses stay the same.

## Change ids

Each change has an id: `new-`, `chg-` or `lost-`, then twelve hex digits of a
digest of its kind, word, part of speech and the digests of the lines it
changes. The same master and the same later file give the same ids on every run
and in any line order, so selection and apply agree on the same changes.
The apply runs the diff again and applies only ids the new run finds. An id
whose master record or file has moved since is refused.

Two changes with one id hold byte-identical lines and could never be chosen
apart. Their group is reported as ambiguous instead.

## What an apply writes

The apply is one SQL file, run once
([src/update/apply.ts](../src/update/apply.ts)):

- **The record.** Each chosen line goes through `writeRecord`, the seed's own
  import path ([src/import/importRelease.ts](../src/import/importRelease.ts)),
  with the source text normalizations of
  [ADR 0019](../.decisions/0019-source-text-may-be-normalized.md). It is a new
  record of the later release: `source_record.release_id` names that release,
  `line_no` is its line there, and `source_record_json` holds the line byte for
  byte. Every child row reaches it by `record_id`, and the index rows that
  carry a release name the same one.
- **The release.** The later release gets its `source_release` row the first
  time a change is applied from it, with its id and checksum as a seed would
  name them, and status `partial`: the checksum names the whole archive, and
  only chosen records landed. `feed_release` ties it to the master, and
  `release_table_rows` adds up what each apply wrote under it.
- **The change.** `applied_change` records each change under its id, with the
  record it wrote and, for a changed record, the record it replaced.
- **The retired record.** The record a changed record replaces loses its
  `lookup_form` and `form_of_edge` rows, so no search reaches it. Everything
  else of it stays: its line, its senses, its claims, and the rows written by
  hand beside it.
- **The nearby indexes.** `accent_fold` and `typo_key` are recomputed with the
  seed's own rules for every key the written and retired records spell. A row
  that changes is replaced, and the new one is written under the later release.
  A row already right stays in the release that wrote it.

Nothing else is written. No record is deleted, and no row of `raw_page`,
`recovered_*`, `claim_review` or `corrected_claim` is touched.

## Rows written by hand follow the record that replaced theirs

A recovered definition or a review stays on the record it was written for.
That record is retired, not deleted, so the row keeps its record and every
foreign key it had. A lookup reads these rows for the record that replaced it
through `applied_change`, one replacement after another
([src/lookup/served.ts](../src/lookup/served.ts)). Each keeps the ref of the
line it was written about, so a reader can still check it there.

The seed recovered a definition only when its record did not carry it, so a
lookup asks that again of the record that replaced it, by the seed's own rule
(`carries` in [src/italian/recovery.ts](../src/italian/recovery.ts),
[#370](https://github.com/hueypov/lexema/issues/370)):

- A recovered definition the replacing record carries as a gloss is not shown
  again: the record shows it as a sense.
- A sense index names a sense of the record the definition was written for, and
  the later record may hold its senses in another order. So a definition listed
  under a sense goes under the one sense of the replacing record whose glosses
  carry that old sense's glosses. When no sense does, or more than one, it goes
  to the top of the list.
- An item listed under a recovered definition that is no longer shown goes
  under the one sense that carries that definition's text, or to the top.

The rules live in [src/lookup/recovered.ts](../src/lookup/recovered.ts). A
record never replaced reads its rows as the seed stored them.

A curated correction (`corrected_claim`, [#420](https://github.com/hueypov/lexema/issues/420))
is the one row written beside a record that does not follow it. It sets a gender
or number the source stated wrongly on that line, checked against a cited
revision, and the later record may state it differently, rightly or not. So it
stays on the retired record, a lookup of the replacing record reads that
record's own claims, and the apply names each such correction in its output,
beside the change and the replacing record, for a person to check
([Write the curated corrections](RUN_AN_IMPORT.md#write-the-curated-corrections-into-a-seeded-database)).

## Serving a master of several releases

`LEXEMA_RELEASE` still names one release: the master's own. The releases a
master serves are a view, `served_release`: its own complete release, and every
feed of it. Every serving read keys on that view instead of on one
`release_id`, so a record a change wrote is found beside the records it did not
touch, and an edge from one release finds its lemma in another. Each value a
lookup returns carries the ref of its own record: a fixed word answers with the
later release's id and line, and its neighbours still with the master's.

The two prefix reads, for the search field and for phrase completions, walk an
index in key order and stop at their limit. An `IN` over several releases would
sort the whole range first, so they run once per served release and merge
([`inKeyOrder`](../src/lookup/served.ts)).

A random pick draws a line of the master's own release. A record a change
replaced is answered with the record that replaced it. A word only a later
release added is not drawn, since its line numbers count in another file.

## A lookup never sees half an apply

`wrangler d1 execute --file` runs a file as one unit: locally as one D1 batch,
remotely through D1's import, which says "if the execution fails to complete,
your DB will return to its original state" and serves no query while it runs.
So a lookup reads the master either before an apply or after it, and an apply
that stops partway leaves the master as it was. `test/update.test.ts` breaks a
statement after the records are written and checks every row is back.

## Caches move with an apply

`LEXEMA_RELEASE` stays the same through an apply, so nothing a reader's browser
or Cloudflare keeps may be keyed on it alone. A shared link's card and the
search field's suggestions are keyed on the **served version** instead: the
release and the last change applied to it
([`servedVersion`](../src/lookup/served.ts), one row read). An apply moves it,
and so every card's address and every suggestion request's address
([#368](https://github.com/hueypov/lexema/issues/368)).

## An older master

A master seeded before #18 has none of `feed_release`, `applied_change` or the
views that read them. The diff reads such a master as it is. The apply's SQL
starts by creating the tables if they are absent and replacing the views, read
out of `schema.sql` itself ([src/update/masterUpgrade.ts](../src/update/masterUpgrade.ts)),
so a fresh seed and an upgraded master have the same shape.

## What this does not do

- **Remove a lost word.** A lost word is reported and never deleted. Whether a
  chosen removal may ever delete a record is not ruled.
- **Apply an ambiguous group.** It has no change id.
- **Recover definitions for an applied record.** The recovered layer is written
  by the seed from raw pages. An applied record gets the rows of its own line.
  The definitions recovered for the record it replaced are still read.
- **Check on a schedule.** An operator invokes the update; no scheduled fetch service is built.
- **Replay saved SQL as a no-op.** Re-run the supported operation, which re-diffs. Stale SQL is not a supported idempotent interface.
