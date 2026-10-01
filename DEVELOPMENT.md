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
first, which generates from `wrangler.jsonc` and needs no Cloudflare account. It
reads secrets from the empty [web/typecheck.env](./web/typecheck.env), never from a
local `web/.dev.vars`, so it gives the same answer on a laptop as in CI.

The `test` script finds its files by pattern, so a new test needs no edit to
[package.json](./package.json). It runs `test/*.test.ts`, then `web/test/*.test.ts`
and `web/test/*.test.tsx`; Node expands the quoted patterns and does not look into
subfolders. The web run uses the web workspace's `tsconfig.json`, because its tests
render React pages, and passes `--experimental-test-module-mocks`, which
`mock.module` needs. The integration test lives in `test/integration/`, so the
pattern skips it and only `test:integration` runs it.

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

### Call the JSON API

The same Worker answers a private JSON API on its own host,
`https://api.lexema.fyi/v1`, and `http://api.localhost:8790/v1` locally (epic
[#148](https://github.com/hueypov/lexema/issues/148); how each host is reached
is in [how to run the search page](./docs/RUN_THE_SITE.md#reach-each-host)).
Every request needs an
API key in the `X-API-Key` header. Keys live in the local app database,
`APP_DB`, which the seed migrates.
The CLI below makes admin keys, which belong to no developer account and carry
their own per-minute limit; a key a developer makes for their own account is an
owned key ([src/api/ownedKeys.ts](./src/api/ownedKeys.ts)), which carries none:
its limits are its account's plan's, and without a serving plan it answers a 402
`plan_required` ([#161](https://github.com/hueypov/lexema/issues/161)). Locally,
give the account a plan with `pnpm run plan enterprise` (below).

```sh
pnpm run api-key create --label "learning app" --per-minute 60
pnpm run api-key revoke 3
```

`create` prints the new key's id and the key itself, once. Only the key's SHA-256
is stored, so a lost key is revoked and replaced, never read back. `revoke`
takes the id. Both write to the `APP_DB` in `SEED_STATE` (default
`.data/seed-state`), the app database `pnpm run seed:dev` migrates, and
re-seeding drops every key with it.

A local database seeded before
[#167](https://github.com/hueypov/lexema/issues/167) has no `owner_account_id`,
`display_prefix` or `last_used_at` on `api_key`, and no `deleted_at` on
`developer_account`, so `create` and every API call fail on the missing column.
One seeded before [#187](https://github.com/hueypov/lexema/issues/187) has no
`endpoints` or `expires_at` on `api_key`, so every API call fails on the missing column.
One seeded before [#190](https://github.com/hueypov/lexema/issues/190) has no
`display_name` on `provider_identity`, so signing in fails on the missing column.
One seeded before [#201](https://github.com/hueypov/lexema/issues/201) still has
`daily_units` on `api_key` and `units` on `api_key_usage`, so making a key and
every answered call fail.
One seeded before [#229](https://github.com/hueypov/lexema/issues/229) has the
hand-built sign-in's account, identity and session tables, not better-auth's,
so signing in fails on the missing columns. Its accounts are not carried over
([ADR 0017](./.decisions/0017-better-auth-and-drizzle-own-accounts.md)): after
re-seeding, sign in again and make your keys again. Sign-in also needs
`BETTER_AUTH_SECRET` in `web/.dev.vars`
([sign in locally](./docs/RUN_THE_SITE.md#sign-in-locally)).
One seeded before [#240](https://github.com/hueypov/lexema/issues/240) keeps
every app table in the dictionary database and has no `APP_DB`, so signing in,
the dashboard, every API call and the report box fail on the missing table.
Run `pnpm run seed:dev` again: it rebuilds the dictionary from
[src/db/schema.sql](./src/db/schema.sql) and the app database from the app
migrations ([change the database schema](#change-the-database-schema)), so make
its keys again afterwards. That section also gives the one command that builds
the app database alone, keeping the dictionary.
One migrated before [#260](https://github.com/hueypov/lexema/issues/260) has no
`subscription` or `enterprise_plan` table, so `pnpm run plan` fails on the
missing table. Apply the new migration with the command in that section, which
keeps every account and key.

With the Worker running as in [how to run the search page](./docs/RUN_THE_SITE.md):

```sh
curl -i -H "X-API-Key: lx_…" "http://api.localhost:8790/v1/lookup?q=andavano"
curl -i -H "X-API-Key: lx_…" "http://api.localhost:8790/v1/lookup?q=andare&pos=verb&fields=forms&mood=congiuntivo&tense=presente&person=noi"
```

`/lookup` takes optional filters, each once: `pos`, `match` (`exact`, `form` or
`any`), `fields`, `limit_definitions`, and the grammar filters `mood`, `tense`,
`person`, `gender` and `number`, in ADR 0015's Italian labels or English codes.
The accepted values are in
[web/worker/api/lookupFilters.ts](./web/worker/api/lookupFilters.ts). A value
outside them is a 400 `invalid_parameter` naming the parameter. Filters that
keep none of a found word's candidates answer 200 with empty `results`.

The other endpoints ([web/worker/api/endpoints.ts](./web/worker/api/endpoints.ts))
reuse the same lookup and never rank anew:

```sh
curl -i -H "X-API-Key: lx_…" "http://api.localhost:8790/v1/lemmatize?q=andavano"
curl -i -H "X-API-Key: lx_…" "http://api.localhost:8790/v1/exists?q=sale"
curl -i -H "X-API-Key: lx_…" "http://api.localhost:8790/v1/inflect?lemma=andare&mood=congiuntivo&tense=presente&person=noi"
curl -i -H "X-API-Key: lx_…" "http://api.localhost:8790/v1/suggest?q=sal"
curl -i -H "X-API-Key: lx_…" "http://api.localhost:8790/v1/nearby?q=mangare"
curl -i -H "X-API-Key: lx_…" "http://api.localhost:8790/v1/random?pos=noun"
curl -i -H "X-API-Key: lx_…" -H "content-type: application/json" -d '{"q":["sale","andavano"]}' "http://api.localhost:8790/v1/lookup/batch"
```

`/inflect` takes `/lookup`'s grammar filters and is a 404 `unknown_lemma` for a
word that heads no record. `/random` takes `/lookup`'s `pos` and reads the
`source_record_by_pos` index, so a database seeded before it needs
`pnpm run seed:dev` again. `/lookup/batch` takes from 1 word up to the key's
calls a minute and answers one light result per candidate, or one
`found: false` per word not in the release.

The per-minute limit counts calls, as the day does: 1 per request, or 1 per word
for `/lookup/batch` ([src/api/calls.ts](./src/api/calls.ts); Huey on
[#216](https://github.com/hueypov/lexema/issues/216)). A request refused before
its calls are counted (a 400 bad `q`, parameter or body, a 403, 404 or 405) counts
nothing, toward the minute or the day; a 401 carries no limit headers
([web/worker/api/keyLimits.ts](./web/worker/api/keyLimits.ts)).

- An admin key's minute is a D1 row, so its answers carry exact
  `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`, and a 429
  `Retry-After` to the minute's end. Its answered calls are added to its D1 row
  for the day.
- An owned key is read with its account's plan state, in one read. With no
  serving plan (none, ended, cancelled past its end, or an Enterprise period
  past `--until`, Huey on [#222](https://github.com/hueypov/lexema/issues/222))
  it answers 402 `plan_required`; past due still serves. Its minute is its
  plan's rate, shared by all the account's keys and counted by the `CALLS_60`
  (Starter) or `CALLS_300` (Pro) Rate Limiting binding keyed by account id, or,
  for another Enterprise rate, by the account meter. Its answers carry
  `RateLimit-Limit`, and a rate 429 `Retry-After: 60`. Its calls are counted
  against the plan's allowance for the billing period by the account meter, a
  Durable Object per account
  ([src/api/accountMeter.ts](./src/api/accountMeter.ts)), in one call per
  request; the call past the allowance is a 429 `allowance_exceeded` naming the
  period's end, with `Retry-After` in seconds to it. Calls reach
  `api_key_usage` at most a minute later. Its `last_used_at` is written at most
  once a minute.

An API request is never counted against the site's per-visitor limits.

The reference a key holder reads is `developers.lexema.fyi/docs`, beside the
landing page at `/` and `/pricing`; `lexema.fyi` links to that site from its
footer and has no `/developers` page. The docs are one page per sidebar item,
`/docs` and `/docs/<page>`, listed in
[web/lib/developers/docsPages.ts](./web/lib/developers/docsPages.ts). What they state is
[web/lib/developers/apiReference.ts](./web/lib/developers/apiReference.ts), and
[web/test/developers.test.tsx](./web/test/developers.test.tsx) sends every example
they print to the API, runs each JavaScript example against it, and fails when an
answer differs, so a change to an answer changes the example with it. It also
fails when a sidebar link reaches no page. The
pricing page's "What counts as a call" table is read from the same call map the API charges by.

### Set an Enterprise plan

Starter and Pro come from Stripe: the Stripe plugin keeps each account's
subscription in `subscription`. Enterprise is set by hand, with its own calls,
rate and period, in `enterprise_plan`
([src/billing/planCli.ts](./src/billing/planCli.ts); the plans and their numbers
are [src/billing/plans.ts](./src/billing/plans.ts), epic
[#161](https://github.com/hueypov/lexema/issues/161)):

```sh
pnpm run plan enterprise 3 --calls 20000000 --per-minute 1000 --from 2026-10-01 --until 2026-11-01
pnpm run plan end 3
```

The number is the developer account's id. The period runs from the start of
`--from` up to the start of `--until`, both UTC days, and nothing renews it: from
`--until` on, the account's keys answer 402 until the next period is set with
`enterprise` again, which replaces the account's row.
An account whose Starter or Pro plan still serves is refused until that plan is
cancelled in Stripe. Bad flags print the usage line and exit 1. Both commands
write to the `APP_DB` in `SEED_STATE`, as `pnpm run api-key` does.

### Look at a pull request's Preview

Each pull request's branch gets a Preview with all three sites, and one comment
on the pull request names their URLs at its head
([docs/DEPLOY.md](./docs/DEPLOY.md#the-preview-comment)). The `preview smoke`
check at that head says whether they answer
([docs/DEPLOY.md](./docs/DEPLOY.md#the-preview-smoke)). Fabrika's
`review-ui render` reads the comment and captures one site per run, named with
`--app`:

```sh
fabrika review-ui render --pr <n> --app web --surface '/?q=andare'
fabrika review-ui render --pr <n> --app developers --surface /docs
fabrika review-ui render --pr <n> --app api --surface /v1/lookup
```

### Sign in on a Preview

A Preview's developer site, `<name>.developers-preview.lexema.fyi`
([ADR 0018](./.decisions/0018-previews-on-workers-builds.md)), has one more
button on `/sign-in`: *Sign in as test developer*. It posts to
`/sign-in/test-developer`, which signs in one fixed account, the test
developer, in that Preview's own `APP_DB` and goes to `/dashboard`
([web/worker/testSignIn.ts](./web/worker/testSignIn.ts),
[src/accounts/testDeveloper.ts](./src/accounts/testDeveloper.ts)
([#245](https://github.com/hueypov/lexema/issues/245))). It needs no provider
and no credential, only the `BETTER_AUTH_SECRET` the preview command sets on
the Preview ([DEPLOY.md](./docs/DEPLOY.md)). On the `production` and `local`
stages, and on every other host, the route is a 404 and the page has no
button.

A reviewer captures the signed-in dashboard with:

```sh
fabrika review-ui render --pr <n> --app developers --out signed-in --surface /sign-in \
  --interact '/sign-in#signed-in=click:role=button[name="Sign in as test developer"];expect:role=heading[name="Dashboard"]'
```

### Change the database schema

There are two databases, each with its own schema and its own Worker binding
([ADR 0017](./.decisions/0017-better-auth-and-drizzle-own-accounts.md),
[ADR 0018](./.decisions/0018-previews-on-workers-builds.md)):

- **The dictionary**, bound as `DB`, is raw SQL in
  [src/db/schema.sql](./src/db/schema.sql): the release tables, plus
  `claim_review`, which cascades from `source_record`. Code only reads it:
  [src/lookup/database.ts](./src/lookup/database.ts) hands it out as a
  `LookupDatabase`, whose one method takes a single `SELECT`, so a write does
  not type-check and is refused again at run time
  ([test/dictionaryReadOnly.test.ts](./test/dictionaryReadOnly.test.ts)).
- **The app database**, bound as `APP_DB`, holds the app tables
  (`developer_account`, `provider_identity`, `developer_session`,
  `verification`, `api_key`, `api_key_minute`, `api_key_usage`,
  `reader_report`, `report_opening`, `subscription`, `enterprise_plan`),
  defined in Drizzle in
  [src/db/app/schema.ts](./src/db/app/schema.ts). The first four are
  better-auth's, generated with `pnpm dlx auth@1.7.6 generate --adapter drizzle
  --dialect sqlite` and brought in under Lexema's table and column names. Their
  migrations are generated by drizzle-kit into
  [src/db/app/migrations/](./src/db/app/migrations), and the generated SQL is
  committed. `subscription` and `developer_account.stripe_customer_id` are
  the Stripe plugin's (`@better-auth/stripe`), brought in the same way.
  Every read and write of them goes through Drizzle: better-auth's
  adapter, Lexema's own key, usage and account code in
  [src/api/](./src/api) and [src/accounts/](./src/accounts), and the report
  store in [web/lib/dictionary/report.ts](./web/lib/dictionary/report.ts).

To change an app table, edit `src/db/app/schema.ts`, then write its migration:

```sh
pnpm run db:generate --name <what-changed>
```

Commit the new SQL file and the updated `meta/` beside it. Drizzle cannot
declare `STRICT`, so add it by hand to any table a migration creates, as the
first migration does. `pnpm exec drizzle-kit generate` on an unchanged schema
writes nothing, so a new file means the schema moved.

`pnpm run seed:dev` loads `schema.sql` into the local `DB` and applies every
app migration to the local `APP_DB` with `wrangler d1 migrations apply
lexema-app`, which reads them through `migrations_dir` in
[web/wrangler.jsonc](./web/wrangler.jsonc) and records which ran. A local
database seeded before
[#240](https://github.com/hueypov/lexema/issues/240) has no `APP_DB`: seed again,
or, to keep its dictionary, build the app database alone from `web/`, with
`--persist-to` naming the state:

```sh
pnpm exec wrangler d1 migrations apply lexema-app --local --persist-to ../.data/seed-state
```

Either way the app database starts empty: accounts, keys and reports in the old
state are not carried over, so sign in and make keys again. Later app
migrations apply the same way, one command, keeping what is there.

A test that needs the app database builds it through `applyAppMigrations` in
[src/db/app/migrations.ts](./src/db/app/migrations.ts), and its dictionary
separately from `schema.sql` ([test/databases.ts](./test/databases.ts)).
[test/appSchema.test.ts](./test/appSchema.test.ts) holds the key and report
tables to the shape they had in `schema.sql` and better-auth's tables to their
columns, and
Drizzle queries run under `node --test`
through [src/db/app/nodeSqlite.ts](./src/db/app/nodeSqlite.ts), which drives
`node:sqlite` with `drizzle-orm/sqlite-proxy`.

## Stack

| Layer | Choice | What it does for Lexema |
|---|---|---|
| Source data | Kaikki/Wiktextract `it-extract.jsonl.gz` | The lexical source of truth. Streamed one record at a time, filtered on `lang_code == "it"`, never loaded whole and never edited. |
| Serving | Cloudflare Worker + D1 + R2 | The Worker reads a D1 projection; R2 keeps the immutable source release. The importer runs offline and never inside a request ([ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md)). |
| Rendering | React via vinext | Cloudflare's Next.js-compatible framework on Vite, pinned exactly because it is beta ([ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md)). |
| Styling | Tailwind v4 over role tokens, Base UI for interactive parts | Utility classes in the markup; the nine colour roles are declared once in `web/app/globals.css` and named by [the manifest](./design-system-manifest.md). Base UI supplies behaviour for a part that needs client state ([ADR 0010](./.decisions/0010-base-ui-and-tailwind-style-the-page.md)). |
| Language | TypeScript, strict, `NodeNext` | `tsx` runs the CLI and the tests; there is no build step. |
| Tests | `node:test` through `tsx` | Unit tests run without the dataset; one integration test streams it. |
| App tables | Drizzle ORM + drizzle-kit | The developer app's tables and their migrations, pinned exactly; the dictionary stays raw SQL ([ADR 0017](./.decisions/0017-better-auth-and-drizzle-own-accounts.md)). |
| Sign-in | better-auth + its Drizzle adapter | Google and GitHub sign-in, account linking and sessions on the developer site, pinned exactly, wired by hand in [src/accounts/auth.ts](./src/accounts/auth.ts); keys, account deletion and the CSRF token stay Lexema's ([ADR 0017](./.decisions/0017-better-auth-and-drizzle-own-accounts.md)). |
| Billing | `@better-auth/stripe` + `stripe` | Stripe Checkout, the billing portal and the `subscription` rows on better-auth, pinned exactly; the plan catalogue, plan states and Enterprise stay Lexema's in [src/billing/](./src/billing) ([#161](https://github.com/hueypov/lexema/issues/161)). |
| Package manager | pnpm 10 | `pnpm-lock.yaml` is the only lockfile ([ADR 0002](./.decisions/0002-pnpm-is-the-package-manager.md)). |

## Layout

```
src/
├── api/            # API keys, call counts and per-key counters; `pnpm run api-key`
├── billing/        # plans, plan states and the Enterprise plan; `pnpm run plan`
├── cli.ts          # `pnpm run validate` — streams the file, writes the report
├── core/           # dataset-independent: record types, candidate resolver, report
├── db/             # the dictionary schema and lookup queries as SQL; app/ holds the Drizzle app tables
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
not repaired. About fifty records are another language's entry tagged Italian;
`pnpm run measure:section-language` counts them over the same dump
([the measurement](./reports/2026-10-01-non-italian-sections.md)), and nothing
filters them yet. How the whole release reads past those, field by field and on
a hand-labelled sample, is in
[the quality measurement](./reports/2026-10-01-dictionary-quality.md);
`pnpm run measure:quality` re-runs it. Source identity, licensing, and
attribution need review before any dictionary content is redistributed; local
development is the only access until that lands.

## CI gates

| Workflow | Fails when |
|---|---|
| [ci.yml](./.github/workflows/ci.yml) | the root typecheck, a unit test, or the `@lexema/web` typecheck fails |
| [gitleaks.yml](./.github/workflows/gitleaks.yml) | a changed file carries a secret |
| [leak-guard.yml](./.github/workflows/leak-guard.yml) | a changed doc or shell file carries a machine-local path |
| [decisions-index.yml](./.github/workflows/decisions-index.yml) | two records share an ADR id, or a filename disagrees with its frontmatter |
| [preview-marker.yml](./.github/workflows/preview-marker.yml) | its `preview smoke` check, at a pull request's head: one of the six known words does not resolve on the Preview, the developer site or the API does not answer, or a response lacks `X-Robots-Tag: noindex` |
