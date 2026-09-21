# Base UI and Tailwind on vinext: spike result

Run on 2026-09-21 in a throwaway workspace outside the repository, to answer one
question before ADR 0010's stack is built on: does Base UI plus Tailwind v4 render
through vinext 1.0.0-beta.10 on Cloudflare Workers, in `vinext build` and under
`wrangler dev`, for one server page with one Tailwind class and one Base UI client
component?

## Answer

Yes. No errors, no fixes needed, 55 seconds from first file to server stopped.

## Versions

Exact pins, confirmed by `pnpm ls`:

| Package | Version |
|---|---|
| vinext | 1.0.0-beta.10 |
| @vinext/cloudflare | 1.0.0-beta.8 |
| vite | 8.3.0 |
| react, react-dom, react-server-dom-webpack | 19.3.0 |
| @vitejs/plugin-rsc | 0.5.35 |
| @cloudflare/vite-plugin | 1.56.0 |
| wrangler | 4.135.0 |
| @base-ui/react | 1.8.0 |
| tailwindcss, @tailwindcss/vite | 4.3.3 |

## Setup that worked

Vite plugin order `tailwindcss()`, `vinext()`, `cloudflare(...)`. The layout imports
a `globals.css` holding only `@import "tailwindcss";`. The server page carries
`className="rounded border p-4"`. A `"use client"` file renders
`Collapsible.Root`, `Trigger` and `Panel` from `@base-ui/react/collapsible`.

## Evidence

`vinext build` passed all five stages, exit 0. Under `wrangler dev` on port 8792,
`GET /` returned 200 with the Tailwind class on `<main>` and the Collapsible
server-rendered closed:

```html
<main class="rounded border p-4"><h1>Spike</h1>
<div data-closed=""><button type="button" aria-expanded="false">Toggle</button></div></main>
```

The emitted stylesheet is served and holds real rules for `.rounded`, `.border`
and `.p-4`, so Tailwind scanned the RSC source. The client chunk containing the
Collapsible exists under `dist/client/`, is served, and is module-preloaded by
the page. Wrangler's log shows both requests `ok` with no warnings.

## Limits

Hydration was verified by bundle presence, preload wiring and absence of server
errors, not by a click in a browser. One component and one class; nothing about
Base UI's larger parts (dialog, menu) or Tailwind's `@theme` tokens was exercised.

## Consequence

ADR 0010's precondition is met: #60 and #48 may build on Base UI and Tailwind.
The workspace was left at `/tmp/lexema-spike-baseui` for inspection and is
disposable.
