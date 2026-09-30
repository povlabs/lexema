import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { placeItalianVerbForm, TENSE_BOXES, type VerbSlot } from "../src/italian/moods.js";

const slot = (tags: string[], rawTags: string[] = []): VerbSlot => placeItalianVerbForm({ tags, rawTags });
const box = (tags: string[], rawTags: string[] = []): string => {
  const placed = slot(tags, rawTags);
  return placed.kind === "tense" ? placed.box : placed.kind;
};

test("a person-tagged form is filed under the tense its tags name, with no mood claimed", () => {
  assert.deepEqual(slot(["singular", "first-person", "present"], ["io"]), {
    kind: "tense",
    box: "presente",
    derivedMood: false,
  });
  assert.equal(box(["plural", "third-person", "imperfect"], ["essi/esse"]), "imperfetto");
  assert.equal(box(["singular", "first-person", "pluperfect", "past", "perfect"], ["io"]), "trapassato prossimo");
  assert.equal(box(["plural", "second-person", "historic", "past-remote"], ["voi"]), "trapassato remoto");
});

test("a tense-only form with a che pronoun is congiuntivo, one with a bare pronoun is condizionale", () => {
  assert.equal(box(["present"], ["che io"]), "congiuntivo presente");
  assert.equal(box(["imperfect"], ["che lui/che lei"]), "congiuntivo imperfetto");
  assert.equal(box(["past"], ["che tu"]), "congiuntivo passato");
  assert.equal(box(["past", "perfect"], ["che essi/che esse"]), "congiuntivo trapassato");
  assert.equal(box(["present"], ["io"]), "condizionale presente");
  assert.equal(box(["past"], ["essi/esse"]), "condizionale passato");
  assert.equal((slot(["present"], ["io"]) as { derivedMood: boolean }).derivedMood, true);
});

test("what the rule cannot place stays unplaced rather than guessed", () => {
  assert.equal(box(["imperfect"], ["io"]), "unplaced");
  assert.equal(box(["present"]), "unplaced");
  assert.equal(box(["present"], ["che io", "io"]), "unplaced");
  assert.equal(box(["present"], ["loro"]), "unplaced");
  assert.equal(box(["singular", "first-person", "present"], ["che io"]), "unplaced");
  assert.equal(box(["pronominal", "reflexive"], ["verbo di prima coniugazione"]), "unplaced");
});

test("mood-tagged and non-finite forms keep what the source states", () => {
  assert.equal(box(["imperative"], ["tu"]), "imperative");
  assert.deepEqual(slot(["gerund"]), { kind: "non-finite", role: "gerundio" });
  assert.deepEqual(slot(["present", "participle"]), { kind: "non-finite", role: "participio presente" });
  assert.deepEqual(slot(["past", "participle"]), { kind: "non-finite", role: "participio passato" });
  assert.deepEqual(slot(["auxiliary"], ["verbo di prima coniugazione (irregolare)"]), { kind: "auxiliary" });
});

// The fifty-word development fixture carries the real archive lines of every
// verb Huey listed. The rule has to place every finite form of every one of
// them, and leave only the source's own pronominal infinitive unplaced.
const FIXTURE = new URL("../fixtures/dev-seed.jsonl", import.meta.url);
// A form-of record is not a conjugation: `andati` the *Voce verbale* lists the
// participle's own gender and number forms, which no mood places.
interface FixtureForm { form: string; tags?: string[]; raw_tags?: string[] }
const verbs = readFileSync(FIXTURE, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { word: string; pos: string; tags?: string[]; forms?: FixtureForm[] })
  .filter((record) => record.pos === "verb" && !(record.tags ?? []).includes("form-of") && (record.forms?.length ?? 0) > 0);

test("it-moods/v1 places every finite form of every fixture verb", () => {
  const words = new Set(verbs.map((record) => record.word));
  for (const word of ["andare", "avere", "essere", "fare", "dire", "finire", "parlare", "venire", "vedere", "salire"]) {
    assert.ok(words.has(word), `${word} is in the fixture`);
  }
  for (const record of verbs) {
    const unplaced = (record.forms ?? []).filter((form) => {
      const placed = slot(form.tags ?? [], form.raw_tags ?? []);
      return placed.kind === "unplaced";
    });
    for (const form of unplaced) {
      assert.deepEqual(
        [...(form.tags ?? [])].sort(),
        ["pronominal", "reflexive"],
        `${record.word}: ${form.form} (${form.tags?.join(",")} | ${form.raw_tags?.join(",")}) is unplaced`,
      );
    }
    const boxes = new Set((record.forms ?? []).flatMap((form) => {
      const placed = slot(form.tags ?? [], form.raw_tags ?? []);
      return placed.kind === "tense" ? [placed.box] : [];
    }));
    assert.deepEqual([...boxes].sort(), [...TENSE_BOXES].sort(), `${record.word} fills all fourteen tense boxes`);
  }
});

test("andare's congiuntivo and condizionale hold the forms Italian grammar puts there", () => {
  const andare = verbs.find((record) => record.word === "andare");
  assert.ok(andare);
  const inBox = (name: string) => (andare.forms ?? [])
    .filter((form) => box(form.tags ?? [], form.raw_tags ?? []) === name)
    .map((form) => form.form);
  assert.deepEqual(inBox("congiuntivo presente"), ["vada", "vada", "vada", "andiamo", "andiate", "vadano"]);
  assert.deepEqual(inBox("condizionale presente"), ["andrei", "andresti", "andrebbe", "andremmo", "andreste", "andrebbero"]);
  assert.deepEqual(inBox("congiuntivo trapassato")[0], "fossi andato");
  assert.deepEqual(inBox("condizionale passato")[0], "sarei andato");
});
