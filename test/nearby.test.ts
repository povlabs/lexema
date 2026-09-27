// What a search that found nothing offers (src/lookup/nearby.ts): the pure
// parts here; the four steps over a seeded database are in web/test/page.test.tsx.

import assert from "node:assert/strict";
import test from "node:test";
import { deletionKeys, foldKey, rankCandidates, withinOneEdit, type Candidate } from "../src/lookup/nearby.js";

test("folding takes accents off and leaves everything else", () => {
  assert.equal(foldKey("città"), "citta");
  assert.equal(foldKey("perché"), "perche");
  assert.equal(foldKey("andò"), "ando");
  assert.equal(foldKey("casa"), "casa");
  assert.equal(foldKey("l'acqua"), "l'acqua");
});

test("a key's deletion keys are itself and each spelling with one character left out, once each", () => {
  assert.deepEqual(deletionKeys("casa"), ["casa", "asa", "csa", "caa", "cas"]);
  assert.deepEqual(deletionKeys("aa"), ["aa", "a"], "a doubled letter gives one deletion");
  assert.deepEqual(deletionKeys("città"), ["città", "ittà", "cttà", "cità", "citt"]);
});

test("one edit is one insertion, deletion, replacement or swap of neighbours, and no more", () => {
  assert.ok(withinOneEdit("mangare", "mangiare"), "an insertion");
  assert.ok(withinOneEdit("mangiare", "mangare"), "a deletion");
  assert.ok(withinOneEdit("mancare", "mangare"), "a replacement");
  assert.ok(withinOneEdit("mnagiare", "mangiare"), "a swap of neighbours");
  assert.ok(withinOneEdit("casa", "casa"));
  assert.ok(!withinOneEdit("mangiare", "mangiate "), "two edits");
  assert.ok(!withinOneEdit("casa", "cosi"));
  assert.ok(!withinOneEdit("abc", "cba"), "a swap of non-neighbours is two edits");
  assert.ok(!withinOneEdit("casa", "casale"));
});

test("candidates rank by fewest edits, then headword before form, then shorter, then alphabetical", () => {
  const c = (surface: string, edits: number, headword: boolean): Candidate => ({ key: surface, surface, edits, headword });
  const ranked = rankCandidates([
    c("mangiate", 1, false),
    c("mandare", 1, true),
    c("mangiare", 1, true),
    c("mancare", 1, true),
    c("città", 0, false),
    c("mangiarsi", 1, true),
  ]).map((candidate) => candidate.surface);
  assert.deepEqual(ranked, ["città", "mancare", "mandare", "mangiare", "mangiarsi", "mangiate"]);
});
