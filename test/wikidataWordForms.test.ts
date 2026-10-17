// A Wikidata word's forms (ADR 0033, #833): the fixed table from each form's
// grammatical features to the tags a record's form writes, and the reading's
// forms read through it. Inputs are the committed snapshot's own lexemes
// (wikidata-words/wikidata-words.jsonl), the words the dictionary serves.

import assert from "node:assert/strict";
import test from "node:test";
import { isLexemeFormRef, isSearchedForm, searchedFormKey, searchedSpellings, sourceTagsOf, type Reading } from "../src/lookup/types.js";
import { wikidataWordReading } from "../src/lookup/wikidataWords.js";
import { formTagsOf, isMappedFeature, TAGS_BY_FEATURE } from "../src/wikidataWords/formFeatures.js";
import { wordRow } from "../src/wikidataWords/loadWikidataWords.js";
import { hasItalianGloss, type WikidataWord } from "../src/wikidataWords/wikidataWord.js";
import { readWordSnapshot } from "../src/wikidataWords/wordSnapshot.js";

const SERVED = (await readWordSnapshot()).filter(hasItalianGloss);
const served = (lemma: string): WikidataWord => {
  const found = SERVED.find((one) => one.lemma === lemma);
  assert.ok(found !== undefined, lemma);
  return found;
};
const readingOf = (lemma: string, key = lemma): Reading => wikidataWordReading("it-test", wordRow(served(lemma), "2026-10-07") as Parameters<typeof wikidataWordReading>[1], key);

test("the table maps every number, gender, mood, tense and person feature the served words state, and nothing else", () => {
  const used = new Set(SERVED.flatMap((word) => word.forms.flatMap((form) => form.features)));
  // Wikidata's own Italian labels for the features the table leaves out: none is a cell of a grid or a conjugation.
  const left = ["Q108709", "Q102786", "Q112154", "Q66664394", "Q1358239", "Q185077", "Q55094451", "Q54948374"]; // diminutivo, abbreviazione, apocope, vezzeggiativo, accrescitivo, vocativo, forma rara, forma spregiativa
  assert.deepEqual([...used].filter((feature) => !isMappedFeature(feature)).sort(), [...left].sort());
  assert.deepEqual([...used].filter(isMappedFeature).sort(), Object.keys(TAGS_BY_FEATURE).sort());
  assert.deepEqual(TAGS_BY_FEATURE, {
    Q499327: { kind: "gender", tag: "masculine" },
    Q1775415: { kind: "gender", tag: "feminine" },
    Q110786: { kind: "number", tag: "singular" },
    Q146786: { kind: "number", tag: "plural" },
    Q21714344: { kind: "person", tag: "first-person" },
    Q51929049: { kind: "person", tag: "second-person" },
    Q51929074: { kind: "person", tag: "third-person" },
    Q56682909: { kind: "verb", tags: ["present"], row: "tagged" },
    Q12547192: { kind: "verb", tags: ["imperfect"], row: "tagged" },
    Q442485: { kind: "verb", tags: ["past-remote"], row: "tagged" },
    Q1475560: { kind: "verb", tags: ["future"], row: "tagged" },
    Q3686414: { kind: "verb", tags: ["present"], row: "pronoun" },
    Q3502553: { kind: "verb", tags: ["present"], row: "che" },
    Q3502541: { kind: "verb", tags: ["imperfect"], row: "che" },
    Q52434162: { kind: "verb", tags: ["imperative"], row: "pronoun" },
    Q52434245: { kind: "verb", tags: ["infinitive"], row: "none" },
    Q52434511: { kind: "verb", tags: ["gerund"], row: "none" },
    Q10345583: { kind: "verb", tags: ["present", "participle"], row: "none" },
    Q12717679: { kind: "verb", tags: ["past", "participle"], row: "none" },
  });
});

test("a form's features read as the tags a record's form writes for the same row", () => {
  // pento: presente indicativo, prima persona, singolare.
  assert.deepEqual(formTagsOf(["Q110786", "Q21714344", "Q56682909"]), { tags: ["singular", "first-person", "present"], rawTags: ["io"] });
  // penta: congiuntivo presente, prima persona, singolare.
  assert.deepEqual(formTagsOf(["Q110786", "Q21714344", "Q3502553"]), { tags: ["present"], rawTags: ["che io"] });
  // pentirebbero: condizionale presente, terza persona, plurale.
  assert.deepEqual(formTagsOf(["Q146786", "Q3686414", "Q51929074"]), { tags: ["present"], rawTags: ["essi/esse"] });
  // pentito: participio passato.
  assert.deepEqual(formTagsOf(["Q12717679"]), { tags: ["past", "participle"], rawTags: [] });
  // professoresse: plurale, femminile.
  assert.deepEqual(formTagsOf(["Q146786", "Q1775415"]), { tags: ["feminine", "plural"], rawTags: [] });
  // A feature the table leaves out leaves the whole form out: prof.i, abbreviazione.
  assert.equal(formTagsOf(["Q102786", "Q146786", "Q499327"]), undefined);
});

test("a Wikidata word's reading holds the forms the table maps, and none with a feature it does not", () => {
  const surfaces = (reading: Reading): string[] => reading.forms.map((form) => form.surface);
  // trucchetto and trucchettino are diminutives.
  assert.deepEqual(surfaces(readingOf("trucco")), ["trucco", "trucchi"]);
  // prof., prof, prof.ssa, prof.i and prof.sse are abbreviations, professor is cut short.
  assert.deepEqual(surfaces(readingOf("professore")), ["professore", "professori", "professoressa", "professoresse"]);
  assert.deepEqual(surfaces(readingOf("targhetta")), ["targhetta", "targhette"]);
  // Every one of pentirsi's 51 forms is mapped.
  assert.equal(readingOf("pentirsi").forms.length, 51);
});

test("each form points at its form of the lexeme, and its tags read back as a record's", () => {
  const reading = readingOf("professore");
  const professoresse = reading.forms.find((form) => form.surface === "professoresse");
  assert.ok(professoresse !== undefined);
  assert.deepEqual(professoresse.ref, { releaseId: "it-test", wiki: "www.wikidata.org", lexeme: "L1180137", snapshot: "2026-10-07", form: "L1180137-F8" });
  assert.ok(professoresse.claims.every((claim) => isLexemeFormRef(claim.ref) && claim.ref.form === "L1180137-F8"));
  assert.deepEqual(sourceTagsOf(professoresse), { tags: ["feminine", "plural"], rawTags: [] });
  // Its index is its place in the lexeme's forms as stored: the seventh, since the lexeme has no F4.
  assert.equal(professoresse.index, 6);
  assert.deepEqual(reading.grammar.byForm.get(6), professoresse.claims);
  const penta = readingOf("pentirsi").forms.find((form) => isLexemeFormRef(form.ref) && form.ref.form === "L1422655-F31");
  assert.ok(penta !== undefined);
  assert.deepEqual(sourceTagsOf(penta), { tags: ["present"], rawTags: ["che io"] });
});

test("a Wikidata word found through a form carries that form as its evidence, and the search names it by its id (#851)", () => {
  const ref = { releaseId: "it-test", wiki: "www.wikidata.org", lexeme: "L1180137", snapshot: "2026-10-07" } as const;
  const viaForm = readingOf("professore", "professoresse");
  assert.deepEqual(viaForm.evidence, [{ origin: "embedded-form", surface: "professoresse", ref: { ...ref, form: "L1180137-F8" }, formSource: null }]);
  assert.equal(viaForm.isAboutQuery, false);
  const searched = searchedSpellings(viaForm);
  assert.deepEqual([searched.headword, [...searched.forms]], [false, ["L1180137-F8"]]);
  assert.deepEqual(viaForm.forms.filter((form) => isSearchedForm(searched, form.ref)).map((form) => form.surface), ["professoresse"]);

  // Its lemma is its headword, and the form that spells it too.
  const viaLemma = readingOf("professore");
  assert.deepEqual(viaLemma.evidence.map((occurrence) => [occurrence.origin, occurrence.ref]), [["headword", ref], ["embedded-form", { ...ref, form: "L1180137-F1" }]]);
  assert.equal(viaLemma.isAboutQuery, true);

  // A record's form keys by its pointer, a lexeme's by its form id: one set cannot confuse them.
  assert.equal(searchedFormKey({ releaseId: "it-test", lineNo: 1, jsonPointer: "/forms/3/form", lineSha256: "0" }), "/forms/3/form");
  assert.equal(searchedFormKey({ releaseId: "it-test", lineNo: 1, jsonPointer: "", lineSha256: "0" }), undefined);
  assert.equal(searchedFormKey({ ...ref, form: "L1180137-F8" }), "L1180137-F8");
});
