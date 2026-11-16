// Which record of a source page each translation belongs to (#928): the four
// rules of src/lookup/translationPlacement.ts over hand-built pages. The
// API's answer over real dev-seed words is web/test/api.test.ts's.

import assert from "node:assert/strict";
import test from "node:test";
import { matchForm, readSenseLabel, TranslationPage, type PageRecord } from "../src/lookup/translationPlacement.js";
import type { Translation } from "../src/lookup/types.js";

/** The page's table: the same entries on every record, as the source copies it. */
const table = (lineNo: number, entries: readonly [word: string, sense: string | null][]): Translation[] =>
  entries.map(([word, sense], i) => ({
    langCode: "en",
    langName: "inglese",
    word,
    sense,
    ref: { releaseId: "it-test", lineNo, jsonPointer: `/translations/${i}`, lineSha256: "x" },
  }));

const ENTRIES: [string, string | null][] = [
  ["go", "(verbo) muoversi da un luogo verso un altro luogo"],
  ["the going", "Incedere, modo di incedere."],
  ["depart", "(verbo) partire"],
  ["gait", "andatura"],
  ["move", null],
  ["swiftly", "(avverbio) in fretta"],
  ["walk", "verbo, camminare"],
];

const record = (recordId: number, pos: string, definitionGlosses: string[][], entries = ENTRIES): PageRecord => ({
  recordId,
  pos,
  translations: table(recordId, entries),
  definitionGlosses,
});

const NOUN = record(1, "noun", [["incedere, modo di incedere"], ["passaggio del tempo"]]);
const VERB = record(2, "verb", [["muoversi da un luogo verso un altro luogo"], ["partire"]]);

/** What is placed on a record, as `word rule index`. */
const placed = (page: TranslationPage, recordId: number): string[] =>
  (page.placedOn(recordId) ?? []).map(({ translation, placement }) => `${translation.word} ${placement.rule} ${placement.definitionIndex}`);

test("a label is read for a leading part-of-speech marker, in parentheses or bare before a comma, and the meaning after it", () => {
  assert.deepEqual(readSenseLabel("(verbo) partire"), { pos: "verb", meaning: "partire" });
  assert.deepEqual(readSenseLabel("(Sostantivo)"), { pos: "noun", meaning: null });
  assert.deepEqual(readSenseLabel("aggettivo, chiaro ed evidente"), { pos: "adj", meaning: "chiaro ed evidente" });
  assert.deepEqual(readSenseLabel("avverbio"), { pos: "adv", meaning: null });
  // A marker that does not lead, a domain label, and a word that only starts like one are no marker.
  assert.deepEqual(readSenseLabel("femminile di giusto (aggettivo)"), { meaning: "femminile di giusto (aggettivo)" });
  assert.deepEqual(readSenseLabel("(musica)"), { meaning: "(musica)" });
  assert.deepEqual(readSenseLabel("verbosità"), { meaning: "verbosità" });
  assert.deepEqual(readSenseLabel(null), { meaning: null });
  assert.deepEqual(readSenseLabel("   "), { meaning: null });
});

test("the match form folds case, spacing and closing punctuation, and nothing else", () => {
  assert.equal(matchForm("  Atto   dell'andare.; "), "atto dell'andare");
  assert.equal(matchForm("é"), "é");
  assert.notEqual(matchForm("atto dell andare"), matchForm("atto dell'andare"));
});

test("on a page of two parts of speech, each record gets only what a marker or one of its definitions places on it", () => {
  const page = TranslationPage.of("andare", [NOUN, VERB]);
  // Rule 1 names the verb, and its meaning names the verb's definition when it matches one; rule 2 places on the noun.
  assert.deepEqual(placed(page, 2), ["go pos-marker 0", "depart pos-marker 1", "walk pos-marker null"]);
  assert.deepEqual(placed(page, 1), ["the going definition 0"]);
  // No evidence, an empty label, and a marker naming a part of speech the page lacks: on no record.
  assert.deepEqual(page.unplaced().map((t) => t.word), ["gait", "move", "swiftly"]);
});

test("a label matching a definition names it; one matching none names nothing", () => {
  const page = TranslationPage.of("andare", [NOUN, VERB]);
  const theGoing = page.placedOn(1)?.find(({ translation }) => translation.word === "the going");
  assert.deepEqual(theGoing?.placement, { rule: "definition", definitionIndex: 0 });
  const walk = page.placedOn(2)?.find(({ translation }) => translation.word === "walk");
  assert.deepEqual(walk?.placement, { rule: "pos-marker", definitionIndex: null });
});

test("on a page of one part of speech, every translation without a contrary marker stays on its records", () => {
  const second = record(3, "verb", [["camminare"]]);
  const page = TranslationPage.of("andare", [VERB, second]);
  assert.deepEqual(placed(page, 2), [
    "go pos-marker 0",
    "the going only-part-of-speech null",
    "depart pos-marker 1",
    "gait only-part-of-speech null",
    "move only-part-of-speech null",
    "walk pos-marker null",
  ]);
  assert.deepEqual(placed(page, 3).at(-1), "walk pos-marker 0");
  // A marker naming another part of speech places it on none of them.
  assert.deepEqual(page.unplaced().map((t) => t.word), ["swiftly"]);
  const outcomes = new Map(page.outcomes().map(({ translation, outcome }) => [translation.word, outcome]));
  assert.equal(outcomes.get("gait"), "only-part-of-speech");
  assert.equal(outcomes.get("swiftly"), "unplaced");
});

test("a record whose line lists no translations takes none and does not make the page one of several parts of speech", () => {
  const phrase = record(4, "phrase", [], []);
  const page = TranslationPage.of("andare", [VERB, phrase]);
  assert.deepEqual(placed(page, 4), []);
  assert.ok(placed(page, 2).includes("gait only-part-of-speech null"));
  assert.equal(page.placedOn(99), undefined);
});

test("a translation one record takes by rule 2 and another by rule 3 counts as rule 2", () => {
  const page = TranslationPage.of("andare", [record(5, "noun", [["andatura"]]), record(6, "noun", [])]);
  const outcomes = new Map(page.outcomes().map(({ translation, outcome }) => [translation.word, outcome]));
  assert.equal(outcomes.get("gait"), "definition");
  assert.equal(page.outcomes().length, ENTRIES.length);
});
