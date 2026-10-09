// The fields the release diff compares (#369): `READ_FIELDS` in
// src/update/content.ts must name exactly what Lexema reads off a record. Every
// reader of a record runs here over a record that watches which fields it is
// asked for, so a reader that starts using a field the list leaves out fails
// this file until the list names it.

import assert from "node:assert/strict";
import test from "node:test";
import { italianRecordOf, writeRecord, type ArchiveRecord } from "../src/import/importRelease.js";
import { addLemmaRecord } from "../src/import/seedSql.js";
import { recordGlosses } from "../src/italian/recovery.js";
import { readSourceFields } from "../src/lookup/sourceRecord.js";
import type { SourceRef } from "../src/lookup/types.js";
import { RecordMatch, type FeedRecord, type MasterRecord } from "../src/update/changes.js";
import { changedFields, contentSha256, readFieldPaths } from "../src/update/content.js";
import { selectChanged, selectNew } from "../src/update/selection.js";

/**
 * `value`, answering every read as itself while adding the path of each field
 * asked for to `seen`: `senses[].form_of[].word`. A reader that lists an
 * object's keys reads all of them, which is `<path>.*`.
 */
function watched<T>(value: T, seen: Set<string>, path = ""): T {
  if (typeof value !== "object" || value === null) return value;
  const fieldAt = (key: string) => (path === "" ? key : `${path}.${key}`);
  return new Proxy(value, {
    get(target, key, receiver) {
      const member: unknown = Reflect.get(target, key, receiver);
      if (typeof key !== "string") return member;
      if (Array.isArray(target)) return /^\d+$/.test(key) ? watched(member, seen, `${path}[]`) : member;
      seen.add(fieldAt(key));
      return watched(member, seen, fieldAt(key));
    },
    has(target, key) {
      if (typeof key === "string" && !Array.isArray(target)) seen.add(fieldAt(key));
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      if (!Array.isArray(target)) seen.add(fieldAt("*"));
      return Reflect.ownKeys(target);
    },
  });
}

const parsed = (fields: Record<string, unknown>): ArchiveRecord["record"] => {
  const record = italianRecordOf(JSON.stringify({ lang_code: "it", ...fields }));
  assert.ok(record !== undefined);
  return record;
};

// A lemma with every field a reader of it asks for, beside fields none does.
const LEMMA = {
  word: "casa",
  pos: "noun",
  pos_title: "Sostantivo",
  tags: ["feminine", "singular"],
  raw_tags: ["colloquiale"],
  forms: [{ form: "case", tags: ["feminine", "plural"], raw_tags: ["pl."], source: "declension", head_nr: 1 }],
  senses: [
    {
      glosses: ["edificio adibito ad abitazione"],
      tags: ["countable"],
      raw_tags: ["architettura"],
      examples: [{ text: "una casa grande", ref: "Autore" }],
      links: [["edificio", "edificio"]],
      senseid: "casa-1",
    },
  ],
  sounds: [{ ipa: "/ˈkasa/", sense: "italiano standard", audio: "casa.ogg" }],
  hyphenations: [{ parts: ["cà", "sa"] }],
  etymology_texts: ["dal latino casa"],
  etymology_links: [["latino", "casa"]],
  synonyms: [{ word: "abitazione", raw_tags: ["formale"], sense: "edificio" }],
  antonyms: [{ word: "strada" }],
  derived: [{ word: "casetta" }],
  proverbs: [{ word: "casa dolce casa", sense: "si sta bene a casa" }],
  translations: [{ lang_code: "en", lang: "inglese", word: "house", sense: "edificio", tags: ["countable"] }],
  categories: ["Sostantivi italiani"],
  head_templates: [{ name: "it-noun" }],
};

// A form-of record: the readers that skip a lemma's fields read its target.
const FORM_OF = {
  word: "case",
  pos: "noun",
  pos_title: "Sostantivo, forma flessa",
  senses: [{ glosses: ["plurale di casa"], tags: ["form-of"], form_of: [{ word: "casa", extra: "x" }] }],
};

const ref = (jsonPointer: string): SourceRef => ({ releaseId: "it-test", lineNo: 1, jsonPointer, lineSha256: "0".repeat(64) });

/** Every field a reader of a record asks for, over the two records above. */
function fieldsRead(): Set<string> {
  const seen = new Set<string>();
  const statement = { run: () => undefined };
  const statements = Object.fromEntries(
    ["insertRelease", "finishRelease", "insertTableRows", "insertRecord", "insertJson", "insertLookup", "insertEdge", "insertSense", "insertGloss", "insertLabel", "insertClaim"].map((name) => [name, statement]),
  ) as unknown as Parameters<typeof writeRecord>[0];
  for (const fields of [LEMMA, FORM_OF]) {
    const record = watched(parsed(fields), seen);
    const line = JSON.stringify(fields);
    // The importer, as the seed and an apply write a record.
    writeRecord(statements, new Proxy({}, { get: () => 0, set: () => true }), {
      recordId: 1, releaseId: "it-test", lineNo: 1, line, record,
      word: record.word, pos: record.pos, posTitle: record.pos_title,
      reportMember: () => {}, hidden: false,
    });
    // The seed's suggestion ranking, and an apply's.
    addLemmaRecord(new Map(), record);
    // The selection rule, over a new record and a changed one.
    selectNew({ record, italian: true }, () => "italian");
    selectChanged({ before: record, after: watched(parsed(fields), seen), beforeHidden: false, italian: true });
    // A lookup: the archive line's own fields, and a replaced record's glosses.
    readSourceFields(watched(JSON.parse(line), seen), ref);
    recordGlosses(record.senses);
  }
  return seen;
}

// The admission test reads `lang_code` off the parsed line, before any record exists.
const ADMISSION = ["lang_code"];

const isUnder = (path: string, field: string): boolean => path === field || path.startsWith(`${field}.`) || path.startsWith(`${field}[]`);

test("every field a reader of a record asks for is one READ_FIELDS names", () => {
  const listed = readFieldPaths();
  const unlisted = [...fieldsRead()].filter((path) => !listed.some((field) => isUnder(path, field) || isUnder(field, path)));
  assert.deepEqual(unlisted, [], "a reader asks for a field READ_FIELDS leaves out: add it, or the diff calls a change to it no change");
});

test("every field READ_FIELDS names is one a reader asks for", () => {
  const seen = fieldsRead();
  const unread = readFieldPaths().filter((field) => !ADMISSION.includes(field) && !seen.has(field));
  assert.deepEqual(unread, [], "READ_FIELDS names a field no reader asks for: take it out");
});

/** `fields` with the value at `path` replaced, the first item standing for every item of a list. */
function changedAt(fields: Record<string, unknown>, path: string): Record<string, unknown> {
  const copy = structuredClone(fields);
  const steps = path.split(".");
  let at: Record<string, unknown> = copy;
  for (const step of steps.slice(0, -1)) {
    const list = step.endsWith("[]") ? (at[step.slice(0, -2)] as Record<string, unknown>[]) : undefined;
    at = list === undefined ? (at[step] as Record<string, unknown>) : list[0];
  }
  at[steps[steps.length - 1]] = ["changed"];
  return copy;
}

// One record holding every read field, a form-of target included.
const EVERY_FIELD = { lang_code: "it", ...LEMMA, senses: [{ ...LEMMA.senses[0], form_of: [{ word: "dimora" }] }] };

test("a change to any read field changes a record's content, and a change to any other field does not", () => {
  const before = contentSha256(JSON.stringify(EVERY_FIELD));
  for (const path of readFieldPaths()) {
    assert.notEqual(contentSha256(JSON.stringify(changedAt(EVERY_FIELD, path))), before, path);
  }
  for (const path of ["etymology_links", "categories", "head_templates", "senses[].links", "senses[].senseid", "senses[].examples[].ref", "forms[].head_nr", "sounds[].audio", "synonyms[].sense", "translations[].tags", "senses[].form_of[].extra"]) {
    assert.equal(contentSha256(JSON.stringify(changedAt(EVERY_FIELD, path))), before, path);
  }
  // A field added to the record, as the September build added `etymology_links`.
  assert.equal(contentSha256(JSON.stringify({ ...EVERY_FIELD, wikipedia: ["Casa"] })), before);
  // A list keeps every item, read field or none: a reader counts them.
  assert.notEqual(contentSha256(JSON.stringify({ ...EVERY_FIELD, derived: [...LEMMA.derived, { tags: ["x"] }] })), before);
  // A value not shaped as a reader expects is compared as it is.
  assert.notEqual(contentSha256(JSON.stringify({ ...EVERY_FIELD, forms: "case" })), before);
});

test("the fields that differ are read fields only", () => {
  const before = JSON.stringify(EVERY_FIELD);
  const after = JSON.stringify({ ...EVERY_FIELD, etymology_links: [], translations: [{ lang_code: "fr", word: "maison" }] });
  assert.deepEqual(changedFields(before, after), ["translations"]);
});

// Two `sale` nouns on each side, each later line gaining a field no reader
// asks for, one of them a fixed gloss too: the September build's shape (#369).
const SALE_SALT = { lang_code: "it", word: "sale", pos: "noun", pos_title: "Sostantivo", senses: [{ glosses: ["cloruro di sodio"] }] };
const SALE_PLURAL = {
  lang_code: "it", word: "sale", pos: "noun", pos_title: "Sostantivo, forma flessa",
  senses: [{ glosses: ["plurale di sala"], tags: ["form-of"], form_of: [{ word: "sala" }] }],
};

const masterOf = (fields: object, recordId: number): { record: MasterRecord; line: string } => {
  const line = JSON.stringify(fields);
  return { line, record: { recordId, releaseId: "it-master", lineNo: recordId, word: "sale", pos: "noun", lineSha256: `m${recordId}` } };
};
const feedOf = (fields: object, lineNo: number): FeedRecord => {
  const line = JSON.stringify(fields);
  return { lineNo, word: "sale", pos: "noun", lineSha256: `f${lineNo}`, contentSha256: contentSha256(line) };
};

test("a group whose records differ only in fields no reader asks for pairs, so its one real fix is a change", () => {
  const masters = [masterOf(SALE_SALT, 1), masterOf(SALE_PLURAL, 2)];
  const later = [
    feedOf({ ...SALE_PLURAL, etymology_links: [] }, 10),
    feedOf({ ...SALE_SALT, etymology_links: [["latino", "sal"]], senses: [{ glosses: ["cloruro di sodio, usato in cucina"] }] }, 11),
  ];
  const match = RecordMatch.of(masters.map(({ record }) => record), later);
  const diff = match.diff(new Map(masters.map(({ record, line }) => [record.recordId, contentSha256(line)])));
  assert.deepEqual(diff.ambiguous, []);
  assert.equal(diff.unchanged, 1);
  assert.deepEqual(diff.changes.map((change) => [change.kind, change.kind === "changed" ? [change.master.recordId, change.feed.lineNo] : []]), [["changed", [1, 11]]]);
});

test("a group whose records each change a read field stays ambiguous", () => {
  const masters = [masterOf(SALE_SALT, 1), masterOf(SALE_PLURAL, 2)];
  const later = [
    feedOf({ ...SALE_PLURAL, senses: [{ ...SALE_PLURAL.senses[0], tags: ["form-of", "plural"] }] }, 10),
    feedOf({ ...SALE_SALT, senses: [{ glosses: ["cloruro di sodio"], tags: ["uncountable"] }] }, 11),
  ];
  const match = RecordMatch.of(masters.map(({ record }) => record), later);
  const diff = match.diff(new Map(masters.map(({ record, line }) => [record.recordId, contentSha256(line)])));
  assert.equal(diff.ambiguous.length, 1);
  assert.deepEqual(diff.changes, []);
});
