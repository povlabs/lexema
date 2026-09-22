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

test("committed fixture lines are complete archive records", { skip: !existsSync(resolve("it-extract.jsonl.gz")) }, async () => {
  const fixtureLines = readFileSync(resolve("fixtures/dev-seed.jsonl"), "utf8").trimEnd().split("\n");
  const fixtureWords = new Set<string>();
  const fixtureByWord = new Map<string, Array<{ raw: string; pos: string; posTitle: string; keys: string[]; forms: number }>>();
  for (const raw of fixtureLines) {
    const record = JSON.parse(raw) as { word: string; pos: string; pos_title: string; forms?: unknown[] };
    fixtureWords.add(record.word);
    const entries = fixtureByWord.get(record.word) ?? [];
    entries.push({ raw, pos: record.pos, posTitle: record.pos_title, keys: Object.keys(record).sort(), forms: record.forms?.length ?? 0 });
    fixtureByWord.set(record.word, entries);
  }

  const archiveByWord = new Map<string, Array<{ raw: string; pos: string; posTitle: string; keys: string[]; forms: number }>>();
  const archiveSelectedLines: string[] = [];
  const input = createReadStream(resolve("it-extract.jsonl.gz")).pipe(createGunzip());
  // The archive has records larger than readline's 4 KiB default. Node accepts
  // this option at runtime, but older @types/node releases do not declare it.
  const lines = createInterface({ input, crlfDelay: Infinity, maxLineLength: 1_000_000 } as any);
  for await (const raw of lines) {
    const record = JSON.parse(raw) as { word?: string; lang_code?: string; pos?: string; pos_title?: string; forms?: unknown[] };
    if (record.lang_code !== "it" || !record.word || !fixtureWords.has(record.word)) continue;
    archiveSelectedLines.push(raw);
    const entries = archiveByWord.get(record.word) ?? [];
    entries.push({ raw, pos: record.pos ?? "", posTitle: record.pos_title ?? "", keys: Object.keys(record).sort(), forms: record.forms?.length ?? 0 });
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
      assert.deepEqual(fixtureRecord.keys, archiveRecord.keys, `${word}: archive key set`);
      assert.equal(fixtureRecord.forms, archiveRecord.forms, `${word}: archive form count`);
      assert.equal(fixtureRecord.pos, archiveRecord.pos);
      assert.equal(fixtureRecord.posTitle, archiveRecord.posTitle);
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
