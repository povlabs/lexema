import assert from "node:assert/strict";
import test from "node:test";
import { verbFormLine } from "../src/italian/verbFormLine.js";

// Each form's tags and raw tags as andare's own `forms[]` gives them in
// fixtures/dev-seed.jsonl.
const line = (tags: string[], rawTags: string[]): string | undefined => verbFormLine("andare", { tags, rawTags });

test("a compound indicative cell reads its person, number, tense and mood: sono andato", () => {
  assert.equal(
    line(["singular", "first-person", "past", "perfect"], ["io"]),
    "prima persona singolare del passato prossimo indicativo di andare",
  );
});

test("a conditional cell names the conditional's own tense: sarei andato", () => {
  assert.equal(line(["past"], ["io"]), "prima persona singolare del passato condizionale di andare");
});

test("one spelling in three subjunctive cells gives three lines: sia andato", () => {
  assert.deepEqual(
    [["che io"], ["che tu"], ["che lui/che lei"]].map((rawTags) => line(["past"], rawTags)),
    [
      "prima persona singolare del passato congiuntivo di andare",
      "seconda persona singolare del passato congiuntivo di andare",
      "terza persona singolare del passato congiuntivo di andare",
    ],
  );
});

test("one spelling in two subjunctive cells gives two lines: fossi andato", () => {
  assert.deepEqual(
    [["che io"], ["che tu"]].map((rawTags) => line(["past", "perfect"], rawTags)),
    [
      "prima persona singolare del trapassato congiuntivo di andare",
      "seconda persona singolare del trapassato congiuntivo di andare",
    ],
  );
});

test("a tense that starts with a vowel takes dell': andavano", () => {
  assert.equal(
    line(["plural", "third-person", "imperfect"], ["essi/esse"]),
    "terza persona plurale dell'imperfetto indicativo di andare",
  );
});

test("an imperative, the infinitive and an unplaced form give no line", () => {
  assert.equal(line(["imperative"], ["tu"]), undefined);
  assert.equal(line(["infinitive"], []), undefined);
  assert.equal(line(["imperfect"], ["io"]), undefined);
  assert.equal(line(["auxiliary"], []), undefined);
});

test("a non-finite cell is named as the table names it, then the verb (v2, #695): stato is the participio of essere", () => {
  assert.equal(line(["past", "participle"], ["verbo di prima coniugazione (irregolare)"]), "participio di andare");
  assert.equal(line(["gerund"], []), "gerundio di andare");
  assert.equal(line(["present", "participle"], []), "participio presente di andare");
  // The non-finite line spells only the masculine, so a feminine finds none.
  assert.equal(verbFormLine("andare", { tags: ["past", "participle"], rawTags: [] }, "feminine"), undefined);
});

test("a feminine compound form's line names the gender after the number; the masculine names none (#676)", () => {
  const io = { tags: ["singular", "first-person", "past", "perfect"], rawTags: ["io"] };
  assert.equal(verbFormLine("andare", io, "feminine"), "prima persona singolare femminile del passato prossimo indicativo di andare");
  assert.equal(verbFormLine("andare", io), "prima persona singolare del passato prossimo indicativo di andare");
  assert.equal(
    verbFormLine("andare", { tags: ["past"], rawTags: ["che noi"] }, "feminine"),
    "prima persona plurale femminile del passato congiuntivo di andare",
  );
});

test("a finite cell with no row gives no line rather than a guessed person", () => {
  assert.equal(line(["first-person", "present"], []), undefined);
  assert.equal(verbFormLine("", { tags: ["singular", "first-person", "present"], rawTags: ["io"] }), undefined);
});
