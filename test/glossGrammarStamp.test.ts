import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readGlossGrammarStamp, STAMPED_GLOSS_GLOBS } from "../src/italian/glossGrammarStamp.js";
import { GlossStampLift } from "../src/import/grammarPolicy.js";
import { glossStampLiftOf, italianRecordOf, stampedGlossRows } from "../src/import/importRelease.js";
import { liftStoredGlossStamps } from "../src/import/glossStampUpdate.js";
import type { DictionarySql } from "../src/import/normalizeGlosses.js";
import { seedSql } from "../src/import/seedSql.js";

// The 15 records of release it-0c432803 whose gloss ends in stamp-like letters
// (reports/2026-10-01-gender-stamp-in-glosses.md), cut down to their word, pos,
// record tags and the senses up to the gloss in question, glosses as written.
const RELEASE_LINES = readFileSync("fixtures/gloss-stamps.jsonl", "utf8").trimEnd().split("\n");

// The 9 glosses the rule changes: what is stored, and the claims it states.
const CHANGED = [
  { word: "casa", pointer: "/senses/0/glosses/0", stored: "casa ( approfondimento)", stamp: "f sing", gender: "feminine", number: "singular" },
  { word: "asciugatoio", pointer: "/senses/0/glosses/0", stored: "asciugatoio", stamp: "m", gender: "masculine" },
  { word: "presina", pointer: "/senses/0/glosses/0", stored: "presina", stamp: "f", gender: "feminine" },
  { word: "pianoforte", pointer: "/senses/0/glosses/0", stored: "pianoforte ( approfondimento)", stamp: "m sing", gender: "masculine", number: "singular" },
  { word: "manuale", pointer: "/senses/0/glosses/0", stored: "manuale ( approfondimento)", stamp: "m sing", gender: "masculine", number: "singular" },
  { word: "manuale", pointer: "/senses/1/glosses/0", stored: "manuale ( approfondimento)", stamp: "m sing", gender: "masculine", number: "singular" },
  { word: "pescante", pointer: "/senses/0/glosses/0", stored: "definizione mancante; se vuoi, aggiungila tu", stamp: "m sing", gender: "masculine", number: "singular" },
  { word: "Pettinatore", pointer: "/senses/0/glosses/0", stored: undefined, stamp: "m sing", gender: "masculine", number: "singular" },
  { word: "lap steel guitar", pointer: "/senses/0/glosses/0", stored: "lap steel guitar ( approfondimento)", stamp: "f sing", gender: "feminine", number: "singular" },
] as const;

// The 7 glosses that end in stamp-like letters and are not stamps.
const LEFT_ALONE = ["qualcuno", "potenza", "fluoro", "effe", "emme", "ottobasso", "chilogrammetro"];

const recordOf = (line: string) => {
  const record = italianRecordOf(line);
  assert.ok(record);
  return record;
};

test("the rule changes exactly the 9 release glosses, and leaves the 7 lookalikes alone", () => {
  const changed = RELEASE_LINES.map(recordOf).flatMap((record) => {
    const lift = glossStampLiftOf(record);
    const claims = lift.claims();
    return stampedGlossRows(lift, record.word).map(({ pointer, stored }) => {
      const at = claims.filter((claim) => claim.pointer === pointer);
      return {
        word: record.word, pointer, stored,
        stamp: at[0].sourceText,
        gender: at.find((claim) => claim.dimension === "gender")?.value,
        ...(at.some((claim) => claim.dimension === "number")
          ? { number: at.find((claim) => claim.dimension === "number")?.value }
          : {}),
      };
    });
  });
  const sortKey = (row: { word: string; pointer: string }) => `${row.word}${row.pointer}`;
  assert.deepEqual(
    changed.sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    [...CHANGED].map((row) => ({ ...row })).sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
  );

  const untouched = RELEASE_LINES.map(recordOf).filter((record) => glossStampLiftOf(record).glossCount === 0);
  assert.deepEqual(untouched.map((record) => record.word).sort(), [...LEFT_ALONE].sort());
});

test("the stamp is read off the whole gloss only, after a lead from the closed list", () => {
  assert.deepEqual(readGlossGrammarStamp("casa", "casa ( approfondimento) f sing"), {
    gender: "feminine", number: "singular", sourceText: "f sing", rest: "casa ( approfondimento)",
  });
  assert.deepEqual(readGlossGrammarStamp("case", "case f pl"), {
    gender: "feminine", number: "plural", sourceText: "f pl", rest: "case",
  });
  assert.deepEqual(readGlossGrammarStamp("x", "m"), { gender: "masculine", sourceText: "m", rest: "" });
  for (const [word, gloss] of [
    ["casa", "casa ( approfondimento) n sing"], // no neuter in the rule
    ["casa", "casa ( approfondimento) f inv"],
    ["casa", "casa f sing."],
    ["casa", "casa  f"],
    ["casa", "casetta f"], // another word's lead
    ["casa", "una casa f"],
    ["casa", "casa ( approfondimento) F"],
    ["a.c", "abc f"], // the headword is matched literally, not as a pattern
  ] as const) {
    assert.equal(readGlossGrammarStamp(word, gloss), undefined, gloss);
  }
  assert.equal(readGlossGrammarStamp("a.c", "a.c f")?.gender, "feminine");
});

test("a record with a gender tag, a disagreeing number tag, disagreeing stamps or another pos lifts nothing", () => {
  const lift = (pos: string, tags: string[], glosses: string[]) =>
    GlossStampLift.of({
      word: "casa", pos, tags,
      glosses: glosses.map((text, index) => ({ pointer: `/senses/${index}/glosses/0`, text })),
    }).glossCount;
  assert.equal(lift("noun", [], ["casa f sing"]), 1);
  assert.equal(lift("adj", ["singular"], ["casa f sing"]), 1);
  assert.equal(lift("noun", ["feminine"], ["casa f sing"]), 0);
  assert.equal(lift("noun", ["plural"], ["casa f sing"]), 0);
  assert.equal(lift("noun", [], ["casa f", "casa m"]), 0);
  assert.equal(lift("noun", [], ["casa f sing", "casa f pl"]), 0);
  assert.equal(lift("verb", [], ["casa f sing"]), 0);
  assert.equal(lift("name", [], ["casa f sing"]), 0);
});

test("the update's GLOBs select every gloss the rule reads a stamp from", () => {
  const db = new DatabaseSync(":memory:");
  const glob = db.prepare("SELECT ? GLOB ? AS hit");
  for (const { word, pointer } of CHANGED) {
    const record = recordOf(RELEASE_LINES.find((line) => recordOf(line).word === word) as string);
    const [, sense, , gloss] = pointer.split("/").slice(1);
    const text = (record.senses[Number(sense)].glosses as string[])[Number(gloss)];
    const hits = STAMPED_GLOSS_GLOBS.filter((pattern) => (glob.get(text, pattern) as { hit: number }).hit === 1);
    assert.ok(hits.length > 0, text);
  }
  db.close();
});

async function seeded(): Promise<{ dir: string; db: DatabaseSync }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-stamp-"));
  const input = join(dir, "fixture.jsonl");
  await writeFile(input, `${RELEASE_LINES.join("\n")}\n`);
  const report = await seedSql({
    input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-test",
    requiredWords: [], validateFixtureClosure: false,
  });
  const db = new DatabaseSync(join(dir, "seed.sqlite"));
  for (const part of report.parts) db.exec(readFileSync(part, "utf8"));
  return { dir, db };
}

const glossRows = (db: DatabaseSync) =>
  db.prepare(
    `SELECT r.word, g.json_pointer, g.text FROM sense_gloss g
       JOIN sense s ON s.sense_id = g.sense_id JOIN source_record r ON r.record_id = s.record_id
      ORDER BY r.record_id, g.json_pointer`,
  ).all().map((row) => ({ ...row }));
const recordClaims = (db: DatabaseSync) =>
  db.prepare(
    `SELECT r.word, c.json_pointer, c.status, c.dimension, c.value, c.source_text FROM grammar_claim c
       JOIN source_record r ON r.record_id = c.record_id
      WHERE c.scope = 'record' ORDER BY r.record_id, c.json_pointer, c.dimension`,
  ).all().map((row) => ({ ...row }));
const rawLines = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all() as { raw_json: string }[])
    .map(({ raw_json }) => raw_json);

test("the seed stores the trimmed glosses and the stated claims, and keeps each raw line byte-for-byte", async () => {
  const { dir, db } = await seeded();
  try {
    assert.deepEqual(rawLines(db), RELEASE_LINES);
    const glosses = glossRows(db) as { word: string; json_pointer: string; text: string }[];
    for (const { word, pointer, stored } of CHANGED) {
      const row = glosses.find((gloss) => gloss.word === word && gloss.json_pointer === pointer);
      assert.equal(row?.text, stored, `${word} ${pointer}`);
    }
    for (const line of RELEASE_LINES) {
      const record = recordOf(line);
      if (!LEFT_ALONE.includes(record.word)) continue;
      const stored = glosses.filter((gloss) => gloss.word === record.word).map((gloss) => gloss.text);
      assert.deepEqual(stored, record.senses.flatMap((sense) => sense.glosses as string[]), record.word);
    }

    const claims = recordClaims(db) as { word: string; json_pointer: string; status: string; dimension: string; value: string; source_text: string }[];
    const casa = claims.filter((claim) => claim.word === "casa");
    assert.deepEqual(casa, [
      { word: "casa", json_pointer: "/senses/0/glosses/0", status: "stated", dimension: "gender", value: "feminine", source_text: "f sing" },
      { word: "casa", json_pointer: "/senses/0/glosses/0", status: "stated", dimension: "number", value: "singular", source_text: "f sing" },
    ]);
    // A stamp with no number answers the gender alone; number stays missing.
    assert.deepEqual(
      claims.filter((claim) => claim.word === "presina").map((claim) => `${claim.status} ${claim.dimension}`),
      ["missing number", "stated gender"],
    );
    // The lookalikes keep the claims their tags give, and no stamp claim.
    for (const claim of claims.filter((row) => LEFT_ALONE.includes(row.word))) {
      assert.ok(!claim.json_pointer.includes("/glosses/"), `${claim.word} ${claim.json_pointer}`);
    }
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});

test("the one-off update brings a database seeded before the rule to the seed's rows, once, and reports them", async () => {
  const { dir, db } = await seeded();
  const sql: DictionarySql = {
    query: <Row>(text: string) => db.prepare(text).all() as Row[],
    run: (text: string) => db.exec(text),
  };
  try {
    const expectedGlosses = glossRows(db);
    const expectedClaims = recordClaims(db);

    // As a seed before #317 wrote them: every gloss as written, no stamp
    // claims, and gender (and number) recorded as missing.
    for (const line of RELEASE_LINES) {
      const record = recordOf(line);
      const lift = glossStampLiftOf(record);
      if (lift.glossCount === 0) continue;
      const { record_id: recordId } = db.prepare("SELECT record_id FROM source_record WHERE word = ?").get(record.word) as { record_id: number };
      for (const { pointer } of stampedGlossRows(lift, record.word)) {
        const [, sense, , gloss] = pointer.split("/").slice(1);
        const text = (record.senses[Number(sense)].glosses as string[])[Number(gloss)];
        const senseId = recordId * 1000 + Number(sense);
        db.prepare("DELETE FROM sense_gloss WHERE sense_id = ? AND gloss_index = ?").run(senseId, Number(gloss));
        db.prepare("INSERT INTO sense_gloss (sense_id, gloss_index, text, json_pointer) VALUES (?, ?, ?, ?)")
          .run(senseId, Number(gloss), text, pointer);
      }
      db.prepare("DELETE FROM grammar_claim WHERE record_id = ? AND json_pointer GLOB '/senses/*/glosses/*'").run(recordId);
      for (const dimension of new Set(lift.claims().map((claim) => claim.dimension))) {
        db.prepare("INSERT INTO grammar_claim (record_id, scope, scope_index, json_pointer, status, dimension) VALUES (?, 'record', NULL, '', 'missing', ?)")
          .run(recordId, dimension);
      }
    }
    assert.notDeepEqual(glossRows(db), expectedGlosses);

    // 9 glosses: 8 trimmed, Pettinatore's dropped. 16 stated claims added and
    // 14 missing rows removed. The GLOBs also select ottobasso and
    // chilogrammetro (`… 3,85 m`, `… 1 m`), which the rule then leaves alone.
    assert.deepEqual(liftStoredGlossStamps(sql), {
      rule: "it-gloss-stamp/v1",
      candidates: 10,
      changed: { sense_gloss: 9, grammar_claim: 16 + 14 },
    });
    assert.deepEqual(glossRows(db), expectedGlosses);
    assert.deepEqual(recordClaims(db), expectedClaims);
    assert.deepEqual(rawLines(db), RELEASE_LINES);

    assert.deepEqual(liftStoredGlossStamps(sql), {
      rule: "it-gloss-stamp/v1",
      candidates: 10,
      changed: { sense_gloss: 0, grammar_claim: 0 },
    });
    assert.deepEqual(glossRows(db), expectedGlosses);
    assert.deepEqual(recordClaims(db), expectedClaims);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});
