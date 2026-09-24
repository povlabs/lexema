# Developing on Lexema

Lexema turns the Kaikki/Wiktextract Italian dictionary dump into source-grounded
search candidates. Today the repository holds the Italian source adapter, the
candidate resolver, a validation CLI, the research that checked them, the
importer that writes D1, the exact lookup over it, and a Worker serving the
search page locally. The same Worker is live at https://lexema.fyi, without a
database yet, so a search there says the lookup failed
([how to deploy it](./docs/DEPLOY.md)).

This is the builder's door. For what Lexema *is*, see [README.md](./README.md).

## Quickstart

```sh
pnpm install --frozen-lockfile
pnpm run typecheck                    # tsc --noEmit over src/ and test/
pnpm test                             # the unit tests; no dictionary data needed
pnpm --filter @lexema/web typecheck   # the Worker's own tsc, over web/ and the
                                      # lookup layer it imports
```

`.nvmrc` pins Node 24 for CI; the checks also pass on Node 26. GitHub Actions runs
all three on every push to `main` and every pull request
([ci.yml](./.github/workflows/ci.yml)). The web typecheck runs `wrangler types`
first, which generates from `wrangler.jsonc` and needs no Cloudflare account.

The `test` script enumerates its files by name. A new unit test runs only once its
path is added to that list in [package.json](./package.json). Its last entry is the
rendered-page test in `web/test/`, which renders the search page over an imported
fixture release; it needs the web workspace's React, so it names that workspace's
`tsconfig.json` and needs no archive and no database.

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

### Run the search page

The page answers from a seeded local D1. `pnpm run seed:dev` seeds it from the
committed fifty-word fixture, so a fresh clone needs no archive; the full release
needs the archive, as [RUN_AN_IMPORT.md](docs/RUN_AN_IMPORT.md) describes. A
search needs that local D1; the deployed Worker has none yet.

```sh
pnpm run seed:dev
pnpm --filter @lexema/web build
```

See [how to run the search page](./docs/RUN_THE_SITE.md) for the full recipe,
[how to deploy it](./docs/DEPLOY.md) for production,
[why the search page works this way](./docs/WEB.md) for the design, and
[the development seed](./docs/DEV_SEED.md) for what the seed covers.

## Stack

| Layer | Choice | What it does for Lexema |
|---|---|---|
| Source data | Kaikki/Wiktextract `it-extract.jsonl.gz` | The lexical source of truth. Streamed one record at a time, filtered on `lang_code == "it"`, never loaded whole and never edited. |
| Serving | Cloudflare Worker + D1 + R2 | The Worker reads a D1 projection; R2 keeps the immutable source release. The importer runs offline and never inside a request ([ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md)). |
| Rendering | React via vinext | Cloudflare's Next.js-compatible framework on Vite, pinned exactly because it is beta ([ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md)). |
| Styling | Tailwind v4 over role tokens, Base UI for interactive parts | Utility classes in the markup; the nine colour roles are declared once in `web/app/globals.css` and named by [the manifest](./design-system-manifest.md). Base UI supplies behaviour for a part that needs client state ([ADR 0010](./.decisions/0010-base-ui-and-tailwind-style-the-page.md)). |
| Language | TypeScript, strict, `NodeNext` | `tsx` runs the CLI and the tests; there is no build step. |
| Tests | `node:test` through `tsx` | Unit tests run without the dataset; one integration test streams it. |
| Package manager | pnpm 10 | `pnpm-lock.yaml` is the only lockfile ([ADR 0002](./.decisions/0002-pnpm-is-the-package-manager.md)). |

## Layout

```
src/
├── cli.ts          # `pnpm run validate` — streams the file, writes the report
├── core/           # dataset-independent: record types, candidate resolver, report
├── db/             # the D1 schema and the lookup queries, as SQL
├── import/         # the streaming importer, the SQL export and the dev seed
├── italian/        # the Italian adapter: normalize, tags, articles, examples
├── lookup/         # exact surface lookup over a complete release
└── source/         # gzip JSONL streaming and provenance refs
web/                # the @lexema/web workspace: the Worker and the search page
test/               # unit tests, plus the dataset-backed adapter test
fixtures/           # the checked forms and the local release metadata
docs/               # how the importer, the lookup and the page work
reports/            # dated findings and measurements
.decisions/         # the rulings
```

## Current state

GitHub milestones and issues are the source of truth for scope, tasks, and
completion checks. There is no Markdown backlog. The current goal is a working
Italian search website before complete dictionary cleanup; the milestone
descriptions hold the scope, and nothing in them is approval to publish.

The importer, the lookup and the search page run locally against a development
seed. The Worker is deployed with no database, and no release has been
published to it. Beneath them the
code is still an experimental validation spike. Passing its tests establishes
that the adapter reads the file as described, not that the dictionary is
accurate or complete. The API-first plan it was written against is superseded by the
website-first approach; [the original specification](./docs/LEXEMA_SPEC.md) is
kept as history, and none of the existing code is accepted as correct without
fresh review.

Three dataset limits are already measured, in [reports/](./reports/): the `casa`
entry loses its house definitions, embedded verb forms carry no mood tag, and the
`studente` verb claim is disputed upstream. The first is partly repaired: the seed
recovers dropped definitions from the raw Wiktionary pages, so `casa` shows its
seven. With the dump the archive was built from in the repository root
(`itwiktionary-20260701-pages-articles.xml.bz2`, gitignored, kept in
`hueypov/lexema-data`), that covers every word, and `pnpm run measure:recovery`
counts the loss exactly ([the measurement](./reports/2026-09-23-recovered-definitions-full-release.md));
without it, the seed reads the pages committed under `fixtures/`
([the development seed](./docs/DEV_SEED.md)). Losses with no structural mark are
not repaired. Source identity, licensing, and
attribution need review before any dictionary content is redistributed; local
development is the only access until that lands.

## CI gates

| Workflow | Fails when |
|---|---|
| [ci.yml](./.github/workflows/ci.yml) | the root typecheck, a unit test, or the `@lexema/web` typecheck fails |
| [gitleaks.yml](./.github/workflows/gitleaks.yml) | a changed file carries a secret |
| [leak-guard.yml](./.github/workflows/leak-guard.yml) | a changed doc or shell file carries a machine-local path |
| [decisions-index.yml](./.github/workflows/decisions-index.yml) | two records share an ADR id, or a filename disagrees with its frontmatter |
