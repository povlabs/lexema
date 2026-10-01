# How to run the search page locally

Get the Italian search page answering queries on your own machine. Why it is
built this way is [WEB.md](WEB.md); the seed's exact numbers are
[DEV_SEED.md](DEV_SEED.md). This page is the operation.

## Before you start

- Nothing needs downloading for local work: `fixtures/dev-seed.jsonl` is the
  committed fifty-word fixture used by `seed:dev`.
- A few hundred MB free under `.data/`.
- About two minutes, most of it the seed.

Nothing here touches a Cloudflare account. `wrangler dev` runs the Worker on
workerd locally, and local D1 state is kept in `.data/`, not `web/.wrangler/`.
The full Italian archive is maintained at
[`source/it-extract.jsonl.gz`](https://github.com/hueypov/lexema-data/blob/main/source/it-extract.jsonl.gz).
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
(`web/worker/hosts.ts`). Locally each has a `.localhost` twin on the same port:

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
returns the empty state rather than an error. A full archive can be supplied
with `SEED_INPUT=it-extract.jsonl.gz`; it loads in numbered SQL parts and takes
about seven minutes
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

The developer site's sign-in (`web/worker/signIn.ts`, on better-auth) needs a
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
(`web/worker/hosts.ts`, #185). The port in the URI is the one you run on.

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

## Not this page

Deploying is [DEPLOY.md](DEPLOY.md); attaching D1 in production is #19. Flipping
which imported release is served is #18.
