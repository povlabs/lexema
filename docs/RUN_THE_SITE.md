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

`pnpm run seed:dev` builds a development release and loads it into local D1. It
drops the existing local D1 database first, so re-running it needs no cleanup.

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
| `?q=casa` | 1 entry that says the source states neither a gender nor a number, with definitions marked *recovered* from Wiktionary revision 4257826 |
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

The developer site's sign-in (`web/worker/signIn.ts`) needs a real OAuth
client, so it is off locally until you give it one: each provider's sign-in
route answers 503 until both its client id and secret are set. Locally that
means GitHub only.

Google cannot sign in locally. The Worker sends the callback on the host it was
asked on, `developers.localhost`. Google's
[redirect URI rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)
say a host's top-level domain must be on the
[public suffix list](https://publicsuffix.org/list/public_suffix_list.dat).
`localhost` is not on it, and Google exempts localhost only from the HTTPS and
raw-IP rules, not from this one. Google's side is covered by the tests instead
(below), and live on `developers.lexema.fyi`
([DEPLOY.md](DEPLOY.md#turn-on-sign-in)).

To sign in with GitHub, create a GitHub OAuth app whose authorization callback
URL is `http://developers.localhost:8790/sign-in/github/callback`. GitHub sets no
host or scheme rule on a callback URL; the one it asks is that the Worker's
`redirect_uri` matches it
([Redirect URLs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#redirect-urls)).
Put its values in `web/.dev.vars`, which is gitignored and which `wrangler dev`
reads:

```sh
GITHUB_CLIENT_ID=…
GITHUB_CLIENT_SECRET=…
```

Then start at <http://developers.localhost:8790/sign-in>. The page shows a
provider without both values as a disabled button.

The session cookie is `__Host-` prefixed and `Secure`, yet the local site is
plain `http://`. It still sticks only because the browser treats
`*.localhost` as a secure context
([MDN, potentially trustworthy origins](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts#potentially_trustworthy_origins)).
A browser that does not will drop the cookie, and you will not stay signed in.

The tests need none of this: they sign in against a stub provider
(`web/test/stubProvider.ts`), and Google's and GitHub's token and email calls
run against a fake `fetch` (`test/accounts.test.ts`).

## If it will not start

| Symptom | Cause |
|---|---|
| zsh asks to correct `wrangler` to `.wrangler` | shell autocorrect; answer `n` or run from outside `web/` |
| D1 looks empty after a seed | `--persist-to` was relative; pass the `.data/seed-state` path shown above |
| Every search says the lookup failed | `web/dist/` holds a production build, which has no D1; run `pnpm --filter @lexema/web build` again |
| Seed stops with `part N of M failed` | one Wrangler run failed; the state directory is partial, so seed again into a fresh one ([RUN_AN_IMPORT.md § If a seed stops](RUN_AN_IMPORT.md#if-a-seed-stops)) |

## Not this page

Deploying is [DEPLOY.md](DEPLOY.md); attaching D1 in production is #19. Flipping
which imported release is served is #18.
