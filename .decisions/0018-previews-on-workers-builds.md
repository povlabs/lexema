---
id: 0018
title: Workers Builds deploys a Preview per branch and production on each merge to main, over one shared read-only dictionary D1
status: accepted
date: 2026-09-30
tags: [stack, hosting]
---

# 0018 — Workers Builds deploys a Preview per branch and production on each merge to main, over one shared read-only dictionary D1

**What this decides:** Every branch gets its own public, noindexed preview of the three sites, built by Cloudflare from the connected repository; previews and production read one dictionary database and never write to it; each preview writes only to its own app database; and merging to `main` deploys production, with no Cloudflare key in GitHub.

## Context

The `review-ui` gate captures only a pull request's announced preview, and this repository deploys none, so every `web/` pull request parks on a hand check by Huey ([#172](https://github.com/hueypov/lexema/issues/172), PR #170, PR #157). Epic #172 gives each pull request a preview of `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi`.

Huey ruled the design on #172 on 2026-09-30:

- [09:22](https://github.com/hueypov/lexema/issues/172#issuecomment-5908188492): previews run on Workers Builds, not a GitHub Action holding a Cloudflare token; a small Action with only `GITHUB_TOKEN` posts Fabrika's markers; previews are public with noindex; the preview email binding sends only to Huey.
- [09:49](https://github.com/hueypov/lexema/issues/172#issuecomment-5908694376): production and every Preview share one dictionary database, read-only by code; app data lives in a separate `APP_DB`; later releases apply as diffs.
- [10:09](https://github.com/hueypov/lexema/issues/172#issuecomment-5909073281), items 1, 3 and 4: a merge to `main` deploys production after the preview sweep; D1 Edit on the Workers Builds token is accepted; production bindings stay with [#19](https://github.com/hueypov/lexema/issues/19).
- [10:12](https://github.com/hueypov/lexema/issues/172#issuecomment-5909144970): no Cloudflare key in GitHub after all, so no close-cleanup Action; the sweep on each merge to `main` cleans up.
- [10:26](https://github.com/hueypov/lexema/issues/172#issuecomment-5909362893): the sweep reads open pull requests with a read-only GitHub token kept as a Workers Builds build secret.

The facts under these rulings were settled in grilling session [#238](https://github.com/hueypov/lexema/issues/238), mirrored on #172 ([R1](https://github.com/hueypov/lexema/issues/172#issuecomment-5908750659), [R2](https://github.com/hueypov/lexema/issues/172#issuecomment-5909132772), [R3](https://github.com/hueypov/lexema/issues/172#issuecomment-5909199824)), from these Cloudflare pages, read 2026-09-30:

- [Previews](https://developers.cloudflare.com/workers/previews/): one isolated Preview per name under one Worker; custom-domain Previews are not noindexed by Cloudflare; past 500 Previews per Worker the least recently deployed is evicted.
- [Previews, resources and isolation](https://developers.cloudflare.com/workers/previews/resources/): D1 is not provisioned per Preview. "Two Previews sharing the same `database_id` share rows"; to isolate one, bind a different D1, apply migrations to it, then run `wrangler preview` (#238 R1.1).
- [Previews, custom domains](https://developers.cloudflare.com/workers/previews/custom-domains/): a route with `previews_enabled: true, enabled: false` serves Previews only, at `<preview-name>.<domain>`.
- [Builds configuration, API token](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token): the Builds token has no D1 permission by default; it is edited in Cloudflare (#238 R1.2).
- [Builds configuration, environment variables](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/): a build sees only `CI`, `WORKERS_CI`, `WORKERS_CI_BUILD_UUID`, `WORKERS_CI_COMMIT_SHA` and `WORKERS_CI_BRANCH`, and no pull request state (#238 R3.2).
- [Build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/): the production branch runs the build and deploy commands on every push; a custom preview command must still run `wrangler preview` (#238 R2.2, R3.1).
- [Previews, examples](https://developers.cloudflare.com/workers/previews/examples/) and [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/): Workers Builds comments the Preview URL on the pull request.
- [Email send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/): a `send_email` binding with `destination_address` can send to that address only.

This record amends [ADR 0013](0013-site-public-behind-rate-limits.md) in part: its *What is public* line (the part [#184](https://github.com/hueypov/lexema/issues/184) names) and its deploy sentence in that line, that `deploy:production` from a laptop is how the site is deployed. It amends the sentence "Deploying is Huey's call" in [docs/DEPLOY.md](../docs/DEPLOY.md) the same way; that page is rewritten with the Workers Builds settings by #252. It sits beside [ADR 0017](0017-better-auth-and-drizzle-own-accounts.md) and follows its line: the dictionary is raw SQL, the app tables are Drizzle. It replaces the #172 triage's first and third rulings and its no-gos on Workers Builds and on production deploys from CI. The rest of ADR 0013 stands.

## Decision

**Workers Builds, connected to this repository, deploys a Worker Preview of `lexema-web` for every branch and deploys production on every merge to `main`; every Preview and production read one shared dictionary D1 that code never writes, and each Preview writes only to its own app D1.**

- **Previews on Workers Builds.** The repository is connected to Workers Builds with `main` as its production branch and preview builds on. Each branch gets one Worker Preview, named from the branch. Fork pull requests get none, since Workers Builds builds only this repository's branches.
- **Fabrika's markers from `GITHUB_TOKEN` alone.** A GitHub Action with only the built-in `GITHUB_TOKEN` reads Cloudflare's preview comment or check run and keeps one pull request comment with `<!-- preview-deploy:web -->`, `<!-- preview-deploy:developers -->` and `<!-- preview-deploy:api -->` blocks, each naming that site's deployment URL and `@ <head sha>`.
- **No Cloudflare key in GitHub.** No workflow holds or reads a Cloudflare token, and there is no `CLOUDFLARE_*` GitHub secret.
- **The sweep.** Each production build first deletes the Previews and app D1s of branches with no open pull request, then deploys. A merged pull request is cleaned up at its own merge; one closed without merging, at the next merge to `main`. The sweep reads open pull requests with `GITHUB_PR_READ_TOKEN`, a fine-grained GitHub token for this repository with Pull requests: read, kept as a Workers Builds build secret (#238 R3.2). When the list cannot be read, the sweep deletes nothing and the deploy still runs.
- **D1 Edit on the Builds token.** Huey adds D1 Edit to the Workers Builds token in Cloudflare. It reaches every database on the account, which is accepted because only reviewed build commands use it.
- **Three preview-only hosts.** `preview.lexema.fyi`, `developers-preview.lexema.fyi` and `api-preview.lexema.fyi` are custom domains that serve Previews only. The Preview for branch slug `<name>` answers at `<name>.preview.lexema.fyi`, `<name>.developers-preview.lexema.fyi` and `<name>.api-preview.lexema.fyi`, told apart by host like production. Previews are public, and every response on the `preview` stage carries `X-Robots-Tag: noindex`.
- **The stage is explicit.** `LEXEMA_STAGE` names where the Worker runs: `local`, `preview` or `production`. It is parsed into a closed type, and any other value refuses to boot. Preview-only behaviour keys on it.
- **One shared dictionary D1.** Production and every Preview bind `DB` to one remote dictionary D1. Code only reads through it, and a test fails if any code path writes through the dictionary binding. A release is uploaded into it once, seeded and verified as [ADR 0012](0012-archive-is-the-release-seed.md) says. Later releases apply as diffs, not full re-imports; how is [#132](https://github.com/hueypov/lexema/issues/132)'s and [#18](https://github.com/hueypov/lexema/issues/18)'s, and not decided here. Local development keeps its own local copy as the default.
- **The one-time upload is a laptop run.** Huey uploads a release from his machine, where the archive lives, with `seed:dev`'s remote target. It is not a workflow, since a workflow would need a Cloudflare token in GitHub.
- **`APP_DB` is the app database.** Accounts, keys, plans, usage and reader reports live on their own binding, `APP_DB`, locally, on Previews and in production. `DB` stays the dictionary.
- **One app D1 per branch on Previews.** The Workers Builds preview command creates `lexema-preview-app-<branch>` if absent, writes its id into the built config's Preview binding, applies the app migrations to it, then runs `wrangler preview`. Production's `APP_DB` is #19's.
- **A merge to `main` deploys production.** The Workers Builds production command runs the sweep, then `wrangler deploy` with the production build. Binding the shared dictionary and a production `APP_DB` into `env.production` stays with #19, under ADR 0013's binding constraint.
- **Preview email goes only to Huey.** The Preview `send_email` binding carries `destination_address` set to Huey's verified address, so it can send nowhere else.
- **Previews keep apart from production.** A Preview never binds a production `APP_DB` or a production secret, and uses its own rate-limit namespace ids.

**Binding constraints.**

- No GitHub workflow holds, reads or is given a Cloudflare credential.
- No code path writes through the dictionary binding.
- Each Preview binds its own app D1, never another branch's and never production's.
- Every response on the `preview` stage carries `X-Robots-Tag: noindex`.
- The Preview `send_email` binding always carries `destination_address`.
- Every Workers Builds setting and build secret is written down in `docs/DEPLOY.md`, per ADR 0013's last binding constraint.

## Consequences

- Every `web/` pull request can be captured by `review-ui render` at its head, with `--app developers` or `--app api` for the other two hosts, without a hand check.
- `main` is production. A reviewed merge goes live with no further step, so the merge gate of [ADR 0006](0006-codex-review-is-the-merge-gate.md) is now also the deploy gate, and a broken merge stays live until something replaces it.
- Previews are public and serve the dictionary before production does. They carry the same *Source* links and `/attribution` page as production, so the licence terms ADR 0013 checked apply to them unchanged. ADR 0013's rule that production gains a D1 only once the release records its source dump is left as it stands, with #19.
- The dictionary D1 is shared, so a bad write would reach production and every Preview at once. The read-only binding and its test are what stop it.
- A closed, unmerged pull request's Preview and app D1 live until the next merge to `main`.
- The Builds token can edit every D1 on the account, including the dictionary. Build commands are reviewed like any other code.
- The build pipeline now lives in Cloudflare's dashboard as well as the repository, so it can drift; that is why its settings go into `docs/DEPLOY.md`.

## Records

This ADR coins three terms, added to [.glossary/TERMS.md](../.glossary/TERMS.md) in the same change: **Preview**, **app database** and **stage**.
