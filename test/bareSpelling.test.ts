// A headword typed without its final accent or apostrophe (#468): the pure
// parts of `pnpm run measure:bare-spellings` (src/lookup/bareSpelling.ts).

import assert from "node:assert/strict";
import test from "node:test";
import { bareSpelling, bareSpellingOutcome } from "../src/lookup/bareSpelling.js";

test("a bare spelling takes off a final accented vowel's accent or a final apostrophe, and nothing else", () => {
  assert.equal(bareSpelling("città"), "citta");
  assert.equal(bareSpelling("perché"), "perche");
  assert.equal(bareSpelling("abbandonò"), "abbandono");
  assert.equal(bareSpelling("po'"), "po");
  assert.equal(bareSpelling("è"), "e");
  assert.equal(bareSpelling("'"), undefined, "a lone apostrophe has no spelling left to search");
  assert.equal(bareSpelling("casa"), undefined);
  assert.equal(bareSpelling("caffè latte"), undefined, "two words");
  assert.equal(bareSpelling("çà"), "ça", "only the final mark goes");
});

test("the outcome is found, the best offer, offered later, or not offered", () => {
  assert.equal(bareSpellingOutcome("è", { found: true }), "found");
  const accent = { kind: "accent", best: "città", others: ["cittadino"], phrases: [] } as const;
  assert.equal(bareSpellingOutcome("città", { found: false, nearby: accent }), "best");
  assert.equal(bareSpellingOutcome("cittadino", { found: false, nearby: accent }), "offered");
  assert.equal(bareSpellingOutcome("po’", { found: false, nearby: { kind: "accent", best: "po'", others: [], phrases: [] } }), "best", "apostrophes compare as one");
  // Words that begin with the query are a list, not a best guess.
  assert.equal(bareSpellingOutcome("be'", { found: false, nearby: { kind: "prefix", words: ["be'", "bea"] } }), "offered");
  assert.equal(bareSpellingOutcome("be'", { found: false, nearby: { kind: "none" } }), "missed");
});
