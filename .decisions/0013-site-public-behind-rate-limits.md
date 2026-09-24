---
id: 0013
title: The site is public at lexema.fyi, and every search is rate-limited per visitor before it can reach the database
status: accepted
date: 2026-09-24
tags: [stack, hosting]
---

# 0013 — The site is public at lexema.fyi, and every search is rate-limited per visitor before it can reach the database

**What this decides:** The website shell is live at `lexema.fyi` without the dictionary behind it, and two per-visitor limits, one in Cloudflare and one in the Worker, stand in front of every search before any data is attached.

## Context

[ADR 0004](0004-cloudflare-workers-d1-vinext.md) said access is local development only, and that publishing is blocked on the licensing review in #6. [ADR 0009](0009-two-licences-and-a-source-link.md) closed #6. It still requires a lawyer's review before public launch and a dated release before any source data is published, and it forbids any address outside this machine from serving results until the *Source* link and the attribution page exist.

On 2026-09-24 Huey bought `lexema.fyi` and asked for the site without its data: "deploy the web there not the database for now . i know search function is not gonna work, which is better we have to implement rate limiter first." Requests are what the site costs ([#19](https://github.com/hueypov/lexema/issues/19)), so the limit comes before the database.

The shell was deployed that day with no D1 binding. A search on it shows the failed-lookup state and serves no Wiktionary text. [#128](https://github.com/hueypov/lexema/issues/128) (PR #129) then added the Worker's limits and the production config. Huey chose the search limit himself: he rejected 30 a minute ("nobody can write that with a keyboard") and settled on 15 after weighing a reader clicking through links against a single-address scraper. A live test showed the Worker's limit is per machine and only loosely shared, so Huey added a Cloudflare rate-limiting rule in front of it the same day.

This record amends ADR 0004 in part: its *Access* line. The rest of ADR 0004 stands, and ADR 0009 is unchanged.

## Decision

**`lexema.fyi` serves the site publicly, and every request that can run a lookup passes two per-visitor limits before it can reach the database.**

- **What is public.** The Worker `lexema-web` answers on `lexema.fyi` only. `workers.dev` and preview URLs are off. `www.lexema.fyi` redirects to the apex, and HTTP redirects to HTTPS. `pnpm --filter @lexema/web run deploy:production` deploys it ([docs/DEPLOY.md](../docs/DEPLOY.md)).
- **No dictionary data yet.** The production config has no D1 binding. Attaching one publishes Wiktionary text, so it waits for ADR 0009's conditions: the lawyer's review and a dated release.
- **Layer one, Cloudflare's rate-limiting rule "Lexema flood guard".** It matches the paths `/`, `/index.rsc` and `/suggest`, and allows 60 requests per 10 seconds per IP, then blocks for 10 seconds. The free plan allows path matching only and a 10-second window, so this rule is a flood guard, not the reading policy. It runs before the Worker, so a blocked request is not a billed Worker request.
- **Layer two, the Worker's rate-limit binding.** It allows 15 searches and 120 suggestions per 60 seconds per visitor. It keys on `CF-Connecting-IP`, using the /64 for IPv6, and runs before any route and any database access. Over the limit, a search gets a 429 page that keeps the search field, and a suggestion gets nothing. Blocks are logged without the address.
- **The numbers are configuration.** The limits live in `web/wrangler.jsonc` and in the dashboard rule. They are a starting point, tuned on logged blocks, and changing them needs no new record.
- **No load balancer.** The Worker runs in every Cloudflare location, and there is no server of ours to balance across.

**Binding constraints.**

- No request path reaches a lookup or suggestion without first passing the Worker's limit.
- Production gains a D1 binding only once ADR 0009's pre-publication conditions are met.
- A setting made in the Cloudflare dashboard is written down in the repository, on #19 or in `docs/DEPLOY.md`, the day it is made.

## Consequences

The site has an address and a deploy path before it has data, so hosting problems surface early and away from the dictionary. The Worker binding is approximate by design: a client that opens a new connection per request can exceed 15 a minute, and the dashboard rule is what bounds that. Blocked requests that reach the Worker still count toward the Worker request bill.

The dashboard rule and the redirects live outside the repository, so they can drift from what is written here. That is why the last binding constraint exists. Moving them into code would need a Cloudflare token with zone rule permissions, which this machine's login does not have.

## Records

No vocabulary impact.
