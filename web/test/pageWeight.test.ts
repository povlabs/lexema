// How much a word page weighs, rendered through the real React Server
// Components path (#647, rscPage.ts): the HTML the Worker sends for `sale`,
// `bello` and `andare` from the development fixture, and the inline payload
// inside it that wakes the page's client components.
//
// About half of a word page's HTML is that payload. Each ceiling is the
// weight measured after #647 trimmed what crosses into client components
// (reports/2026-10-06-word-page-payload.md), rounded up to the next 500 bytes,
// so a page that grows past it fails here rather than quietly. The render is
// deterministic, so the room is small. A change that grows a page on purpose
// raises the ceiling, and says why, in the same commit.

import assert from "node:assert/strict";
import test from "node:test";
import { clientElements, renderWordPages, weightOf, type PageWeight } from "./rscPage.ts";

const CEILING: Readonly<Record<string, PageWeight>> = {
  // Measured 290,542 and 148,896: 286,395 and 146,758 before #686 put
  // salire's meanings under its Voce verbale line, once in the HTML and once
  // in the payload; 283,570 and 144,983 before #676 let paired tense tables
  // share their rows on a wide screen (the grid rules on each set of tenses).
  sale: { html: 291_000, payload: 149_000 },
  // Measured 119,015 and 39,218.
  bello: { html: 119_500, payload: 39_500 },
  // Measured 268,893 and 125,330: 265,363 and 123,547 before #676 showed
  // andare's 42 compound cells with both genders (`sono andato/a`) and let
  // paired tense tables share their rows on a wide screen.
  andare: { html: 269_000, payload: 125_500 },
};

const pages = renderWordPages(Object.keys(CEILING));

for (const [word, ceiling] of Object.entries(CEILING)) {
  test(`${word}'s page stays under its weight: HTML and inline payload (#647)`, async () => {
    const page = (await pages)[word];
    // It is the word's page, through the flight stream: its heading, and the
    // client components the stream asks the browser to load.
    assert.match(page.markup, new RegExp(`<h1 [^>]*lang="it">${word}</h1>`));
    assert.ok(clientElements(page.flight).some(({ component }) => component === "ReportDialog"));
    const weight = weightOf(page);
    assert.ok(weight.html <= ceiling.html, `${word}: ${weight.html} bytes of HTML, over the ceiling of ${ceiling.html}`);
    assert.ok(weight.payload <= ceiling.payload, `${word}: ${weight.payload} bytes of inline payload, over the ceiling of ${ceiling.payload}`);
  });
}

test("no client component on a word page is handed a class string; it is handed a key (#647)", async () => {
  for (const [word, page] of Object.entries(await pages)) {
    for (const { component, props } of clientElements(page.flight)) {
      assert.ok(!("className" in props), `${word}: ${component} is handed a className`);
    }
  }
});
