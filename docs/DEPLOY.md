# How to deploy the site

Put the Worker that serves https://lexema.fyi, https://developers.lexema.fyi
and https://api.lexema.fyi live from this repository. Running it locally is
[RUN_THE_SITE.md](RUN_THE_SITE.md); why the page works as it does is
[WEB.md](WEB.md). A merge to `main` deploys production, and every other
branch gets a Preview, both built by Cloudflare's Workers Builds
([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)). Huey sets that
up once, as [Workers Builds](#workers-builds) says.

## What production is

`web/wrangler.jsonc` holds two configurations. The top level is local
development, with the placeholder D1 that `pnpm run seed:dev` fills.
`env.production` is what is deployed:

| Setting | Production |
|---|---|
| Worker | `lexema-web` |
| Address | the custom domains `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi` only, told apart by host (`web/worker/hosts.ts`) |
| Stage | `LEXEMA_STAGE` is `production` ([below](#the-preview-only-domains)) |
| `workers_dev`, `preview_urls` | both off |
| D1 | none yet, so a search shows the failed-lookup state; attaching it is #19 |
| Rate limits | 15 searches and 120 suggestions a minute per visitor ([#128](https://github.com/hueypov/lexema/issues/128)); 10 sign-in starts ([#165](https://github.com/hueypov/lexema/issues/165)) and 5 key creations ([#168](https://github.com/hueypov/lexema/issues/168)) a minute on the developer site |
| Sign-in | Google and GitHub, each on only once its client id and secret are set ([below](#turn-on-sign-in)) |
| Workers Logs | on |

`www` to the apex and HTTP to HTTPS are dashboard settings (a redirect rule and
Always Use HTTPS), not Worker settings, so they are not in the repository.

## Deploy

A merge to `main` deploys production. Workers Builds runs the deploy command on
every push to `main`: the [sweep](#the-sweep), then the production build and
`wrangler deploy`, the same `deploy:production` script as a deploy by hand. A
failed sweep never stops the deploy. The build log is under the Worker's
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

A deploy creates every custom domain its routes list. So a production deploy
from `main` puts `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi`
live, and creates the three preview-only domains below. The API cannot look
anything up there until production has a D1 (#19).

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
env.LEXEMA_STAGE ("production")            Environment Variable
env.LEXEMA_RELEASE ("it-dev")              Environment Variable
```

The build warns that the top-level `DB` and `APP_DB` have no counterpart in
`env.production`. That is expected: production has no D1 until #19.

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
| `LEXEMA_STAGE` | `preview`, so every response the Worker gives carries `X-Robots-Tag: noindex` (`web/worker/stage.ts`) |
| `LEXEMA_RELEASE` | `it-0c432803` |
| `DB` | the shared dictionary D1 `lexema-dictionary`, which code only reads |
| `APP_DB` | `<REPLACE_ME>`, which the [Preview command](#the-preview-command) replaces with the branch's own app D1; `wrangler preview` refuses to run while it is there |
| Rate limits | production's limits under their own `namespace_id`s |
| `EMAIL` | a `send_email` binding with `destination_address` set to Huey's verified address, so it can send nowhere else |
| Sign-in | off: both OAuth client ids are empty |

`web/test/preview.test.ts` fails if a Preview's email can reach anyone else,
if a Preview rate limit shares a production `namespace_id`, if a production
build carries any stage but `production`, or if the build drops the `previews`
block. The Workers Builds settings that build and sweep Previews are
[below](#workers-builds).

## Workers Builds

Cloudflare's Workers Builds is connected to this repository and runs one of two
commands on every push, from `web/`. Their steps are in `web/builds/`:

| Branch | Command | What it runs |
|---|---|---|
| `main` | `pnpm run deploy:workers-builds` | the [sweep](#the-sweep), then `deploy:production`: the production build and `wrangler deploy` |
| any other | the [Preview command](#the-preview-command) | `preview:prepare`, then `wrangler preview` |

### The Preview command

This is the exact string for the Preview command field:

```sh
pnpm run preview:prepare && npx wrangler preview --config dist/server/wrangler.json --name "$(cat dist/preview/name)" --secrets-file dist/preview/secrets.json
```

It has two steps, because Workers Builds refuses a custom Preview command that
does not run `npx wrangler preview` itself
([Build branches, existing Workers](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#existing-workers-connected-to-builds)).

1. `pnpm run preview:prepare` (`web/builds/preview.ts`) runs the production
   build. It finds or creates the branch's app D1 `lexema-preview-app-<name>`
   and binds it as `APP_DB` in `web/dist/server/wrangler.json`, leaving `DB` on
   the shared dictionary. It applies the app migrations to it. Then it writes
   the [Preview name](#the-preview-name) to `web/dist/preview/name`, and the
   secrets for the deployment to `web/dist/preview/secrets.json`. That file holds
   a new random `BETTER_AUTH_SECRET` on every push, the first and every later one.
2. `npx wrangler preview` deploys the Preview from that config, named by that
   name, with those secrets. Without `--name`, Wrangler would name it after the
   raw branch.

The secret is sent with every Preview deployment, because a deployment keeps
only the secrets it is sent: Wrangler 4.135.0 has no flag to keep the last
deployment's. A push that sent none would leave the Preview with no
`BETTER_AUTH_SECRET`, and sign-in would break. It goes up with the deployment,
not after it, because `wrangler preview secret put` refuses a Preview that has
no deployment yet. So nothing has to run after `npx wrangler preview`. The cost
is that each push signs the Preview's testers out.

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

Every later push to a branch reuses its app D1. `web/test/workersBuilds.test.ts`
checks the prepare step and the deploy command against a fake account, with no
network and no credential.

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
longest, a 36-character UUID. Workers Builds comments the Preview URL on the
pull request
([GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/#pull-request-comment)).

### The sweep

On each push to `main`, before the deploy, the sweep deletes the Preview and the
app D1 of every branch with no open pull request. A merged pull request is
cleaned up at its own merge; one closed without merging, at the next merge.

- It reads the open pull requests' head branches from GitHub's REST API with
  `GITHUB_PR_READ_TOKEN`, a read-only token kept as a Workers Builds build secret.
- It looks only at D1 databases whose name starts with `lexema-preview-app-`, and
  never at the shared dictionary `lexema-dictionary`.
- It deletes the Preview first (`wrangler preview delete`), then its D1
  (`wrangler d1 delete`). If the Preview cannot be deleted, its D1 stays, and the
  next sweep tries again.
- If the token is missing, or GitHub's list cannot be read, it deletes nothing.
  The build log then says `sweep: deleting nothing` and why.

A Preview made any other way, such as `wrangler preview` from a laptop, has no
`lexema-preview-app-` D1, so the sweep never sees it. Delete it by hand with
`pnpm exec wrangler preview delete --name <name>` in `web/`.

### Set it up

Do these once, in this order. Each Cloudflare step names the doc page it comes
from; where a label is not in the docs, the step says what to look for.

**1. Create the read-only GitHub token.**

1. Open https://github.com/settings/personal-access-tokens/new (a fine-grained
   token).
2. **Token name**: `lexema-workers-builds-sweep`.
3. **Resource owner**: `hueypov`.
4. **Expiration**: pick a date and put a reminder in your calendar. When it
   expires the sweep deletes nothing, and says `GitHub answered 401` in the build
   log, until you make a new one; deploys carry on.
5. **Repository access**: **Only select repositories**, then pick
   `hueypov/lexema` and nothing else.
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
3. Pick your GitHub account and the repository `hueypov/lexema`. If Cloudflare
   asks to install the **Cloudflare Workers and Pages** GitHub app, give it access
   to `hueypov/lexema` only
   ([GitHub integration, manage access](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/#manage-access)).
4. Fill in the build settings with exactly these values
   ([Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#build-settings)):

   | Setting | Value |
   |---|---|
   | Git branch (the production branch) | `main` |
   | Build command | `pnpm install --frozen-lockfile` |
   | Deploy command | `pnpm run deploy:workers-builds` |
   | Preview command (the one for branches that are not `main`, whatever the page labels it) | `pnpm run preview:prepare && npx wrangler preview --config dist/server/wrangler.json --name "$(cat dist/preview/name)" --secrets-file dist/preview/secrets.json` ([above](#the-preview-command)) |
   | Root directory | `web` |
   | API token | leave the default, **Create new token**, unless one already exists for Workers Builds; then select that one |

5. Save. Cloudflare may start a first build straight away; it can fail until
   the steps below are done, and the next push retries.

**3. Turn on preview builds**
([Build branches, configure preview builds](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#configure-preview-builds)).

1. In the same Worker, go to **Settings**, **Build**, **Branch control**.
2. Check that the production branch is `main`, and tick **Enable Preview
   Builds**.
3. If the page shows a **Set up Worker Previews** banner, select **Set up**.
   Set the Preview command to the [Preview command](#the-preview-command) above,
   exactly:

   ```sh
   pnpm run preview:prepare && npx wrangler preview --config dist/server/wrangler.json --name "$(cat dist/preview/name)" --secrets-file dist/preview/secrets.json
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

1. Push a branch and open a pull request. Workers Builds comments a Preview
   URL on it. The build log shows `Preview <name> for branch <branch>`, then
   `app database: created lexema-preview-app-<name>`, the migrations,
   `BETTER_AUTH_SECRET: a new random one goes up with Preview <name>`, and
   `wrangler preview`.
2. Push to the branch again. The log now says `app database: reusing`, and
   again `BETTER_AUTH_SECRET: a new random one goes up with Preview <name>`.
3. Merge it. The `main` build log starts with `sweep:` lines, deletes that
   branch's Preview and app D1, and then deploys production.

## Turn on sign-in

The developer site signs in with Google and GitHub, on better-auth
(`web/worker/signIn.ts`, [ADR 0017](../.decisions/0017-better-auth-and-drizzle-own-accounts.md)).
A provider stays unavailable, and its sign-in route answers 503, until its
client id and its secret are set, and so is `BETTER_AUTH_SECRET`, which signs
the session cookie. None of them is in the repository.

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

Sign-in also needs the production app database, `APP_DB` (#19): without it, a
callback answers 503.

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
