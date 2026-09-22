import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
  parseArchive,
  validateArchiveRecord,
  type ArchiveRecord,
  type Rejection,
} from "../src/import/importRelease.js";

const italian = (word: string) => JSON.stringify({ word, pos: "noun", pos_title: "Sostantivo", lang_code: "it" });
const LINES = [
  italian("casa"),
  JSON.stringify({ word: "house", pos: "noun", pos_title: "Noun", lang_code: "en" }),
  JSON.stringify({
    word: "studenti", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    forms: [{ form: "studentessa", tags: ["plural"] }],
    senses: [{ glosses: ["plurale di studente"], form_of: [{ word: "studente" }] }],
  }),
  "{ this is not json",
  "",
  "   ",
];

async function fixture(lines: readonly string[] = LINES) {
  const dir = await mkdtemp(join(tmpdir(), "lexema-parser-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(`${lines.join("\n")}\n`));
  return { dir, archive };
}

async function parse(archive: string, lines: ArchiveRecord[] = [], options: { limit?: number } = {}) {
  const rejections: Rejection[] = [];
  const report = await parseArchive({
    input: archive,
    onRejection: (item) => rejections.push(item),
    onRecord: (record, reportMember) => {
      validateArchiveRecord(record.record, reportMember);
      lines.push(record);
    },
    ...options,
  });
  return { report, rejections, lines };
}

test("parses only Italian records and locates every rejected line", async () => {
  const { dir, archive } = await fixture();
  try {
    const result = await parse(archive);
    assert.equal(result.report.linesRead, LINES.length);
    assert.equal(result.report.admitted, 2);
    assert.equal(result.report.skippedOtherLanguage, 1);
    assert.equal(result.report.malformed, 3);
    assert.deepEqual(result.rejections, [
      { kind: "other-language", lineNo: 2, reason: 'lang_code is "en"' },
      { kind: "malformed", lineNo: 4, reason: "not valid JSON" },
      { kind: "malformed", lineNo: 5, reason: "blank line" },
      { kind: "malformed", lineNo: 6, reason: "blank line" },
    ]);
    assert.equal(result.lines[1].record.word, "studenti");
    assert.equal(result.lines[1].record.senses[0].form_of[0].word, "studente");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("locates every rejection even when the archive has hundreds", async () => {
  const lines = Array.from({ length: 300 }, (_, index) => JSON.stringify({
    word: "x", pos: "noun", pos_title: "Sostantivo", lang_code: `l${index}`,
  }));
  const { dir, archive } = await fixture([...lines, italian("casa")]);
  try {
    const result = await parse(archive);
    assert.equal(result.report.admitted, 1);
    assert.equal(result.report.skippedOtherLanguage, 300);
    assert.deepEqual(
      result.rejections.map((item) => [item.lineNo, item.reason]),
      lines.map((_, index) => [index + 1, `lang_code is "l${index}"`]),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects malformed nested objects as whole lines and continues", async () => {
  const lines = [
    JSON.stringify({ word: "a", pos: "noun", pos_title: "Sostantivo", lang_code: "it", forms: [null] }),
    JSON.stringify({ word: "b", pos: "noun", pos_title: "Sostantivo", lang_code: "it", senses: [null] }),
    JSON.stringify({ word: "c", pos: "noun", pos_title: "Sostantivo", lang_code: "it", senses: [{ form_of: ["d"] }] }),
    JSON.stringify({ word: "d", pos: "noun", pos_title: "Sostantivo", lang_code: "it", forms: {} }),
    JSON.stringify({ word: "e", pos: 7, pos_title: "Sostantivo", lang_code: "it" }),
    italian("after"),
  ];
  const { dir, archive } = await fixture(lines);
  try {
    const result = await parse(archive);
    assert.equal(result.report.admitted, 1);
    assert.equal(result.report.malformed, 5);
    assert.deepEqual(result.rejections, [
      { kind: "malformed", lineNo: 1, reason: "/forms/0 is not an object" },
      { kind: "malformed", lineNo: 2, reason: "/senses/0 is not an object" },
      { kind: "malformed", lineNo: 3, reason: "/senses/0/form_of/0 is not an object" },
      { kind: "malformed", lineNo: 4, reason: "/forms is not an array" },
      { kind: "malformed", lineNo: 5, reason: "word, pos and pos_title must be strings" },
    ]);
    assert.equal(result.lines[0].record.word, "after");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reports malformed nested leaves without dropping the admitted record", async () => {
  const lines = [JSON.stringify({
    word: "valido", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: [7, "masculine"], forms: [{ form: 42, tags: ["plural"] }],
    senses: [{ glosses: [42, "valido"], form_of: [{ word: 9 }] }],
  })];
  const { dir, archive } = await fixture(lines);
  try {
    const result = await parse(archive);
    assert.equal(result.report.admitted, 1);
    assert.equal(result.report.malformedMembers, 4);
    assert.deepEqual(result.rejections, [
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/form is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/tags/0 is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/senses/0/glosses/0 is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/senses/0/form_of/0/word is not a string" },
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preserves source checksums and detects an archive changed during parsing", async () => {
  const { dir, archive } = await fixture([italian("casa")]);
  try {
    const result = await parse(archive);
    const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(archive));
    assert.equal(result.report.archiveSha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(result.report.archiveBytes, bytes.byteLength);

    const changed = await fixture([italian("casa")]);
    const errors: unknown[] = [];
    try {
      await parseArchive({
        input: changed.archive,
        onRejection: () => {},
        onRecord: async () => { await writeFile(changed.archive, gzipSync(`${italian("altro")}\n`)); },
      });
    } catch (error) { errors.push(error); }
    assert.match(String(errors[0]), /changed while it was being imported/);
    await rm(changed.dir, { recursive: true, force: true });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a limit is reported as partial and still emits records through the limit", async () => {
  const { dir, archive } = await fixture([italian("uno"), italian("due")]);
  try {
    const result = await parse(archive, [], { limit: 1 });
    assert.equal(result.report.status, "partial");
    assert.equal(result.report.admitted, 1);
    assert.equal(result.report.linesRead, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
