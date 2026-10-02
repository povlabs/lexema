# First-feed recovery proposal — not approved for execution

Prepared 2026-10-02 for [#414](https://github.com/hueypov/lexema/issues/414).
The [audit](2026-10-02-first-feed-retention.md) reconciles the source evidence.
No shared write is authorized. Implementation is deferred to
[#427](https://github.com/hueypov/lexema/issues/427); no recovery was executed.
This is a proposal for a separate approval, not a rollback runbook.

## What is recoverable

[src/update/apply.ts](../src/update/apply.ts)'s `planApply` removes only the
replaced record's `lookup_form` and `form_of_edge` rows. It retains the old
`source_record`, verbatim `source_record_json`, senses, glosses, labels and
claims, and preserves `raw_page`, `recovered_*` and `claim_review` attachments.
The old archive is therefore evidence for the old text; the retained rows are
potential recovery material, not an implemented restoration.

| Change | Word / POS | Original release:line | Later release:line | Local retired → later record id |
|---|---|---|---|---|
| `chg-4aa885e4ac68` | resistere / verb | `it-0c432803:49191` | `it-78385b62:49474` | 14933 → 560400 |
| `chg-ecd05a1dc1d2` | inerente / adj | `it-0c432803:53608` | `it-78385b62:53906` | 18828 → 560404 |
| `chg-f6d9da14cdd4` | deprimente / adj | `it-0c432803:412862` | `it-78385b62:413315` | 325468 → 560442 |
| `chg-d59d7ae8a93f` | pressurizzazione / noun | `it-0c432803:417898` | `it-78385b62:418358` | 329814 → 560446 |

Record ids above came from the pre-apply local state plus the original generated
SQL reconstructed in memory; **do not use them as production identifiers**.
Read-only inspection of that pre-apply state found each original raw record and
one old sense. Its lookup rows were 98 for resistere and 2 for each of the other
three; each had zero outgoing form-of edges. These are local pre-apply facts,
not a fresh count of surviving production rows. Production originals must be
verified independently. Exact glosses, keys and both raw-line hashes are in
[the audit result](2026-10-02-first-feed-retention.json).

Restoring an old record alone would restore its absent old meaning **and lose
the newly added meanings** of the later record. It cannot be represented as a
lossless repair. Manufacturing a merged record or senses is forbidden here by
[ADR 0012](../.decisions/0012-archive-is-the-release-seed.md) and
[ADR 0019](../.decisions/0019-source-text-may-be-normalized.md).

## Supported mechanisms and their limits

[src/update/updateCli.ts](../src/update/updateCli.ts) exposes upgrade, diff,
select and apply. It has **no targeted restoration or reversal verb**.
Reapplying the preserved first-feed ids cannot undo an apply: the diff is
against the current master and `chooseChanges` refuses absent ids.
Using an old archive as an ordinary feed is not a restoration mechanism;
`planApply` refuses the master's own release as a feed.

The [runbook](../docs/UPDATE_THE_DICTIONARY.md#if-an-apply-reads-back-wrong)
documents a whole-database D1 time-travel restore to a previously saved bookmark,
or replacement of a private local state copy. Neither is a four-record repair.
No bookmark, current availability, or absence of subsequent writes was verified
in this lane. A whole-database restore could discard the other 264 selected
changes and later work. This proposal neither supplies nor executes a restore
command.

## Approval and current-state prerequisites

Before any recovery implementation or shared execution, Huey must separately
approve the desired result: an explicitly lossy return to old records, or a
new serving design retaining both immutable source records with their own
provenance. The latter is **not** a source-record merge, but changes serving
behavior and needs its own scope and approval. This lane chooses neither.

On authorized, read-only production access (not an alternative authentication
mode around error `10000`), capture a fresh snapshot and establish:

1. The master's release, feed checksum, importer/normalizer/schema versions and
   served releases. Verify the confirmed apply ledger against the four change
   ids; derive actual replaced/later ids from `applied_change`, not this table.
2. Both original and later raw lines and hashes, intact structured rows, hiding
   status, and serving/lookup state. Trace any subsequent replacement chain and
   detect records or keys changed since the first feed. Abort on drift until a
   revised plan is approved.
3. All lookup/form-of/nearby rows touching either side, incoming target links,
   and recovered/review attachments over the full lineage. Inventory current
   caches and the last applied change/version token.
4. A backup whose restore has been proved on a private copy, an exclusive
   maintenance window, explicit exact row expectations, and independently
   authorized execution. Approval of the selection PR is not that authorization.

## Requirements for the deferred implementation

- **Serving and ledger:** `served_record` in
  [schema.sql](../src/db/schema.sql) excludes any replaced record even if its
  lookup rows were restored. A planner must explicitly model the approved
  active record(s) and retain auditable replacement history. Do not casually
  delete `applied_change` or reverse its links: `lineageOf` in
  [served.ts](../src/lookup/served.ts) reads predecessor chains, and cycles
  or broken lineage can lose recovered definitions and reviews.
- **Lookup and form-of:** reconstruct the approved originals' derived rows
  through the existing import rules (`writeRecord` in
  [importRelease.ts](../src/import/importRelease.ts)), without editing their
  raw lines or double-inserting existing senses/claims. Retire only the
  lookup/edge rows the approved result replaces. Validate exact headword,
  embedded-form and form-of reads, including incoming edges and ambiguous
  candidates. The local zero outgoing-edge count does not exempt these checks.
- **Nearby indexes:** recompute the union of old/later surface keys against the
  proposed serving state with the existing `nearbyEdits`/seed scoring rules,
  including accent folds and typo deletions. Preserve unaffected records that
  share keys, and write correct release provenance and row accounting.
- **Recovered layer:** preserve raw pages, recovered definitions/items and
  reviews on their original records. Validate lineage, duplicate suppression
  and placement through [recovered.ts](../src/lookup/recovered.ts); swapping
  senses changes where inherited recovered text belongs. Source glosses must
  not be relabelled as raw-page recovered definitions.
- **Cache identity:** `servedVersion` reads the last `applied_change` rowid;
  its append-only assumption does not cover an in-place reversal. A recovery
  needs an explicit version/invalidation design so cards and suggestions
  cannot keep the pre-recovery result. A silent lookup-row repair is inadequate.
- **Safety:** use a named/versioned, idempotent planner with a dry-run artifact,
  exact precondition guards, transaction failure proof on a private snapshot,
  foreign-key/integrity checks and repeat-run no-op behavior. Preserve every
  `source_record_json` byte and source provenance.

## Validation and abort conditions

First rehearse on a private copy of the fresh serving snapshot. Verify the four
approved results against source hashes, all expected sense keys, candidate
counts, forms, target links, nearby suggestions and recovered/review attachments.
Verify unaffected records and all other applied changes stay served, history
remains acyclic, row counts match the plan, caches move, and a second run is a
no-op. Inspect rendered word pages only as an additional observation, not a
substitute for raw/source checks.

Abort on absent originals, checksum or row drift, an unexpected replacement,
hiding conflict, ambiguous recovery target, unapproved loss of either old or new
meanings, altered raw bytes, broken provenance/lineage, collateral lookup/index
changes, stale cache identity, failed validation or lack of separate approval.
Do not run a partial repair or fall back to another authentication mode.
After any independently authorized execution, read back the exact approved plan
and serving behavior before declaring recovery complete. This selection fix
alone establishes none of those production outcomes.
