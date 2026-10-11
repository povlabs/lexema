// A missing common word's group (#807): the pure part of
// `pnpm run measure:missing-words` (src/lookup/missingWord.ts), over the
// Morph-it! analyses the brief's own words carry.

import assert from "node:assert/strict";
import test from "node:test";
import { bugClassOf, bugClassOfTag, groupOf, type MissingWordEvidence } from "../src/lookup/missingWord.js";

const evidence = (over: Partial<MissingWordEvidence>): MissingWordEvidence => ({
  word: "parola",
  archiveHeadword: false,
  archiveForm: false,
  declaredLemma: false,
  accentVariant: undefined,
  pronominal: undefined,
  foundLemmas: [],
  lexemes: [],
  ...over,
});

test("a Morph-it! tag names the kind of form a missing word is", () => {
  assert.equal(bugClassOfTag("VER:inf+pres+vi"), "clitic-form", "raccontarvi");
  assert.equal(bugClassOfTag("VER:inf+pres+si"), "clitic-form", "trasferirsi");
  assert.equal(bugClassOfTag("VER:inf+pres+telo"), "clitic-form", "dirtelo");
  assert.equal(bugClassOfTag("VER:impr+pres+2+s+tene"), "clitic-form", "vattene");
  assert.equal(bugClassOfTag("VER:ind+pres+3+p"), "verb-form");
  assert.equal(bugClassOfTag("DET-DEMO:m+p"), "demonstrative-form", "quei");
  assert.equal(bugClassOfTag("NOUN-M:p"), "noun-inflection", "amichetti");
  assert.equal(bugClassOfTag("ADJ:pos+f+p"), "adjective-inflection");
  assert.equal(bugClassOfTag("PRO-PERS-CLI-3-M-S"), "pronoun-form");
  assert.equal(bugClassOfTag("ARTPRE-M:s"), "determiner-form");
  assert.equal(bugClassOfTag("ADV"), "other-form");
});

test("an elided or cut-short form is named by its shape before its tag", () => {
  assert.equal(bugClassOf("quell'", { lemma: "quello", tag: "DET-DEMO:m+s" }), "elided-form");
  assert.equal(bugClassOf("aver", { lemma: "avere", tag: "VER:inf+pres" }), "truncated-form");
  assert.equal(bugClassOf("cuor", { lemma: "cuore", tag: "NOUN-M:s" }), "truncated-form");
  assert.equal(bugClassOf("son", { lemma: "essere", tag: "VER:ind+pres+3+p" }), "verb-form", "not a prefix of its lemma");
});

test("a form of a lemma the lookup finds is our bug, the most specific class first", () => {
  assert.deepEqual(
    groupOf(evidence({ word: "quei", foundLemmas: [{ lemma: "quello", tag: "PRO-DEMO-M-P" }, { lemma: "quello", tag: "DET-DEMO:m+p" }] })),
    { group: "our-bug", bugClass: "demonstrative-form", lemma: "quello" },
  );
  assert.deepEqual(
    groupOf(evidence({ word: "raccontarvi", foundLemmas: [{ lemma: "raccontare", tag: "VER:inf+pres+vi" }], lexemes: [{ id: "L1", lemma: "raccontare", senses: 1, italianGloss: true }] })),
    { group: "our-bug", bugClass: "clitic-form", lemma: "raccontare" },
    "our bug wins over a Wikidata lexeme",
  );
  assert.deepEqual(groupOf(evidence({ archiveForm: true, foundLemmas: [{ lemma: "x", tag: "ADV" }] })), {
    group: "our-bug",
    bugClass: "listed-form-not-served",
    lemma: undefined,
  });
  assert.deepEqual(groupOf(evidence({ word: "si trasferiscono", pronominal: { part: "trasferiscono", verb: "trasferirsi" } })), {
    group: "our-bug",
    bugClass: "pronominal-verb-pair",
    lemma: "trasferirsi",
  });
  assert.deepEqual(groupOf(evidence({ word: "perche", accentVariant: "perché", foundLemmas: [{ lemma: "perché", tag: "CON" }] })), {
    group: "our-bug",
    bugClass: "accent-variant",
    lemma: "perché",
  });
  assert.deepEqual(groupOf(evidence({ word: "farci", accentVariant: "farcì", foundLemmas: [{ lemma: "fare", tag: "VER:inf+pres+ci" }] })), {
    group: "our-bug",
    bugClass: "clitic-form",
    lemma: "fare",
  }, "an accent offer Morph-it! does not read the word as");
});

test("a word no lemma of ours explains is a Wikidata word with its lexemes, else in neither", () => {
  const paralimpico = { id: "L1247138", lemma: "paralimpico", senses: 0, italianGloss: false };
  assert.deepEqual(groupOf(evidence({ word: "paralimpico", lexemes: [paralimpico] })), { group: "wikidata", lexemes: [paralimpico] });
  assert.deepEqual(groupOf(evidence({ word: "handbike" })), { group: "neither" });
});
