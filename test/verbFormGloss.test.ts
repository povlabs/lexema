import assert from "node:assert/strict";
import test from "node:test";
import { readVerbFormGloss } from "../src/italian/verbFormGloss.js";

// Glosses as release it-0c432803 writes them on verb form-of records, most of
// them of lemmas no record heads (#453): `verbalizzare`, `smaccare`,
// `aggrapparsi`. The typographic apostrophe, the full stop, the ` di ` in a
// verb and the three-verb list are each one change to a real gloss, made to
// hold that case.

test("each finite mood's person shape reads as its tense, person and number", () => {
  assert.deepEqual(readVerbFormGloss("prima persona singolare dell'indicativo presente di verbalizzare", "verbalizzare"), {
    kind: "finite", tense: "presente", person: "first", number: "singular",
  });
  assert.deepEqual(readVerbFormGloss("terza persona plurale dell'indicativo imperfetto di verbalizzare", "verbalizzare"), {
    kind: "finite", tense: "imperfetto", person: "third", number: "plural",
  });
  assert.deepEqual(readVerbFormGloss("seconda persona singolare dell'indicativo passato remoto di verbalizzare", "verbalizzare"), {
    kind: "finite", tense: "passato remoto", person: "second", number: "singular",
  });
  assert.deepEqual(readVerbFormGloss("prima persona plurale dell'indicativo futuro di verbalizzare", "verbalizzare"), {
    kind: "finite", tense: "futuro semplice", person: "first", number: "plural",
  });
  assert.deepEqual(readVerbFormGloss("prima persona plurale dell'indicativo futuro semplice di abalienare", "abalienare"), {
    kind: "finite", tense: "futuro semplice", person: "first", number: "plural",
  });
  assert.deepEqual(readVerbFormGloss("terza persona singolare del congiuntivo presente di verbalizzare", "verbalizzare"), {
    kind: "finite", tense: "congiuntivo presente", person: "third", number: "singular",
  });
  assert.deepEqual(readVerbFormGloss("seconda persona plurale del congiuntivo imperfetto di verbalizzare", "verbalizzare"), {
    kind: "finite", tense: "congiuntivo imperfetto", person: "second", number: "plural",
  });
  assert.deepEqual(readVerbFormGloss("prima persona singolare del condizionale presente di verbalizzare", "verbalizzare"), {
    kind: "finite", tense: "condizionale presente", person: "first", number: "singular",
  });
});

test("the imperativo shape, with or without presente, reads as an imperative person", () => {
  assert.deepEqual(readVerbFormGloss("seconda persona singolare dell'imperativo di verbalizzare", "verbalizzare"), {
    kind: "imperative", person: "second", number: "singular",
  });
  assert.deepEqual(readVerbFormGloss("terza persona plurale dell'imperativo presente di verbalizzare", "verbalizzare"), {
    kind: "imperative", person: "third", number: "plural",
  });
});

test("gerundio di, participio presente di and participio passato di read as non-finite slots, with any agreement they name", () => {
  assert.deepEqual(readVerbFormGloss("gerundio di verbalizzare", "verbalizzare"), { kind: "gerund" });
  assert.deepEqual(readVerbFormGloss("gerundio presente di verbalizzare", "verbalizzare"), { kind: "gerund" });
  assert.deepEqual(readVerbFormGloss("participio presente di verbalizzare", "verbalizzare"), { kind: "present-participle", number: undefined });
  assert.deepEqual(readVerbFormGloss("participio presente plurale di verbalizzare", "verbalizzare"), { kind: "present-participle", number: "plural" });
  assert.deepEqual(readVerbFormGloss("participio passato di verbalizzare", "verbalizzare"), {
    kind: "past-participle", gender: undefined, number: undefined,
  });
  assert.deepEqual(readVerbFormGloss("participio passato maschile plurale di verbalizzare", "verbalizzare"), {
    kind: "past-participle", gender: "masculine", number: "plural",
  });
  assert.deepEqual(readVerbFormGloss("participio passato femminile singolare di verbalizzare", "verbalizzare"), {
    kind: "past-participle", gender: "feminine", number: "singular",
  });
});

test("the verb may be one of the pair a reflexive participle names, or hold a ' di ' of its own", () => {
  const participle = { kind: "past-participle", gender: undefined, number: undefined };
  assert.deepEqual(readVerbFormGloss("participio passato di aggrappare, aggrapparsi", "aggrapparsi"), participle);
  assert.deepEqual(readVerbFormGloss("participio passato di aggrappare, aggrapparsi", "aggrappare"), participle);
  assert.deepEqual(readVerbFormGloss("gerundio di andare di corpo", "andare di corpo"), { kind: "gerund" });
  assert.deepEqual(readVerbFormGloss("gerundio di verbalizzare.", "verbalizzare"), { kind: "gerund" });
  assert.deepEqual(readVerbFormGloss("prima persona singolare dell’indicativo presente di verbalizzare", "verbalizzare"), {
    kind: "finite", tense: "presente", person: "first", number: "singular",
  });
});

test("a gloss in any other shape, or naming another word, is refused", () => {
  // The forms the source wrote by hand, in an order or wording the rule does not read.
  assert.equal(readVerbFormGloss("prima persona indicativo singolare presente del verbo smaccare", "smaccare"), undefined);
  assert.equal(readVerbFormGloss("prima persona singolare dell'indicativo presente del verbo lussare", "lussare"), undefined);
  assert.equal(readVerbFormGloss("indicativo presente, seconda persona singolare di orare", "orare"), undefined);
  assert.equal(readVerbFormGloss("prima persona singolare dell'indicativo passato prossimo di verbalizzare", "verbalizzare"), undefined);
  assert.equal(readVerbFormGloss("participio passato di maschile singolare di verbalizzare", "verbalizzare"), undefined);
  assert.equal(readVerbFormGloss("Gerundio di verbalizzare", "verbalizzare"), undefined);
  assert.equal(readVerbFormGloss("andare sovrappensiero", "sovrappensiero"), undefined);
  // Right shape, other verb, or a longer one.
  assert.equal(readVerbFormGloss("gerundio di verbalizzare", "verbalizzar"), undefined);
  assert.equal(readVerbFormGloss("gerundio di verbalizzare", "videoregistrare"), undefined);
  assert.equal(readVerbFormGloss("participio passato di fondere, fondersi, rifondersi", "fondersi"), undefined);
  assert.equal(readVerbFormGloss("gerundio di verbalizzare", ""), undefined);
});
