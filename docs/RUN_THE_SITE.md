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
  --persist-to "$PWD/../.data/web-state" --port 8790
```

Then open <http://localhost:8790/?q=sale>.

`pnpm run seed:dev` builds a development release and loads it into local D1. It
drops the existing local D1 database first, so re-running it needs no cleanup.

The seed streams the committed fifty-word fixture directly into generated D1
SQL and applies that SQL to local D1. It does not cut a prefix, create a
SQLite staging database, or write to `web/.wrangler/`; the fixture's coverage is
in [DEV_SEED.md](DEV_SEED.md).

## Check it came up

| Query | Expect |
|---|---|
| `?q=sale` | 5 entries, two of them labelled as mentions |
| `?q=casa` | 1 entry, gender and number shown as *not stated in the source* |
| `?q=studente` | 5 entries, the verb one flagged *Disputed by later research* |
| `?q=citta` | the empty state — accents are significant |
| `?q=` | the opening hint |

What these actually rendered, on which release and on which date, is in
[the dated report](../reports/2026-09-21-web-page-measurements.md) — including
all twelve queries of the spot check, not only these.

The fixture is intentionally bounded, so a word outside its fifty-word set
returns the empty state rather than an error. A full archive can be supplied
with `SEED_INPUT=it-extract.jsonl.gz`; it loads in numbered SQL parts and takes
about seven minutes
([DEV_SEED.md § Seed the full release](DEV_SEED.md#seed-the-full-release)).

## See the failed-lookup state

Point the Worker at a release that does not exist:

```sh
cd web && pnpm exec wrangler dev --config dist/server/wrangler.json \
  --persist-to "$PWD/../.data/web-state" --port 8790 \
  --var LEXEMA_RELEASE:does-not-exist
```

The page then says the lookup failed, which is a different message from finding
nothing. It does not print the reason: a database message names releases,
tables and bindings, so it goes to the Worker's log, where `wrangler dev` prints
it.

## If it will not start

| Symptom | Cause |
|---|---|
| zsh asks to correct `wrangler` to `.wrangler` | shell autocorrect; answer `n` or run from outside `web/` |
| D1 looks empty after a seed | `--persist-to` was relative; pass the `.data/web-state` path shown above |
| Seed stops with `part N of M failed` | one Wrangler run failed; the state directory is partial, so seed again into a fresh one ([DEV_SEED.md § When a part fails](DEV_SEED.md#when-a-part-fails)) |

## Not this page

Deploying to a real URL is #19, and is blocked on licensing (#6). Flipping which
imported release is served is #18.
