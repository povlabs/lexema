// The `sm` width has one home, and code reads it from there (#196).
//
// web/lib/shared/breakpoint.ts reads `--breakpoint-sm` off `:root` at run time,
// and Tailwind puts a theme variable there only when it is used or declared
// `static`. Nothing uses it through `var()`, so a `static` dropped from its
// block would leave the ☰ menu with no width to close at.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { smQuery } from "../lib/shared/breakpoint.ts";

test("globals.css declares --breakpoint-sm in a `@theme static` block, so it reaches :root", async () => {
  const css = await readFile(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
  assert.match(css, /@theme static \{[^}]*^ {2}--breakpoint-sm: [^;]+;/m);
  assert.equal(css.match(/--breakpoint-sm:/g)?.length, 1, "the width is declared once");
});

test("smQuery writes the query Tailwind's `sm:` writes, and refuses a missing width", () => {
  assert.equal(smQuery(" 40rem"), "(width >= 40rem)");
  assert.throws(() => smQuery(""), /--breakpoint-sm/);
});
