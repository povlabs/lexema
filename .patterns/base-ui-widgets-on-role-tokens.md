# Base UI widgets on role tokens

How an interactive part of the page is built: a Base UI component for the
behaviour, Tailwind classes over Lexema's role tokens for the look; applies to
every component under `web/components/` and `web/app/`.

## The shape

Every widget with behaviour (tabs, dialogs, menus, collapsibles, the search
combobox, toasts, checkboxes, radios) comes from `@base-ui/react`, imported per
component, and is styled with class strings
([ADR 0010](../.decisions/0010-base-ui-and-tailwind-style-the-page.md)). The mood
tabs are the smallest example
([`web/components/dictionary/MoodTabs.tsx`](../web/components/dictionary/MoodTabs.tsx)):

```tsx
"use client";
import { Tabs } from "@base-ui/react/tabs";
import { TAB, TAB_LIST, TAB_PANEL, TABS } from "@/components/shared/styles.ts";

<Tabs.Root className={TABS} defaultValue={open}>
  ...
  <Tabs.Panel key={mood} className={TAB_PANEL} value={mood} keepMounted data-mood={mood}>
```

The rules, each held by the source or a test:

1. **Behaviour is Base UI's.** Focus, keyboard and ARIA come from the component.
   No component under `web/` sets `role="tab"`, `role="dialog"` or `role="menu"`
   itself, or handles arrow keys for a widget Base UI already ships.
2. **Colour is a role, never a literal.** Classes name roles such as `bg-surface`
   or `text-text-muted`, declared once in [`web/app/globals.css`](../web/app/globals.css).
   [`web/test/tokens.test.ts`](../web/test/tokens.test.ts) fails on any hex,
   `rgb()`, `hsl()`, `oklch()` or inline `style={{` under `web/app/`,
   `web/components/` or `web/lib/`, and checks each role against the design file.
3. **Class strings are named once.** Shared parts live in
   [`web/components/shared/styles.ts`](../web/components/shared/styles.ts), and
   `web/test/page.test.tsx` imports the same constants, so a test asserts the class
   the component really carries.
4. **Client code stays small.** Only the widget file carries `"use client"`; the
   page around it renders on the server.
5. **The widget needs JavaScript; no fallback widget is hand-built.** What must
   work without JavaScript is plain HTML around the widget: the search is a GET
   form, links are links, and the mood panels are `keepMounted` so every form is
   in the server's HTML ([docs/WEB.md](../docs/WEB.md)). There is no second,
   no-JavaScript version of the tabs, the combobox or the dialogs.

## When this applies

Any new or changed interactive part of the dictionary page or the developer site.
A part with no behaviour (a heading, a table of forms, a link) is plain markup with
role-token classes and needs no Base UI component. Which colour role to use is the
[design manifest](../design-system-manifest.md)'s call; a missing role is a
question for Huey, not a literal in the markup (ADR 0010).

## Why it is not obvious

A small widget looks quicker to write by hand than to look up: a `div` with a click
handler for tabs, or a `<details>` for "more". The hand-made one then misses focus
handling, keyboard support and ARIA states, and each one is drawn a little
differently; the first result cards went that way before ADR 0010. A raw colour
copied from the design file looks harmless, but it stops following the role when
the role's value changes.
Building a no-JavaScript copy of each widget doubles the markup to serve a case the
plain form and links already cover.

> Derived from `@base-ui/react@1.8.0` — re-verify on pin bump.
