// What the developer site draws with sign-up open and closed (#610): the
// header's bar and ☰ menu, the landing page, pricing, the docs' Authentication
// topic and the sign-in page.
//
// The ☰ menu is Base UI's dialog, closed on a server render, so a real page
// never draws its links or foot here. This file swaps `DeveloperMenu` for a
// stand-in that draws both, as web/test/developerHeader.test.tsx does, then
// renders the real pages. `mock.module` needs `--experimental-test-module-mocks`,
// which the `test` script passes to every web test.

import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DeveloperMenuLink } from "@/components/developers/DeveloperMenu";

/** Draws what the header hands the menu: its links, then its foot. */
function OpenMenu({ links, children }: { links: readonly DeveloperMenuLink[]; children: ReactNode }) {
  return (
    <div data-menu="">
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
      <div data-menu-foot="">{children}</div>
    </div>
  );
}

mock.module(new URL("../components/developers/DeveloperMenu.tsx", import.meta.url).href, {
  exports: { DeveloperMenu: OpenMenu },
});

const { DeveloperLanding } = await import("@/components/developers/DeveloperLanding");
const { DeveloperPricing } = await import("@/components/developers/DeveloperPricing");
const { DeveloperDocs } = await import("@/components/developers/DeveloperDocs");
const { SignIn } = await import("@/components/developers/SignIn");
const { CONTACT_EMAIL } = await import("@/components/shared/contact.ts");
const { CHECKOUT_ACTION } = await import("@/lib/developers/billingActions.ts");
const { PLAN_TERMS } = await import("@lexema/billing/plans.ts");
const { TEST_SIGN_IN } = await import("@/worker/developers/testSignIn.ts");
const { ORIGIN, originsOf } = await import("@/worker/shared/hosts.ts");
const {
  SIGN_IN_CARD,
  SIGN_IN_HEADING,
  SIGN_IN_LEAD,
  SIGN_IN_SHELL,
} = await import("@/components/shared/styles.ts");

/** The bar: everything before the page's own content. */
const barOf = (html: string): string => html.slice(0, html.indexOf("</header>"));
/** The ☰ menu the stand-in draws. */
const menuOf = (html: string): string => {
  const at = html.indexOf('<div data-menu="">');
  assert.notEqual(at, -1, "the page draws the ☰ menu");
  return html.slice(at, html.indexOf("</header>"));
};
/** The page between the bar and the footer. */
const mainOf = (html: string): string => html.slice(html.indexOf("<main"), html.indexOf("</main>"));

const SIGN_IN_LINK = /href="\/sign-in"/;
const CHECKOUT = new RegExp(`action="${CHECKOUT_ACTION}"`);

const pages = (signUp: "open" | "closed") => ({
  landing: renderToStaticMarkup(<DeveloperLanding signUp={signUp} origins={ORIGIN} />),
  pricing: renderToStaticMarkup(<DeveloperPricing signUp={signUp} origins={ORIGIN} />),
  authentication: renderToStaticMarkup(<DeveloperDocs page={{ kind: "guide", guide: "authentication" }} signUp={signUp} origins={ORIGIN} />),
});

test("open, the bar and ☰ menu offer Sign in and Get an API key, the landing page Get an API key, pricing Choose, and the docs a Sign in link", () => {
  const { landing, pricing, authentication } = pages("open");
  for (const html of [landing, pricing, authentication]) {
    assert.match(barOf(html), /<a[^>]*href="\/sign-in"[^>]*>Sign in<\/a>/, "the bar's Sign in");
    assert.match(menuOf(html), /data-menu-foot=""><div[^>]*><a[^>]*href="\/sign-in"[^>]*>Sign in<\/a><a[^>]*href="\/sign-in"[^>]*>Get an API key<\/a>/);
  }
  assert.match(mainOf(landing), /<a[^>]*href="\/sign-in"[^>]*>Get an API key<\/a>/);
  assert.equal([...pricing.matchAll(new RegExp(CHECKOUT, "g"))].length, 2, "Choose Starter and Choose Pro");
  assert.match(pricing, /Choose Starter/);
  assert.match(pricing, /Choose Pro/);
  assert.match(mainOf(authentication), /<a[^>]*href="\/sign-in"[^>]*>Sign in<\/a> with Google or GitHub/);
});

test("closed, no page links to sign-in, Get an API key or Checkout; Docs, Pricing, the prices, Read the docs and Contact us stay", () => {
  const { landing, pricing, authentication } = pages("closed");
  for (const html of [landing, pricing, authentication]) {
    assert.doesNotMatch(html, SIGN_IN_LINK);
    assert.doesNotMatch(html, CHECKOUT);
    assert.doesNotMatch(html, />Sign in</);
    assert.doesNotMatch(html, /Get an API key/);
    assert.match(barOf(html), /<a[^>]*href="\/docs"[^>]*>Docs<\/a>/);
    assert.match(barOf(html), /<a[^>]*href="\/pricing"[^>]*>Pricing<\/a>/);
    assert.match(menuOf(html), /<a href="\/docs">Docs<\/a>.*<a href="\/pricing">Pricing<\/a>/);
    assert.match(menuOf(html), /<div data-menu-foot=""><\/div>/, "the ☰ menu has no foot");
  }
  assert.match(mainOf(landing), /<a[^>]*href="\/docs"[^>]*>Read the docs<\/a>/);
  assert.doesNotMatch(pricing, /Choose/);
  for (const plan of ["starter", "pro"] as const) {
    assert.match(pricing, new RegExp(`\\$${PLAN_TERMS[plan].usdPerMonth}<span[^>]*>/ month</span>`), `${plan}'s price`);
  }
  assert.ok(pricing.includes(`href="mailto:${CONTACT_EMAIL}">Contact us</a>`));
  assert.match(mainOf(authentication), /A key is created on your account&#x27;s dashboard\. It is shown once/);
});

test("open, the sign-in page offers Google and GitHub; closed, it says sign-up opens soon in the same card, with no provider", () => {
  const available = { google: true, github: true };
  const open = renderToStaticMarkup(<SignIn available={available} signUp="open" origins={ORIGIN} />);
  assert.match(open, /<h1[^>]*>Sign in<\/h1>/);
  assert.match(open, /href="\/sign-in\/google"/);
  assert.match(open, /href="\/sign-in\/github"/);

  const closed = renderToStaticMarkup(<SignIn available={available} signUp="closed" origins={ORIGIN} />);
  assert.ok(
    closed.includes(
      `<main class="${SIGN_IN_SHELL}"><div class="${SIGN_IN_CARD}"><h1 class="${SIGN_IN_HEADING}">Sign-up opens soon</h1><p class="${SIGN_IN_LEAD}">API keys are not available yet. The docs and pricing are open to read.</p></div></main>`,
    ),
  );
  assert.doesNotMatch(closed, /Google|GitHub|Continue with|\/sign-in\//);
  assert.doesNotMatch(barOf(closed), SIGN_IN_LINK);
});

test("closed, a Preview's sign-in page still offers the test sign-in under the closed message", () => {
  const preview = originsOf("huey-610-sign-up.developers-preview.lexema.fyi");
  const html = renderToStaticMarkup(<SignIn available={{ google: false, github: false }} testSignIn signUp="closed" origins={preview} />);
  assert.match(html, /Sign-up opens soon<\/h1>/);
  assert.match(html, new RegExp(`<form action="${TEST_SIGN_IN}" method="post"><button[^>]*>Sign in as test developer</button></form>`));
  assert.doesNotMatch(html, /Continue with/);
});
