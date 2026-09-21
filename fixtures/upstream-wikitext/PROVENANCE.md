# Sampled Italian Wiktionary pages

The page cache
[`tools/definition_loss.py classify`](../../tools/definition_loss.py) reads, committed so
that [the how-to](../../docs/MEASURE_DEFINITION_LOSS.md) and
`pnpm run test:definition-loss` run in a fresh checkout with no network.

- **Source.** it.wiktionary.org, through `https://it.wiktionary.org/w/api.php`
  (`action=query&prop=revisions`), saved verbatim.
- **Licence.** CC BY-SA 4.0, like the regression pages in
  [`fixtures/upstream-pages/`](../upstream-pages/).
- **Retrieved.** 2026-09-21, by `python3 tools/definition_loss.py fetch --sample <sample>`
  over both committed samples in
  [`fixtures/definition-loss-samples/`](../definition-loss-samples/).
- **Pages.** 2,200 — 1,200 from the lemma sample, 1,000 from the inflected sample. One JSON
  file per page, named after the URL-quoted page title.
- **Revision ids.** In the file, not in a manifest beside it: each file carries `word`,
  `revid`, `timestamp` and `wikitext`, so a page's exact revision is readable where the
  page is.

## Relation to the report

[The investigation](../../reports/2026-09-18-definition-loss.md) was measured on 2026-09-18
over a cache with the same shape. Re-running `classify` over these files reproduces both
committed reports in `fixtures/definition-loss-samples/` byte for byte, so the report's
numbers stand on what is committed here. Three pages — `diluente`, `fantastico` and
`fazzoletto` — were edited upstream between the report and this retrieval; none of them is a
flagged or confirmed record, which is why no number moved.

## Refreshing

`fetch` skips a page that is already cached, so a refresh means deleting the `.json` files
first — this page is not one of them.
Re-fetching moves the revision ids, and any number in the report has to be re-derived and
re-reviewed after that — hand labels in
[`hand-labels.json`](../definition-loss-samples/hand-labels.json) are tied to the revisions
a person read.
