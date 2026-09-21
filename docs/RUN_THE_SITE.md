# How to run the search page locally

Get the Italian search page answering queries on your own machine. Why it is
built this way is [WEB.md](WEB.md); the seed's exact numbers are
[DEV_SEED.md](DEV_SEED.md). This page is the operation.

## Before you start

- `it-extract.jsonl.gz` in the repository root.
- A few hundred MB free under `.data/` and `web/.wrangler/`.
- About two minutes, most of it the seed.

Nothing here touches a Cloudflare account. `wrangler dev` runs the Worker on
workerd locally, and `--local` D1 is a miniflare SQLite file.

## Run it

```sh
pnpm install --frozen-lockfile
pnpm run seed:dev
pnpm --filter @lexema/web build
cd web && pnpm exec wrangler dev --config dist/server/wrangler.json \
  --persist-to "$PWD/.wrangler/state" --port 8790
```

Then open <http://localhost:8790/?q=sale>.

`pnpm run seed:dev` builds a development release and loads it into local D1. It
drops the existing local D1 database first, so re-running it needs no cleanup.

The seed is a prefix of the archive, cut into `.data/it-dev.jsonl.gz` and
imported whole; what that covers is in [DEV_SEED.md](DEV_SEED.md), and why it is
cut rather than limited is in
[WEB.md](WEB.md#why-the-seed-is-a-prefix-file-not-a-limited-import).

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

The seed loads a prefix of the archive, so a word past its cutoff returns the
empty state rather than an error. [DEV_SEED.md](DEV_SEED.md) lists what the
default covers. The same query can answer differently against a full release:
`citta` is empty in the default prefix and has an entry in the whole archive.

## See the failed-lookup state

Point the Worker at a release that does not exist:

```sh
cd web && pnpm exec wrangler dev --config dist/server/wrangler.json \
  --persist-to "$PWD/.wrangler/state" --port 8790 \
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
| D1 looks empty after a seed | `--persist-to` was relative; wrangler resolves it against the config file, so pass an absolute path |
| `SQLITE_TOOBIG` from a manual `d1 execute` | the SQL has a statement over wrangler's limit; the seed batches at 64 KiB for this reason |

## Not this page

Deploying to a real URL is #19, and is blocked on licensing (#6). Flipping which
imported release is served is #18.
