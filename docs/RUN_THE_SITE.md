# How to run the site

Get the Italian search page answering queries on your own machine, and keep the
live site running: its health check, what it logs, how to roll it back, and the
checks to run right after go-live. Why it is built this way is
[WEB.md](WEB.md); the seed's exact numbers are [DEV_SEED.md](DEV_SEED.md);
deploying is [DEPLOY.md](DEPLOY.md). This page is the operation.

## Before you start

- Nothing needs downloading for local work: `fixtures/dev-seed.jsonl` is the
  committed fifty-word fixture used by `seed:dev`.
- A few hundred MB free under `.data/`.
- About two minutes, most of it the seed.

Nothing up to [Check it is healthy](#check-it-is-healthy) touches a Cloudflare
account. `wrangler dev` runs the Worker on
workerd locally, and local D1 state is kept in `.data/`, not `web/.wrangler/`.
The full Italian archive is maintained at
[`source/it-extract.jsonl.gz`](https://github.com/povlabs/lexema-data/blob/main/source/it-extract.jsonl.gz).
A local copy at the repository root (`it-extract.jsonl.gz`) is gitignored and is
the default full-archive input when an archive is selected explicitly.

## Run it

```sh
pnpm install --frozen-lockfile
pnpm run seed:dev
pnpm --filter @lexema/web build
cd web && pnpm exec wrangler dev --config dist/server/wrangler.json \
  --persist-to "$PWD/../.data/seed-state" --port 8790
```

Then open <http://localhost:8790/?q=sale>.

`pnpm run seed:dev` builds a development release and loads it into the local
dictionary database, `DB`. It then applies the app migrations to the local app
database, `APP_DB`, which holds accounts, keys, usage and reader reports
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)). Both live in the
same `--persist-to` directory. It drops that directory first, so re-running it
needs no cleanup, and every local account, key and report goes with it.

The seed streams the committed fifty-word fixture directly into generated D1
SQL and applies that SQL to local D1. It does not cut a prefix, create a
SQLite staging database, or write to `web/.wrangler/`; the fixture's coverage is
in [DEV_SEED.md](DEV_SEED.md).

## Reach each host

One Worker serves three hosts, and tells them apart by the request's host
(`web/worker/shared/hosts.ts`). Locally each has a `.localhost` twin on the same port:

| Live | Local | Serves |
|---|---|---|
| `lexema.fyi` | <http://localhost:8790/> | the dictionary |
| `developers.lexema.fyi` | <http://developers.localhost:8790/> | the developer site |
| `api.lexema.fyi` | <http://api.localhost:8790/v1/> | the JSON API, under `/v1/` only |

`curl`, Chrome and Firefox resolve any `.localhost` name to this machine, so nothing
needs adding to `/etc/hosts`. Any other host, such as `127.0.0.1`, is the
dictionary. The `.localhost` names never reach the live Worker, which is routed
from its three custom domains only (`web/wrangler.jsonc`).

A client that cannot resolve `.localhost` sends the host itself:

```sh
curl -i -H "Host: api.localhost" "http://127.0.0.1:8790/v1/exists?q=sale"
```

The API is only on its own host. Its old path, `lexema.fyi/api/v1/…`, answers
404 with no redirect, and so does `localhost:8790/api/v1/…`.

## Check it came up

| Query | Expect |
|---|---|
| `?q=sale` | 3 entries: the noun, a form of `sala`, and a verb form |
| `?q=casa` | 1 entry, *Sostantivo · femminile, singolare* (gender and number from its gloss grammar stamp), showing the definitions recovered from Wiktionary revision 4257826 with no mark for where they came from |
| `?q=studente` | 4 entries: the noun, a form of `studiare`, and two noun forms |
| `?q=citta` | the empty state — accents are significant |
| `?q=` | the opening hint, with words to try |

What these actually rendered, on which release and on which date, is in
[the dated report](../reports/2026-09-21-web-page-measurements.md) — including
all twelve queries of the spot check, not only these.

The fixture is intentionally bounded, so a word outside its fifty-word set
returns the empty state rather than an error. The one exception is a word the
release itself has no record for, such as `raccontare`: its committed page
gives a page-only entry, as on the real site
([DEV_SEED.md](DEV_SEED.md#what-is-emitted)). A full archive can be supplied
with `SEED_INPUT=it-extract.jsonl.gz`; it loads in numbered SQL parts and takes
nine to ten minutes
([RUN_AN_IMPORT.md § Run it](RUN_AN_IMPORT.md#run-it)).

## See the failed-lookup state

Point the Worker at a release that does not exist:

```sh
cd web && pnpm exec wrangler dev --config dist/server/wrangler.json \
  --persist-to "$PWD/../.data/seed-state" --port 8790 \
  --var LEXEMA_RELEASE:does-not-exist
```

The page then says the lookup failed, which is a different message from finding
nothing. It does not print the reason: a database message names releases,
tables and bindings, so it goes to the Worker's log, where `wrangler dev` prints
it.

## See the rate limits

The local Worker counts searches and suggestions like the live one: 15 searches
and 120 suggestions a minute from one address. The sixteenth search in a minute
answers 429 with the "too many searches" message under the field; wait a minute
or restart `wrangler dev` to reset the count. Why they are there is
[WEB.md](WEB.md#why-the-rate-limits-sit-in-front-of-vinext).

## Sign in locally

The developer site's sign-in (`web/worker/developers/signIn.ts`, on better-auth) needs a
real OAuth client and a secret to sign sessions with, so it is off locally
until you give it both: each provider's sign-in route answers 503 until its
client id and secret are set and so is `BETTER_AUTH_SECRET`. Put the values in
`web/.dev.vars`, which is gitignored and which `wrangler dev` reads, for either
provider or both:

```sh
BETTER_AUTH_SECRET=…
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GITHUB_CLIENT_ID=…
GITHUB_CLIENT_SECRET=…
```

Make the local `BETTER_AUTH_SECRET` with `openssl rand -base64 32`, and never
reuse the production one. Changing it signs every local session out.

For Google, add the authorized redirect URI
`http://localhost:8790/sign-in/google/callback` to a Google OAuth client of type
*Web application*. It can be the production client, which may list this URI
beside the live one ([DEPLOY.md](DEPLOY.md#turn-on-sign-in)). The URI is on
`localhost`, not `developers.localhost`. Google accepts `http://localhost`,
but its
[redirect URI rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)
want any other host's top-level domain on the
[public suffix list](https://publicsuffix.org/list/public_suffix_list.dat), and
`localhost` is not on it. So when the developer site
runs on `developers.localhost`, the Worker sends Google the `localhost`
callback, and `localhost` answers it with a 302 to the same path and query on
`developers.localhost`, which checks the sign-in as it does live
(`web/worker/shared/hosts.ts`, #185). The port in the URI is the one you run on.

For GitHub, create a GitHub OAuth app whose authorization callback URL is
`http://developers.localhost:8790/sign-in/github/callback`. GitHub sets no host
or scheme rule on a callback URL; the one it asks is that the Worker's
`redirect_uri` matches it
([Redirect URLs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#redirect-urls)).

Then start at <http://developers.localhost:8790/sign-in>. The page shows a
provider without both values, or any provider while `BETTER_AUTH_SECRET` is
unset, as a disabled button.

The session cookie is `__Secure-` prefixed and `Secure`, yet the local site is
plain `http://`. It still sticks only because the browser treats
`*.localhost` as a secure context
([MDN, potentially trustworthy origins](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts#potentially_trustworthy_origins)).
A browser that does not will drop the cookie, and you will not stay signed in.

The tests need none of this: they sign in against a stub provider
(`web/test/stubProvider.ts`) that answers Google's and GitHub's token and user
endpoints in place of `fetch`, so better-auth's own provider code runs with no
network, and it sets a test-only `BETTER_AUTH_SECRET`.

## If it will not start

| Symptom | Cause |
|---|---|
| zsh asks to correct `wrangler` to `.wrangler` | shell autocorrect; answer `n` or run from outside `web/` |
| D1 looks empty after a seed | `--persist-to` was relative; pass the `.data/seed-state` path shown above |
| Every search says the lookup failed | `web/dist/` holds a production build, which has no D1; run `pnpm --filter @lexema/web build` again |
| Sign-in, the dashboard, API keys or the report box answer 503, and the log says `no such table` | the state was seeded before `APP_DB` existed (#240); run `pnpm run seed:dev` again, or migrate the app database alone ([DEVELOPMENT.md](../DEVELOPMENT.md#change-the-database-schema)) |
| Seed stops with `part N of M failed` | one Wrangler run failed; the state directory is partial, so seed again into a fresh one ([RUN_AN_IMPORT.md § If a seed stops](RUN_AN_IMPORT.md#if-a-seed-stops)) |

## Check it is healthy

Every host answers `GET /health` (`web/worker/shared/health.ts`):

```sh
curl -s https://lexema.fyi/health
curl -s https://developers.lexema.fyi/health
curl -s https://api.lexema.fyi/health
```

Each answers JSON with three fields:

| Field | Holds |
|---|---|
| `ok` | `true` when every database checked answered |
| `release` | the release `LEXEMA_RELEASE` serves |
| `d1` | each database's state: `ok`, `unbound` (no binding) or `failed`. `lexema.fyi` checks the dictionary, `dictionary`; the developer site and the API also check the app database, `app` |

A healthy host answers 200, for example
`{"ok":true,"release":"it-0c432803","d1":{"dictionary":"ok","app":"ok"}}`.
Any other state answers 503 with the same body, so a monitor that reads only the
status still sees it. The cause of a `failed` is in the log, never in the body.

Each check is `SELECT 1`, which reads no table. `/health` is answered before the
per-visitor limits, so a monitor is never counted as a visitor and never gets a
429, even with a `q` on it. Locally it is `http://localhost:8790/health`, and
the same path on `developers.localhost` and `api.localhost`.

## What is logged

The Worker writes to Workers Logs
([web/wrangler.jsonc](../web/wrangler.jsonc), `observability`). Read it in the
Cloudflare dashboard: **Workers & Pages**, `lexema-web`, **Observability**.

What it writes:

- **Errors.** A short message, a few fields saying what failed (which route,
  which database, which kind of email), and the error. A database error names
  tables, not the words searched.
- **Rate-limit blocks.** Which limit, such as `rate limited { limit: 'search' }`,
  never the address.
- **A request id on every line.** `requestId` is the request's `cf-ray`, the id
  Cloudflare gives each request. A failure nothing else answered is answered
  500 with that id in its `x-request-id` header, so a reader's report can be
  matched to the log. In the dashboard, filter on `requestId`.

What it never writes: a search string, a query string, an IP address, an email
address or an API key. To keep it that way, invocation logs are off
(`"invocation_logs": false`). Cloudflare writes one per request, with
[the method and the full URL](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#invocation-logs),
query included, and the request's headers, which
[are redacted only for cookies and auth-like names](https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/#tailrequest),
so `cf-connecting-ip`, the visitor's address, would sit beside the search
string. `web/test/health.test.ts` fails if production turns them back on.

How long it is kept: Workers Logs keeps 7 days on the Workers Paid plan and 3
days on Workers Free
([Workers Logs, pricing](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#pricing)),
then Cloudflare deletes it. We keep nothing longer: there is no Logpush, no Tail
Worker and no export, and `wrangler tail` only shows lines as they happen.

## Roll back

### The Worker

Every deploy is a new version, and a rollback makes an earlier one live on all
three hosts at once
([Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)).
From the repository root, list the recent deployments and pick the version
before the bad one:

```sh
pnpm --dir web exec wrangler deployments list --name lexema-web
```

Then roll back to it:

```sh
pnpm --dir web exec wrangler rollback <version-id> --name lexema-web --message "<why>"
```

Or in the dashboard: **Workers & Pages**, `lexema-web`, **Deployments**, the
three dots on the version, **Rollback**.

Then check `/health` on all three hosts, as above. A rollback changes code and
settings only: D1, secrets and the account meter's data stay as they are. It is
refused across a Durable Object migration. The next merge to `main` deploys
again, so revert the bad commit on `main` before anything else merges.

### A dictionary change

A dictionary change is an apply of [UPDATE_THE_DICTIONARY.md](UPDATE_THE_DICTIONARY.md)
(#18). It writes the shared dictionary, `lexema-dictionary`, and nothing else.
Undo it with D1 Time Travel, which restores the database to a moment before the
apply.

Use the bookmark you kept before the apply (step 4 of that page). Without one,
get the bookmark for a time before it:

```sh
pnpm --dir web exec wrangler d1 time-travel info lexema-dictionary --timestamp="2026-10-02T09:00:00+00:00"
```

Restore:

```sh
pnpm --dir web exec wrangler d1 time-travel restore lexema-dictionary --bookmark=<bookmark>
```

It asks to confirm, overwrites the database in place and cancels queries in
flight, so a few lookups fail while it runs. It prints the bookmark to undo the
restore itself; keep it. Then search a word the apply changed: it shows the
older release's senses again, and its share card moves back with it.

Time Travel is always on and costs nothing extra: no charge for the history or
for a restore. It reaches back 30 days on Workers Paid, 7 on Workers Free
([Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)).

Never restore the app database, `APP_DB`, to undo a dictionary change: it would
take back every account, key and report written since.

## Smoke-test right after go-live

Run these as soon as production serves the dictionary (#19). Each row is one
check; *Huey* marks the ones only Huey can run.

| Check | Do | Passes when |
|---|---|---|
| Health | `curl -s` each `/health` above | 200, `"ok":true`, the live release, every database `ok` |
| Found | <https://lexema.fyi/?q=andare> | the verb, its forms grouped by tense |
| Not found | <https://lexema.fyi/?q=citta> | `No entry for "citta"`, offering `città` |
| Ambiguous | <https://lexema.fyi/?q=sale> | several entries; the link to `sala` searches it and shows both the noun and the verb, without picking one |
| Missing data | <https://lexema.fyi/?q=casa> | one entry; what the source does not give, such as its forms, is missing, not filled in |
| Disputed | <https://lexema.fyi/?q=studente> | every reading as the source states it, and no note about a dispute ([WEB.md](WEB.md#why-a-disputed-claim-is-a-row-and-not-a-code-path)) |
| Share card | the `og:image` of `?q=casa`, below | 200, `image/png`, the word's card |
| Sign-in (Huey) | <https://developers.lexema.fyi/sign-in>, with Google and with GitHub | back on the dashboard, signed in |
| API key (Huey) | on the dashboard, create a key named `smoke` | the key is shown once; copy it |
| API lookup | `/v1/lookup`, below | 200 with `casa`'s entry |
| API batch | `/v1/lookup/batch`, below | 200, `results` for `sale` then `casa` |
| Checkout (Huey) | upgrade to Starter in Stripe live mode ([DEPLOY.md](DEPLOY.md#in-production-at-go-live)) | back on the dashboard on Starter; then cancel in the billing portal |
| Flood guard | 16 searches in a minute, below | fifteen 200s, then a 429 with `retry-after: 60` |

Then revoke the `smoke` key on the dashboard.

The share card's address is in the page:

```sh
curl -s "https://lexema.fyi/?q=casa" | grep -o 'og:image" content="[^"]*'
curl -sI "<that address>" | grep -iE '^HTTP|content-type'
```

The API, with the key from the dashboard:

```sh
KEY=<the smoke key>
curl -s -H "X-API-Key: $KEY" "https://api.lexema.fyi/v1/lookup?q=casa"
curl -s -H "X-API-Key: $KEY" -H "content-type: application/json" \
  -d '{"q":["sale","casa"]}' https://api.lexema.fyi/v1/lookup/batch
```

The flood guard, from one machine. It uses up your own searches for a minute:

```sh
for i in $(seq 16); do curl -s -o /dev/null -w "%{http_code}\n" "https://lexema.fyi/?q=casa"; done
```

## Not this page

Deploying is [DEPLOY.md](DEPLOY.md); attaching D1 in production is #19. Flipping
which imported release is served is #18. What a reader should know about the
data's gaps is [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).
