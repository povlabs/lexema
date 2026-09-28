# How to deploy the site

Put the Worker that serves https://lexema.fyi, https://developers.lexema.fyi
and https://api.lexema.fyi live from this repository. Until the developer site
is ready, a deploy puts only https://lexema.fyi live
([below](#the-developer-hosts-are-held-back)). Running it locally is
[RUN_THE_SITE.md](RUN_THE_SITE.md); why the page works as it does is
[WEB.md](WEB.md). Deploying is Huey's call.

## What production is

`web/wrangler.jsonc` holds two configurations. The top level is local
development, with the placeholder D1 that `pnpm run seed:dev` fills.
`env.production` is what is deployed:

| Setting | Production |
|---|---|
| Worker | `lexema-web` |
| Address | the custom domains `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi` only, told apart by host (`web/worker/hosts.ts`); the last two are held back |
| `workers_dev`, `preview_urls` | both off |
| D1 | none yet, so a search shows the failed-lookup state; attaching it is #19 |
| Rate limits | 15 searches and 120 suggestions a minute per visitor ([#128](https://github.com/hueypov/lexema/issues/128)) |
| Workers Logs | on |

`www` to the apex and HTTP to HTTPS are dashboard settings (a redirect rule and
Always Use HTTPS), not Worker settings, so they are not in the repository.

## The developer hosts are held back

A deploy creates every custom domain its routes list. So a deploy of
`env.production` as written would put `developers.lexema.fyi` and
`api.lexema.fyi` live. Epic [#159](https://github.com/hueypov/lexema/issues/159)
rules that nothing there is published before the whole developer site is
ready.

Until then, the build leaves those two domains out of the routes it writes
([`web/worker/heldBack.ts`](../web/worker/heldBack.ts), applied in
[`web/vite.config.ts`](../web/vite.config.ts)). So a deploy from `main` creates
`lexema.fyi` alone. `web/test/rateLimit.test.ts` fails if the routes left
after the hold are anything else.

One thing still points at the held-back API: `lexema.fyi/api/v1/…` answers 301
to `api.lexema.fyi`, which is not there yet. Production has no D1 (#19), so no
key could call the API there anyway.

To launch the developer site, empty `HELD_BACK`, then delete the file and its
use in `web/vite.config.ts`.

## Deploy

Log in with `pnpm exec wrangler login` in `web/` first, as the account that owns
`lexema.fyi`. Then, from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @lexema/web run deploy:production
```

That builds with `CLOUDFLARE_ENV=production`, which makes the build write the
production settings into `web/dist/server/wrangler.json`, and deploys that file.

To see what would go up without deploying, add `--dry-run`:

```sh
pnpm --filter @lexema/web run deploy:production --dry-run
```

The domains it would create are the `routes` in
`web/dist/server/wrangler.json`. The dry run ends by listing the bindings, and
nothing else:

```
env.SEARCH_LIMIT (15 requests/60s)         Rate Limit
env.SUGGEST_LIMIT (120 requests/60s)       Rate Limit
env.ASSETS                                 Assets
env.LEXEMA_RELEASE ("it-dev")              Environment Variable
```

The build warns that the top-level `DB` has no counterpart in `env.production`.
That is expected: production has no D1 until #19.

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
