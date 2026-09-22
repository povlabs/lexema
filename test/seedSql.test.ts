import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createGunzip } from "node:zlib";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedSql } from "../src/import/seedSql.js";

const rawLemma = '{ "word":"lemma", "pos":"noun", "pos_title":"Sostantivo", "lang_code":"it", "forms":[{"form":"forma","source":"Appendice:Coniugazioni/Italiano/lemma","tags":["plural"]}], "senses":[{"glosses":["una voce"],"tags":["rare"]}] }';
const rawForm = JSON.stringify({
  word: "forma", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
  tags: ["form-of"], senses: [{ form_of: [{ word: "lemma" }] }],
});
const rawDangling = JSON.stringify({
  word: "orfano", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
  senses: [{ form_of: [{ word: "missing-lemma" }] }],
});

const HUEY_WORDS = [
  "acqua", "albero", "amica", "amico", "andare", "andavano", "avere", "bella", "bello",
  "cane", "casa", "case", "casetta", "città", "dire", "dormire", "essere", "fare",
  "fine", "finire", "gatto", "grande", "librare", "libro", "luna", "mangiare", "mare",
  "parlare", "parlerei", "partire", "ragazza", "ragazzo", "rosso", "sala", "salare", "sale",
  "salire", "scuola", "sole", "strada", "studente", "studentessa", "studenti", "studiare",
  "tavolo", "vado", "vedere", "venire", "vivere", "zaino",
] as const;

type ExpectedRecord = { pos: string; keyCount: number; forms: number };
type FixtureExpectations = { recordsByWord: Record<string, { recordCount: number; records: ExpectedRecord[] }> };
const expectations = JSON.parse(readFileSync(resolve("fixtures/dev-seed-expectations.json"), "utf8")) as FixtureExpectations;
const fixturePath = resolve(process.env.DEV_SEED_FIXTURE ?? "fixtures/dev-seed.jsonl");

async function fixture(lines: readonly string[]) {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  const input = join(dir, "fixture.jsonl");
  const output = join(dir, "seed.sql");
  await writeFile(input, `${lines.join("\n")}\n`);
  return { dir, input, output };
}

function openSeed(sqlPath: string, database: string): DatabaseSync {
  const db = new DatabaseSync(database);
  db.exec(readFileSync(sqlPath, "utf8"));
  return db;
}

test("emits valid SQL with verbatim lines, form source, and all candidates", async () => {
  const { dir, input, output } = await fixture([rawLemma, rawForm, rawDangling]);
  const database = join(dir, "seed.sqlite");
  try {
    const report = await seedSql({
      input, output, schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: ["lemma", "forma", "orfano"], validateFixtureClosure: false,
    });
    assert.equal(report.rows.source_record, 3);
    assert.equal(report.rows.source_record_json, 3);
    assert.equal(report.rows.lookup_form, 4);
    assert.equal(report.rows.form_of_edge, 2);

    const db = openSeed(output, database);
    try {
      const raw = (db.prepare("SELECT raw_json FROM source_record_json WHERE record_id = 1").get() as { raw_json: string }).raw_json;
      assert.equal(raw, rawLemma);
      const source = (db.prepare("SELECT form_source FROM lookup_form WHERE surface = 'forma'").get() as { form_source: string }).form_source;
      assert.equal(source, "Appendice:Coniugazioni/Italiano/lemma");
      const candidates = (db.prepare("SELECT target_word, candidate_record_id FROM form_of_candidate WHERE target_word = 'lemma' ORDER BY candidate_record_id").all() as { target_word: string; candidate_record_id: number }[]).map((row) => ({ ...row }));
      assert.deepEqual(candidates, [{ target_word: "lemma", candidate_record_id: 1 }]);
      assert.equal((db.prepare("SELECT count(*) AS n FROM form_of_candidate WHERE target_word = 'missing-lemma'").get() as { n: number }).n, 0);
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("fixture closure fails with the missing target name", async () => {
  const { dir, input, output } = await fixture([rawDangling]);
  try {
    await assert.rejects(
      seedSql({ input, output, schema: resolve("src/db/schema.sql"), requiredWords: ["orfano"], validateFixtureClosure: true }),
      /missing form_of target word: missing-lemma/,
    );
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("committed fixture matches archive-derived expectations", async () => {
  const fixtureLines = readFileSync(fixturePath, "utf8").trimEnd().split("\n");
  const fixtureWords = new Set<string>();
  const fixtureByWord = new Map<string, Array<{ raw: string; pos: string; keyCount: number; forms: number }>>();
  const allFormOfTargets: string[] = [];
  for (const raw of fixtureLines) {
    const record = JSON.parse(raw) as {
      word: string;
      pos: string;
      forms?: unknown[];
      senses?: Array<{ form_of?: Array<{ word?: unknown }> }>;
    };
    fixtureWords.add(record.word);
    const entries = fixtureByWord.get(record.word) ?? [];
    entries.push({ raw, pos: record.pos, keyCount: Object.keys(record).length, forms: record.forms?.length ?? 0 });
    fixtureByWord.set(record.word, entries);
    for (const sense of record.senses ?? []) {
      for (const edge of sense.form_of ?? []) {
        assert.equal(typeof edge.word, "string", `${record.word}: form_of target must be a word`);
        allFormOfTargets.push(edge.word as string);
      }
    }
  }

  const expectedWords = Object.keys(expectations.recordsByWord);
  assert.deepEqual([...fixtureWords].sort(), [...expectedWords].sort(), "fixture words must match the archive-derived table");
  for (const word of HUEY_WORDS) {
    assert.ok(fixtureWords.has(word), `missing required word: ${word}`);
  }
  for (const target of allFormOfTargets) {
    assert.ok(fixtureWords.has(target), `missing form_of target word: ${target}`);
  }
  for (const [word, expectation] of Object.entries(expectations.recordsByWord)) {
    const actualRecords = fixtureByWord.get(word) ?? [];
    assert.equal(actualRecords.length, expectation.recordCount, `${word}: fixture record count`);
    assert.deepEqual(actualRecords.map(({ pos, keyCount, forms }) => ({ pos, keyCount, forms })), expectation.records,
      `${word}: fixture record shape differs from archive-derived expectation`);
  }

  // The archive is ignored and absent in CI; when present locally, retain the stronger byte check.
  if (!existsSync(resolve("it-extract.jsonl.gz"))) return;
  const archiveByWord = new Map<string, Array<{ raw: string; pos: string; keys: string[]; forms: number }>>();
  const archiveSelectedLines: string[] = [];
  const input = createReadStream(resolve("it-extract.jsonl.gz")).pipe(createGunzip());
  // The archive has records larger than readline's 4 KiB default. Node accepts
  // this option at runtime, but older @types/node releases do not declare it.
  const lines = createInterface({ input, crlfDelay: Infinity, maxLineLength: 1_000_000 } as any);
  for await (const raw of lines) {
    const record = JSON.parse(raw) as { word?: string; lang_code?: string; pos?: string; forms?: unknown[] };
    if (record.lang_code !== "it" || !record.word || !fixtureWords.has(record.word)) continue;
    archiveSelectedLines.push(raw);
    const entries = archiveByWord.get(record.word) ?? [];
    entries.push({ raw, pos: record.pos ?? "", keys: Object.keys(record).sort(), forms: record.forms?.length ?? 0 });
    archiveByWord.set(record.word, entries);
  }

  assert.deepEqual(fixtureLines, archiveSelectedLines, "fixture must be the archive selection in archive order");
  assert.deepEqual([...archiveByWord.keys()].sort(), [...fixtureByWord.keys()].sort());
  for (const word of fixtureWords) {
    const fixtureRecords = fixtureByWord.get(word) ?? [];
    const archiveRecords = archiveByWord.get(word) ?? [];
    assert.equal(fixtureRecords.length, archiveRecords.length, `${word}: fixture record count`);
    const remaining = new Map(archiveRecords.map((record, index) => [index, record]));
    for (const fixtureRecord of fixtureRecords) {
      const archiveEntry = [...remaining.entries()].find(([, candidate]) => candidate.raw === fixtureRecord.raw);
      assert.ok(archiveEntry, `${word}: fixture line is not an archive line`);
      const [index, archiveRecord] = archiveEntry;
      assert.deepEqual(Object.keys(JSON.parse(fixtureRecord.raw)).sort(), archiveRecord.keys, `${word}: archive key set`);
      assert.equal(fixtureRecord.forms, archiveRecord.forms, `${word}: archive form count`);
      assert.equal(fixtureRecord.pos, archiveRecord.pos);
      remaining.delete(index);
    }
    assert.equal(remaining.size, 0, `${word}: archive records omitted from fixture`);
  }
});

test("missing required fixture words and repeated output are deterministic", async () => {
  const { dir, input, output } = await fixture([rawLemma]);
  const output2 = join(dir, "seed-2.sql");
  try {
    await assert.rejects(
      seedSql({ input, output, schema: resolve("src/db/schema.sql"), requiredWords: ["absent"] }),
      /missing required word: absent/,
    );
    await seedSql({ input, output, schema: resolve("src/db/schema.sql"), releaseId: "it-test", requiredWords: ["lemma"] });
    await seedSql({ input, output: output2, schema: resolve("src/db/schema.sql"), releaseId: "it-test", requiredWords: ["lemma"] });
    assert.equal(await readFile(output, "utf8"), await readFile(output2, "utf8"));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a form refused for its surface still reports its own refused leaves", async () => {
  // writeRecord reads every form surface before it reads any form's members
  // (importRelease.ts, "Read once, before either pass over forms[]"). A pass
  // that returned on the refused surface lost the tag's rejection from both
  // the rejection list and the count. This drives the seeder's own path, not
  // the record validator, because writeRecord is where that ordering lives.
  const { dir, input, output } = await fixture([
    JSON.stringify({
      word: "valido", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
      forms: [{ form: 42, tags: [9, "plural"], raw_tags: 8, source: 7 }],
      senses: [{ glosses: ["valido"] }],
    }),
  ]);
  try {
    const rejections: { kind: string; lineNo: number; reason: string }[] = [];
    const report = await seedSql({
      input, output, schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: ["valido"], validateFixtureClosure: false,
      onRejection: (item) => rejections.push(item),
    });
    assert.equal(report.rows.source_record, 1);
    assert.deepEqual(rejections, [
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/form is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/source is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/tags/0 is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/raw_tags is not an array" },
    ]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
