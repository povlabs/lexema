# How to deploy the site

Put the Worker that serves https://lexema.fyi, https://developers.lexema.fyi
and https://api.lexema.fyi live from this repository. Running it locally is
[RUN_THE_SITE.md](RUN_THE_SITE.md); why the page works as it does is
[WEB.md](WEB.md). Deploying is Huey's call.

## What production is

`web/wrangler.jsonc` holds two configurations. The top level is local
development, with the placeholder D1 that `pnpm run seed:dev` fills.
`env.production` is what is deployed:

| Setting | Production |
|---|---|
| Worker | `lexema-web` |
| Address | the custom domains `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi` only, told apart by host (`web/worker/hosts.ts`) |
| `workers_dev`, `preview_urls` | both off |
| D1 | none yet, so a search shows the failed-lookup state; attaching it is #19 |
| Rate limits | 15 searches and 120 suggestions a minute per visitor ([#128](https://github.com/hueypov/lexema/issues/128)); 10 sign-in starts a minute on the developer site ([#165](https://github.com/hueypov/lexema/issues/165)) |
| Sign-in | Google and GitHub, each on only once its client id and secret are set ([below](#turn-on-sign-in)) |
| Workers Logs | on |

`www` to the apex and HTTP to HTTPS are dashboard settings (a redirect rule and
Always Use HTTPS), not Worker settings, so they are not in the repository.

## Deploy

Log in with `pnpm exec wrangler login` in `web/` first, as the account that owns
`lexema.fyi`. Then, from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @lexema/web run deploy:production
```

That builds with `CLOUDFLARE_ENV=production`, which makes the build write the
production settings into `web/dist/server/wrangler.json`, and deploys that file.

A deploy creates every custom domain its routes list. So a production deploy
from `main` puts `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi`
live. The API cannot look anything up there until production has a D1 (#19).

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

## Turn on sign-in

The developer site signs in with Google and GitHub (`web/worker/signIn.ts`).
A provider stays unavailable, and its sign-in route answers 503, until both its
client id and its secret are set. Neither is in the repository.

1. Create a Google OAuth client of type *Web application* in the Google Cloud
   console, with the authorized redirect URI
   `https://developers.lexema.fyi/sign-in/google/callback`.
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

Sign-in also needs the production D1 (#19): without it, a callback answers 503.

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
