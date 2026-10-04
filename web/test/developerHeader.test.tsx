// The ☰ menu marks the page being read (#197). The menu is Base UI's dialog,
// closed on a server render, so a real page never draws its links here. This
// file swaps `DeveloperMenu` for a stand-in that draws the `links` it is handed,
// then renders real pages: what it checks is what `DeveloperHeader` passes in.
// The menu's own markup is web/test/signedIn.test.tsx.
//
// `mock.module` needs `--experimental-test-module-mocks`, which the `test`
// script passes to every web test, and this file imports the page only after
// the swap.

import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DeveloperMenuLink } from "@/components/developers/DeveloperMenu";

/** Draws what the header hands the menu: each link, with whether it is the current page. */
function MenuLinks({ links }: { links: readonly DeveloperMenuLink[] }) {
  return (
    <ul data-menu-links="">
      {links.map((link) => (
        <li key={link.href} data-current={String(link.current)}>
          {link.label}
        </li>
      ))}
    </ul>
  );
}

mock.module(new URL("../components/developers/DeveloperMenu.tsx", import.meta.url).href, {
  exports: { DeveloperMenu: MenuLinks },
});

const { DashboardSettings } = await import("@/components/developers/dashboard/DashboardSettings");
const { DeveloperDocs } = await import("@/components/developers/DeveloperDocs");
const { settingsView } = await import("@/lib/developers/dashboardView.ts");
const { NO_PLAN } = await import("@lexema/billing/plans.ts");
const { ORIGIN } = await import("@/worker/shared/hosts.ts");

/** The ☰ menu's links on a rendered page, each as [label, current]. */
const menuOf = (html: string): [string, boolean][] => {
  const menus = [...html.matchAll(/<ul data-menu-links="">(.*?)<\/ul>/g)];
  assert.equal(menus.length, 1, "the page draws one ☰ menu");
  return [...menus[0][1].matchAll(/<li data-current="(true|false)">([^<]+)<\/li>/g)].map((link) => [link[2], link[1] === "true"]);
};

test("signed in on Settings, the ☰ menu marks Settings, not Dashboard, though the bar marks Dashboard (board 28g)", () => {
  const view = settingsView({ email: "ada@example.com", name: "Ada Lovelace", providers: ["google"] }, [], { state: NO_PLAN, serving: { serving: false }, held: false });
  const html = renderToStaticMarkup(<DashboardSettings view={view} csrf={"c".repeat(43)} origins={ORIGIN} />);
  assert.deepEqual(menuOf(html), [
    ["Dashboard", false],
    ["Settings", true],
    ["Docs", false],
    ["Pricing", false],
  ]);
  assert.match(html, /<a[^>]*href="\/dashboard" aria-current="page"[^>]*>Dashboard<\/a>/, "the bar marks the dashboard");
});

test("signed out on the docs, the ☰ menu marks Docs", () => {
  const html = renderToStaticMarkup(<DeveloperDocs page={{ kind: "guide", guide: "grammar-values" }} origins={ORIGIN} />);
  assert.deepEqual(menuOf(html), [
    ["Docs", true],
    ["Pricing", false],
  ]);
});
