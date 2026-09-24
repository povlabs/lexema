---
id: 0004
title: Lexema runs on Cloudflare Workers, with D1 for lookup and vinext for rendering
status: amended-in-part by [0013](0013-site-public-behind-rate-limits.md)
date: 2026-09-18
tags: [stack]
---

# 0004 — Lexema runs on Cloudflare Workers, with D1 for lookup and vinext for rendering

**What this decides:** The website is a Cloudflare Worker; lookups hit D1, the original dictionary file lives in R2, and the pages are React rendered by vinext.

## Context

Nothing in milestone 1 could start until this was settled — the importer, the
lookup layer, and the search page all depend on where the data lives and what
renders the pages.

Huey chose Cloudflare. For rendering he wanted React, and three options were
weighed:

- **React Router v8 + `@cloudflare/vite-plugin`** — stable on both sides, no
  adapter, but not Next.js.
- **Next.js via `@opennextjs/cloudflare`** — Next.js proper, with an adapter
  layer between it and Workers.
- **vinext** — Cloudflare's own reimplementation of the Next.js API on Vite,
  with Workers as its deepest-integrated target.

Huey picked vinext. It is Cloudflare-native, so there is no adapter in the
middle, and its published gaps — cache components, build-time image and font
optimization, native modules — do not touch a search box and a result page.

**vinext is beta.** At the time of this decision it was `1.0.0-beta.10` with 538
open issues, and its own README says it is not yet a drop-in replacement for
every application. That risk was raised and accepted.

## Decision

**Lexema is a Cloudflare Worker: D1 holds the lookup data, R2 holds the original source file, and vinext renders the React pages.**

The importer runs outside the request path. It reads the source file and writes
D1 offline; the Worker only reads. A dictionary rebuild therefore never means a
website rebuild.

Two things this also settles, so nobody has to ask again:

- **Access.** Local development only for now. Publishing anything externally is
  blocked on the licensing review in #6 regardless of readiness.
- **Language.** The interface is in English. Definitions are shown in the
  Italian the source wrote them in — we do not translate them, because a
  translation would be a lexical claim we cannot ground.

**Binding constraints.**

- The vinext and Vite versions are pinned exactly, not floated on a range. A
  beta that moves under us is the failure mode here.
- A hello-world deploy that reads from D1 is proven before any feature work is
  built on vinext.
- The full gzip source is never decompressed or imported inside a request. The
  importer is a separate offline program.
- Swapping any of these later goes through
  [0003](0003-tool-replacement-is-its-own-decision.md).

## Consequences

D1 has a 10 GB limit on the paid plan and 500 MB on free. The rough projection
for the Italian data is around 258 MB before indexes, so paid is comfortable and
free is tight. That makes the sizing check in #3 worth doing early rather than
late; it stops being conditional now that D1 is chosen.

Betting on a beta means some debugging budget goes to the framework instead of to
the dictionary data, which is where this project's real difficulty sits. Pinned
versions and an early deploy are how that cost is kept small and found sooner.

Choosing vinext over React Router also means the Next.js API is the target we are
writing against, so a later move to Next.js proper stays cheap while a move to
another React framework does not.

## Records

No vocabulary impact.
