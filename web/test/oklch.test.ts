// The oklch-to-hex conversion the tokens test leans on, checked against pairs
// that do not come from it.
//
// The sRGB primaries and the two ends of the grey axis are the reference values
// published with OKLab (https://bottosson.github.io/posts/oklab/) and in CSS
// Color 4's worked examples, so a sign error, a swapped matrix row or a missing
// transfer curve shows up here before it can make the stylesheet and the design
// file agree by accident.

import assert from "node:assert/strict";
import test from "node:test";

import { Oklch } from "./oklch.ts";

const KNOWN: [oklch: string, hex: string][] = [
  ["oklch(0% 0 0deg)", "#000000"],
  ["oklch(100% 0 0deg)", "#FFFFFF"],
  ["oklch(1 0 0)", "#FFFFFF"],
  ["oklch(62.796% 0.25768 29.2339deg)", "#FF0000"],
  ["oklch(86.644% 0.29483 142.4953deg)", "#00FF00"],
  ["oklch(45.201% 0.31321 264.052deg)", "#0000FF"],
  ["oklch(59.987% 0 0deg)", "#808080"],
];

test("known oklch values convert to their sRGB hex", () => {
  for (const [oklch, hex] of KNOWN) {
    assert.equal(Oklch.parse(oklch).toHex(), hex, oklch);
  }
});

test("a value that is not an oklch() colour is refused, not guessed", () => {
  for (const text of ["#121110", "oklch(17.84% 0.0026)", "rgb(0 0 0)", "oklch(170% 0 0deg)"]) {
    assert.throws(() => Oklch.parse(text), /not an oklch\(\) colour/, text);
  }
});

test("a colour outside sRGB is refused rather than clamped into a hex", () => {
  assert.throws(() => Oklch.parse("oklch(70% 0.4 145deg)").toHex(), /outside sRGB/);
});
