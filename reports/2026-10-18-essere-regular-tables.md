# Verbs whose own `{{It-conj}}` call names essere, or both auxiliaries

Measurement for [issue #873](https://github.com/povlabs/lexema/issues/873), run
2026-10-18. [The #841 report](2026-10-17-base-verb-regular-tables.md) left 17
verbs with no table: their own Appendice page names their class in an
`{{It-conj}}` call, but the call names essere, or both auxiliaries, and rule
`it-regular-conjugation/v1` built every compound tense on avere. Huey ruled on
2026-10-18 that the rule covers them, using the essere building blocks, and
follows what the call states for a verb with both
([ruling](https://github.com/povlabs/lexema/issues/873#issuecomment-6252704549)).

**All 17 now get a table**: 8 on essere and 9 on both auxiliaries.

## What was measured

| | |
|---|---|
| Release | `it-0c432803`, `it-extract.jsonl.gz` (SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`) |
| Calls | [src/italian/conjugationTemplateCalls.ts](../src/italian/conjugationTemplateCalls.ts), unchanged since the #841 report |
| Script | [`tools/measureBaseRegularTables.ts`](../tools/measureBaseRegularTables.ts), read-only, under a minute; it now also gives each settled record's auxiliary |
| Output | [2026-10-18-essere-regular-tables.json](2026-10-18-essere-regular-tables.json) |

Run it with
`pnpm exec tsx tools/measureBaseRegularTables.ts <it-extract.jsonl.gz> > result.json`.
The records counted are the ones the #841 report counts.

## How the auxiliary is read

The rule reads the call's third parameter as Modulo:It-conj (revision 4048685
in the dump) does. Exactly `avere` puts every compound tense on avere. Exactly
`essere` puts it on essere, with the participle plural on a plural row
(`siamo affaticati`). Any other text makes the module write each compound cell
twice, the avere spelling then the essere one (`ho scolato`, `sono scolato`).
The rule reads that other text only when it names both avere and essere, and a
call naming neither settles nothing (`auxiliary-not-read`). No pinned call of
these verbs names neither. The page shows the essere spellings in both genders
(`it-essere-agreement/v2`) and a two-auxiliary cell on two lines
(`it-compound-auxiliary/v1`), as it does for a record's own table.

The auxiliary cell spells the call's text as a record's table does, cut at
`, `: a record whose table was built from `avere, come intr. essere` lists
`avere` and `come intr. essere` (`crescere`, in the release).

## The count

The 257 records with a call on their own page:

| Outcome | Records | Words | Before (#841) |
|---|---:|---:|---:|
| Settled, on avere | 212 | 206 | 212 records, 206 words |
| **Settled, on essere** | **8** | **8** | declined |
| **Settled, on both** | **11** | **9** | declined |
| Not settled: the call overrides a form, or names a class the rule does not build | 26 | 22 | 26 records, 22 words |
| **Total** | **257** | **245** | |

The 206 avere words are the #841 report's, record for record. A word with two
records gets one table, under its first record with a meaning.

| Auxiliary in the call | Words |
|---|---|
| `essere` | affaticare, cascare, infradiciare, insanguinare, rifuggire, rifugiare, rintristire, sbilanciare |
| `avere, come intr. essere`, `avere, se intr. essere`, `avere, se intransitivo essere` | incocciare, incrudelire, inferocire, insalvatichire, insecchire, insuperbire, invelenire, rifiorire, scolare |

## How the tables were checked

`test/regularConjugation.test.ts` builds a table of each class on the
auxiliary of a whole source table in the dev seed and compares them cell for
cell, the auxiliary and every compound tense included: `slanciare`, `partire`
and `rimbambire` on essere, `finire` (`avere, se intr. essere`) and `rinsavire`
(`avere, come intr. essere`) on both. The page tests in
`web/test/page.test.tsx` render `affaticare`, `scolare` and `accertare` from
their real records.
