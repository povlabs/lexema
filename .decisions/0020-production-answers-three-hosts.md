---
id: 0020
title: Production answers on lexema.fyi, developers.lexema.fyi and api.lexema.fyi, and the API host is limited per key, never per visitor
status: accepted
date: 2026-10-01
tags: [stack, hosting]
---

# 0020 — Production answers on lexema.fyi, developers.lexema.fyi and api.lexema.fyi, and the API host is limited per key, never per visitor

**What this decides:** The live Worker serves three public hosts, not one, and calls to the API host count against the caller's key instead of the per-visitor search limits.

## Context

[ADR 0013](0013-site-public-behind-rate-limits.md) says, under *What is public*: "The Worker `lexema-web` answers on `lexema.fyi` only." [ADR 0018](0018-previews-on-workers-builds.md) amended that line for Previews and for how production is deployed, and left the production hosts standing.

Since then the same Worker answers two more production hosts. Epic [#159](https://github.com/povlabs/lexema/issues/159) planned a developer site and moved the JSON API to its own host, and Huey approved that plan on 2026-09-28. [#164](https://github.com/povlabs/lexema/issues/164), landed in PR #170, routes the hosts, and its criteria record Huey's ruling that publishing `developers.lexema.fyi` and `api.lexema.fyi` is fine. Neither touched ADR 0013, so its *What is public* line now states something false, which [#184](https://github.com/povlabs/lexema/issues/184) reports.

This record makes no new choice. It writes down the shape Huey already ruled on #159 and #164, as it stands in the code:

- `web/wrangler.jsonc` `env.production.routes` lists `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi` as custom domains, beside the three preview-only hosts of ADR 0018.
- `web/worker/hosts.ts` `ORIGIN` names the same three sites, and `byHost` tells them apart by host.
- `web/worker/index.ts` and `web/worker/api/handler.ts` send every request for the API host to the API, so it never reaches the per-visitor limits of `web/worker/rateLimit.ts`. The API limits each call by its key instead, and `web/worker/api/keyLimits.ts` `keyStanding` sets those limits by who holds the key. An admin key is outside plans: it has its own per-minute limit, counted in D1, and no billing-period allowance. An owned key takes its account's plan: a per-minute rate shared by the account's keys, counted by the `CALLS_60` or `CALLS_300` binding for those two rates and by the account meter for any other (`src/api/accountRate.ts`), and a billing-period allowance on the account meter (`web/worker/api/metering.ts`). An owned key whose account has no serving plan may not call at all.

This record amends ADR 0013 in part: the first sentence of its *What is public* line, and the scope of its *Layer two* line and first binding constraint, which read as covering every request. The rest of ADR 0013 stands, and so does ADR 0018's amendment of the same line.

## Decision

**The production Worker `lexema-web` answers on `lexema.fyi`, `developers.lexema.fyi` and `api.lexema.fyi`, and a request to the API host is limited by its key, never by the per-visitor search limits.**

- **Three production hosts.** `lexema.fyi` is the dictionary. `developers.lexema.fyi` is the developer site. `api.lexema.fyi` is the JSON API under `/v1/` and nothing else. They are custom domains of one Worker, told apart by host. `workers.dev` and preview URLs stay off, and the preview-only hosts are ADR 0018's.
- **The API host is limited per key.** A call to `api.lexema.fyi` is admitted or refused by its `X-API-Key`. An admin key has its own per-minute limit and no plan or allowance. An owned key takes its account's plan rate and its billing-period allowance, and is refused with a 402 when the account has no serving plan. A call past a key's limits gets a 429. The per-visitor search and suggestion limits of ADR 0013 do not apply to it, because the API host never reaches them.
- **The other two hosts keep the per-visitor limits.** On `lexema.fyi` and `developers.lexema.fyi`, every request listed in `web/worker/rateLimit.ts` passes the Worker's per-visitor limit before it runs, as ADR 0013 says.

**Binding constraints.**

- No API request reaches a lookup without first passing its key's limits.
- No request on `lexema.fyi` or `developers.lexema.fyi` reaches a lookup or suggestion without first passing the Worker's per-visitor limit.

## Consequences

ADR 0013 again describes what is public, so a reader no longer takes the two newer hosts as a breach of it, or trusts it to mean only `lexema.fyi` is exposed. An API caller is bounded by its key's limits, its account's plan or an admin key's own rate, not by how fast one person types, so a heavy API user does not trip the reader's search limit, and an anonymous visitor cannot reach the API at all.
