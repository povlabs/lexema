# Italian source-adapter validation results

> Historical run report, not fresh verification of the current repository or linguistic correctness. Current scope is in [NEXT_STEPS.md](NEXT_STEPS.md); independently checked data and limits are in [DATASET_SPOT_CHECK.md](DATASET_SPOT_CHECK.md) and [SOURCE_RESEARCH.md](SOURCE_RESEARCH.md).

**Run date:** 2026-07-21  
**Dataset:** `it-extract.jsonl.gz`  
**Release ID:** `it-local-validation`  
**Compressed source SHA-256:** `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`

## Scope

This run validates the first local TypeScript source-adapter spike only. It does not implement a Worker API, D1 importer/schema, frontend, AI generation, contextual ranking, or production deployment.

The adapter streams gzip JSONL, admits records only when `lang_code === "it"`, preserves bounded fixture evidence, keeps unknown grammar unclassified, and produces deterministic Italian articles only from unambiguous source evidence.

## Verification status

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | Passed — 13 fast unit tests (~184 ms) |
| `npm run test:integration` | Passed — 2 real-dataset tests (~11.38 s) |
| `npm run validate -- --input ./it-extract.jsonl.gz --fixtures ./fixtures/it-validation-forms.json --release-id it-local-validation --out ./artifacts/it-adapter-validation` | Passed — report generated (~9.77 s) |

The default `npm test` suite does not scan the source dataset. Only `npm run test:integration` performs the real-dataset stream.

## Stream integrity

| Measurement | Value |
| --- | ---: |
| Parsed records | 799,600 |
| Italian records accepted | 560,357 |
| Non-Italian records skipped | 239,243 |
| Malformed records | 0 |
| Peak retained records | 46 |
| Largest Italian JSON record | 49,188 bytes |
| Validation duration | 9.77 s |

The raw Italian JSON-byte total excludes one trailing newline per accepted record. Adding 560,357 newline bytes produces 391,274,879 bytes, matching the documented source inspection.

## Global projection profile

| Projection / index measurement | Bytes / rows |
| --- | ---: |
| Complete Italian source JSON | 390,714,522 bytes |
| Useful-field projection | 226,621,458 bytes |
| Minimal MVP projection | 106,348,484 bytes |
| Entry-level provenance | 93,425,054 bytes |
| Compact evidence references | 58,303,774 bytes |
| Minimal projection plus provenance | 258,077,312 bytes |
| Provenance overhead over minimal projection | 142.67% |
| Projected headword lookup rows | 560,357 |
| Projected embedded-form lookup rows | 713,133 |
| Projected `form_of` relation rows | 608,726 |

These are deterministic serialized-projection estimates, not a measured SQLite or D1 database size.

## Adapter summary

| Measurement | Value |
| --- | ---: |
| Qualifying exact-form source usage examples | 15 |
| Deterministic articles generated | 40 |
| Article outputs withheld conservatively | 5 |
| Classified verb forms | 756 |
| Unclassified forms | 138 |
| Unresolved relations | 1 |
| Multi-target relations | 0 |

## Fixture results

All 16 requested fixtures passed:

```text
studente, studenti, casa, case, zaino, amica, bello, belle,
andare, andavano, parlare, parlerò, credere, finire, sale, camera
```

Key validated behavior:

- `studenti` resolves to `studente`, retaining merged embedded-form and independent `form_of` evidence.
- `case` resolves to `casa` and exposes `le case` and `delle case` from explicit feminine-plural evidence.
- `andavano` resolves once to `andare`, preserving both evidence paths rather than emitting duplicate normalized candidates.
- `sale` retains its separate noun, plural-noun, and verb analyses.
- `camera` admits only Italian records through the strict `lang_code` filter.
- Usage examples must contain the exact searched surface and cannot be a person-label/conjugation fragment.
- Unsupported or incomplete grammar remains in `unclassifiedForms`; no mood, missing form, or lexical fact is guessed.

## Open data and provenance warnings

1. The direct `casa` record has no explicit structured gender/number. The adapter therefore withholds an article for `casa` rather than parsing gloss prose or guessing. Its explicit `case` relation can receive plural-feminine articles.
2. One relation requires a third traversal. The two-pass fixture collector reports it as unresolved instead of following an unbounded relation graph.
3. Local validation metadata lacks `sourceUrl` and `retrievedAt`. These are allowed as local warnings but are required for a production release.
4. Mood is not derived from surface spelling or incomplete `present` tags. Verb forms lacking support remain unclassified.

## D1 sizing interpretation

The result makes a paid-plan D1 benchmark reasonable, but does not prove D1 fit.

- The ~258 MB serialized minimal projection includes entry-level provenance and compact evidence estimates, but not actual SQLite storage or index overhead.
- The projected lookup data contains approximately 1.27 million headword/form rows plus 608,726 `form_of` rows.
- Cloudflare documents a 10 GB per-database limit on Workers Paid and a 500 MB per-database limit on Workers Free. A paid-plan benchmark is plausible; Free-plan headroom is likely too narrow after indexes and a simultaneous staging release.
- The next infrastructure-specific spike must materialize the projection and indexes in SQLite/D1, measure resulting storage, and test simultaneous release staging.

See [Cloudflare D1 platform limits](https://developers.cloudflare.com/d1/platform/limits).

## Full machine-readable artifacts

- `artifacts/it-adapter-validation/validation-report.json`
- `artifacts/it-adapter-validation/validation-report.md`
