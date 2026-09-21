import assert from "node:assert/strict";
import test from "node:test";
import { containsExactItalianSurface, normalizeItalianExact } from "../src/italian/normalize.js";

test("normalizes whitespace, NFC, and apostrophe variants without removing accents", () => {
  assert.equal(normalizeItalianExact("  L’ANNO  "), "l'anno");
  assert.equal(normalizeItalianExact("perché"), "perché");
  assert.notEqual(normalizeItalianExact("perché"), normalizeItalianExact("perche"));
  assert.equal(normalizeItalianExact("café"), "café");
});

test("folds exactly the four apostrophes the contract names, and nothing else", () => {
  // The whole set, one case each. Every one of these occurs as an apostrophe in
  // the archive's headwords, which is why it is in the set.
  const folded = ["\u0027", "\u2019", "\u2018", "\u02bc"];
  for (const mark of folded) {
    assert.equal(normalizeItalianExact(`l${mark}anno`), "l'anno");
  }

  // Outside the set: U+00B4 is the acute accent, not an apostrophe. It survives
  // normalization, so a query spelled with it is a different key.
  assert.equal(normalizeItalianExact("l\u00b4anno"), "l\u00b4anno");
  assert.notEqual(normalizeItalianExact("l\u00b4anno"), "l'anno");
});

test("matches exact Italian surfaces at word boundaries", () => {
  assert.equal(containsExactItalianSurface("Le case sono aperte.", "case"), true);
  assert.equal(containsExactItalianSurface("Una casetta è piccola.", "case"), false);
  assert.equal(containsExactItalianSurface("L’anno è lungo.", "l'anno"), true);
});
