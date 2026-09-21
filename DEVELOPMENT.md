# Developing on Lexema

Lexema turns the Kaikki/Wiktextract Italian dictionary dump into source-grounded
search candidates. Today the repository holds the Italian source adapter, the
candidate resolver, a validation CLI, and the research that checked them. The
website, the importer that writes D1, and the Worker are decided but not built.

This is the builder's door. For what Lexema *is*, see [README.md](./README.md).

## Quickstart

```sh
pnpm install --frozen-lockfile
pnpm run typecheck   # tsc --noEmit over src/ and test/
pnpm test            # the unit tests; no dictionary data needed
```

`.nvmrc` pins Node 24 for CI; the checks also pass on Node 26. GitHub Actions runs
the typecheck and the unit tests on every push to `main` and every pull request
([ci.yml](./.github/workflows/ci.yml)).

The `test` script enumerates its files by name. A new unit test runs only once its
path is added to that list in [package.json](./package.json).

### Checks that need the dataset

```sh
pnpm run test:integration   # streams the real file through the adapter
pnpm run validate           # writes a report under the ignored artifacts/
```

Both need the original `it-extract.jsonl.gz` in the repository root. Git ignores
it and CI never downloads it. Its SHA-256 is recorded in
[the dataset spot check](./reports/2026-09-18-dataset-spot-check.md); a newer
download from kaikki.org is a different snapshot, so do not substitute one and
assume the numbers still hold. A missing file fails these two commands and nothing
else.

### Lookup benchmark

The benchmark needs no dictionary data. It generates its own release at two
scales, so its numbers can be re-derived anywhere:

```sh
pnpm run bench:lookup
```

See [the benchmark guide](./docs/LOOKUP_BENCHMARK.md) for the flags and the
captured output.

## Stack

| Layer | Choice | What it does for Lexema |
|---|---|---|
| Source data | Kaikki/Wiktextract `it-extract.jsonl.gz` | The lexical source of truth. Streamed one record at a time, filtered on `lang_code == "it"`, never loaded whole and never edited. |
| Serving | Cloudflare Worker + D1 + R2 | The Worker reads a D1 projection; R2 keeps the immutable source release. The importer runs offline and never inside a request ([ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md)). |
| Rendering | React via vinext | Cloudflare's Next.js-compatible framework on Vite, pinned exactly because it is beta ([ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md)). |
| Language | TypeScript, strict, `NodeNext` | `tsx` runs the CLI and the tests; there is no build step. |
| Tests | `node:test` through `tsx` | Unit tests run without the dataset; one integration test streams it. |
| Package manager | pnpm 10 | `pnpm-lock.yaml` is the only lockfile ([ADR 0002](./.decisions/0002-pnpm-is-the-package-manager.md)). |

## Layout

```
src/
├── cli.ts          # `pnpm run validate` — streams the file, writes the report
├── core/           # dataset-independent: record types, candidate resolver, report
├── italian/        # the Italian adapter: normalize, tags, articles, examples
└── source/         # gzip JSONL streaming and provenance refs
test/               # unit tests, plus the dataset-backed adapter test
fixtures/           # the checked forms and the local release metadata
reports/            # dated findings and measurements
.decisions/         # the rulings
```

## Current state

GitHub milestones and issues are the source of truth for scope, tasks, and
completion checks. There is no Markdown backlog. The current goal is a working
Italian search website before complete dictionary cleanup; the milestone
descriptions hold the scope, and nothing in them is approval to publish.

The code is an experimental validation spike. Passing its tests establishes that
the adapter reads the file as described, not that the dictionary is accurate or
complete. The API-first plan it was written against is superseded by the
website-first approach; [the original specification](./docs/LEXEMA_SPEC.md) is
kept as history, and none of the existing code is accepted as correct without
fresh review.

Three dataset limits are already measured, in [reports/](./reports/): the `casa`
entry loses its house definitions, embedded verb forms carry no mood tag, and the
`studente` verb claim is disputed upstream. Source identity, licensing, and
attribution need review before any dictionary content is redistributed; local
development is the only access until that lands.

## CI gates

| Workflow | Fails when |
|---|---|
| [ci.yml](./.github/workflows/ci.yml) | the typecheck or a unit test fails |
| [gitleaks.yml](./.github/workflows/gitleaks.yml) | a changed file carries a secret |
| [leak-guard.yml](./.github/workflows/leak-guard.yml) | a changed doc or shell file carries a machine-local path |
| [decisions-index.yml](./.github/workflows/decisions-index.yml) | two records share an ADR id, or a filename disagrees with its frontmatter |
