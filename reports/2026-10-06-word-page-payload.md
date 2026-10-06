# The inline payload of a word page, before and after #647, 2026-10-06

A word page's HTML carries a second copy of the page as React Server Components
(RSC) data, inline in `<script>` tags, so the browser can wake the client
components. The filer's production profile of 2026-10-06 found 159 KB of the
312 KB `sale` page was that payload
([#647](https://github.com/povlabs/lexema/issues/647)). #647 trims what crosses
into client components; this report measures `sale`, `bello` and `andare` before
and after it, the same way both times.

## Method

The page is rendered through the real RSC path by
[web/test/rscPage.ts](../web/test/rscPage.ts), which
[web/test/pageWeight.test.ts](../web/test/pageWeight.test.ts) also runs:

- The flight half ([rscFlight.tsx](../web/test/rscFlight.tsx)) runs under the
  `react-server` export condition and production React. Every `"use client"`
  module is replaced by client references
  ([rscRegister.mjs](../web/test/rscRegister.mjs)), as the build replaces it,
  and React's edge renderer, the one the Worker runs, writes the flight stream.
- The SSR half ([rscHtml.ts](../web/test/rscHtml.ts)) reads the stream back with
  React's flight client, renders it with React DOM's streaming renderer, and
  inlines the stream with vinext's own embed (`createRscEmbedTransform`), one
  `<script>` per chunk, each with a 24-character nonce.
- The data is the development fixture `fixtures/dev-seed.jsonl`, seeded with
  its raw pages the way `pnpm run seed:dev` seeds it.
- *HTML* is the page's markup plus the inline scripts. *Payload* is the inline
  scripts, tags included. Bytes are UTF-8.

"Before" is `origin/main` at `3a6fc40`, with the same harness files copied in.
"After" is this change. The harness is identical in both.

What this does not measure, so its numbers are lower than the profile's:

- The layout: `<html>`, `<head>`, styles and the footer. They are the same on
  every page.
- Production chunking. The Worker sent `sale`'s payload in about 110 scripts;
  this render sends it in 38. Each script adds 184 bytes of wrapper, quotes
  included.
- The full release. The fixture holds fewer facts per word than production.

## Results

| Word | HTML before | HTML after | Payload before | Payload after | Change |
|---|---:|---:|---:|---:|---:|
| `sale` | 284,836 | 283,570 | 146,249 | 144,983 | −1,266 (−0.9%) |
| `bello` | 121,867 | 119,015 | 42,070 | 39,218 | −2,852 (−6.8%) |
| `andare` | 282,594 | 265,363 | 140,770 | 123,547 | −17,223 (−12.2%) |

*Change* is the payload's. The HTML falls by the same bytes, because the markup
does not change: `sale`'s and `bello`'s markup is byte-identical before and
after. `andare`'s differs in one place, 8 bytes smaller: React drops one empty
text separator, `<!-- -->`, after *passaggio del tempo*, because the stream
splits into chunks in different places. Nothing a reader sees changes.

### The built app, as a check

The same three pages were also read from the built Worker, before and after,
each built with `pnpm --filter @lexema/web build` and served by `wrangler dev`
over one local D1 seeded by `pnpm run seed:dev`. One request each. This is the
whole document, layout included, chunked as the Worker chunks it.

| Word | HTML before | HTML after | Payload before | Payload after | Scripts before → after | Flight text before → after |
|---|---:|---:|---:|---:|---|---|
| `sale` | 312,878 | 312,432 | 164,587 | 164,141 | 107 → 110 | 129,936 → 129,009 |
| `bello` | 145,265 | 142,888 | 56,065 | 53,688 | 54 → 55 | 40,203 → 37,861 |
| `andare` | 309,790 | 293,364 | 158,592 | 142,166 | 104 → 104 | 125,632 → 110,690 |

Outside the payload scripts, each page is byte-identical before and after. The
flight text falls as it does in the test's render. `sale`'s payload falls less
than its flight text: the Worker split it into three more scripts, at 184 bytes
each. How the Worker splits the stream is not something this change controls.

Where the bytes went:

- *Expressions* was handed whole `Expression` values, each with the refs it was
  read from (release, line, pointer and a SHA-256 per source line). It now gets
  the label and, per row, only the phrase, the meanings and whether the phrase
  has an entry. That is most of `andare`'s and `bello`'s drop, since they list
  many expressions.
- `More`, `MoreBlock` and `MorePanel` were handed Tailwind class strings. They
  now take a key (`place="definitions"`, `kind="mood"`) or nothing.

## What is left: class strings on server-rendered markup

The payload is mostly server-rendered markup, which the browser needs to
hydrate. Its class strings are half of it:

| Word | Flight stream after | `className` bytes in it |
|---|---:|---:|
| `sale` | 124,324 | 61,083 (49%) |
| `bello` | 32,347 | 12,717 (39%) |
| `andare` | 105,998 | 51,776 (49%) |

On `sale`, three classes on the conjugation tables are 41 KB of that:
`FORM_LINK` (20.5 KB), `TENSE_CELL` (14.3 KB) and the person cell (6.3 KB). Each
is repeated on every cell. React keys built from fact refs add another 8.5 KB on
`sale`; they never reach the HTML.

Neither is in #647's scope. Shorter class names change the rendered HTML, which
#647 holds fixed. Rendering the tables from data inside a client component goes
against [ADR 0010](../.decisions/0010-base-ui-and-tailwind-style-the-page.md),
which keeps them as server components. The choice is filed as
[#660](https://github.com/povlabs/lexema/issues/660).
