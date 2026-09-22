import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
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
