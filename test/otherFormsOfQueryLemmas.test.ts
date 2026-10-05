// Which readings a form's page leaves out as other forms of the form's own
// lemma (#626), over synthetic readings: the rule reads `isAboutQuery` and
// declared `form_of` links, and nothing else.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readingPartOfSpeech } from "../src/lookup/articles.js";
import { otherFormsOfQueryLemmas, type LemmaLink, type Reading, type SourceRef } from "../src/lookup/types.js";

const ref = (lineNo: number): SourceRef => ({ releaseId: "it-test", lineNo, jsonPointer: "", lineSha256: "0".repeat(64) });

function reading(recordId: number, word: string, isAboutQuery: boolean, lemmaLinks: LemmaLink[] = []): Reading {
  return {
    recordId,
    ref: ref(recordId),
    word,
    ...readingPartOfSpeech("adj", word, []),
    posTitle: lemmaLinks.length > 0 ? "Aggettivo, forma flessa" : "Aggettivo",
    wordFacts: { pronunciations: [], hyphenations: [], etymologies: [], synonyms: [], synonymList: [], antonyms: [], derived: [], expressions: [] },
    isAboutQuery,
    evidence: [],
    senses: [],
    forms: [],
    grammar: { record: [], byForm: new Map(), bySense: new Map() },
    lemmaLinks,
    inflections: [],
    reviews: [],
    recovered: [],
  };
}

/** A `form_of` edge naming `target`, resolved to these records. */
const formOf = (target: string, ...recordIds: number[]): LemmaLink => ({
  kind: "candidates",
  targetWord: target,
  candidates: recordIds.map((recordId) => ({ recordId, ref: ref(recordId), word: target, pos: "adj", listing: undefined, expressions: [] })),
  ref: ref(900),
});

const words = (readings: ReadonlySet<Reading>): string[] => [...readings].map((r) => r.word).sort();

// Record 9 is `bello`, the lemma. It is no reading here: the lookup hands a
// lemma the query's form names to that form's link, not to the readings.
const BELLO = 9;

test("a table-only reading that is a form of the query's own lemma is left out", () => {
  const bella = reading(1, "bella", true, [formOf("bello", BELLO)]);
  const belli = reading(2, "belli", false, [formOf("bello", BELLO)]);
  assert.deepEqual(words(otherFormsOfQueryLemmas([bella, belli])), ["belli"]);
});

test("a form of a form of the query's lemma is left out too, whatever the order", () => {
  const bella = reading(1, "bella", true, [formOf("bello", BELLO)]);
  const bellissimo = reading(2, "bellissimo", false, [formOf("bello", BELLO)]);
  const bellissime = reading(3, "bellissime", false, [formOf("bellissimo", 2)]);
  // The chain's last link comes first, so one pass in order would miss it.
  assert.deepEqual(words(otherFormsOfQueryLemmas([bellissime, bella, bellissimo])), ["bellissime", "bellissimo"]);
});

test("a reading about the query always stays, even when it is a form of the same lemma", () => {
  const bellaAdjective = reading(1, "bella", true, [formOf("bello", BELLO)]);
  const bellaNoun = reading(2, "bella", true, [formOf("bello", BELLO)]);
  assert.deepEqual(words(otherFormsOfQueryLemmas([bellaAdjective, bellaNoun])), []);
});

test("a table-only reading with no form_of edge stays, and so does one whose edge names another lemma", () => {
  const bella = reading(1, "bella", true, [formOf("bello", BELLO)]);
  // A separate noun `bella`-lister, or a proper name: it lists the query and declares nothing.
  const lister = reading(2, "Bella", false);
  const other = reading(3, "bellona", false, [formOf("bellone", 40)]);
  const dangling = reading(4, "bellina", false, [{ kind: "dangling", targetWord: "bello", ref: ref(901) }]);
  assert.deepEqual(words(otherFormsOfQueryLemmas([bella, lister, other, dangling])), []);
});

test("a lemma reading about the query seeds nothing: its own forms are formsOfQueryReadings' case", () => {
  const bello = reading(1, "bello", true);
  const bella = reading(2, "bella", false, [formOf("bello", 1)]);
  assert.deepEqual(words(otherFormsOfQueryLemmas([bello, bella])), []);
});
