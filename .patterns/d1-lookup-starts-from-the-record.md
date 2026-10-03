# A D1 lookup starts from the record

How a lookup statement in `src/lookup/` joins the dictionary tables so D1 probes an
index on its full key; applies to every statement that reads `lookup_form` or
`form_of_edge` across the served releases.

## The shape

A statement that reads around one record starts from that record's own row, then
probes the next table on the whole index key: `release_id` and the word key
together. In SQLite, `CROSS JOIN` is how the join order is fixed, so the planner
cannot start somewhere else ([`src/lookup/lookup.ts`](../src/lookup/lookup.ts)):

```sql
SELECT ...
  FROM lookup_form lf
  CROSS JOIN form_of_edge e
    ON e.release_id IN (${servedBy("?2")}) AND e.target_word_key = lf.surface_key
  JOIN source_record f ON f.record_id = e.record_id
 WHERE lf.record_id = ?1 AND lf.origin = 'headword' AND lf.release_id IN (${servedBy("?2")})
```

The first step reads `lookup_form_by_record (record_id=?)`. Each probe after it
binds both columns of `form_of_edge_by_target (release_id, target_word_key)` or
`lookup_form_by_key (release_id, surface_key)`
([`src/db/schema.sql`](../src/db/schema.sql)). `servedBy` in
[`src/lookup/served.ts`](../src/lookup/served.ts) supplies the releases as an `IN`,
so each served release is one probe.

Two tests hold the plans, on Node's SQLite over the bare schema, which picks the
same plan D1 does:

- [`test/servedPlan.test.ts`](../test/servedPlan.test.ts) imports every exported
  string in `src/lookup/` that reads through `servedBy`, runs `EXPLAIN QUERY PLAN`
  on each, and fails on any step that probes a `lookup_form` or `form_of_edge`
  index on `(release_id=?)` alone. It also names the statements #381 fixed, so a
  rename cannot drop one from the sweep unseen.
- [`test/lookup.test.ts`](../test/lookup.test.ts) asserts, per statement, that no
  step is a `SCAN` or `MATERIALIZE` of those tables, and which index leads. For
  the inflection queries the first step must be `lookup_form_by_record`.

A new lookup statement is exported as a `DictionaryRead` string, so the sweep
picks it up without a list to update.

## When this applies

Every read in `src/lookup/` that reads through `servedBy`: search, lemma links,
inflections, form entries, batch lookups, phrases, expressions and nearby offers
(`lookup.ts`, `batch.ts`, `phrase.ts`, `expressions.ts`, `nearby.ts`). Range reads
in key order, such as suggestions, run once per release through `inKeyOrder`
instead and are outside this shape. The plan tests assume a statement is a module-level exported string; one built
inside a function is invisible to `servedPlan.test.ts`. The app database's reads
(`src/db/app/`) have their own plan tests in
[`test/accounts.test.ts`](../test/accounts.test.ts) and
[`test/apiKeys.test.ts`](../test/apiKeys.test.ts).

## Why it is not obvious

A probe on the `release_id` prefix alone is still reported as `SEARCH ... USING
INDEX`, so a "no SCAN" test lets it through. But one release has about two million
`lookup_form` rows, and that probe walks all of them for each record: preview
result pages took about 35 seconds for common words before the fix
([#381](https://github.com/povlabs/lexema/issues/381),
[#384](https://github.com/povlabs/lexema/pull/384)). Rows-only tests cannot see
it either, because the slow plan returns the same rows. Left free, the planner
starts from the small `served_release` list instead of the one record, which is
why the join order is fixed by hand.
