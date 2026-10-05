// Which readings a word's page leaves out as forms of its own readings (#622),
// over synthetic readings: the rule reads `isAboutQuery` and declared
// `form_of` links, and nothing else.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readingPartOfSpeech } from "../src/lookup/articles.js";
import { formsOfQueryReadings, type LemmaLink, type Reading, type SourceRef } from "../src/lookup/types.js";

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

test("a table-only reading that is a form of a reading about the query is left out", () => {
  const bello = reading(1, "bello", true);
  const bella = reading(2, "bella", false, [formOf("bello", 1)]);
  assert.deepEqual(words(formsOfQueryReadings([bello, bella])), ["bella"]);
});

test("a form of a form of the query's reading is left out too, whatever the order", () => {
  const bello = reading(1, "bello", true);
  const bellissimo = reading(2, "bellissimo", false, [formOf("bello", 1)]);
  const bellissime = reading(3, "bellissime", false, [formOf("bellissimo", 2)]);
  // The chain's last link comes first, so one pass in order would miss it.
  assert.deepEqual(words(formsOfQueryReadings([bellissime, bello, bellissimo])), ["bellissime", "bellissimo"]);
});

test("a table-only reading that declares no form_of link stays (the studentessa/studenti case)", () => {
  const studenti = reading(1, "studenti", true, [formOf("studente", 9)]);
  const studentessa = reading(2, "studentessa", false);
  assert.deepEqual(words(formsOfQueryReadings([studenti, studentessa])), []);
});

test("a form of a word that is no reading about the query stays (bellissimo on bella's page)", () => {
  // bella is a form of bello; bello is not among the readings, so bellissimo,
  // another form of bello, is not a form of any reading about bella.
  const bella = reading(1, "bella", true, [formOf("bello", 9)]);
  const bellissimo = reading(2, "bellissimo", false, [formOf("bello", 9)]);
  const dangling: Reading = reading(3, "bellona", false, [{ kind: "dangling", targetWord: "bella", ref: ref(901) }]);
  assert.deepEqual(words(formsOfQueryReadings([bella, bellissimo, dangling])), []);
});

test("a reading about the query is never left out, even when it is a form of another one", () => {
  const sale = reading(1, "sale", true);
  const saleForm = reading(2, "sale", true, [formOf("sale", 1)]);
  assert.deepEqual(words(formsOfQueryReadings([sale, saleForm])), []);
});
