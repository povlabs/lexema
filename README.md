# Lexema

An Italian word-search website for meanings, conjugations, articles, and related forms.

A search page now runs locally; it is not deployed anywhere. The first goal is a working search flow that shows available data honestly, including missing or disputed information. Dictionary quality can improve separately from the website.

## Work tracking

[GitHub milestones](https://github.com/hueypov/lexema/milestones) hold the goals. [Issues](https://github.com/hueypov/lexema/issues) hold tasks and decisions. Changes will go through linked pull requests.

## Repository status

The repository includes experimental code, tests, and research notes. Passing the existing tests does not establish dictionary accuracy or completeness. The search page runs on a local Worker only and is not deployed.

The downloaded dictionary and generated reports are not included. Source identity, licensing, and attribution need review before dictionary content is redistributed.

## Run the existing checks

pnpm is the package manager; commit `pnpm-lock.yaml` alongside dependency changes.

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
```

Any Node version manager works. `.nvmrc` pins Node 24 for CI; the checks also pass on Node 26.

The commands above do not need dictionary data. GitHub Actions runs the typecheck and unit tests on pushes and pull requests.

The lookup benchmark needs no dictionary data either — it generates its own release at two scales, so its numbers can be re-derived anywhere:

```sh
pnpm run bench:lookup
```

See [exact lookup](docs/LOOKUP.md) for what it measures and the captured output.

## Run the search page

The page needs the dictionary archive, because it answers from imported data.

```sh
pnpm run seed:dev
pnpm --filter @lexema/web build
```

See [how to run the search page](docs/RUN_THE_SITE.md) for the full recipe, [why the search page works this way](docs/WEB.md) for the design, and [the development seed](docs/DEV_SEED.md) for what the seed covers.

### Check the local dataset

Dataset checks additionally require the original `it-extract.jsonl.gz` in the repository root. That file is intentionally ignored by Git and is not downloaded by CI. Do not substitute a newer download and assume it is the same snapshot.

```sh
pnpm run test:integration
pnpm run validate
```

The validation command writes reports under ignored `artifacts/it-adapter-validation/`. A missing dataset causes these commands to fail; it does not affect the unit tests. See [the dataset inspection](docs/DATASET_SPOT_CHECK.md) for the checked file's checksum and [source research](docs/SOURCE_RESEARCH.md) for known limitations.
