# Where a dictionary page render spends Worker CPU — 2026-11-02

Issue [#921](https://github.com/povlabs/lexema/issues/921). On `lexema-web`, a
dictionary page costs about 85-115 ms of Worker CPU per invocation (Cloudflare
GraphQL `workersInvocationsAdaptive`, quoted in the issue). This finding profiles
one word-page render and one home-page render on a local production build, says
where the time goes, and says which part of the production figure is render
work.

## In short

- Each part of the render is small. No single function takes most of the time.
  A warm word page costs 41 ms (`casa`, 98 KB) to 94 ms (`rosa`, 240 KB) on this
  machine, and the cost grows with page size.
- Utility class strings are about half the bytes of a big word page. They
  appear once in the HTML and again in the inline RSC payload.
- The first page a new isolate renders costs 2-3 times a warm render: 108-165 ms
  for a word page and 83 ms for the home page. Production traffic is low, so many
  requests may land on a new isolate.
- The `sweepReports` cron is about 2% of production CPU. Isolate startup is
  37 ms locally. Cloudflare's docs do not say whether startup counts toward an
  invocation's CPU.

## How it was measured

- Commit `1525c0726cd68b78fa5ba8b467e14916e7f4945f` (`main`, after #920).
- Machine: Apple M1 Pro laptop, 16 GB, macOS, Node 26.2.0, wrangler 4.135.0.
  Nothing else heavy ran during the profile.
- Local numbers compare builds and request kinds. They do not match Cloudflare's
  own figure: Cloudflare's CPUs differ, and its D1 is remote.

Commands, run from the repository root and then from `web/`:

```sh
pnpm run seed:state <scratch>/state          # the fifty-word dev seed
cd web
pnpm run build                               # vinext build
node_modules/.bin/vinext build --sourcemap hidden
node_modules/.bin/wrangler dev --config dist/server/wrangler.json \
  --persist-to <scratch>/state --port 8790 --inspector-port 9229
CLOUDFLARE_API_TOKEN=unused-local-profile \
  node_modules/.bin/wrangler check startup --config dist/server/wrangler.json
```

`--sourcemap hidden` adds map files and no `sourceMappingURL` comment, so the
code that runs is the code of the plain build. The two builds differ only in
build ids and chunk hashes. The maps let each profile sample be named by its
source file and function.

A small script attached to wrangler's inspector through the Chrome DevTools
Protocol. For each request it ran `Profiler.start` at a 100 µs sampling interval,
fetched the page, read the whole body, waited 300 ms for `waitUntil` work, then
ran `Profiler.stop`. "Busy" is the sum of the non-idle samples. With the profiler
off, the same renders took about the same wall time (`casa` 45-70 ms, home
20-22 ms), so the profiler adds little.

Kinds of request:

- **miss**: the first request for a page. It renders, then the shared cache keeps
  it (`x-lexema-page: miss`).
- **render**: a request with a `Cookie` header. `withSharedPageCache` neither
  reads nor writes the cache for it, so the same page can be rendered again.
- **hit**: answered from `caches.default`.
- **cold**: the first page request after `wrangler dev` started, so the first
  page a new isolate renders.

Every row is in [2026-11-02-page-render-cpu.json](2026-11-02-page-render-cpu.json).

## CPU per request

| Request | Page bytes | Busy CPU (ms) |
|---|---:|---:|
| Word page, cold: `casa` miss, `vivere` miss, `casa` render | 98-277 KB | 157, 165, 108 |
| Word page, warm render, `casa` ×5 | 98 KB | 38-47 (mean 41) |
| Word page, warm miss: `rosa`, `essere`, `sale`, `parlare`, `dovere`, `avere`, `fatto` | 238-293 KB | 94, 72, 76, 68, 69, 60, 59 (mean 71) |
| Home page `/`, cold render | 21 KB | 83 |
| Home page `/`, warm miss and renders ×6 | 21 KB | 17-21 (mean 18.5) |
| Shared-cache hit, `casa` and `/` | | 11.6, 9.6 |
| `sweepReports` cron, ×3 (`/cdn-cgi/local/scheduled`) | | 14.7, 6.1, 4.2 |
| Isolate startup (`wrangler check startup`, ×2) | 3,267 KiB bundle | 37.6, 36.2 active |

Warm word pages grow by about 0.18 ms per KB of page: `casa` at 98 KB takes 41 ms,
`sale` at 293 KB takes 76 ms. `rosa` (94 ms) was the first warm miss after the
cold `casa`, so it probably still carries some first-use cost.

Startup was 68.6 ms after #911
([2026-10-21-worker-startup-cpu.md](2026-10-21-worker-startup-cpu.md)). It is now
37 ms with a smaller bundle.

## Where a word-page render goes

Self time by group, in ms. Each value is the mean over the profiles in its
column. A group is set by the source file each sample maps to.

| Group | Warm miss, 7 words | Warm render, `casa` ×5 | Cold, 3 words |
|---|---:|---:|---:|
| Runtime built-ins: `fetch`, `Response.text`, `TextEncoder.encode`, streams, `getRandomValues` | 12.9 | 9.0 | 10.0 |
| Lookup layer, `src/lookup/**` and `src/italian/**` | 8.8 | 2.5 | 14.9 |
| RSC render, `react-server-dom-webpack` server | 8.0 | 2.9 | 11.6 |
| HTML render, `react-dom/server.edge` and RSC payload decode for it | 7.2 | 3.9 | 14.6 |
| D1 client row decoding, `cloudflare-internal:d1-api` (`toJson`, `toArrayOfObjects`) | 7.1 | 4.7 | 7.9 |
| `(program)`: V8 work outside JS, mostly compiling | 5.8 | 3.8 | 20.1 |
| vinext request and stream glue | 5.4 | 3.7 | 19.0 |
| Page data, `web/lib/dictionary/**` | 5.1 | 2.7 | 6.4 |
| Lexema's wrappers, `web/worker/**` | 4.6 | 3.5 | 11.7 |
| Garbage collector | 2.2 | 2.7 | 5.2 |
| Page components, `web/components/**` and `web/app/**` | 2.0 | 0.7 | 4.0 |
| `@base-ui/react` | 1.4 | 0.6 | 11.5 |
| Module evaluation of lazily loaded chunks | 0 | 0 | 3.2 |
| **Busy total** | **71.0** | **40.9** | **143.2** |

The largest named parts:

- **D1 row decoding.** `toJson` in `cloudflare-internal:d1-api` takes 2.6-2.7 ms
  warm and 5.2 ms cold. In production, the wait for D1 is not CPU, but this
  decoding of the rows D1 returns is. `search` and `servedVersion` in
  `web/lib/dictionary/db.ts` take under 0.2 ms of their own time. Their cost is
  the lookup layer and the decoding below them. The local seed has fifty words,
  so production rows may decode at a different cost.
- **Lookup layer.** No single function stands out. The largest are
  `src/italian/normalize.ts` (about 0.8 ms), `src/italian/moods.ts`,
  `src/lookup/types.ts`, `src/lookup/lookup.ts`, `src/lookup/database.ts` and
  `src/lookup/nearby.ts`, each 0.4-1.1 ms warm. Cold, `src/lookup/database.ts`
  and `src/lookup/lookup.ts` take 2.3-2.4 ms each.
- **Page data.** `web/lib/dictionary/conjugation.ts` takes 1.9 ms on verb pages,
  then `relatedList.ts`, `wordPage.ts` and `readingLabels.ts`.
- **RSC render and HTML render.** These are React's own production builds, which
  carry no inner source maps. The work grows with page size (see below).
- **Nonce and security headers.** The `withSecurityHeaders` handler in
  `web/worker/shared/securityHeaders.ts` (line 85) takes 1.2-3.7 ms of its own
  time. It builds the nonce, copies the request headers, and copies the response
  with new headers. `getRandomValues` takes 0.7 ms. On a miss, `keep` in
  `web/worker/dictionary/pageCache.ts` reads the whole body a second time
  (`Response.text` takes 1.9 ms on a miss, and that read is probably part of it).

### Why big pages cost more

`/?q=sale` is 293,341 bytes:

- 154,194 bytes are inline scripts, almost all of it the RSC payload.
- In the markup (139,147 bytes), `class` attributes are 92,159 bytes and text is
  4,893 bytes.
- In the payload, `className` values are 64,418 bytes.

So class strings are about 156 KB, 53% of the page. The RSC render serializes
each string once, the HTML render writes it again, and the payload is encoded
into the HTML a third time.

## Where a home-page render goes

A warm home render is 18.5 ms. React's part is small: RSC 1.4 ms, HTML 1.8 ms,
components 0.9 ms. The rest is plumbing:

- runtime built-ins: 6.0 ms;
- Lexema's wrappers: 5.0 ms (`web/worker/shared/hosts.ts`, `securityHeaders.ts`,
  `pageCache.ts`, `pageDesk.ts`);
- vinext: 1.4 ms.

A shared-cache hit (9.6-11.6 ms) is almost all the same wrapper chain, the
version read through `src/lookup/served.ts`, and the nonce swap over the kept
body.

A cold home render is 83 ms: compiling (`(program)`, 18 ms), vinext's first run
(16.5 ms), `@base-ui` (8.9 ms) and module evaluation of lazy chunks (6.4 ms).

## The first page on a new isolate

A cold word render costs 108-165 ms against 41-71 ms warm, so 60-120 ms more.
Most of the extra is first use:

- compiling, in `(program)`: 20 ms against 4-6 ms warm;
- vinext's request code on its first run: 19 ms against 4-5 ms;
- loading lazy route chunks. Some of this shows as self time in the wrapper that
  first calls into them (`withSharedPageCache` and `withRateLimits` take 5-11 ms
  cold);
- `getFilter` in `@base-ui/react/internals/filter.mjs`: 7.0-8.2 ms. It builds an
  `Intl.Collator` even though `SearchField` passes `filter={null}`.

## How much of the production ~100 ms is the render

For 2026-11-01 12:00 to 2026-11-02 12:00 UTC, the issue gives 950 invocations and
about 109k CPU ms.

- **Cron.** `*/5 * * * *` is 288 invocations a day. At the local 4-15 ms (mean
  8 ms), that is about 2.4k ms, about 2% of the day's CPU. Cron runs pull the
  per-invocation average down, not up.
- **Page requests.** The other ~660 invocations average about 160 ms each. That
  is above any warm render measured here (18-94 ms), but close to a cold word
  render (108-165 ms). So the likely reading is that most production requests are
  renders on a new isolate. At under one request a minute, spread over data
  centers, isolates are seldom reused. That is an inference: nothing here
  measures how often production reuses an isolate.
- **Startup.** It is 37 ms locally. The Cloudflare limits and pricing pages
  ([limits](https://developers.cloudflare.com/workers/platform/limits/#worker-startup-time),
  [pricing](https://developers.cloudflare.com/workers/platform/pricing/)) define
  CPU per invocation and a 1 s startup limit. They do not say whether startup is
  billed in the first invocation's CPU. If it is, it adds about 37 ms to each
  cold request, about a quarter of the cold total.
- **October.** About 85 ms per request over 1.8M requests. With that much bot
  traffic, isolates were likely warm, and 85 ms fits a warm render of a large
  word page on Cloudflare's CPUs. This is also an inference.

Estimate per page invocation: about 40-90 ms is the render itself (warm cost,
growing with page size), and 60-120 ms is first-use work on a new isolate. Startup
may add 37 ms on top. Cron is about 2% of the total.

## Proposed fixes

Each fix is filed as its own issue.

| Fix | Expected saving | Evidence | Issue |
|---|---|---|---|
| Replace the most repeated utility class lists on word pages with short named classes | About 20 ms of a ~76 ms render on a ~290 KB page, about 25%. Smaller pages save less. | Class strings are 53% of `sale`'s bytes. Render CPU grows about 0.18 ms per KB (table above). The estimate assumes a linear cost and was not measured. | [#922](https://github.com/povlabs/lexema/issues/922) |
| Answer kept pages with Workers Cache, which runs before the Worker and is tiered | About 10 ms per hit, down to 0. The upper tier may also turn many current misses into hits, saving 40-165 ms each. Hit-rate change not measured. | A hit costs 9.6-11.6 ms locally. Cloudflare's [Workers Cache](https://developers.cloudflare.com/workers/cache/) page says a hit runs no Worker code and that the cache is tiered. Needs a ruling on the per-request nonce and the search limit. | [#923](https://github.com/povlabs/lexema/issues/923) |
| Stop base-ui building an `Intl.Collator` when `filter` is `null` | 7-8 ms per new isolate. Nothing when warm. | `getFilter` self time 8.2 and 7.0 ms in two cold profiles, under 0.1 ms warm. `AriaCombobox.mjs` line 107 calls it on every render. | [#924](https://github.com/povlabs/lexema/issues/924) |

Not proposed:

- **The cron.** It is about 2% of CPU. Its first run spends about 5 ms building
  the drizzle schema (`src/db/app/database.ts`, `drizzle-orm` `relations.js`).
  Making it cheaper would save under 1% of the bill.
- **The wrapper chain.** Each wrapper copies `Headers` and `Response`, and
  together they take 3.5-5 ms per request. That time sits in async frames whose
  self time also holds runtime work. A saving cannot be estimated from these
  profiles.
- **The cache key's served version.** It is out of scope for #921 (see the
  issue).
