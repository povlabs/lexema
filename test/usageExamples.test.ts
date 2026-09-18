import assert from "node:assert/strict";
import test from "node:test";
import { isQualifyingUsageExample } from "../src/italian/examples.js";

test("accepts a meaningful exact-form source sentence", () => {
  assert.equal(isQualifyingUsageExample("Le case sono aperte.", "case"), true);
  assert.equal(isQualifyingUsageExample("L’anno è lungo.", "l'anno"), true);
});

test("rejects substring, lemma-only, and conjugation-label fragments", () => {
  assert.equal(isQualifyingUsageExample("La casetta è piccola.", "case"), false);
  assert.equal(isQualifyingUsageExample("La casa è grande.", "case"), false);
  assert.equal(isQualifyingUsageExample("loro/essi andavano", "andavano"), false);
  assert.equal(isQualifyingUsageExample("essi andavano", "andavano"), false);
});
