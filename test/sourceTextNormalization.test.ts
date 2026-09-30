import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { NORMALIZABLE_GLOSS_GLOB, normalizeGloss } from "../src/italian/sourceTextNormalization.js";
import { type DictionarySql, normalizeStoredGlosses } from "../src/import/normalizeGlosses.js";
import { seedSql } from "../src/import/seedSql.js";

// Glosses as release it-0c432803 has them (#257).
const VADO = "1ª persona singolare del presente semplice indicativo di andare";
const FATE = "2ª persona plurale dell'indicativo presente di fare";
const FARA = "3ª persona singolare dell'indicativo futuro di fare";
const ARRIVAMMO = "voce del verbo arrivare, 1ª coniugazione, modo indicativo, tempo passato remoto, 2ª persona plurale";
const STO = "1ª pers sing presente indicativo di stare";

test("a gloss opening 1ª/2ª/3ª persona opens prima/seconda/terza persona", () => {
  assert.equal(normalizeGloss(VADO), "prima persona singolare del presente semplice indicativo di andare");
  assert.equal(normalizeGloss(FATE), "seconda persona plurale dell'indicativo presente di fare");
  assert.equal(normalizeGloss(FARA), "terza persona singolare dell'indicativo futuro di fare");
});

test("any other gloss is left as written", () => {
  for (const gloss of [
    ARRIVAMMO, // "1ª" and "2ª persona" mid-text
    STO, // opens "1ª" but not "1ª persona"
    "prima persona singolare dell'indicativo presente di fare",
    "4ª persona singolare",
    "1ª personaggio",
    " 1ª persona singolare",
    "1ª Persona singolare",
  ]) {
    assert.equal(normalizeGloss(gloss), gloss, gloss);
  }
});

test("the update's GLOB selects every gloss the rule changes", () => {
  const db = new DatabaseSync(":memory:");
  const glob = db.prepare("SELECT ? GLOB ? AS hit");
  for (const gloss of [VADO, FATE, FARA, "1ª persona", "2ª persona."]) {
    assert.notEqual(normalizeGloss(gloss), gloss);
    assert.equal((glob.get(gloss, NORMALIZABLE_GLOSS_GLOB) as { hit: number }).hit, 1, gloss);
  }
  db.close();
});

const record = (word: string, glosses: string[]): string =>
  JSON.stringify({ word, pos: "verb", pos_title: "Voce verbale", lang_code: "it", tags: ["form-of"], senses: [{ glosses }] });
const LINES = [
  record("vado", [VADO]),
  record("fate", [FATE]),
  record("farà", [FARA]),
  record("arrivammo", [ARRIVAMMO]),
  record("sto", [STO]),
];

async function seeded(): Promise<{ dir: string; db: DatabaseSync }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-normalize-"));
  const input = join(dir, "fixture.jsonl");
  await writeFile(input, `${LINES.join("\n")}\n`);
  const report = await seedSql({
    input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-test",
    requiredWords: [], validateFixtureClosure: false,
  });
  const db = new DatabaseSync(join(dir, "seed.sqlite"));
  for (const part of report.parts) db.exec(readFileSync(part, "utf8"));
  return { dir, db };
}

const glosses = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT text FROM sense_gloss ORDER BY gloss_id").all() as { text: string }[]).map(({ text }) => text);
const rawLines = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all() as { raw_json: string }[]).map(({ raw_json }) => raw_json);
const EXPECTED = [
  "prima persona singolare del presente semplice indicativo di andare",
  "seconda persona plurale dell'indicativo presente di fare",
  "terza persona singolare dell'indicativo futuro di fare",
  ARRIVAMMO,
  STO,
];

test("the seed stores the normalized gloss and keeps the raw line byte-for-byte", async () => {
  const { dir, db } = await seeded();
  try {
    assert.deepEqual(glosses(db), EXPECTED);
    assert.deepEqual(rawLines(db), LINES);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});

test("the one-off update rewrites a database seeded before the rule, once, and reports the rows", async () => {
  const { dir, db } = await seeded();
  const sql: DictionarySql = {
    query: <Row>(text: string) => db.prepare(text).all() as Row[],
    run: (text: string) => db.exec(text),
  };
  try {
    // As a seed before #257 wrote them: the source's wording.
    const update = db.prepare("UPDATE sense_gloss SET text = ? WHERE text = ?");
    for (const [stored, source] of [[EXPECTED[0], VADO], [EXPECTED[1], FATE], [EXPECTED[2], FARA]]) update.run(source, stored);
    assert.deepEqual(glosses(db).slice(0, 3), [VADO, FATE, FARA]);

    assert.deepEqual(normalizeStoredGlosses(sql), { candidates: 3, changed: 3 });
    assert.deepEqual(glosses(db), EXPECTED);
    assert.deepEqual(rawLines(db), LINES);

    assert.deepEqual(normalizeStoredGlosses(sql), { candidates: 0, changed: 0 });
    assert.deepEqual(glosses(db), EXPECTED);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});
