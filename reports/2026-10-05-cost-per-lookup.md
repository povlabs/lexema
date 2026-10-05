# What one lookup costs on Workers Paid, 2026-10-05

Measured on production right after go-live
([#19](https://github.com/povlabs/lexema/issues/19),
[#611](https://github.com/povlabs/lexema/issues/611)). The question is what one
word lookup costs on Cloudflare's $5 Workers Paid plan, and how much traffic that
plan carries. The numbers are the baseline for
[#393](https://github.com/povlabs/lexema/issues/393) (cutting queries per page)
and the trigger for [#113](https://github.com/povlabs/lexema/issues/113) (static
suggestion files). They were read once and are recorded here as read; nothing was
re-measured for this report.

## Method

- Source: the Cloudflare GraphQL Analytics API, read-only.
  `workersInvocationsAdaptive` for the `lexema-web` Worker, and D1 analytics for
  the `lexema-dictionary` database.
- A controlled sample, sent in quiet windows:
  - 10 word pages (`/?q=` andare, bello, casa, essere, sale, zzzz, citta, grande,
    mangiare, anima gemella), 2026-10-05 20:03:49 to 20:04:40Z.
  - 9 `/suggest` calls, 2026-10-05 20:06:18 to 20:07:35Z.

## Per-request results

| Request | CPU median | CPU mean | CPU p99 | D1 rows read | D1 read queries |
|---|---|---|---|---|---|
| Word page | ~100 ms (minute p50s 112 and 90) | 121 ms | 309 ms | ~3,640 | ~114 |
| `/suggest` call | ~8–10 ms | 12 ms | 45 ms | ~31 | 4 |

## One lookup

One lookup is 1 word page plus ~2 suggest calls, from the #113 research:

- 3 requests
- ~120 ms CPU (145 ms by means)
- ~3,700 D1 rows read

## Plan allowances and overage prices

Source: Cloudflare docs, fetched 2026-10-05.

| Workers Paid, $5/month | Included | Then |
|---|---|---|
| Requests | 10M | $0.30/M |
| CPU time | 30M CPU ms | $0.02/M ms |
| D1 rows read | 25B | $0.001/M rows |

Static assets are free.

## What the plan carries

Lookups per month that fit inside each allowance:

| Allowance | Lookups per month |
|---|---|
| CPU | ~250k (hit first) |
| Requests | ~3.3M |
| D1 rows read | ~6.8M |

Estimated monthly bill: ~$7 at 1M lookups, ~$46 at 10M lookups.

## Caveats

- **Go-live skew.** From go-live to the sample (17:40–20:03Z) there were 785
  requests, mostly our own smoke tests. A repeating request pair, likely a
  monitor, was left out of the sample.
- **Client latency is not a billing figure.** Seen from the measuring machine,
  latency was sometimes 1–19 s, while the Worker's own wall time was 0.3–0.5 s.
  The delay was outside the Worker (client network or edge).

## What to watch

Cloudflare dashboard: Workers & Pages → lexema-web → Metrics, and Billing → Usage.
