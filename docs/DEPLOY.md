# How to deploy the site

Put the Worker that serves https://lexema.fyi, https://developers.lexema.fyi
and https://api.lexema.fyi live from this repository. Running it locally is
[RUN_THE_SITE.md](RUN_THE_SITE.md); why the page works as it does is
[WEB.md](WEB.md). A merge to `main` first runs the
[dictionary deploy](#the-dictionary-deploy), which applies the dictionary
changes the merge declares and then fast-forwards the `production` branch.
Each push to `production` deploys production, `main` and the merge queue's
`gh-readonly-queue/` branches get no Preview, and every other branch gets one, all built by Cloudflare's Workers Builds
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)). Huey sets both
up once, as [Workers Builds](#workers-builds) and
[the dictionary deploy](#set-up-the-dictionary-deploy) say. Once a month,
[the monthly release](#the-monthly-release) opens a pull request for a new
kaikki Italian release.

## What production is

`web/wrangler.jsonc` holds two configurations. The top level is local
development, with the placeholder D1 that `pnpm run seed:dev` fills.
`env.production` is what is deployed:

| Setting | Production |
|---|---|
| Worker | `lexema-web` |
| Address | the custom domains `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi` only, told apart by host (`web/worker/shared/hosts.ts`) |
| Stage | `LEXEMA_STAGE` is `production` ([below](#the-preview-only-domains)) |
| `workers_dev`, `preview_urls` | both off |
| D1 | `DB`, the shared dictionary `lexema-dictionary`, which code only reads, the same one the Previews read; `APP_DB`, production's own app database `lexema-app`, which the deploy command migrates ([below](#deploy)) ([#611](https://github.com/povlabs/lexema/issues/611)) |
| Release | `LEXEMA_RELEASE` is `it-0c432803`, the master the shared dictionary serves, the same as the Previews' |
| Report box | Turnstile: `TURNSTILE_SITE_KEY`, the public site key, is a var ([#611](https://github.com/povlabs/lexema/issues/611)); its secret `TURNSTILE_SECRET_KEY` is a Worker secret. The visitor code is keyed by the Worker secret `REPORT_VISITOR_KEY` ([#621](https://github.com/povlabs/lexema/issues/621)). Huey sets both secrets with `wrangler secret put`, never in the repository; without either, or without the site key, the box is closed ([below](#set-the-report-boxs-secrets)) |
| Rate limits | 15 searches and 120 suggestions a minute per visitor ([#128](https://github.com/povlabs/lexema/issues/128)); 10 sign-in starts ([#165](https://github.com/povlabs/lexema/issues/165)), 5 key creations ([#168](https://github.com/povlabs/lexema/issues/168)) and 5 billing requests ([#296](https://github.com/povlabs/lexema/issues/296)) a minute on the developer site |
| API rate | `CALLS_60` and `CALLS_300`, Rate Limiting bindings of 60 and 300 calls a minute per developer account, keyed by account id ([#261](https://github.com/povlabs/lexema/issues/261)) |
| Account meter | the Durable Object class `AccountMeterObject`, bound as `ACCOUNT_METER`, SQLite-backed through the `v1-account-meter` migration: one per developer account, counting its calls and adding them to `api_key_usage` at most once a minute ([#261](https://github.com/povlabs/lexema/issues/261)) |
| Sign-up | `DEVELOPER_SIGN_UP` is `closed` until Lexema can take payments ([#610](https://github.com/povlabs/lexema/issues/610)): the developer site offers no sign-in and no plan button, and the sign-in and Checkout routes answer 303 to the sign-in page (`web/worker/developers/signUp.ts`). Setting it to `open` restores the flow below |
| Sign-in | Google and GitHub, each on only once its client id and secret are set ([below](#turn-on-sign-in)) |
| Billing | Checkout, the billing portal and Stripe's webhook at `https://developers.lexema.fyi/auth/stripe/webhook`, on only once the Stripe secrets and live price ids are set ([below](#turn-on-billing)) |
| Account email | `EMAIL`, a `send_email` binding with no restriction, sending from `noreply@lexema.fyi` once `lexema.fyi` is onboarded to Email Sending ([below](#turn-on-account-email)) |
| Workers Logs | on, without invocation logs; what is logged and for how long is [RUN_THE_SITE.md](RUN_THE_SITE.md#what-is-logged) |

`www` to the apex and HTTP to HTTPS are dashboard settings (a redirect rule and
Always Use HTTPS), not Worker settings, so they are not in the repository.

## Card and suggestion cache identity

Cards and suggestion requests carry the master release, its last applied change,
its committed live-hide and curated-correction revisions, and `LEXEMA_VERSION.id`. That last value is
Cloudflare's [Worker version metadata binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/):
each uploaded Worker version has its own id, so a serving-code deploy moves cache
keys even with unchanged dictionary data. No manual cache-version bump or source
accuracy review is part of a deploy. The binding is declared separately for local,
production and Previews in [web/wrangler.jsonc](../web/wrangler.jsonc); it is not
inherited by environments. A Worker rollback names that version's code again,
combined with the data identity read now.

A nonempty `hide:records` transaction increments the singleton `hide_version`
revision alongside its serving-index changes. An empty plan writes nothing; a
failed transaction publishes neither the hide nor its revision. A master seeded
before this mechanism reads as revision zero. `update:upgrade` creates the table,
and the hide refuses to write until it has. Deploy this reader before running a live hide;
an older Worker cannot use the new revision. The operator's procedure remains
[Hiding records](RUN_AN_IMPORT.md#hide-another-languages-records-in-a-seeded-database).

A nonempty `correct:records` transaction does the same with the singleton
`correction_version`, which adds `.fix-N` to the address, and an absent table
reads as zero. `update:upgrade` creates it, with `corrected_claim`, before the
command writes. Deploy this reader before running it live, too. The procedure is
[Write the curated corrections](RUN_AN_IMPORT.md#write-the-curated-corrections-into-a-seeded-database).

Old card requests reaching the Worker still redirect to the current address with
`no-store`, before reading the card cache. Already downloaded immutable images can
remain in a crawler's cache at their old URL; newly rendered pages name the new
URL. Suggestion keys move too; a page left open keeps its old key until reloaded.
A reader may see a word page up to one hour old after a dictionary apply: the
Worker lets the reader's browser keep the home page and each word page for an
hour (`private, max-age=3600`, [pageCache.ts](../web/worker/dictionary/pageCache.ts)).
A page whose lookup failed is never kept, so an outage does not outlast itself
in a reader's browser.
Each data center's Cloudflare cache also keeps those pages, under the served
version, so a deploy or a dictionary apply starts it fresh and no reader gets a
page from an older version from there.
If the data identity cannot be read, the card route returns an uncached home card.
Reading the identity probes the newest applied change and table existence, plus
one singleton row for each revision table that exists; it scans no lexical rows.

Reproduce the hide, rollback, provenance, apply, cache-key and old-URL checks using
fixtures and disposable local SQLite databases only:

```sh
pnpm exec node --import tsx --test test/hiddenRecords.test.ts test/update.test.ts
TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec node --import tsx --test web/test/card.test.tsx web/test/suggestionAsker.test.ts
TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec node --import tsx --test --test-name-pattern='each configuration' web/test/preview.test.ts
pnpm --filter @lexema/web run typecheck
```

## Deploy

A merge to `main` deploys production once its
[dictionary deploy](#the-dictionary-deploy) is green and has fast-forwarded
`production`. Workers Builds runs the deploy command on every push to
`production`: the [sweep](#the-sweep), then the
[app migrations](#the-production-app-migrations) on `lexema-app`, then the
production build and `wrangler deploy`, the same `deploy:production` script as
a deploy by hand. A failed sweep never stops the deploy; a failed or refused
migration step always does. The build log is under the Worker's
**Deployments** tab, **View build history**
([Builds](https://developers.cloudflare.com/workers/ci-cd/builds/#view-build-and-preview-url)).

### Deploy by hand

For emergencies only, such as Workers Builds being down: deploy from a laptop.
Log in with `pnpm exec wrangler login` in `web/` first, as the account that owns
`lexema.fyi`. Then, from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @lexema/web run deploy:production
```

That builds with `CLOUDFLARE_ENV=production`, which makes the build write the
production settings into `web/dist/server/wrangler.json`, and deploys that file.
It applies no app migrations. When the commit being deployed adds one, run
`pnpm --filter @lexema/web run deploy:workers-builds` instead: the same sweep,
[app migrations](#the-production-app-migrations) and deploy that Workers Builds
runs, so the code never goes live ahead of its schema.

A deploy creates every custom domain its routes list. So a production deploy
puts `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi`
live, and creates the three preview-only domains below.

To see what would go up without deploying, add `--dry-run`:

```sh
pnpm --filter @lexema/web run deploy:production --dry-run
```

The domains it would create are the `routes` in
`web/dist/server/wrangler.json`. The dry run ends by listing the bindings, and
nothing else. Among them are the two databases and the release:

```
env.DB (lexema-dictionary)                                 D1 Database
env.APP_DB (lexema-app)                                    D1 Database
env.LEXEMA_STAGE ("production")                            Environment Variable
env.LEXEMA_RELEASE ("it-0c432803")                         Environment Variable
```

### The production app migrations

Production's app database is `lexema-app`
(`e77ba8e9-f4da-45fe-9b8c-322904054edc`), made empty by Huey on 2026-10-05
([#611](https://github.com/povlabs/lexema/issues/611)). It holds real accounts,
keys, usage and reader reports, so the deploy command only ever moves it
forward (`web/builds/productionAppDatabase.ts`). After the sweep and before
`wrangler deploy`, it:

1. Refuses the shared dictionary, by name or id, before it touches anything.
2. Finds `lexema-app` on the account under that id. It never creates it: an
   absent database, or one under another id, stops the deploy.
3. Reads the migrations it has applied, as the
   [Preview command](#the-preview-command) does. It first asks
   `sqlite_master` whether the `d1_migrations` table exists. A new, empty
   database has none, so it has applied nothing, and the table itself is never
   queried. A failed read stops the deploy. When they are the tree's list
   so far, in its order, it applies only the new ones from
   `src/db/app/migrations` with `wrangler d1 migrations apply --remote`, and
   logs one `app database:` line naming them. With none new, it applies
   nothing. The read and the apply both pass `--config` with a temporary
   config that names `lexema-app` by its real id. Without it, Wrangler would
   take the local placeholder id that `web/wrangler.jsonc`'s top level gives
   the same name.
4. When the history has left the tree's, such as after a renumbered
   migration, it stops red and names the divergence. Unlike a Preview's, it
   never deletes, creates again or resets the database; a person decides how
   to bring it back.

A failed or refused step stops the deploy, so production keeps its last
deployed version. Unlike the sweep, it is not housekeeping. It uses the same
Workers Builds token, with D1 Edit, that migrates Preview app databases
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)).

## The preview-only domains

Each branch's Preview ([ADR 0018](../.decisions/0018-previews-on-workers-builds.md))
answers the three sites one label below three domains that serve Previews and
never production:

| Site | Preview URL | One deployment |
|---|---|---|
| dictionary | `<name>.preview.lexema.fyi` | `<deployment-id>-<name>.preview.lexema.fyi` |
| developer site | `<name>.developers-preview.lexema.fyi` | `<deployment-id>-<name>.developers-preview.lexema.fyi` |
| API | `<name>.api-preview.lexema.fyi` | `<deployment-id>-<name>.api-preview.lexema.fyi` |

They are the last three `routes` of `env.production`, each with
`custom_domain: true`, `previews_enabled: true` and `enabled: false`, which is
Cloudflare's setting for a domain that serves Previews only
([Previews, custom domains](https://developers.cloudflare.com/workers/previews/custom-domains/)).
So the production deploy [above](#deploy) is what creates them, and Cloudflare adds a wildcard DNS record and
certificate for each. The certificate can take a while after the first Preview.

A Preview takes its settings from the `previews` block of `web/wrangler.jsonc`
alone, never from the top level or `env.production`:

| Setting | Preview |
|---|---|
| `LEXEMA_STAGE` | `preview`, so every response the Worker gives carries `X-Robots-Tag: noindex` (`web/worker/shared/stage.ts`); static assets, which never reach the Worker, get it from `web/public/_headers` |
| `LEXEMA_RELEASE` | `it-0c432803` |
| `DB` | the shared dictionary D1 `lexema-dictionary`, which code only reads |
| `APP_DB` | `<REPLACE_ME>`, which the [Preview command](#the-preview-command) replaces with the branch's own app D1; `wrangler preview` refuses to run while it is there |
| `DICTIONARY_SLICE` | not in `web/wrangler.jsonc`; the [Preview command](#the-preview-command) adds it, read-only, only for a branch that changes dictionary data: its [dictionary slice](#the-dictionary-slice) |
| Rate limits | production's limits under their own `namespace_id`s, `CALLS_60` and `CALLS_300` included |
| `ACCOUNT_METER` | the account meter's binding; each Preview gets its own Durable Object namespace and storage |
| `EMAIL` | a `send_email` binding with `destination_address` set to Huey's verified address, so it can send nowhere else |
| `EMAIL_ONLY_TO` | Huey's verified address, the same as the binding's `destination_address`, so every [account email](#turn-on-account-email) goes to Huey whoever the account is |
| `DEVELOPER_SIGN_UP` | `closed`, as production: no sign-in or plan button, and the sign-in and Checkout routes answer 303 to the sign-in page; the test sign-in still shows there |
| Sign-in | off: both OAuth client ids are empty |
| Billing | off: the Stripe test-mode price ids are set, but the [Preview command](#the-preview-command) sends no Stripe secret, so the billing routes and the webhook answer 503 |

`web/test/preview.test.ts` fails if a Preview's email can reach anyone else,
if a Preview rate limit shares a production `namespace_id`, if a production
build carries any stage but `production`, or if the build drops the `previews`
block. The Workers Builds settings that build and sweep Previews are
[below](#workers-builds).

## Workers Builds

Cloudflare's Workers Builds is connected to this repository and runs one of two
commands on every push, from `web/`. Their steps are in `web/builds/`, which
runs under plain `node`, not `tsx`. Node only strips types, so those files use
no TypeScript that is more than types, such as a parameter property or an
`enum`. `web/test/buildsRunUnderNode.test.ts` checks every file there the way
Node strips it ([#611](https://github.com/povlabs/lexema/issues/611)).

| Branch | Command | What it runs |
|---|---|---|
| `production` | `pnpm run deploy:workers-builds` | the [sweep](#the-sweep), then the [app migrations](#the-production-app-migrations) on `lexema-app`, then `deploy:production`: the production build and `wrangler deploy`. A failed or refused migration step deploys nothing |
| `main` | the [Preview command](#the-preview-command) | `preview:prepare` only, which skips `main`: no build, no app D1, no Preview |
| `gh-readonly-queue/...` (the merge queue) | the [Preview command](#the-preview-command) | `preview:prepare` only, which skips it like `main`: no build, no app D1, no Preview |
| any other | the [Preview command](#the-preview-command) | `preview:prepare`, then `wrangler preview` |

Only the [dictionary deploy](#the-dictionary-deploy) moves `production`, so the
site never deploys ahead of the dictionary it reads. `main` builds no Preview:
what lands on it goes live through `production`, and the next production
build's [sweep](#the-sweep) would delete a `main` Preview anyway
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md), amended on
[#491](https://github.com/povlabs/lexema/issues/491)). Nor does a merge queue
branch: GitHub tests each queued pull request on a temporary branch whose name
starts with `gh-readonly-queue/`, and nobody opens a Preview of it (amended on
[#566](https://github.com/povlabs/lexema/issues/566)). The match is exact and
case-sensitive, at the start of the name (`getsNoPreview` in
`web/builds/previewCommand.ts`).

### The Preview command

This is the exact string for the Preview command field:

```sh
pnpm run preview:prepare && if [ -f dist/preview/name ]; then npx wrangler preview --config dist/server/wrangler.json --name "$(cat dist/preview/name)" --secrets-file dist/preview/secrets.json; fi
```

It has two steps, because Workers Builds refuses a custom Preview command that
does not run `npx wrangler preview` itself
([Build branches, existing Workers](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#existing-workers-connected-to-builds)).
Workers Builds has no setting that leaves a branch out of preview builds, only
one checkbox for all of them
([Build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#configure-preview-builds)),
so the second step runs only when the first wrote the Preview name. On `main`
and on a `gh-readonly-queue/` branch, `preview:prepare` writes nothing and does nothing else, and the command ends
there, green.

1. `pnpm run preview:prepare` (`web/builds/preview.ts`) stops at once on
   `main` and on a `gh-readonly-queue/` branch. On any other branch, it runs the production build. It finds or
   creates the branch's app D1 `lexema-preview-app-<name>` and binds it as
   `APP_DB` in `web/dist/server/wrangler.json`, leaving `DB` on the shared
   dictionary. For a branch that adds change declarations, it also gives the
   Preview its [dictionary slice](#the-dictionary-slice), bound as
   `DICTIONARY_SLICE`. It applies the app migrations to the app D1. Then it writes
   the [Preview name](#the-preview-name) to `web/dist/preview/name`, and the
   secrets for the deployment to `web/dist/preview/secrets.json`. That file holds
   a new random `BETTER_AUTH_SECRET` and a new random `REPORT_VISITOR_KEY` on
   every push, the first and every later one.
2. If that name file exists, `npx wrangler preview` deploys the Preview from
   that config, named by that name, with those secrets. Without `--name`,
   Wrangler would name it after the raw branch.

The secrets are sent with every Preview deployment, because a deployment keeps
only the secrets it is sent: Wrangler 4.135.0 has no flag to keep the last
deployment's. A push that sent none would leave the Preview with no
`BETTER_AUTH_SECRET`, and sign-in would break, and no `REPORT_VISITOR_KEY`, and
the report box would answer `failed`. They go up with the deployment,
not after it, because `wrangler preview secret put` refuses a Preview that has
no deployment yet. So nothing has to run after `npx wrangler preview`. The cost
is that each push signs the Preview's testers out, and starts its reports'
visitor codes afresh, which only resets an hour's report allowance.

`npx` runs the Wrangler pinned in `web/package.json`, 4.135.0, from
`web/node_modules`, and downloads nothing
([Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#build-settings):
"Workers Builds will use the Wrangler version set in your `package.json`").
The flags are Wrangler 4.135.0's (`wrangler preview --help`).

Cloudflare's pages show a Preview command with arguments, such as
`npx wrangler preview --env staging`
([Builds configuration, Preview command](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#preview-command)),
and `--name` to choose the name
([Previews, get started](https://developers.cloudflare.com/workers/previews/get-started/#step-2-deploy-a-preview)).
They say nothing about `&&` or `$(...)` in the field. If the dashboard refuses
this string, that is why.

Every later push to a branch reuses its app D1, and keeps its rows, while the
migrations it applied are the tree's list so far, in the tree's order. Wrangler
picks the migrations to run by file name alone, from its `d1_migrations` table,
which keeps no SQL. So when a merge of `main` renumbers a migration the branch
already applied, Wrangler would run the same SQL again under the new name, and
fail. Before the migrations run, `preview:prepare` reads the names the app D1
applied. If one is not in the tree, or one is out of the tree's order, it
deletes the app D1, creates it again empty, and applies every migration. One
`app database: reset` line in the build log names the migration that differed.
A Preview's app data is for review only; the test developer is made again at
the next test sign-in. `web/test/workersBuilds.test.ts` checks the prepare step
and the deploy command against a fake account, with no network and no
credential.

### The dictionary slice

A pull request that adds or fixes dictionary words cannot show them on a
Preview that reads only the shared dictionary. So a branch that adds change
declarations under `dictionary-changes/` past `main` gets a small D1 of its
own, `lexema-preview-dict-<name>`, holding only the words those declarations
touch, with their changes applied
([#447](https://github.com/povlabs/lexema/issues/447), ADR 0018). The Preview
binds it read-only as `DICTIONARY_SLICE`, beside `DB`. A page lookup and an
API lookup (`/v1/lookup`, `/lemmatize`, `/exists`, `/inflect`) of a word the
slice serves read the slice, so a word the pull request hides reads as not
found and a word it adds or recovers reads as found. Every other word, and
suggestions, read the shared dictionary.

The prepare step builds it in this order, and logs a line starting
`dictionary slice:` that says what it did and why:

1. `pnpm run preview:slice declared` (`src/deploy/sliceCli.ts`, from the
   repository root) fetches `main` and reads the declarations the branch adds
   past it. None, or a base it cannot read, gives no slice, and the Preview is
   the one a branch without declarations gets.
2. A slice that already holds the fingerprint of those declarations,
   `src/db/schema.sql` and the slice format is reused, and nothing is written.
3. Otherwise `pnpm run preview:slice build` plans each declaration with
   `planWrite` against `lexema-dictionary`, through single `SELECT`s only, and
   takes the words each plan touches. `update:auto`, `hide:records`,
   `correct:records`, `load:page-entries` and `load:recovered-definitions`
   name them; `update:upgrade` touches
   none, and `normalize:source-text` rewrites the whole dictionary, so a branch
   with only those gets no slice. It builds the slice in a local SQLite
   database: the schema, the shared rows a lookup of those words reads, then
   each plan's SQL, with foreign keys on as on D1. A plan it cannot read, or
   SQL that does not run on the slice, gives no slice.
4. It counts the rows writing the slice would write, each row once for its
   table and once per index, against `SLICE_ROWS_WRITTEN_CAP`, 250,000 rows,
   which the prepare step passes as `--cap`. When the slice of every touched
   word is over the cap, the slice is a sample
   ([#741](https://github.com/povlabs/lexema/issues/741), ADR 0018). It takes
   the words the declarations name in their `lookups` first, then the other
   touched words in key order, as many as fit under the cap. Each candidate
   is measured on the slice actually built, since two words can share rows.
   The touched words it leaves out read the shared dictionary, and a change's
   rows for them are dropped from the sample. The log line says the slice is
   a sample, gives its word count, its rows written and the cap, and names
   every touched word it left out. To show a word in a large change's
   Preview, name it in the declaration's `lookups`.
5. When not even one word fits under the cap, it writes nothing and binds no
   slice, and the log line gives the count and the cap. Otherwise it deletes
   the branch's old slice, creates a new one, runs the slice's SQL on it with
   `wrangler d1 execute --remote --file`, and reads the fingerprint back.

Whatever fails, the Preview still deploys on the shared dictionary. Every step
refuses a D1 whose name or id is `lexema-dictionary`'s before it reads,
writes or deletes it (`web/builds/previewSlice.ts`).

What a slice holds for its words: every row of each record that spells one or
names one as a form-of target, of the lemma records those name, and of the
records an applied change links them to; the words' page-only entries; and
the accent and typo index rows a not-found page reads for them. A lookup there
lists another word's multi-word expressions and inflections only as far as
the slice holds that word.

It needs no new setting or secret. The build reads `lexema-dictionary` with the
Workers Builds token, which already has D1 Edit (step 5 of
[Set it up](#set-it-up)), and reads `povlabs/lexema-data`, which is public,
with no token. Planning an `update:auto`, `hide:records`, `load:page-entries`
or `load:recovered-definitions` declaration downloads an archive and a dump, so
that build runs longer.

### The Preview name

`<name>` is made from the branch name by `web/builds/previewName.ts`, which the
sweep also uses. A branch of at most 26 lowercase letters, digits and inner
hyphens keeps its name: `huey-242-preview` previews as `huey-242-preview`. Any
other branch keeps a cleaned-up start and ends with the first 8 hex digits of
its own SHA-256, so two branches never share a name and one branch always gets
the same one: `huey/foo_bar` previews as `huey-foo-bar-54d62606`, and
`build/251-preview-adr-f7d91140` as `build-251-preview-d8c93941`.

26 is what fits one DNS label (63 characters) in the deployment URL
`<deployment-id>-<name>.preview.lexema.fyi`
([Previews, URLs](https://developers.cloudflare.com/workers/previews/#urls)).
Cloudflare does not say how long a deployment id is, so the limit assumes the
longest, a 36-character UUID.

### The preview comment

Cloudflare's docs say Workers Builds comments the Preview URL on the pull
request
([GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/#pull-request-comment)),
but on this repository it posts no comment, only a check run named
`Workers Builds: lexema-web` (#244). So
[`preview-marker.yml`](../.github/workflows/preview-marker.yml) runs when that
check run completes with `success` for a pull request's current head. It checks
that the three sites answer, then keeps one comment on the pull request naming
`https://<name>.preview.lexema.fyi/`,
`https://<name>.developers-preview.lexema.fyi/` and
`https://<name>.api-preview.lexema.fyi/`, each `@ <head sha>`, under the
`<!-- preview-deploy:web -->`, `<!-- preview-deploy:developers -->` and
`<!-- preview-deploy:api -->` anchors Fabrika's `review-ui render` reads. A build of an older commit changes nothing. It uses
only `GITHUB_TOKEN`; the steps are `web/builds/previewMarkerCommand.ts`.

### The preview smoke

When the comment is written, the same workflow's smoke job asks the three sites
it names for one thing each (#246), and each of them for the site icon (#383):

| Site | Request | Passes when |
|---|---|---|
| dictionary | `/?q=<word>` for sale, andare, andavano, casa, bello and studente | a 200 whose page shows a reading; a word it cannot find is a 200 too, with no reading |
| developer site | `/` | a 200 |
| API | `GET /v1/lookup?q=andare` with a key that does not exist | the API's own 401 `invalid_key`, which it gives only after looking the key up in the Preview's app D1 |
| all three | `/favicon.ico` and `/apple-touch-icon.png` | a 200 with `image/vnd.microsoft.icon` (or `image/x-icon`) and `image/png`; both are static assets, served before the Worker runs |

Every response must also carry `X-Robots-Tag: noindex`. The result is the
`preview smoke` check run on the pull request's head, with one row per request.
A workflow that runs on `check_run` runs from `main`, so a job's own check
would land on `main`'s commit; the smoke creates its check through the Checks
API instead. If the head moves on during the smoke, it reports nothing, and the
newer commit's run reports. It uses only `GITHUB_TOKEN` and holds no API key;
the steps are `web/builds/previewSmokeCommand.ts`.

### The sweep

On each push to `production`, before the deploy, the sweep deletes the Preview,
the app D1 and the [dictionary slice](#the-dictionary-slice) of every branch
with no open pull request. A merged pull request
is cleaned up at the production build that follows its merge; one closed
without merging, at the next production build.

- It reads the open pull requests' head branches from GitHub's REST API. The
  repository is public, so no token is needed; `GITHUB_PR_READ_TOKEN`, if set as
  a Workers Builds build secret, is sent with the request (#527).
- It looks only at D1 databases whose name starts with `lexema-preview-app-` or
  `lexema-preview-dict-`, and never at the shared dictionary
  `lexema-dictionary`. A slice with no app D1 still names its branch's Preview.
- It deletes the Preview first (`wrangler preview delete`), then its slice and
  its app D1 (`wrangler d1 delete`). If the Preview cannot be deleted, its D1s
  stay, and the next sweep tries again; so does a D1 that fails to delete.
- If GitHub's list cannot be read (a refused or failed request, or a malformed
  answer), it deletes nothing.
  The build log then says `sweep: deleting nothing` and why.

A Preview made any other way, such as `wrangler preview` from a laptop, has no
`lexema-preview-app-` D1, so the sweep never sees it. Delete it by hand with
`pnpm exec wrangler preview delete --name <name>` in `web/`.

### Set it up

Do these once, in this order. Each Cloudflare step names the doc page it comes
from; where a label is not in the docs, the step says what to look for.

**1. Create the read-only GitHub token (optional).** `povlabs/lexema` is public,
so the sweep reads open pull requests without a token (#527). A token only
raises GitHub's rate limit for anonymous reads.

1. Open https://github.com/settings/personal-access-tokens/new (a fine-grained
   token).
2. **Token name**: `lexema-workers-builds-sweep`.
3. **Resource owner**: `povlabs`.
4. **Expiration**: pick a date and put a reminder in your calendar. When it
   expires the sweep deletes nothing, and says `GitHub answered 401` in the build
   log, until you make a new one; deploys carry on.
5. **Repository access**: **Only select repositories**, then pick
   `povlabs/lexema` and nothing else.
6. **Permissions**: under the repository permissions, set **Pull requests** to
   **Read-only** (on the newer page, select **Add permissions**, then **Pull
   requests**). Add nothing else. GitHub adds **Metadata: Read-only** by itself,
   which every token has.
7. Select **Generate token** and copy it. GitHub shows it once.

**2. Connect the repository to the Worker**
([Builds, connect an existing Worker](https://developers.cloudflare.com/workers/ci-cd/builds/#connect-an-existing-worker)).

1. Open https://dash.cloudflare.com/?to=/:account/workers-and-pages and select
   the Worker `lexema-web`. If it is not there yet, [deploy by hand](#deploy-by-hand)
   once first: Workers Builds needs the dashboard Worker's name to match `name` in
   `web/wrangler.jsonc`.
2. Select **Settings**, then **Builds**, then **Connect**.
3. Pick your GitHub account and the repository `povlabs/lexema`. If Cloudflare
   asks to install the **Cloudflare Workers and Pages** GitHub app, give it access
   to `povlabs/lexema` only
   ([GitHub integration, manage access](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/#manage-access)).
4. Fill in the build settings with exactly these values
   ([Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#build-settings)):

   | Setting | Value |
   |---|---|
   | Git branch (the production branch) | `production` ([below](#set-up-the-dictionary-deploy) makes it) |
   | Build command | `pnpm install --frozen-lockfile` |
   | Deploy command | `pnpm run deploy:workers-builds` |
   | Preview command (the one for branches that are not `production`, whatever the page labels it) | `pnpm run preview:prepare && if [ -f dist/preview/name ]; then npx wrangler preview --config dist/server/wrangler.json --name "$(cat dist/preview/name)" --secrets-file dist/preview/secrets.json; fi` ([above](#the-preview-command)) |
   | Root directory | `web` |
   | API token | leave the default, **Create new token**, unless one already exists for Workers Builds; then select that one |

5. Save. Cloudflare may start a first build straight away; it can fail until
   the steps below are done, and the next push retries.

**3. Turn on preview builds**
([Build branches, configure preview builds](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#configure-preview-builds)).

1. In the same Worker, go to **Settings**, **Build**, **Branch control**.
2. Check that the production branch is `production`, and tick **Enable Preview
   Builds**.
3. If the page shows a **Set up Worker Previews** banner, select **Set up**.
   Set the Preview command to the [Preview command](#the-preview-command) above,
   exactly:

   ```sh
   pnpm run preview:prepare && if [ -f dist/preview/name ]; then npx wrangler preview --config dist/server/wrangler.json --name "$(cat dist/preview/name)" --secrets-file dist/preview/secrets.json; fi
   ```

   Then select **Switch to Worker Previews**. It cannot be undone, and nothing
   here needs the old model.

**4. Add the build variables and the secret**
([Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#build-settings),
[Build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)).

In **Settings**, **Build**, find **Build variables and secrets** (the build
image page calls it **Build Variables and Secrets**), and add:

| Name | Value | Type |
|---|---|---|
| `GITHUB_PR_READ_TOKEN` | the token from step 1 | secret (choose the encrypt or secret option, so the value is hidden) |
| `SKIP_DEPENDENCY_INSTALL` | `1` | plain text |
| `PNPM_VERSION` | `10.13.1` | plain text |

`SKIP_DEPENDENCY_INSTALL` stops the automatic install, so the build command's
`pnpm install --frozen-lockfile` is the only one, from the root lockfile.
`PNPM_VERSION` is the pnpm `package.json` names. These are build variables, not
the Worker's own variables under **Variables & Secrets**, which the build never
reads.

**5. Give the Workers Builds API token D1 Edit**
([Builds configuration, API token](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token)).

The token Workers Builds made in step 2 can edit Workers, KV and R2, but not D1,
and both commands create, migrate or delete D1 databases.

1. Open https://dash.cloudflare.com/profile/api-tokens (**My Profile**, **API
   Tokens**).
2. Find the token Workers Builds uses: it is the one the **API token** setting
   in step 2 names. Select **Edit** on its row (under the three-dot menu if there
   is no button).
3. Under **Permissions**, add a row: **Account**, **D1**, **Edit**.
4. Select **Continue to summary**, then **Update token**.

That token can now edit every D1 on the account, the dictionary too. ADR 0018
accepts this, since only reviewed build commands use it.

**6. Check it works.**

1. Push a branch and open a pull request. Once the build succeeds, the
   [preview comment](#the-preview-comment) names its three sites. The build log shows `Preview <name> for branch <branch>`, then
   `app database: created lexema-preview-app-<name>`, the migrations,
   `BETTER_AUTH_SECRET: a new random one goes up with Preview <name>`,
   `REPORT_VISITOR_KEY: a new random one goes up with Preview <name>`, and
   `wrangler preview`.
2. Push to the branch again. The log now says `app database: reusing`, and
   again the two `a new random one goes up with Preview <name>` lines.
3. Merge it. Once its dictionary deploy run is green, the `production` build
   log starts with `sweep:` lines, deletes that branch's Preview and app D1,
   and then deploys production.

## CI runners

Every GitHub Actions job here runs on a GitHub-hosted `ubuntu-latest` runner.
`povlabs/lexema` is a public repository, so those minutes are free
([GitHub Actions billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)).
Do not use a self-hosted runner on this repository: a pull request from a fork
can run code on it
([self-hosted runner security](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners#self-hosted-runner-security)).
Which change starts which workflow is in
[DEVELOPMENT.md](../DEVELOPMENT.md#ci-gates).

## The dictionary deploy

[`dictionary-deploy.yml`](../.github/workflows/dictionary-deploy.yml) runs on
every push to `main`, its `deploy` job one run at a time. It writes every declared change to
the shared dictionary D1 `lexema-dictionary`, and it is the only thing that
moves `production`
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)). One write to
`lexema-dictionary` still runs from Huey's laptop, outside it: the one-time
upload of a release
([RUN_AN_IMPORT.md](RUN_AN_IMPORT.md#load-a-release-into-cloudflare-d1)).

Most pushes declare nothing. So the workflow's first job, `gate`, reads
`production..<the run's commit>` with no install and no secret. When that range
adds or changes nothing under `dictionary-changes/`, `gate` fast-forwards
`production` itself and the run ends in seconds; a commit `production` already
holds needs nothing. Otherwise it starts the `deploy` job, whose steps are
`pnpm run deploy:dictionary` ([src/deploy/](../src/deploy/dictionaryDeploy.ts)):

1. It reads the [change declarations](../dictionary-changes/README.md) added in
   `production..<the run's commit>`, oldest first. With none, it writes
   nothing and goes to step 6.
2. It fetches the archive and dump each one reads from `povlabs/lexema-data`
   ([below](#where-the-archives-are)) and checks them: the archive's SHA-256
   against its [`ARCHIVE_FACTS`](../src/source/archiveFacts.ts) entry, the
   dump's size and SHA-1 against
   [`KNOWN_DUMPS`](../src/source/wiktionaryDump.ts). A file that does not match
   stops the run.
3. It records a D1 Time Travel bookmark, the restore point. Before anything is
   written, its log gets the line
   `bookmark: <bookmark> (restore with: <the restore command below>)`, so a run
   killed mid-write still names it. The summary names it again at the end.
   The run then runs the upgrade's DDL
   ([`update:upgrade`](../src/update/masterUpgrade.ts)) as its own batch, so
   no declaration's SQL carries DDL
   ([#507](https://github.com/povlabs/lexema/issues/507),
   [#509](https://github.com/povlabs/lexema/issues/509)). The upgrade
   creates the tables every write command writes into, `corrected_claim`,
   `corrected_edge`, `correction_version`, `hidden_record` and `hide_version` among them, so a
   feed apply, a correction or a hide changes no schema. It does so when
   the dictionary lacks a table, index or view the upgrade creates, or when
   it stores a rebuilt table or its index with a definition other than
   [schema.sql](../src/db/schema.sql)'s, such as a `hidden_record` from
   before [#389](https://github.com/povlabs/lexema/issues/389), without
   `lemma_line`. Comments and spacing do not count.
   The rebuilt tables come in four groups (`REBUILT_GROUPS`): the four
   page-entry tables with `corrected_definition`; `recovered_definition` with
   `recovered_label` and `recovered_example`; `hidden_record`; and
   `corrected_form`. For a
   changed definition the upgrade rebuilds that table's group with its rows:
   it copies the rows aside, drops the group's tables, creates them and their
   indexes from schema.sql and copies the rows back by the columns both
   definitions share. A `corrected_form` from before
   [#743](https://github.com/povlabs/lexema/issues/743) has no `surface_key`,
   which SQL cannot compute: the upgrade keys each distinct `surface` with the
   release's normalizer when it plans, and the copy writes that key beside
   each row. A row the new definition refuses stops the batch, and
   D1 rolls it back whole. After the batch the run checks that nothing is
   missing, nothing differs and every rebuilt table holds as many rows as
   before. The upgrade also compares each of the four serving views
   (`served_release`, `served_record`, `form_of_candidate`, `surface_hit`)
   with schema.sql's the same way. A changed view is replaced, not rebuilt:
   the upgrade drops the views and creates them again. A view holds no rows,
   so this rebuilds no table
   ([#525](https://github.com/povlabs/lexema/issues/525)).
   After the batch the run checks that no view still differs. So a change
   to those tables or views in schema.sql reaches the shared dictionary on
   the next deploy. The
   [pull request plan check](#the-pull-request-plan-check) and
   `update:upgrade --plan-only` name each table a rebuild drops, with its rows.
   `update:upgrade --plan-only` also names each view it replaces.
4. For each declaration it runs the command's plan, without writing, and holds
   its counts to the declared ones and to the hard limits: more than 100
   records removed, or more than 5% of the records changed or removed. Any
   difference stops the run before that change is written. Otherwise it runs
   the plan's SQL as one transaction, then reads the changed rows back.
   SQL of at most 100,000 bytes goes through D1's query API
   (`wrangler d1 execute --command=<sql>`), and larger SQL through an import
   (`--file`) ([d1Batch.ts](../src/deploy/d1Batch.ts)). SQL holding a `LIKE`
   or `GLOB` pattern over 50 bytes, which D1 refuses, stops the run before it
   is sent.
5. It looks up `casa`, `andare`, `raccontare`, `bello`, `studente` and
   `andavano` in the dictionary with the site's own lookup. Each must be found.
   It also looks up each word a declaration it applied names in its
   [`lookups`](../dictionary-changes/README.md#words-the-deploy-looks-up), and
   each must show what the declaration says. A miss names the declaration
   file and the word.
6. It fast-forwards `production` to the run's commit with `GITHUB_TOKEN`, and
   Workers Builds deploys the site.

A stop at any step is a red run, and `production` stays where it was, so the
site stays at its last green commit. GitHub's failed-run email is the alert.
The run's summary says why it stopped. When something was written, it names
the bookmark and the exact restore command; the run never restores by itself.
A batch D1 refused rolled back whole, so it alone counts as nothing written.
Huey runs it from the repository root:

```sh
pnpm --dir web exec wrangler d1 time-travel restore lexema-dictionary --bookmark=<bookmark>
```

A later run plans the same declarations again from `production`, so restore
first when a red run wrote something. A run on a commit already in
`production` does nothing.

No agent runs this workflow, holds its tokens or writes the shared dictionary.
An agent runs the commands against the local D1 only.

### The plan-only entry

The same workflow, run by hand (`workflow_dispatch`) or called by another
workflow (`workflow_call`), plans one change against `lexema-dictionary` and
writes nothing: no bookmark, no write, no branch moved. Its input `change` is
a declaration's command and inputs, with no counts:

```json
{ "command": "update:auto", "inputs": { "feedRelease": "it-78385b62" } }
```

Its job summary and its `counts` output are the plan-only answer: the counts,
the dictionary's size, any hard limit they cross and, for `update:upgrade`,
each table a rebuild drops with its rows (`rebuilds`). The
[monthly release](#the-monthly-release) takes a new declaration's counts from
it. It also passes the input `release`: the archive facts and dump of a kaikki
release `main` does not record yet. The plan reads them as data, still runs
`main`'s code, and holds the files it fetches to them. The same command runs
against the local D1:

```sh
pnpm run deploy:dictionary --plan-only --change '{"command":"update:upgrade"}'
```

A pull request that adds a declaration needs no hand run: the
[pull request plan check](#the-pull-request-plan-check) plans it with the pull
request's own code.

### What it reads

| Name | Kind | Where | What it is |
|---|---|---|---|
| `dictionary-deploy` | GitHub environment | repository **Settings**, **Environments** | holds the secret and the variable below; its deployment branches are `main` only, so a run on any other branch never receives them. The `deploy` and `plan` jobs name it; the `gate` job takes no environment and no secret |
| `CLOUDFLARE_D1_TOKEN` | environment secret | `dictionary-deploy` | a Cloudflare API token with one permission, **Account**, **D1**, **Edit**. Wrangler reads it as `CLOUDFLARE_API_TOKEN`. The only Cloudflare credential in GitHub that can write; the other one is the [pull request plan check](#the-pull-request-plan-check)'s read-only token |
| `CLOUDFLARE_ACCOUNT_ID` | environment variable | `dictionary-deploy` | the Cloudflare account id that owns `lexema-dictionary`; not secret |
| `GITHUB_TOKEN` | built in | the `gate` and `deploy` jobs, `contents: write` | pushes `production`. A push that is not a fast-forward is refused |
| `production` | branch | this repository | the commit whose dictionary changes are in place. Workers Builds deploys it ([Workers Builds](#workers-builds)) |
| Git branch (the production branch) | Workers Builds setting | the Worker's **Settings**, **Build**, **Branch control** | `production` |

`SEED_REMOTE=lexema-dictionary` is set in the workflow itself.

### Where the archives are

The run reads the public `povlabs/lexema-data` from raw.githubusercontent.com,
with no token and no API rate limit, and checks every file's checksum (#527):

| File | Path in `povlabs/lexema-data` |
|---|---|
| the master's archive, `it-0c432803` | `source/it-extract.jsonl.gz` |
| any other release's archive | `source/<release id>.jsonl.gz`, such as `source/it-78385b62.jsonl.gz` |
| a dump | `source/<its KNOWN_DUMPS file>`, such as `source/itwiktionary-20260901-pages-articles.xml.bz2` |

A declaration of `update:auto` reads its feed release's archive and the dump
its `ARCHIVE_FACTS` entry names; `hide:records`, `load:page-entries` and
`load:recovered-definitions` read the master's archive and its dump.
`update:upgrade`, `normalize:source-text` and `correct:records` read none:
`correct:records` writes the committed list of curated corrections.

### Load recovered definitions

`load:recovered-definitions` ([src/import/loadRecoveredDefinitionsCli.ts](../src/import/loadRecoveredDefinitionsCli.ts),
#706) writes the definitions a word's page states outside its `#` list into a
dictionary seeded before the recovered layer read them
([ADR 0029](../.decisions/0029-recovered-layer-reads-bullet-prose-lines.md)).
Its two rules read a `*` bullet line (`recovered-bullet-line/v1`) and a plain
line with no list mark (`recovered-prose-line/v1`) under an Italian
part-of-speech heading, in a section no `#` line of which states a meaning,
for the archive record of that section. A seed writes the same rows; the
command brings a dictionary seeded earlier to them.

It reads the master's archive, for its records, and the dump that archive was
built from, for the pages. For each definition the rules read it writes one
`recovered_definition` row, its `recovered_label` rows, and the page's
`raw_page` row when the dictionary has none. It touches no record and no
`source_record_json` line, changes no row the dictionary holds, and adds no
other route's definition. A definition the dictionary already holds, by record
and page line, is left alone, so a second run plans nothing. A record a feed
replaced keeps the rows written for it, and the lookup reads them for the
record that replaced it; a definition that record now carries as a gloss is not
written.

Its SQL holds no DDL. `recovered_definition`'s `route` CHECK admits the two
routes only after `update:upgrade` rebuilds the recovered tables with their
rows, so the command refuses to write before it has; the deploy runs the
upgrade first. Against the local D1:

```sh
pnpm run update:upgrade
pnpm run load:recovered-definitions --plan-only
pnpm run load:recovered-definitions
```

`--plan-only` prints the counts and one line per definition, with its word,
record, revision, line, route and text, and writes nothing. The shared
dictionary changes only through a declaration:

```json
{
  "command": "load:recovered-definitions",
  "inputs": { "archive": "it-0c432803", "rules": ["recovered-bullet-line/v1", "recovered-prose-line/v1"] }
}
```

### Set up the dictionary deploy

Huey does these once, before the pull request that adds the workflow merges.
No agent does any of them.

1. **The Cloudflare token.** Open https://dash.cloudflare.com/profile/api-tokens,
   select **Create Token**, then **Create Custom Token**. Name it
   `lexema-dictionary-deploy`. Under **Permissions** add one row: **Account**,
   **D1**, **Edit**, and nothing else. Under **Account Resources** include the
   account that owns `lexema-dictionary`. Create it and copy it.
2. **The environment.** In this repository's **Settings**, **Environments**,
   select **New environment** and name it `dictionary-deploy`. Under
   **Deployment branches and tags** choose **Selected branches and tags** and
   add `main` only. Add the environment secret `CLOUDFLARE_D1_TOKEN` (step 1)
   and the environment variable `CLOUDFLARE_ACCOUNT_ID`. `povlabs/lexema-data`
   is public, so no data token is needed (#527).
3. **The `production` branch.** Create it at `main`'s current commit:

   ```sh
   git fetch origin && git push origin origin/main:refs/heads/production
   ```

   If a rule protects it, let GitHub Actions push to it; only fast-forwards
   are ever pushed.
4. **Workers Builds.** In the Worker's **Settings**, **Build**, **Branch
   control**, change the production branch from `main` to `production`.

### The pull request plan check

[`dictionary-plan.yml`](../.github/workflows/dictionary-plan.yml) runs on a
pull request that adds or changes a file under `dictionary-changes/`. It gives
a new declaration its `expected` counts, so one pull request carries a change
and its declaration
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md), #494, #498). It runs
`pnpm run deploy:dictionary --plan-only --added-since HEAD^1` on the pull
request's merge commit ([src/deploy/](../src/deploy/pullRequestPlan.ts)). A
later push to the pull request plans again when that push itself changes
`dictionary-changes/`, or when the plan on the previous head did not conclude
success (red, cancelled, unfinished or unreadable). Otherwise it skips, and its
green carries the previous green forward. A newer push cancels a plan still
running.

1. It reads the declarations the pull request adds, in path order, the order
   the deploy takes them from the one commit a pull request lands as. A
   declaration may leave `expected` out until this check gives it.
2. It plans the first one with the pull request's own code against
   `lexema-dictionary`, and holds the counts to `expected` and to the hard
   limits, as the deploy will. This includes `update:auto`, `hide:records`,
   `load:page-entries` and `load:recovered-definitions`: their plan downloads
   an archive and a dump from the public
   `povlabs/lexema-data` with no token, as the deploy does
   ([Where the archives are](#where-the-archives-are)).
3. Its job summary says, for each declaration:
   - the counts match `expected`: green;
   - they differ, or `expected` is missing: red, naming each difference and
     printing the whole declaration file with the plan's counts as
     `expected`. Copy it into the file and push;
   - the plan crosses a hard limit: red, naming the limit;
   - an `update:upgrade` that rebuilds tables
     ([the deploy's step 3](#the-dictionary-deploy)): a table naming each
     table it drops and copies back, with its rows;
   - any declaration after the first: red. Its counts depend on what the
     earlier ones write, and this run writes nothing. Put it in its own pull
     request once the earlier ones are deployed.

   It also lists each word a declaration names in `lookups`, and the file it
   prints keeps them. It does not look them up: the change is not written yet.

It writes nothing: no bookmark, no SQL file run on the dictionary, no branch
moved. Its job has `contents: read`, and `actions: read` to read this
workflow's run on the previous head, and no other permission. It runs only for
this repository's own branches: a fork's pull request never runs it, and
`pull_request` gives a fork's run no secret anyway. The deploy still holds
every declaration to `expected` at merge, so a count that went stale between
the check and the merge stops the deploy red.

| Name | Kind | Where | What it is |
|---|---|---|---|
| `dictionary-plan` | GitHub environment | repository **Settings**, **Environments** | holds the secret and the variable below, and no other token. This job and the [reader report issues](#reader-report-issues) job name it |
| `CLOUDFLARE_D1_READ_TOKEN` | environment secret | `dictionary-plan` | a Cloudflare API token with one permission, **Account**, **D1**, **Read**. Wrangler reads it as `CLOUDFLARE_API_TOKEN` |
| `CLOUDFLARE_ACCOUNT_ID` | environment variable | `dictionary-plan` | the same account id as in `dictionary-deploy`; not secret |

`SEED_REMOTE=lexema-dictionary` is set in the workflow itself.

The plan reads the dictionary through `wrangler d1 execute --remote --command`
with a `SELECT`. With `CLOUDFLARE_ACCOUNT_ID` set, Wrangler makes two
Cloudflare API calls for it, and Cloudflare's API reference accepts `D1 Read`
for both:
[Get D1 Database](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/get/),
to find the database by name, and
[Query D1 Database](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).

### Set up the pull request plan check

Huey does these once. No agent does any of them. Until they are done, the
check goes red on every pull request that adds a declaration.

1. **The Cloudflare token.** Open https://dash.cloudflare.com/profile/api-tokens,
   select **Create Token**, then **Create Custom Token**. Name it
   `lexema-dictionary-plan`. Under **Permissions** add one row: **Account**,
   **D1**, **Read**, and nothing else. Never **Edit**. If the page offers
   Developer Platform roles instead, pick the **D1** product with the role
   **Content Read-Only**, and limit it to `lexema-dictionary` when it offers
   one database. Under **Account Resources** include the account that owns
   `lexema-dictionary`. Create it and copy it.
2. **The environment.** In this repository's **Settings**, **Environments**,
   select **New environment** and name it `dictionary-plan`. If a run already
   created an empty one, open it instead. Under
   **Deployment branches and tags** choose **Selected branches and tags** and
   add the branch rule `refs/pull/*/merge`. GitHub matches
   the rule against the run's `GITHUB_REF`, which is `refs/pull/<number>/merge`
   for a `pull_request` run, so pull request runs get the secret
   ([GitHub: deployment branches and tags](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#deployment-branches-and-tags)).
   The one other rule is `main`, for the
   [reader report issues](#set-up-the-reader-report-issues).
   Add no required reviewer, or every check waits for one.
3. **The secret and the variable.** In `dictionary-plan`, add the environment
   secret `CLOUDFLARE_D1_READ_TOKEN` (step 1) and the environment variable
   `CLOUDFLARE_ACCOUNT_ID`, the same account id `dictionary-deploy` has.
Add no other secret to `dictionary-plan`: never `CLOUDFLARE_D1_TOKEN` and
never `LEXEMA_DATA_WRITE_TOKEN`.

## The monthly release

[`dictionary-release.yml`](../.github/workflows/dictionary-release.yml) runs
at 06:17 UTC on the 5th of each month, and can be run by hand from `main`
(`workflow_dispatch`). It opens one pull request when kaikki has a new Italian
release, and nothing otherwise. Its steps are `pnpm run release:monthly`
([src/release/](../src/release/monthlyRelease.ts)):

1. **`prepare`.** It reads kaikki's build log for `it-extract.jsonl.gz` and
   the Wiktionary dump the log names. A release is new only when that dump is
   later than the dump of every [`ARCHIVE_FACTS`](../src/source/archiveFacts.ts)
   entry, the order `update:auto` itself requires. When it is not new, the run
   ends green: no download, nothing stored, no pull request. Otherwise it
   downloads the archive. When the branch `release/<release id>` exists and a
   pull request was opened from it, open or closed, the run ends the same
   way. When it exists with no pull request, the run stops red: see
   [When a run stops after prepare](#when-a-run-stops-after-prepare). It then reads the dump's size and SHA-1 from Wikimedia's
   `dumpstatus.json`, downloads the dump and checks it, and stores in
   `povlabs/lexema-data`, as one commit:

   | File | Path in `povlabs/lexema-data` |
   |---|---|
   | the archive | `source/<release id>.jsonl.gz` |
   | kaikki's build log | `source/<release id>.log` |
   | the archive download's response headers | `source/<release id>.headers` |
   | the dump | `source/<its file>`, such as `source/itwiktionary-20261001-pages-articles.xml.bz2` |

   A file already there with the same bytes is left alone; one with other
   bytes stops the run. Last, it adds the release's `ARCHIVE_FACTS` entry and
   its dump's [`KNOWN_DUMPS`](../src/source/wiktionaryDump.ts) entry on a new
   branch `release/<release id>`, and pushes it with `GITHUB_TOKEN`.
2. **`plan`.** It calls the dictionary deploy's
   [plan-only entry](#the-plan-only-entry) with the change
   `{"command": "update:auto", "inputs": {"feedRelease": "<release id>"}}` and
   the release's facts. That job, in the dictionary deploy workflow, is the
   only one that reads the Cloudflare token; this workflow passes it no secret.
3. **`pull-request`.** It adds the
   [change declaration](../dictionary-changes/README.md)
   `dictionary-changes/<release id>.json` with the plan's counts to the branch,
   and opens a pull request into `main` that states the counts and any hard
   limit they cross.

Merging the pull request deploys the release through
[the dictionary deploy](#the-dictionary-deploy), which plans it again and stops
red when the counts differ. Closing it skips the release: its branch stays, so
a later run does not open it again. To have the next run offer the release
again, delete the branch and the release's `.headers` and `.log` files, as
[When a run stops after prepare](#when-a-run-stops-after-prepare) describes.

GitHub starts no workflow for a branch pushed or a pull request opened with
`GITHUB_TOKEN`, so the release pull request's checks do not start by
themselves. Close and reopen it to start them. Workers Builds still builds its
Preview.

A stop at any step is a red run, and GitHub's failed-run email is the alert.
No agent runs this workflow or holds its token.

### When a run stops after prepare

When `plan` or `pull-request` stops red, `prepare` has already stored the
release in `povlabs/lexema-data` and pushed `release/<release id>`. The run's
`stranded` job names that branch in an error. To finish the release:

1. Fix what stopped the run, such as the pull request setting under
   [Set up the monthly release](#set-up-the-monthly-release).
2. Open the red run and select **Re-run failed jobs**. The re-run keeps what
   `prepare` stored, plans again, and opens the pull request. When the earlier
   try pushed its declaration and then failed, the re-run replaces it.

Do not start a new run instead. While the branch has no pull request, every
new run stops red at `prepare` and names the branch again.

GitHub re-runs a run only within 30 days of it. After that, delete
`release/<release id>`, and delete `source/<release id>.headers` and
`source/<release id>.log` from `povlabs/lexema-data`. A new run then downloads
the release again and stores those two files fresh. The archive and the dump
are the same bytes, so they stay.

### What the monthly release reads

| Name | Kind | Where | What it is |
|---|---|---|---|
| `dictionary-release` | GitHub environment | repository **Settings**, **Environments** | holds the secret below; its deployment branches are `main` only, so a run on any other branch never receives it. Only the `prepare` job names it |
| `LEXEMA_DATA_WRITE_TOKEN` | environment secret | `dictionary-release` | a fine-grained GitHub token for `povlabs/lexema-data` only, **Contents** read and write. The only token that writes that repository; no other workflow reads it |
| `GITHUB_TOKEN` | built in | `prepare`: `contents: write`, `pull-requests: read`; `pull-request`: `contents: write`, `pull-requests: write` | pushes `release/<release id>`, reads whether a pull request was opened from it, and opens the pull request |
| `plan` job grant | `permissions` in the workflow | `contents: write` | GitHub checks every job of the called dictionary deploy against it when it loads the workflow, so it covers the `gate` and `deploy` jobs' `contents: write`. Those jobs run only on a push, never here; the plan job asks for `contents: read` |
| Allow GitHub Actions to create and approve pull requests | repository setting | **Settings**, **Actions**, **General**, **Workflow permissions** | on, or GitHub refuses the pull request |
| Schedule | `on.schedule` in the workflow | `17 6 5 * *` | 06:17 UTC on the 5th of each month |

The `plan` job reads what [the dictionary deploy reads](#what-it-reads), in its
own `dictionary-deploy` environment.

### Set up the monthly release

Huey does these once, before the pull request that adds the workflow merges.
No agent does any of them.

1. **The write token.** Open
   https://github.com/settings/personal-access-tokens/new. **Token name**:
   `lexema-monthly-release-data`. **Resource owner**: `povlabs`. **Repository
   access**: **Only select repositories**, `povlabs/lexema-data` alone.
   **Permissions**: **Contents**, **Read and write**, and nothing else.
   Generate it and copy it. When it expires, the run stops before it stores
   anything.
2. **The environment.** In this repository's **Settings**, **Environments**,
   select **New environment** and name it `dictionary-release`. Under
   **Deployment branches and tags** choose **Selected branches and tags** and
   add `main` only. Add the environment secret `LEXEMA_DATA_WRITE_TOKEN`
   (step 1).
3. **Pull requests from Actions.** In **Settings**, **Actions**, **General**,
   under **Workflow permissions**, turn on **Allow GitHub Actions to create and
   approve pull requests**.

## Reader report issues

[`reader-reports.yml`](../.github/workflows/reader-reports.yml) runs every hour,
at 17 minutes past, and can be run by hand (`workflow_dispatch`). It opens one
public issue in this repository for each new report waiting in production's
`lexema-app`, so a report sent on https://lexema.fyi reaches someone
([#631](https://github.com/povlabs/lexema/issues/631)). Its steps are
`pnpm run report:issues`
([src/readerReport/](../src/readerReport/reportIssuesCli.ts)):

1. Its first step checks that `CLOUDFLARE_D1_READ_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` are set and not empty. When one is not, the job
   stops red with an error naming it, before any install, D1 read or GitHub
   write.
2. It reads the waiting reports (`outcome IS NULL`) from `lexema-app` by its
   real id, through a temporary Wrangler config as
   [the production app migrations](#the-production-app-migrations) do. Its one
   statement selects `report_id`, `release_id`, `word`, `record_id`, `line_no`,
   `line_sha256`, `choice` and whether a note is there, and never the note, the
   visitor code or the time the report came in.
3. It lists every issue with the `reader-report` label, open and closed,
   through the REST issues list, page by page, and skips each report whose
   hidden marker `<!-- lexema-reader-report:<report id> -->` is already on one.
   The search API lags behind a new issue, so it is never used.
4. It takes the reports left, oldest first, at most 20 a run; the rest wait for
   the next run. When one of them names a record, it reads production's
   `lexema-dictionary` (`DB`, by its real id) once, with the same token: one
   `SELECT` of `record_id`, `release_id`, `line_no`, `line_sha256`, `word` and
   `pos_title` from `source_record`. A row whose `pos_title` is missing or not
   text stops the run, and the error quotes none of the row. A report that kept its source line is matched on
   `release_id`, `line_no` and `line_sha256`, because a re-seed of a release
   can renumber `record_id`; one that did not is matched on `record_id` and
   `release_id`. Each value is checked before it goes into the statement:
   numbers are whole, `release_id` is `it-` and eight lowercase hex digits, and
   `line_sha256` is 64 lowercase hex digits. A report that fails a check is
   left out of the statement.
5. It opens an issue for each of those reports, with the `reader-report`
   label. It creates the label when the repository lacks it.

An issue never shows the note or anything from the visitor code, and it never
shows the word as the reader sent it
([#639](https://github.com/povlabs/lexema/issues/639)):

| Report | Word and page link |
|---|---|
| names a record (a mistake report on a reading) | the record's headword from `lexema-dictionary`. When the read finds no row, or a value failed its check, the word is withheld and has no link |
| names no record (a missing word, or a mistake report sent with "Not sure") | the typed text, only when it has the shape of a word: Latin and Italian accented letters, `'` or `’`, `-`, and single spaces between words, so no digits, `@`, `/`, `:` or `.`; no space at either end; at most 40 characters and 4 words. Otherwise the word is withheld and has no link |

The issue's title names the word and what the reader says is wrong, and ends
with ` (reader report)`, for example `bello: a meaning is wrong (reader report)`
or `zzzz: missing word (reader report)`
([#652](https://github.com/povlabs/lexema/issues/652)). A title has no code
span, so a word stands in it only when it has the shape of a word, as in the
table above. A withheld word, or a headword that holds a digit, `#` or another
character the shape refuses, gives
`Report <report id>: <what is wrong> (reader report)` instead. What is wrong is
one of these plain words, by the option the reader picked:

| Option | Plain words |
|---|---|
| `meaning` | a meaning is wrong |
| `example` | an example is wrong |
| `form` | a form is wrong |
| `synonym` | a synonym is wrong |
| `other` | something else is wrong |
| `missing` | missing word |

The body starts with the hidden marker on its own line, then short sentences:

- the word in a code span with a link to its page on https://lexema.fyi, or
  "The word is withheld." with no link;
- the reading's part of speech (`pos_title`, from the same `source_record` row
  as the headword) in a code span, then its release, line and record in small
  print; or "The reader picked no reading.";
- what the reader picked, in the plain words above;
- "The reader left a note. Read it with `pnpm run report list`." or "No note.";
- the report id in small print.

A shown word or part of speech is in a code span, so it cannot mention anyone,
form a link or break the issue's layout. A word that passes the shape can still
be a name; that is inside the rule Huey approved on #639.

The run never writes D1: it knows a report was sent only from that report's
marker. It does not answer a report or erase its note; that stays with
`pnpm run report answer`, run by Huey
([#632](https://github.com/povlabs/lexema/issues/632)). Actions logs are public,
so the run logs counts and report ids only, never a row, Wrangler's output or a
word. Two runs never overlap.

| Name | Kind | Where | What it is |
|---|---|---|---|
| `dictionary-plan` | GitHub environment | repository **Settings**, **Environments** | the [pull request plan check](#the-pull-request-plan-check)'s environment, reused; holds the secret and the variable below. Its deployment branch rules are `refs/pull/*/merge` and `main`; on any other branch GitHub refuses the job before it starts |
| `CLOUDFLARE_D1_READ_TOKEN` | environment secret | `dictionary-plan` | the existing Cloudflare API token with one permission, **Account**, **D1**, **Read**, which covers both `lexema-app` and `lexema-dictionary`. Wrangler reads it as `CLOUDFLARE_API_TOKEN`; the script passes it to nothing else |
| `CLOUDFLARE_ACCOUNT_ID` | environment variable | `dictionary-plan` | the existing account id; not secret |
| `GITHUB_TOKEN` | built in | the `issues` job, `contents: read`, `issues: write` | lists the `reader-report` issues, creates the label and opens the issues |
| Schedule | `on.schedule` in the workflow | `17 * * * *` | every hour, at 17 minutes past |

No new token, secret, variable or environment is needed, and no D1 edit token:
the run only reads D1.

### Set up the reader report issues

Huey does this once. No agent does it.

| Setting | Where | Change |
|---|---|---|
| deployment branch rule for `main` | repository **Settings**, **Environments**, `dictionary-plan`, **Deployment branches and tags** | add a rule for `main`; keep the existing `refs/pull/*/merge` rule |

Until it is done, GitHub refuses the job before it starts, so a run writes
nothing.

## Set the report box's secrets

The report box ([WEB.md](WEB.md#why-a-report-is-stored-and-nothing-more)) needs two Worker secrets in
production, and neither is in the repository
([#621](https://github.com/povlabs/lexema/issues/621)):

| Secret | What it is |
|---|---|
| `TURNSTILE_SECRET_KEY` | Turnstile's secret key, the other half of `TURNSTILE_SITE_KEY` in `env.production.vars` |
| `REPORT_VISITOR_KEY` | the key a report's visitor code is an HMAC-SHA-256 under, so the code cannot be turned back into an address without it |

On production the box is closed while either is unset, or while
`TURNSTILE_SITE_KEY` is empty: `POST /report` answers `{ "outcome": "failed" }`
with a 503 and stores nothing, `POST /report/open` does the same for a missing
Turnstile key, and the Worker logs one error, `report box closed: <secrets> not
set`, naming each one. Every other route keeps serving. Locally and on a
Preview, a missing Turnstile key turns Turnstile off with a warning instead.

Set `REPORT_VISITOR_KEY` from `web/`:

```sh
openssl rand -base64 32 | pnpm exec wrangler secret put REPORT_VISITOR_KEY --env production
```

It is safe in any order with a deploy, because `wrangler secret put` only adds
a binding, and code that does not read it ignores it. The order Huey follows:

1. Huey sets the secret with the command above.
2. The pull request merges and production deploys.
3. If the merge lands first, the site stays up. Only `POST /report` answers
   `failed` until step 1 is done, and the Worker log names `REPORT_VISITOR_KEY`.

Replacing the secret changes every visitor's code, so stored codes stop
matching. That only resets one hour of report allowance, and the cron sweep
erases those codes within the hour anyway.

## Turn on sign-in

The developer site signs in with Google and GitHub, on better-auth
(`web/worker/developers/signIn.ts`, [ADR 0017](../.decisions/0017-better-auth-and-drizzle-own-accounts.md)).
A provider stays unavailable, and its sign-in route answers 503, until its
client id and its secret are set, and so is `BETTER_AUTH_SECRET`, which signs
the session cookie. None of them is in the repository. Sign-in also needs
`DEVELOPER_SIGN_UP` set to `open` in `env.production` of `web/wrangler.jsonc`;
while it is `closed`, no provider is offered and the routes refuse.

1. Create a Google OAuth client of type *Web application* in the Google Cloud
   console, with the authorized redirect URI
   `https://developers.lexema.fyi/sign-in/google/callback`. The same client can
   also list the local one, `http://localhost:8790/sign-in/google/callback`, to
   sign in on your own machine
   ([RUN_THE_SITE.md](RUN_THE_SITE.md#sign-in-locally)).
2. Create a GitHub OAuth app (Settings, Developer settings, OAuth Apps) with the
   homepage `https://developers.lexema.fyi` and the authorization callback URL
   `https://developers.lexema.fyi/sign-in/github/callback`.
3. Put each client id in `env.production.vars` in `web/wrangler.jsonc`, as
   `GOOGLE_CLIENT_ID` and `GITHUB_CLIENT_ID`.
4. Set each secret on the Worker, from `web/`:

   ```sh
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env production
   pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --env production
   ```

5. Make the session secret and set it the same way:

   ```sh
   openssl rand -base64 32 | pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
   ```

   The Worker reads it from `process.env`, where the Workers runtime puts
   every var and secret under `nodejs_compat`. Replacing it signs every
   developer out.

Sign-in also needs the production app database, `APP_DB`, bound since
[#611](https://github.com/povlabs/lexema/issues/611): without it, a callback
answers 503.

## Turn on billing

Starter and Pro are paid through Stripe, on better-auth's Stripe plugin
(`src/accounts/billing.ts`, [#262](https://github.com/povlabs/lexema/issues/262)).
The developer site's billing routes (`web/worker/developers/billing.ts`,
[#264](https://github.com/povlabs/lexema/issues/264)) send a developer to
Stripe Checkout and to Stripe's billing portal. Its webhook keeps each
account's `subscription` row in step with Stripe: for each event below it
reads the subscription back from Stripe and writes it, so a late or repeated
event ends in Stripe's current state. Until all four settings are set, and
`BETTER_AUTH_SECRET` too, the billing routes and the webhook answer 503 and
the log names what is missing.

| Setting | Kind | What it is |
|---|---|---|
| `STRIPE_SECRET_KEY` | Worker secret | the Stripe API key the plugin calls Stripe with, `sk_test_…` or `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | Worker secret | the webhook endpoint's signing secret, `whsec_…` |
| `STRIPE_PRICE_STARTER` | var | Starter's monthly price id, `price_…` |
| `STRIPE_PRICE_PRO` | var | Pro's monthly price id, `price_…` |

Where each one lives:

| Setting | Local | Previews | Production |
|---|---|---|---|
| Price ids | the top-level `vars` in `web/wrangler.jsonc`: Stripe test-mode prices, already set | `previews.vars`: the same test-mode prices, already set | `env.production.vars`: empty until the live-mode products exist at go-live |
| `STRIPE_SECRET_KEY` | `web/.dev.vars`, the test-mode key | not sent, so billing is off | `wrangler secret put`, the live-mode key |
| `STRIPE_WEBHOOK_SECRET` | `web/.dev.vars`, the secret `stripe listen` prints | not sent, so billing is off | `wrangler secret put`, the live endpoint's secret |

The price ids are not secret. The test-mode ones in the repository are
Starter's $15 price `price_1ULTI07wyoTIgVX6DFZ5TmY3` and Pro's $49 price
`price_1ULTI17wyoTIgVX6QiH9muAe` (posted on
[#161](https://github.com/povlabs/lexema/issues/161)). A price id set without
the two secrets turns nothing on. A Preview gets a fresh deployment on every
push, which keeps only the secrets the Preview command sends, and those are
`BETTER_AUTH_SECRET` and `REPORT_VISITOR_KEY` alone, so billing stays off on
every Preview.

### Locally, in test mode

1. Put the test-mode secret key in `web/.dev.vars` as `STRIPE_SECRET_KEY`.
2. Forward Stripe's test events to the local developer site with the Stripe
   CLI, which prints the webhook signing secret it signs them with
   ([Stripe CLI, `stripe listen`](https://docs.stripe.com/cli/listen)):

   ```sh
   stripe listen --forward-to http://developers.localhost:8790/auth/stripe/webhook
   ```

   Put that secret in `web/.dev.vars` as `STRIPE_WEBHOOK_SECRET`, and restart
   the Worker.

### In production, at go-live

1. In Stripe's live mode, make the Starter and Pro products with their monthly
   prices ($15 and $49). Put each price id in `env.production.vars` in
   `web/wrangler.jsonc`, as `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_PRO`.
2. Add a webhook endpoint at
   `https://developers.lexema.fyi/auth/stripe/webhook`, sending these six
   events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

   Stripe sends each event with a `Stripe-Signature` header. A missing, wrong
   or stale one answers 400, as does a sync that could not be written, and
   Stripe retries.
3. Set both secrets on the Worker, from `web/`:

   ```sh
   pnpm exec wrangler secret put STRIPE_SECRET_KEY --env production
   pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET --env production
   ```

### The billing portal

Manage billing opens Stripe's customer portal, and choosing a plan while one
already serves opens it too. Turn these on in the portal's settings (Stripe
Dashboard, Settings, Billing, Customer portal), in test mode and again in live
mode:

- Payment methods: customers can update their payment method.
- Invoice history: shown.
- Subscriptions, switch plan: on, between the Starter and Pro products'
  monthly prices.
- Subscriptions, cancel: on, at the end of the billing period.

Billing also needs the production app database, `APP_DB`, bound since #611: without it,
the billing routes and the webhook answer 503. Two `/auth` paths are answered,
both the Stripe plugin's and only on the developer site: the webhook, which is
not counted by the per-visitor limits, and `/auth/subscription/success`, where
Checkout returns a paid developer before they land on `/dashboard/settings`.

## Turn on account email

The developer site emails a developer about their account through Cloudflare
Email Service ([#215](https://github.com/povlabs/lexema/issues/215)), from
`noreply@lexema.fyi`. Each email is plain text and HTML, in English, with one
link to `/dashboard/settings` (`src/email/accountEmail.ts`):

| Email | Sent when |
|---|---|
| Welcome to Starter or Pro | Stripe's webhook finds a plan serving that did not |
| Your plan is now Starter or Pro | a serving plan moved between the two |
| Your plan's payment failed | the plan fell past due |
| Your plan is cancelled | the plan was cancelled; it names the day it ends |
| Your plan has ended | the plan stopped serving |
| Your Lexema account is deleted | the developer deleted their account |

Each is sent once per change. The plan emails are sent by the webhook
(`web/worker/developers/stripeWebhook.ts`) after it writes the subscription's row: it
compares Stripe's current state with the `plan_notice` row, which holds what
the account was last emailed about, and moving that row is what claims the
email (`src/billing/planNotice.ts`). So a replayed or late event, or two
arriving at once, send nothing twice. The deletion email is sent by the
account's first deletion only (`deleteAccount` in `src/accounts/accounts.ts`).
A send that fails is logged as `account email failed` with Email Service's
code, never the address, and is not tried again: the webhook still answers 200
and the deletion still happens.

Stripe sends the rest, from its own settings: receipts, invoices, expiring-card
and upcoming-renewal emails. Turn those on in the Stripe Dashboard, in test
mode and again in live mode, and leave Stripe's own failed-payment email off,
as the one above replaces it.

### The binding

Every configuration binds Email Service as `EMAIL`, a `send_email` binding
([Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/),
[send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)):

| Where | Binding | What it does |
|---|---|---|
| Local | `{ "name": "EMAIL" }` at the top level of `web/wrangler.jsonc` | `wrangler dev` simulates it: each email is logged in the terminal and sent nowhere ([local development](https://developers.cloudflare.com/email-service/local-development/sending/)). Adding `"remote": true` would send real email; do not commit that |
| Previews | `previews.send_email`, with `destination_address` set to Huey's verified address, and the same address in the `EMAIL_ONLY_TO` var | sends to Huey alone ([above](#the-preview-only-domains)). Billing and OAuth are off there, so the only account is the test developer, `test-developer@example.com`, and only its deletion sends. The binding would refuse that address, so `EMAIL_ONLY_TO` sends every account email to Huey instead (`workerEmailOf` in `src/email/send.ts`) |
| Production | `{ "name": "EMAIL" }` in `env.production` | sends to any address, which needs the Workers Paid plan ([pricing](https://developers.cloudflare.com/email-service/platform/pricing/)) |

Local development and production leave `EMAIL_ONLY_TO` empty, so each email
goes to its own account. Tests hand in a stub binding (`test/stubEmail.ts`), so
no test sends email, and CI holds nothing that could.

To get a real account email on a Preview: open the Preview's developer site,
sign in with the test sign-in, go to Settings and delete the account. The
"Your Lexema account is deleted" email reaches Huey's inbox. Signing in with
the test sign-in again makes a new test developer, so this can be repeated.

### Onboard lexema.fyi (Huey, once)

Email Service sends only from a domain onboarded to Email Sending
([domain configuration](https://developers.cloudflare.com/email-service/configuration/domains/)):

1. In the Cloudflare dashboard, go to **Compute**, **Email Service**, **Email
   Sending**.
2. Select **Onboard Domain** and choose `lexema.fyi`.
3. Review the records Cloudflare adds: MX, SPF and DKIM records on the
   `cf-bounce` subdomain, for bounces and authentication, and a DMARC record on
   `_dmarc.lexema.fyi`. Select **Done**.

DNS usually takes 5 to 15 minutes on Cloudflare's own DNS. Until the domain is
onboarded, every send fails with `E_SENDER_DOMAIN_NOT_AVAILABLE` or
`E_SENDER_NOT_VERIFIED`, which Workers Logs shows as `account email failed`;
nothing else breaks. Once it is, the **Email Sending** page's logs show each
email sent.

## After a deploy

`web/dist/` now holds the production build, which has no D1. Before running the
site locally again, rebuild it with `pnpm --filter @lexema/web build`.
`pnpm run seed:dev` does not care which build is there.

## Changing a limit

Edit both `ratelimits` lists in `web/wrangler.jsonc`: the top level and
`env.production`. Wrangler does not copy bindings into an environment, and
`web/test/rateLimit.test.ts` fails if the two differ. Each block is logged as
`rate limited { limit: 'search' }` or `{ limit: 'suggest' }`, never with the
address, so Workers Logs shows how often each limit is hit.
