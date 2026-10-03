// `form-of-foreign-lemma/v1` (#389, ADR 0023) over real archive lines of
// it-0c432803 (fixtures/form-of-foreign-lemma/archive-lines.jsonl): `zapatero`
// [es] and `zapateros`, which it hides, and `amaricare` [la] and `amaricasti`,
// an Italian verb form it leaves alone. The seed's hide is in
// test/hiddenRecords.test.ts.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { italianRecordOf } from "../src/import/importRelease.js";
import { ForeignLemmaIndex, type ForeignForm } from "../src/italian/formOfForeignLemma.js";

const LINES = (await readFile("fixtures/form-of-foreign-lemma/archive-lines.jsonl", "utf8")).trimEnd().split("\n");
const lineOf = (word: string): string => LINES.find((line) => (JSON.parse(line) as { word: string }).word === word) as string;

/** The rule over `lines`, numbered from 1 in the order given. */
function found(lines: readonly string[]): ForeignForm[] {
  const index = new ForeignLemmaIndex();
  lines.forEach((line, at) => {
    const italian = italianRecordOf(line);
    if (italian !== undefined) index.addItalian(at + 1, italian);
    else index.addOtherLanguage(at + 1, JSON.parse(line) as Record<string, unknown>);
  });
  return index.found();
}

const without = (line: string, change: Record<string, unknown>): string => JSON.stringify({ ...(JSON.parse(line) as object), ...change });

test("zapateros is hidden: its only target, zapatero, is a Spanish record that lists it as its plural", () => {
  assert.deepEqual(found(LINES), [{ lineNo: 2, word: "zapateros", code: "es", lemmaLine: 1, lemma: "zapatero" }]);
  // The archive order does not matter: the claimant can come after the form.
  assert.deepEqual(found([lineOf("zapateros"), lineOf("zapatero")]), [{ lineNo: 1, word: "zapateros", code: "es", lemmaLine: 2, lemma: "zapatero" }]);
});

test("zapateros stays visible when zapatero also has an Italian record", () => {
  const italianZapatero = without(lineOf("zapatero"), { lang_code: "it", lang: "Italiano" });
  assert.deepEqual(found([lineOf("zapatero"), lineOf("zapateros"), italianZapatero]), []);
});

test("zapateros stays visible when the Spanish record does not list it among its forms", () => {
  assert.deepEqual(found([without(lineOf("zapatero"), { forms: [{ form: "zapateras", tags: ["plural"] }] }), lineOf("zapateros")]), []);
});

test("a record is hidden only when every form-of target is claimed", () => {
  const zapateros = JSON.parse(lineOf("zapateros")) as { senses: { form_of: { word: string }[] }[] };
  const twoTargets = without(lineOf("zapateros"), {
    senses: [...zapateros.senses, { glosses: ["plurale di amaricare"], tags: ["form-of"], form_of: [{ word: "amaricare" }] }],
  });
  assert.deepEqual(found([lineOf("zapatero"), lineOf("amaricare"), twoTargets]), []);
});
