import assert from "node:assert/strict";
import test from "node:test";
import { resolveCandidates } from "../src/core/candidateResolver.js";
import type { RecordEnvelope } from "../src/core/types.js";

const envelope = (ordinal: number, record: RecordEnvelope["record"]): RecordEnvelope => ({ ordinal, record, sourceBytes: JSON.stringify(record).length });

test("merges form_of and embedded-form evidence for the same target record", () => {
  const target = envelope(10, { word: "andare", lang_code: "it", pos: "verb", forms: [{ form: "andavano", tags: ["third-person", "plural", "imperfect"] }] });
  const formRecord = envelope(11, { word: "andavano", lang_code: "it", pos: "verb", tags: ["form-of"], senses: [{ tags: ["form-of"], form_of: [{ word: "andare" }] }] });
  const result = resolveCandidates("andavano", [target, formRecord]);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].target.ordinal, 10);
  assert.deepEqual(result.groups[0].evidence.map((item) => item.kind).sort(), ["embedded-form", "form-of"]);
  assert.equal(result.duplicateCandidatesMerged, 1);
});

test("keeps compatible same-lemma target records distinct", () => {
  const source = envelope(1, { word: "sale", lang_code: "it", pos: "verb", tags: ["form-of"], senses: [{ form_of: [{ word: "salire" }] }] });
  const firstTarget = envelope(2, { word: "salire", lang_code: "it", pos: "verb", tags: ["transitive"] });
  const secondTarget = envelope(3, { word: "salire", lang_code: "it", pos: "verb", tags: ["intransitive"] });
  const result = resolveCandidates("sale", [source, firstTarget, secondTarget]);
  assert.equal(result.groups.length, 2);
  assert.equal(result.ambiguousRelations, 1);
});

test("does not merge candidates across parts of speech", () => {
  const noun = envelope(1, { word: "sale", lang_code: "it", pos: "noun", tags: ["masculine", "singular"] });
  const verb = envelope(2, { word: "sale", lang_code: "it", pos: "verb", tags: ["form-of"], senses: [{ form_of: [{ word: "salire" }] }] });
  const target = envelope(3, { word: "salire", lang_code: "it", pos: "verb" });
  assert.equal(resolveCandidates("sale", [noun, verb, target]).groups.length, 2);
});
