# Ruled page-only recovery measurement

Read-only measurement for [#403](https://github.com/hueypov/lexema/issues/403),
2026-10-02, under [ADR 0024](../.decisions/0024-italian-pages-the-extraction-skips-are-recovered.md).

The [machine-readable output](2026-10-02-page-entry-recovery.json) lists every
eligible and excluded title, its revision and timestamp, rule outcome and
recovered-definition count. It verifies release `it-0c432803` (archive SHA-256
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`) and dump
`itwiktionary-20260701` (SHA-1 `2bdd444236f7dcd26fee3652dbd641c31d0d9651`).

The rule `italian-page-entry/v1` admits **13 of 104** dangling titles with a page;
**91** have no ruled layout and are excluded. The ruling's estimate of about 23
is not an acceptance count or a title allowlist. Eligible titles: `addirizzare`,
`congedare`, `dipendere`, `dismagare`, `educare`, `fidelizzare`, `fornire`,
`grufolare`, `raccontare`, `rivenire`, `smentire`, `tornire`, `tremare`.

The set is derived from all admitted Italian archive words and all their
`form_of` targets, subtracting words already in the archive, then streaming the
verified dump's main-namespace pages. The same production parser the seed uses
judges every page. No source-accuracy review or newer-feed selection is added.

## Reproduce

With the verified archive and dump copied locally from `hueypov/lexema-data`:

```sh
pnpm exec tsx src/import/measurePageEntries.ts \
  --archive it-extract.jsonl.gz \
  --dump itwiktionary-20260701-pages-articles.xml.bz2 \
  --out reports/2026-10-02-page-entry-recovery.json
pnpm run typecheck
pnpm --filter @lexema/web typecheck
pnpm exec node --import tsx --test test/pageEntry.test.ts test/recovery.test.ts test/seedSql.test.ts test/lookup.test.ts test/servedPlan.test.ts test/d1Batch.test.ts
TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec node --import tsx --experimental-test-module-mocks --test web/test/page.test.tsx web/test/api.test.ts
```

The fixtures and disposable SQLite tests need neither source download nor D1.
Their provenance and primary test contracts are in
[the fixture notes](../fixtures/page-entry-provenance.md).

## Seed and rollout boundary

The local seed steps are in
[run an archive seed](../docs/RUN_AN_IMPORT.md#page-only-entries). What is
stored, the identities and how a dictionary without the tables is served are in
[page-only entries](../docs/PAGE_ENTRIES.md).
This measurement performed no shared writes.
