import assert from "node:assert/strict";
import test from "node:test";
import { readPluralGloss } from "../src/italian/pluralGloss.js";

// Glosses as release it-0c432803 writes them on noun form-of senses (#145).

test("the five plural openings, followed by the lemma's word, read as its plural", () => {
  assert.deepEqual(readPluralGloss("plurale di casa", "casa"), { gender: undefined });
  assert.deepEqual(readPluralGloss("femminile plurale di ivoriano", "ivoriano"), { gender: "feminine" });
  assert.deepEqual(readPluralGloss("plurale femminile di maccartista", "maccartista"), { gender: "feminine" });
  assert.deepEqual(readPluralGloss("maschile plurale di pisano", "pisano"), { gender: "masculine" });
  assert.deepEqual(readPluralGloss("plurale maschile di analfabeta", "analfabeta"), { gender: "masculine" });
});

test("what follows the word may be punctuation or a note, never more letters", () => {
  assert.deepEqual(readPluralGloss("plurale di colpa.", "colpa"), { gender: undefined });
  assert.deepEqual(readPluralGloss("plurale di lettone (letto grande)", "lettone"), { gender: undefined });
  assert.deepEqual(readPluralGloss("plurale di pomo¹, in tutti i sensi", "pomo"), { gender: undefined });
  assert.equal(readPluralGloss("plurale di intramontabiletimeless, everlasting", "intramontabile"), undefined);
  assert.equal(readPluralGloss("plurale di casa", "cas"), undefined);
});

test("any other gloss, or a plural of a different word, is not one", () => {
  assert.equal(readPluralGloss("diminutivo di casa", "casa"), undefined);
  assert.equal(readPluralGloss("femminile di studente", "studente"), undefined);
  assert.equal(readPluralGloss("accrescitivo di casa", "casa"), undefined);
  assert.equal(readPluralGloss("tenda a forma di piccola casa", "casa"), undefined);
  // `ossi` names `ossa` in its form_of, but its gloss is a plural of `osso`.
  assert.equal(readPluralGloss("plurale di osso; quando si intende un insieme organico, si usa ossa", "ossa"), undefined);
  assert.equal(readPluralGloss("Plurale di casa", "casa"), undefined);
  assert.equal(readPluralGloss("plurale di casa", ""), undefined);
});
