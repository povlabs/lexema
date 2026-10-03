// Each saved regression page is named after its title, percent-encoded
// (`a%20monte.wikitext`), so every path in the tree stays ASCII. Git quotes a
// non-ASCII path, and a tool that reads `git diff --name-only` without `-z`
// then reads a name that does not exist (#537).

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { readSavedPage } from "../src/source/rawPage.js";

const SAVED = resolve("fixtures/upstream-pages");

/** The file name a saved page with this title must have. */
const fileNameOf = (title: string): string => `${encodeURIComponent(title)}.wikitext`;

test("each saved upstream page is named after its percent-encoded title", () => {
  for (const name of readdirSync(SAVED).filter((file) => file.endsWith(".wikitext"))) {
    const page = readSavedPage(readFileSync(join(SAVED, name), "utf8"), name);
    assert.equal(name, fileNameOf(page.title), `${name} holds ${JSON.stringify(page.title)}`);
  }
});
