---
id: 0013
title: The site is public at lexema.fyi, and every search is rate-limited per visitor before it can reach the database
status: amended-in-part by [0018](0018-previews-on-workers-builds.md), [0020](0020-production-answers-three-hosts.md)
date: 2026-09-24
tags: [stack, hosting]
---

# 0013 — The site is public at lexema.fyi, and every search is rate-limited per visitor before it can reach the database

**What this decides:** The website shell is live at `lexema.fyi` without the dictionary behind it, two per-visitor limits stand in front of every search, publishing needs no lawyer's review, and the July archive may be published as the 1 July 2026 Wiktionary snapshot.

## Context

[ADR 0004](0004-cloudflare-workers-d1-vinext.md) said access is local development only, and that publishing is blocked on the licensing review in #6. [ADR 0009](0009-two-licences-and-a-source-link.md) closed #6. It still requires a lawyer's review before public launch and a dated release before any source data is published, and it forbids any address outside this machine from serving results until the *Source* link and the attribution page exist.

Huey's rulings below were made in the working session and are summarised on [#128](https://github.com/povlabs/lexema/issues/128#issuecomment-5812231763).

On 2026-09-24 Huey bought `lexema.fyi` and asked for the site to be deployed there without its database. He accepted that search would not work until then, and asked for rate limiting to be built first. Requests are what the site costs ([#19](https://github.com/povlabs/lexema/issues/19)), so the limit comes before the database.

The shell was deployed that day with no D1 binding. A search on it shows the failed-lookup state and serves no Wiktionary text. [#128](https://github.com/povlabs/lexema/issues/128) (PR #129) then added the Worker's limits and the production config. Huey chose the search limit himself: he rejected 30 a minute as more than anyone types by hand, and settled on 15 after weighing a reader clicking through links against a single-address scraper. A live test showed the Worker's limit is per machine and only loosely shared, so Huey added a Cloudflare rate-limiting rule in front of it the same day.

The public shell conflicted with ADR 0009's legal-review condition. Huey ruled that no lawyer's review is needed: the Wiktionary licence had already been checked, and meeting its terms is what compliance requires. He asked for that check to be repeated. The check was redone that day against CC BY-SA 4.0 §3 and the Wikimedia Terms of Use §7:

- **Authors credited.** The Terms of Use allow a hyperlink to the page, whose history lists the authors, and every result links its Wiktionary page.
- **Licence named and linked, warranty disclaimer kept.** Both are on `/attribution`.
- **Changes stated.** `/attribution` has a *What we changed* section.
- **ShareAlike, no added restrictions.** Lexema adds no terms, and a rate limit restricts traffic, not reuse.

The check also found two wrong statements on `/attribution`: that Lexema never reads Wiktionary directly (the recovery layer reads the Wikimedia dump), and that the licence for Lexema's own material is undecided (ADR 0009's amendment settled it). They are fixed separately.

ADR 0009 also barred publishing the July archive, because the file does not record which Wiktionary dump it was built from. Huey ruled that Lexema keeps that archive and states its source as the 1 July 2026 dump. kaikki rebuilds its files about weekly and publishes no list of what changes between builds, so moving to a newer file now would mean re-checking the data for no stated gain. The evidence for 1 July: the archive was built on 16 July, the most recent dump before that is `itwiktionary-20260701`, every one of the archive's 560,357 records has a page of its exact title in that dump, and the dump's newest revision is from 3 July ([report](../reports/2026-09-23-recovered-definitions-full-release.md)). Checking kaikki for newer builds automatically is left for later ([#132](https://github.com/povlabs/lexema/issues/132)).

This record amends ADR 0004 in part, its *Access* line. It amends ADR 0009 in part: the *Legal review before public launch* clause, the legal-review sentence of its amendment, the clause that the July file is not published, and the *One attribution page* clause's requirement that the page carry the release identity. On the page, the release is now identified by its source dump and the kaikki.org download link; its release id and checksum stay in the repository. The rest of both stands.

## Decision

**`lexema.fyi` serves the site publicly, and every request that can run a lookup passes two per-visitor limits before it can reach the database.**

- **What is public.** The Worker `lexema-web` answers on `lexema.fyi` only. `workers.dev` and preview URLs are off. `www.lexema.fyi` redirects to the apex, and HTTP redirects to HTTPS. `pnpm --filter @lexema/web run deploy:production` deploys it ([docs/DEPLOY.md](../docs/DEPLOY.md)). *Amended by [ADR 0018](0018-previews-on-workers-builds.md): Worker Previews on their preview-only hosts, and how production is deployed, are 0018's; the redirects and the rest of this record stand. Amended by [ADR 0020](0020-production-answers-three-hosts.md), from [#159](https://github.com/povlabs/lexema/issues/159) and [#164](https://github.com/povlabs/lexema/issues/164): production answers on `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi`, and the API host is limited per key, not by the per-visitor limits below.*
- **No lawyer's review.** Publishing, the site or its data, needs no legal review. Compliance means meeting the licence's own terms, checked as above, and any change to what is published or how it is credited is checked against them again.
- **The published source is the 1 July 2026 snapshot.** The archive `it-0c432803` is published as extracted from `itwiktionary-20260701`. The dump is inferred, not recorded by kaikki: it is the last dump before the build, and the page match is consistent with it, not proof of it. The repository's records say so.
- **The attribution page stays short.** Huey ruled that `/attribution` should be as clear as possible. It names the source, the 1 July 2026 Italian Wiktionary dump, linked to its Wikimedia page, and links the kaikki.org download the file came from. Dates, checksums, release ids and the evidence stay in the repository, not on the page. *Amended by [ADR 0009](0009-two-licences-and-a-source-link.md)'s amendment #139: the page is now `/licence`, and Huey's approved text for it names the release the content is up to date with, beside its dump date; checksums and the evidence still stay in the repository.*
- **No dictionary data yet.** The production config has no D1 binding. Attaching one publishes Wiktionary text, so it waits until the release records its source dump and download URL, which the attribution page then shows.
- **Layer one, Cloudflare's rate-limiting rule "Lexema flood guard".** It matches the paths `/`, `/index.rsc` and `/suggest`, and allows 60 requests per 10 seconds per IP, then blocks for 10 seconds. The free plan allows path matching only and a 10-second window, so this rule is a flood guard, not the reading policy. It runs before the Worker, so a blocked request is not a billed Worker request.
- **Layer two, the Worker's rate-limit binding.** It allows 15 searches and 120 suggestions per 60 seconds per visitor. It keys on `CF-Connecting-IP`, using the /64 for IPv6, and runs before any route and any database access. Over the limit, a search gets a 429 page that keeps the search field, and a suggestion gets nothing. Blocks are logged without the address.
- **The numbers are configuration.** The limits live in `web/wrangler.jsonc` and in the dashboard rule. They are a starting point, tuned on logged blocks, and changing them needs no new record.

**Binding constraints.**

- No request path reaches a lookup or suggestion without first passing the Worker's limit.
- Production gains a D1 binding only once the served release records its source dump and download URL.
- A setting made in the Cloudflare dashboard is written down in the repository, on #19 or in `docs/DEPLOY.md`, the day it is made.

## Consequences

The site has an address and a deploy path before it has data, so hosting problems surface early and away from the dictionary. The Worker binding is approximate by design: a client that opens a new connection per request can exceed 15 a minute, and the dashboard rule is what bounds that. Blocked requests that reach the Worker still count toward the Worker request bill.

No load balancer is involved. Huey asked whether one was needed, and the answer was no: the Worker runs in every Cloudflare location, and there is no server of ours to balance across.

The dashboard rule and the redirects live outside the repository, so they can drift from what is written here. That is why the last binding constraint exists. Moving them into code would need a Cloudflare token with zone rule permissions, which this machine's login does not have.

## Records

No vocabulary impact.
