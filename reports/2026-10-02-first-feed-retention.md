# First-feed real-gloss retention audit

Measured 2026-10-02 for [#414](https://github.com/hueypov/lexema/issues/414).
This is a source/domain audit, not an observation of current production pages.
The future-selection guard is `feed-selection/v2`: only the automatic
`adds-sense` route now requires every old `ReadSenses.keys` key to survive.
`fills-gloss`, new words and the real-gloss interpretation are unchanged.
A code merge does **not** repair already-applied data.

## Production fact and historical evidence

Huey's **read-only D1 query**, as recorded in
[#414](https://github.com/hueypov/lexema/issues/414), confirms production applied
**54 changed + 214 new** from `it-78385b62` at
**2026-10-01T22:35:34.630Z**. That is Huey's evidence, not an agent query.
No remote query, shared D1 write, alternative authentication mode or recovery
was attempted in this lane. Wrangler error `10000` remains a constraint, not
an invitation to try another mode.

The [original first-feed report](2026-10-01-first-feed-release.md) and
[original ids](2026-10-01-first-feed-selection.ids) are preserved unchanged.
Their local apply and page observations are historical; their instructions
addressing a then-future production apply are stale now.

## Reproduction

Run from the repository root with the two local archives available:

```sh
pnpm exec tsx tools/auditFirstFeedRetention.ts <old.jsonl.gz> <later.jsonl.gz> > <scratch-result.json>
diff reports/2026-10-02-first-feed-retention.json <scratch-result.json>
```

The [audit tool](../tools/auditFirstFeedRetention.ts) reads archives only and
writes JSON to stdout. It verifies compressed SHA-256:

- `it-0c432803`: `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`.
- `it-78385b62`: `78385b6229d19ed990ada6f6f33930585701c3bdc146fb1c849818df72a3e8d4`.

The [54-pair manifest](2026-10-02-first-feed-pairs.json) was reconstructed in
this lane's in-memory SQLite: load `src/db/schema.sql`, execute the original
first-feed generated apply SQL, attach the pre-apply local full-state dictionary
with SQLite `mode=ro`, and join `applied_change.replaced_record_id` to its
`source_record`, and `applied_change.record_id` to the generated later record.
Those record ids describe that local plan only, not portable production ids.
The manifest makes reproduction independent of those uncommitted SQL/state files.

For **all 54 changed pairs**, the tool reads both archive lines, verifies
word/POS, recomputes each change id from the raw-line SHA-256 digests using
[src/update/changes.ts](../src/update/changes.ts)'s documented recipe, and checks
membership in the preserved ids file. It freezes the original v1 adds-sense
predicate for historical classification (more real senses, a new key, no
decrease in non-real senses), using the unchanged `ReadSenses` comparison.
The [complete result](2026-10-02-first-feed-retention.json) contains all old/later
keys and raw-line hashes, not semantic paraphrase matching. The v2 verdict is
also checked for every original adds-sense pair.

Result: **22 original adds-sense IDs = 4 affected + 18 retaining all old keys**.
Each affected record loses exactly one old key. The other 32 changed selections
were not v1 adds-sense; this audit does not reinterpret their fills-gloss route.

## All 22 original adds-sense records

Lines are 1-based physical source lines; old is `it-0c432803`, later is
`it-78385b62`. “Retained” means every old real-gloss key occurs later, not that
all page-visible properties are unchanged.

| Change id | Word | POS | Old line | Later line | Retention / v2 outcome |
|---|---|---|---:|---:|---|
| `chg-6f0b5dda3e59` | cucina | noun | 31618 | 31886 | Retained / adds-sense |
| `chg-aa4efde12d7e` | centrale | noun | 39494 | 39770 | Retained / adds-sense |
| `chg-b6d933196529` | legno | noun | 42270 | 42550 | Retained / adds-sense |
| `chg-719f8db26ebb` | aristocrazia | noun | 47606 | 47889 | Retained / adds-sense |
| `chg-4aa885e4ac68` | resistere | verb | 49191 | 49474 | One key absent / loses-gloss |
| `chg-ecd05a1dc1d2` | inerente | adj | 53608 | 53906 | One key absent / loses-gloss |
| `chg-7aa4934c9c7d` | perimetro | noun | 62146 | 62453 | Retained / adds-sense |
| `chg-7b0325838ef5` | panno | noun | 64966 | 65273 | Retained / adds-sense |
| `chg-95e42f4e376b` | SUV | abbrev | 83148 | 83470 | Retained / adds-sense |
| `chg-bfa7a284f481` | schizzo | noun | 107571 | 107908 | Retained / adds-sense |
| `chg-acfa954d20a0` | stregua | noun | 109809 | 110149 | Retained / adds-sense |
| `chg-5e7203197062` | camper | noun | 129605 | 129966 | Retained / adds-sense |
| `chg-b33cdddd08ae` | striminzito | adj | 139452 | 139843 | Retained / adds-sense |
| `chg-8f81733e20b3` | stecca | noun | 202600 | 203011 | Retained / adds-sense |
| `chg-f6d9da14cdd4` | deprimente | adj | 412862 | 413315 | One key absent / loses-gloss |
| `chg-0bea0ca4af52` | tripletta | noun | 417641 | 418101 | Retained / adds-sense |
| `chg-d59d7ae8a93f` | pressurizzazione | noun | 417898 | 418358 | One key absent / loses-gloss |
| `chg-ef8c8bf05160` | donatore | noun | 446967 | 447439 | Retained / adds-sense |
| `chg-c66213aa6720` | storicoletterario | adj | 458076 | 458551 | Retained / adds-sense |
| `chg-aef5500baf0c` | grumo | noun | 494932 | 495418 | Retained / adds-sense |
| `chg-671244243223` | beghina | noun | 579586 | 580083 | Retained / adds-sense |
| `chg-42a9b56afdcb` | MB | symbol | 610145 | 610678 | Retained / adds-sense |

## Exact absent glosses and keys

These glosses are verbatim from the old real senses. Keys are exactly
`ReadSenses.keys`: Italian exact normalization, then punctuation and spacing
removal over the joined gloss strings. Accents are not semantically matched.

### resistere / verb — `chg-4aa885e4ac68`

- Gloss: preservare le qualita di un oggetto
- Key: `preservare le qualita di un oggetto`

### inerente / adj — `chg-ecd05a1dc1d2`

- Gloss: che riguarda qualcosa
- Key: `che riguarda qualcosa`

### deprimente / adj — `chg-f6d9da14cdd4`

- Gloss: che provoca debolezza
- Key: `che provoca debolezza`

### pressurizzazione / noun — `chg-d59d7ae8a93f`

- Gloss: applicazione di una pressione prossima a quella del livello del mare nella cabina di un aeromobile, per rendere quest'ultima abitabile dal personale e dai passeggeri
- Key: `applicazione di una pressione prossima a quella del livello del mare nella cabina di un aeromobile per rendere quest ultima abitabile dal personale e dai passeggeri`

## Recovery boundary

The separately approved, source-backed proposal is in
[the recovery proposal](2026-10-02-first-feed-recovery-proposal.md).
No targeted recovery operation exists; deferred implementation is filed as
[#427](https://github.com/hueypov/lexema/issues/427), linked to #414.
