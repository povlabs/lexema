---
id: 0010
title: Base UI and Tailwind style the page, over a role-token layer Lexema owns
status: accepted
date: 2026-09-21
tags: [stack, ui]
---

# 0010 — Base UI and Tailwind style the page, over a role-token layer Lexema owns

**What this decides:** The web app's components come from Base UI, unstyled, and are styled with Tailwind against role tokens defined in this repository. No full-kit design language is adopted.

## Context

The first result cards ([#34](https://github.com/povlabs/lexema/pull/34), [#56](https://github.com/povlabs/lexema/pull/56), [#58](https://github.com/povlabs/lexema/pull/58)) were written in hand-rolled CSS with no token layer, because `design-system-manifest.md` left colour roles, the type ramp and component primitives unruled. Each card invented its own layout, and the result read as lists rather than the boxed, side-by-side shape Huey wants ([#63](https://github.com/povlabs/lexema/pull/63), "The result card"). With the verb card ([#48](https://github.com/povlabs/lexema/issues/48)) and the card repair ([#60](https://github.com/povlabs/lexema/issues/60)) next, the page needs a styling system before more markup lands.

Huey asked whether a UI package works with vinext, and chose Base UI and Tailwind on 2026-09-21. Under [0003](0003-tool-replacement-is-its-own-decision.md) that is its own decision, recorded here. vinext ([0004](0004-cloudflare-workers-d1-vinext.md)) renders React server components on Vite, so Tailwind is native and any React component library works, with client-state components marked `"use client"`.

## Decision

**The page is built from Base UI components styled with Tailwind, over role tokens Lexema defines.**

- **Base UI** (`@base-ui/react`, the headless successor to Radix) supplies behaviour and accessibility for interactive parts: tabs, collapsibles, dialogs, menus, tooltips. It ships no styles, so Reverso's shape is drawn here, not inherited.
- **Tailwind** (v4, through `@tailwindcss/vite`) is the styling language. Utility classes in markup; no new hand-rolled stylesheet beyond the token definitions.
- **Role tokens are Lexema's.** Colour roles, the type ramp, spacing and density are declared once as Tailwind theme values in this repository, named by role (surface, text, accent, warning), and every component reaches for a role, never a raw scale. The manifest's "Not yet ruled" list is where those values land, ruled by Huey.
- **Server-first stays.** A component is a server component unless it needs client state; then it carries `"use client"` and stays small. The search page itself renders on the server, as [WEB.md](../docs/WEB.md) explains.
- **A spike proves the pair on vinext before any card is rebuilt on it.** vinext is beta; the spike renders one Base UI component and one Tailwind class through `vinext build` and `wrangler dev`, and its result is recorded before [#60](https://github.com/povlabs/lexema/issues/60) or [#48](https://github.com/povlabs/lexema/issues/48) depend on it.

**Binding constraints.**

- Versions are pinned exactly, as [0004](0004-cloudflare-workers-d1-vinext.md) requires of the Vite stack.
- No full-kit library (Mantine, Chakra, MUI) is added; a second styling system beside Tailwind is a tool replacement under [0003](0003-tool-replacement-is-its-own-decision.md).
- A component never uses a raw colour or size where a role token exists; a missing role is a manifest question for Huey, not a literal in the markup.
- The rendered-page tests keep passing through the migration; a test that asserts markup structure is updated with the markup, not deleted.

## Consequences

The cards get one consistent layout language and interactive parts that are accessible by default, at the cost of a dependency on a beta framework's compatibility with two more libraries, which the spike bounds. Existing CSS in `web/app/globals.css` is retired as components migrate; the migration rides with [#60](https://github.com/povlabs/lexema/issues/60) rather than as its own change. The `taste-color` skill gains a role-token layer to read once the manifest's token values are ruled.

## Records

No vocabulary impact.
