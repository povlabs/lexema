// A lookup reads each archive line cut down in SQL to the fields it reads
// (#646, src/lookup/projection.ts). The cut line must read exactly as the whole
// line does, every pointer included, over every fixture line and over values
// not shaped as a reader expects; and the cut must name every field the
// readers ask for, so a reader that starts using a field it leaves out fails
// here instead of reading nothing on a page.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { after, test } from "node:test";
import { recordGlosses } from "../src/italian/recovery.js";
import { projectedJsonSql } from "../src/lookup/projection.js";
import {
  EXPRESSION_FIELDS,
  LINE_FIELDS,
  readExpressionItems,
  readSourceFields,
  readSourceRecord,
  type ExpressionLine,
  type ReadingLine,
} from "../src/lookup/sourceRecord.js";
import type { SourceRef } from "../src/lookup/types.js";
import { readContent, readFieldPaths, type ReadFields } from "../src/update/content.js";
import { watched } from "./watched.js";

const sqlite = new DatabaseSync(":memory:");
after(() => sqlite.close());

/** `line` as a lookup's statement returns it, cut to `fields`. */
function cut(line: string, fields: ReadFields): string {
  const row = sqlite.prepare(`SELECT ${projectedJsonSql("?1", fields)} AS line`).get(line) as { line: string };
  return row.line;
}

const ref = (jsonPointer: string): SourceRef => ({ releaseId: "it-test", lineNo: 1, jsonPointer, lineSha256: "0".repeat(64) });

const glossesOf = (parsed: unknown): unknown =>
  recordGlosses(typeof parsed === "object" && parsed !== null ? (parsed as { senses?: unknown }).senses : undefined);

/** Every line of every fixture archive. */
async function fixtureLines(): Promise<string[]> {
  const files = (await readdir("fixtures")).filter((file) => file.endsWith(".jsonl"));
  const lines = await Promise.all(files.map(async (file) => (await readFile(`fixtures/${file}`, "utf8")).split("\n").filter((line) => line.trim() !== "")));
  return lines.flat();
}

// Values a reader skips, each where a reader looks: a list that is an object,
// an item that is a string, a sense that is not an object, a missing field.
const ODD_LINES = [
  {
    word: "x",
    sounds: [{ ipa: "/a/", audio: "x.ogg" }, "str", 3, null, [1]],
    senses: [{ glosses: ["g", 2], tags: ["t"], examples: [{ text: "e", ref: "r" }, "s", { text: 4 }] }, "bad", { examples: "notarray" }, {}],
    etymology_texts: ["a\"b", "é ü  ", null],
    synonyms: { word: "not a list" },
    antonyms: [{ word: "" }, { word: "su" }],
    proverbs: null,
    translations: [{ word: "house" }],
  },
  { senses: {} },
  {},
  [1, 2],
];

test("a line cut to the fields a reading reads reads as the whole line, over every fixture line", async () => {
  const lines = [...(await fixtureLines()), ...ODD_LINES.map((line) => JSON.stringify(line))];
  assert.ok(lines.length > 300, `${lines.length} lines`);
  for (const line of lines) {
    const whole: unknown = JSON.parse(line);
    const reading = cut(line, LINE_FIELDS) as ReadingLine;
    const expressions = cut(line, EXPRESSION_FIELDS) as ExpressionLine;
    // The cut is the line with only the named fields, as the release diff reads one.
    assert.deepEqual(JSON.parse(reading), readContent(whole, LINE_FIELDS), line.slice(0, 80));
    assert.deepEqual(readSourceRecord(reading, ref), readSourceFields(whole, ref), line.slice(0, 80));
    assert.deepEqual(glossesOf(JSON.parse(reading)), glossesOf(whole), line.slice(0, 80));
    assert.deepEqual(readExpressionItems(expressions, ref), readSourceFields(whole, ref).expressionItems, line.slice(0, 80));
    assert.ok(reading.length <= line.length, "a cut line is never longer than the line");
  }
});

// A record with every field a reading reads, beside fields none does.
const EVERY_FIELD = {
  word: "casa",
  forms: [{ form: "case", tags: ["plural"] }],
  senses: [{ glosses: ["edificio"], tags: ["countable"], examples: [{ text: "una casa grande", ref: "Autore" }], senseid: "casa-1" }],
  sounds: [{ ipa: "/ˈkasa/", sense: "italiano standard", audio: "casa.ogg" }],
  hyphenations: [{ parts: ["cà", "sa"] }],
  etymology_texts: ["dal latino casa"],
  synonyms: [{ word: "abitazione", raw_tags: ["formale"], sense: "edificio" }],
  antonyms: [{ word: "strada" }],
  derived: [{ word: "casetta" }],
  proverbs: [{ word: "casa dolce casa", sense: "si sta bene a casa" }],
  translations: [{ lang_code: "en", word: "house" }],
};

/** Every field path `fields` names, and every path above one: `senses`, `senses[].examples`. */
function namedPaths(fields: ReadFields): Set<string> {
  const paths = new Set<string>();
  for (const path of readFieldPaths(fields)) {
    const steps = path.split(".");
    for (let i = 1; i <= steps.length; i++) paths.add(steps.slice(0, i).join(".").replace(/\[\]$/, ""));
  }
  return paths;
}

test("the cut names every field a reading's readers ask for, and no other", () => {
  const seen = new Set<string>();
  readSourceFields(watched(structuredClone(EVERY_FIELD), seen), ref);
  glossesOf(watched(structuredClone(EVERY_FIELD), seen));
  assert.deepEqual([...seen].sort(), [...namedPaths(LINE_FIELDS)].sort());
});
