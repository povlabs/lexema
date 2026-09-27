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

test("candidates rank by fewest edits, translation languages, senses and forms, headword first, length, then alphabet", () => {
  const c = (surface: string, edits: number, languages: number, richness: number, headword = true): Candidate => ({
    key: surface,
    surface,
    edits,
    languages,
    richness,
    headword,
  });
  const ranked = rankCandidates([
    c("mangiate", 1, 0, 0, false),
    c("magnare", 1, 0, 1),
    c("mandare", 1, 6, 40),
    c("mangiare", 1, 51, 99),
    c("mancare", 1, 5, 60),
    c("città", 0, 0, 1),
    c("vangare", 1, 0, 3),
    c("zappare", 1, 0, 3),
  ]).map((candidate) => candidate.surface);
  // città is fewer edits. Then most languages: mangiare, mandare (6), mancare
  // (5, though richer). With no translations, richness: vangare and zappare
  // (3, then alphabetical), magnare (1); the form mangiate last.
  assert.deepEqual(ranked, ["città", "mangiare", "mandare", "mancare", "vangare", "zappare", "magnare", "mangiate"]);
});
