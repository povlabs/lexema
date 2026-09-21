# How to measure definition loss

The run sequence behind
[the definition-loss investigation](../reports/2026-09-18-definition-loss.md). That report
holds the findings; this page holds the commands. `tools/definition_loss.py` is Python and
standard-library only, so it needs `python3` and nothing installed.

Step 1 needs no network and no dataset. Everything after it reads
`it-extract.jsonl.gz` from the repository root, the page cache written by step 4, or both.
Neither is in the repository, so run the steps in order in a fresh checkout.

## 1. Replay the saved regression cases

```sh
python3 tools/definition_loss.py verify
```

Reads `fixtures/definition-loss-regressions.json` and the saved pages in
`fixtures/upstream-pages/`. Every case pins a revision id, so this answers the same way
whatever upstream does today. A non-zero exit means a saved expectation stopped holding.

## 2. Prove the replay can fail

```sh
python3 test/definition-loss.py
```

Removes records and retained fields from a copy of the fixture and checks that `verify`
rejects each one, then re-runs `classify` over the committed sample with no hand labels and
checks that it stops instead of printing a rate. That last check needs the page cache from
step 4: with an empty cache `classify` scores no record, flags nothing, and the check fails
rather than pass vacuously. Steps 1 and 2 together are `pnpm run test:definition-loss`,
which stays out of CI for that reason — CI has neither the archive nor the cache.

## 3. Draw the lemma sample

```sh
python3 tools/definition_loss.py sample --stratum lemma --size 1200 --seed 11 --out build/sample-lemma.json
```

Seed 11 and size 1200 are the numbers the report measured. The unit is the extract record:
each drawn record keeps its word and its part of speech, and scoring later reads only that
record's section.

## 4. Fetch the sampled pages

```sh
python3 tools/definition_loss.py fetch --sample build/sample-lemma.json
```

Caches wikitext under `fixtures/upstream-wikitext/`, which is gitignored. This is the one
networked step, and step 5 and step 2's last check both read what it leaves behind.

## 5. Score the sample and print the rate

```sh
python3 tools/definition_loss.py classify --sample build/sample-lemma.json --out build/report-lemma.json
```

`classify` stops rather than print a rate if it flags a record nobody has labelled. Hand
labels live in `fixtures/definition-loss-samples/hand-labels.json` and are tied to the
revisions reviewed for the report, so a fresh draw — any other seed or size — needs fresh
review before it prints anything.

The written report carries `definition_loss_rate`, its Wilson 95% interval and
`projected_records`, which is the rate times `stratum_population`.

## 6. Repeat for the inflected stratum

```sh
python3 tools/definition_loss.py sample --stratum inflected --size 1000 --seed 11 --out build/sample-inflected.json
python3 tools/definition_loss.py fetch --sample build/sample-inflected.json
python3 tools/definition_loss.py classify --sample build/sample-inflected.json --out build/report-inflected.json
```

## Regenerate a regression case

```sh
python3 tools/definition_loss.py regressions casa manuale --out build/regressions.json
```

Emits drafts, not trusted labels: the definition/example/control split on every emitted
line is a human call, so read the draft before any of it replaces the committed fixture.
