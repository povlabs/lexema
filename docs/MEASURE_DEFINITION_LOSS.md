# How to measure definition loss

The run sequence behind
[the definition-loss investigation](../reports/2026-09-18-definition-loss.md). That report
holds the findings; this page holds the commands. `tools/definition_loss.py` is Python and
standard-library only, so it needs `python3` and nothing installed.

Every step names its own inputs. Three kinds exist:

- **Committed fixtures** — the regression cases, the two drawn samples, the hand labels, the
  saved regression pages in `fixtures/upstream-pages/`, and the sampled page cache in
  [`fixtures/upstream-wikitext/`](../fixtures/upstream-wikitext/PROVENANCE.md). All present
  in a fresh checkout.
- **The archive** — `it-extract.jsonl.gz` in the source cache, `.data/source/`. Gitignored,
  absent from CI. `pnpm run source:fetch` fetches it from `povlabs/lexema-data` and checks it.
- **The network** — it.wiktionary.org, for `fetch` alone.

Steps 1 and 2 need only committed fixtures, and they are the pair `pnpm run
test:definition-loss` runs. Steps 3 to 6 are optional re-derivations, and each says what it
needs. Nothing here depends on a step later than itself.

## 1. Replay the saved regression cases

```sh
python3 tools/definition_loss.py verify
```

**Inputs:** `fixtures/definition-loss-regressions.json` and the saved pages in
`fixtures/upstream-pages/`. No archive, no network.

Every case pins a revision id, so this answers the same way whatever upstream does today. A
non-zero exit means a saved expectation stopped holding.

## 2. Prove the replay can fail

```sh
python3 test/definition-loss.py
```

**Inputs:** the step 1 fixtures, the committed reports and hand labels in
`fixtures/definition-loss-samples/`, and the committed page cache in
`fixtures/upstream-wikitext/`. No archive, no network.

Removes records and retained fields from a copy of the regression fixture and checks that
`verify` rejects each one, then re-runs `classify` over the committed sample with no hand
labels and checks that it stops instead of printing a rate. That last check reads the
committed cache: with an empty cache `classify` would score no record, flag nothing, and
pass vacuously.

The extract records `verify` compares are rebuilt from the cases themselves, so they cannot
catch archive drift. When the archive is present the test runs the same comparison against
the real records as well, and step 3 is that comparison on its own.

## 3. Compare the cases against the archive

```sh
python3 tools/definition_loss.py verify --with-extract
```

**Inputs:** the step 1 fixtures **and the archive**. Without the archive the command exits
naming the missing file. This is the check that catches a re-import changing which glosses,
examples or translations the extract retains, which is why it is a flag and not the default:
CI and a fresh checkout have no archive.

## 4. Re-score the committed samples

```sh
python3 tools/definition_loss.py classify --sample fixtures/definition-loss-samples/sample-lemma.json --out build/report-lemma.json
python3 tools/definition_loss.py classify --sample fixtures/definition-loss-samples/sample-inflected.json --out build/report-inflected.json
```

**Inputs:** the committed samples, the committed hand labels, and the committed page cache.
No archive, no network.

This reproduces `fixtures/definition-loss-samples/report-lemma.json` and
`report-inflected.json`, the two files the report's numbers come from. `classify` stops
rather than print a rate if it flags a record nobody has labelled. Each report carries
`definition_loss_rate`, its Wilson 95% interval and `projected_records`, which is the rate
times `stratum_population`.

## 5. Redraw a sample from the archive

**Inputs:** the archive for `sample`, the network for `fetch`, both plus fresh hand labels
for `classify`. This is the only networked step, and the only one that writes into the
committed cache.

```sh
python3 tools/definition_loss.py sample --stratum lemma --size 1200 --seed 11 --out build/sample-lemma.json
python3 tools/definition_loss.py fetch --sample build/sample-lemma.json
python3 tools/definition_loss.py classify --sample build/sample-lemma.json --out build/report-lemma.json
```

Seed 11 and size 1200 are the numbers the report measured; the inflected stratum is seed 11
and size 1000. The unit is the extract record: each drawn record keeps its word and its part
of speech, and scoring reads only that record's section.

`fetch` skips pages already in `fixtures/upstream-wikitext/`, so a redraw on the committed
seed downloads nothing and a different seed adds pages to the committed cache — review what
it wrote before committing it, and read
[its provenance page](../fixtures/upstream-wikitext/PROVENANCE.md) first. Hand labels in
`fixtures/definition-loss-samples/hand-labels.json` are tied to the revisions reviewed for
the report, so any other seed or size needs fresh review before `classify` prints anything.

## 6. Regenerate a regression case

```sh
python3 tools/definition_loss.py regressions casa manuale --out build/regressions.json
```

**Inputs:** the archive, and the named pages in the committed cache — `fetch` them first if
they are not there. Writes the pages it read into `fixtures/upstream-pages/` as well.

Emits drafts, not trusted labels: the definition/example/control split on every emitted line
is a human call, so read the draft before any of it replaces the committed fixture.
