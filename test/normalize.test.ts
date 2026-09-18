import assert from "node:assert/strict";
import test from "node:test";
import { containsExactItalianSurface, normalizeItalianExact } from "../src/italian/normalize.js";

test("normalizes whitespace, NFC, and apostrophe variants without removing accents", () => {
  assert.equal(normalizeItalianExact("  L’ANNO  "), "l'anno");
  assert.equal(normalizeItalianExact("perché"), "perché");
  assert.notEqual(normalizeItalianExact("perché"), normalizeItalianExact("perche"));
  assert.equal(normalizeItalianExact("café"), "café");
});

test("matches exact Italian surfaces at word boundaries", () => {
  assert.equal(containsExactItalianSurface("Le case sono aperte.", "case"), true);
  assert.equal(containsExactItalianSurface("Una casetta è piccola.", "case"), false);
  assert.equal(containsExactItalianSurface("L’anno è lungo.", "l'anno"), true);
});
