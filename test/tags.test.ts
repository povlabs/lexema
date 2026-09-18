import assert from "node:assert/strict";
import test from "node:test";
import { mapItalianTags } from "../src/italian/tags.js";

test("maps only explicit structured and approved raw tags", () => {
  const grammar = mapItalianTags(["feminine", "plural", "third-person", "imperfect", "unmapped"], ["essi/esse"]);
  assert.equal(grammar.gender, "feminine");
  assert.equal(grammar.number, "plural");
  assert.equal(grammar.person, "third");
  assert.equal(grammar.tense, "imperfect");
  assert.deepEqual(grammar.unknownTags, ["unmapped"]);
});

test("does not fabricate a mood from present", () => {
  const grammar = mapItalianTags(["present"], ["io"]);
  assert.equal(grammar.tense, "present");
  assert.equal(grammar.person, "first");
  assert.equal("mood" in grammar, false);
});

test("withholds conflicting structured gender", () => {
  const grammar = mapItalianTags(["masculine", "feminine", "singular"]);
  assert.equal(grammar.gender, undefined);
  assert.equal(grammar.number, "singular");
});
