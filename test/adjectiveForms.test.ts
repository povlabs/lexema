// An adjective's table of forms set right by a curated correction (#836, ADR
// 0027's amendment of 2026-10-17): `quello`'s adjective record gains `quel`,
// `quell'`, `quei` and `quegli` and loses `quelli`, its pronoun's plural, and
// `bello`'s gains `bel`, `bell'`, `bei` and `begli`. Every record is a verbatim
// archive line of it-0c432803, from fixtures/curated-corrections.jsonl
// (test/correctionFixture.ts lists them).

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
  adjectiveFormsCorrections,
  adjectiveFormsMisquote,
  CURATED_CORRECTIONS,
  correctionId,
  evidenceUrl,
  type AdjectiveFormsCorrection,
} from "../src/italian/curatedCorrections.js";
import { describeEntry, missingForCorrections, planCorrections, unwritten } from "../src/import/correctRecords.js";
import { seedSql, type SeedSqlReport } from "../src/import/seedSql.js";
import { wordsOfCorrections, touchedWords } from "../src/deploy/touchedWords.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { ADJECTIVE_RECORD_FORM_SQL, lookup } from "../src/lookup/lookup.js";
import type { Reading } from "../src/lookup/types.js";
import type { MasterReader } from "../src/update/master.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";
import { atFixtureLines, correctionFixtureLines } from "./correctionFixture.js";

const RELEASE = "it-adjective-forms";
const SCHEMA = "src/db/schema.sql";
const RULING = "https://github.com/povlabs/lexema/issues/836#issuecomment-6237109728";

const LINES = await correctionFixtureLines();
const ENTRIES = adjectiveFormsCorrections(CURATED_CORRECTIONS);
const KEYED: AdjectiveFormsCorrection[] = atFixtureLines(LINES, RELEASE, ENTRIES);

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });
const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));
const entryOf = (word: string): AdjectiveFormsCorrection => {
  const entry = ENTRIES.find((correction) => correction.record.word === word);
  assert.ok(entry !== undefined, word);
  return entry;
};

/** The fixture seeded with `corrections`, or with the line `lines` gives instead. */
async function seeded(corrections: readonly AdjectiveFormsCorrection[], lines: readonly string[] = LINES): Promise<{ db: DatabaseSync; report: SeedSqlReport }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-adjective-forms-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
    const report = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: SCHEMA,
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      corrections,
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    for (const part of report.parts) db.exec(await readFile(part, "utf8"));
    return { db, report };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The reading of `word` of part of speech `pos`, as a lookup reads it. */
async function readingOf(db: DatabaseSync, word: string, pos: string): Promise<Reading> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
  assert.ok(result.outcome === "found", word);
  const reading = result.readings.find((candidate) => candidate.word === word && candidate.pos === pos);
  assert.ok(reading !== undefined, `${word} ${pos}`);
  return reading;
}

/** The rows a correction of an adjective's forms leaves as imported. */
const IMPORTED = ["source_record", "source_record_json", "lookup_form", "grammar_claim"];

test("the entries name quello's and bello's adjective lines, quote quelli where quello's line holds it, and cite en.wiktionary at a revision and the ruling", () => {
  assert.deepEqual(ENTRIES.map((entry) => [entry.record.word, entry.record.lineNo, correctionId(entry)]), [
    ["quello", 33211, "it-0c432803:33211:forms"],
    ["bello", 33645, "it-0c432803:33645:forms"],
  ]);
  assert.equal(KEYED.length, 2, "the fixture holds both lines, byte for byte");
  for (const [i, entry] of ENTRIES.entries()) {
    const line = LINES[KEYED[i].record.lineNo - 1];
    assert.equal(entry.record.lineSha256, createHash("sha256").update(line, "utf8").digest("hex"));
    assert.equal(adjectiveFormsMisquote(entry, line), undefined, entry.record.word);
    assert.equal(entry.ruling, RULING);
    const english = entry.evidence.filter((evidence) => evidence.wiki === "en.wiktionary.org");
    assert.deepEqual(english.map(evidenceUrl), [`https://en.wiktionary.org/w/index.php?title=${entry.record.word}&oldid=${english[0].revisionId}`]);
  }
  const quello = entryOf("quello");
  assert.deepEqual(quello.adjectiveForms.adds?.map((form) => [form.surface, form.gender, form.number]), [
    ["quel", "masculine", "singular"],
    ["quell'", "masculine", "singular"],
    ["quell'", "feminine", "singular"],
    ["quei", "masculine", "plural"],
    ["quegli", "masculine", "plural"],
  ]);
  assert.deepEqual(quello.adjectiveForms.removes, [{ index: 0, removes: "quelli" }]);
  assert.deepEqual(quello.evidence.map(evidenceUrl), [
    "https://en.wiktionary.org/w/index.php?title=quello&oldid=90494248",
    "https://it.wiktionary.org/w/index.php?title=quello&oldid=4042892",
  ]);
  const bello = entryOf("bello");
  assert.deepEqual(bello.adjectiveForms.adds?.map((form) => form.surface), ["bel", "bell'", "bell'", "bei", "begli"]);
  // bello's forms are only added: `belli` stays ("sono belli").
  assert.equal(bello.adjectiveForms.removes, undefined);
  assert.deepEqual(bello.evidence.map(evidenceUrl), ["https://en.wiktionary.org/w/index.php?title=bello&oldid=91582021"]);
});

test("the seed writes one row per added and removed form, and keeps every imported row and each line byte for byte", async () => {
  const corrected = await seeded(KEYED);
  const source = await seeded([]);
  try {
    assert.deepEqual(corrected.report.corrections, { keyed: 2, applied: 2, unapplied: [] });
    assert.equal(corrected.report.rows.corrected_adjective_form, 11);
    assert.deepEqual(
      all(corrected.db, "SELECT r.word, c.row_index, c.form_index, c.surface, c.gender, c.number FROM corrected_adjective_form c JOIN source_record r USING (record_id) WHERE r.word = 'quello' ORDER BY c.row_index"),
      [
        { word: "quello", row_index: 0, form_index: null, surface: "quel", gender: "masculine", number: "singular" },
        { word: "quello", row_index: 1, form_index: null, surface: "quell'", gender: "masculine", number: "singular" },
        { word: "quello", row_index: 2, form_index: null, surface: "quell'", gender: "feminine", number: "singular" },
        { word: "quello", row_index: 3, form_index: null, surface: "quei", gender: "masculine", number: "plural" },
        { word: "quello", row_index: 4, form_index: null, surface: "quegli", gender: "masculine", number: "plural" },
        { word: "quello", row_index: 5, form_index: 0, surface: "quelli", gender: null, number: null },
      ],
    );
    for (const table of IMPORTED) {
      assert.deepEqual(all(corrected.db, `SELECT * FROM ${table} ORDER BY 1, 2`), all(source.db, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
    for (const entry of KEYED) {
      assert.deepEqual(
        all(corrected.db, `SELECT j.raw_json FROM source_record_json j JOIN source_record r USING (record_id) WHERE r.line_no = ${entry.record.lineNo}`),
        [{ raw_json: LINES[entry.record.lineNo - 1] }],
        entry.record.word,
      );
    }
  } finally {
    corrected.db.close();
    source.db.close();
  }
});

test("a lookup reads quello's adjective forms beside the record's own, which stay as the source lists them; its pronoun keeps quelli", async () => {
  const corrected = await seeded(KEYED);
  const source = await seeded([]);
  try {
    const before = await readingOf(source.db, "quello", "adj");
    const after = await readingOf(corrected.db, "quello", "adj");
    assert.equal(before.formCorrection, undefined);
    assert.deepEqual(after.forms, before.forms, "the record's own forms stay as imported");
    assert.deepEqual(after.formCorrection?.added.map((form) => [form.surface, form.gender, form.number]), [
      ["quel", "masculine", "singular"],
      ["quell'", "masculine", "singular"],
      ["quell'", "feminine", "singular"],
      ["quei", "masculine", "plural"],
      ["quegli", "masculine", "plural"],
    ]);
    const correction = { id: `${RELEASE}:${KEYED[0].record.lineNo}:forms`, evidenceUrl: "https://en.wiktionary.org/w/index.php?title=quello&oldid=90494248" };
    assert.deepEqual(after.formCorrection?.removed, [{ index: 0, surface: "quelli", correction }]);
    const { formCorrection: _, ...rest } = after;
    assert.deepEqual(rest, before, "nothing else of the reading moves");

    const pronoun = await readingOf(corrected.db, "quello", "pron");
    assert.equal(pronoun.formCorrection, undefined);
    assert.deepEqual(pronoun.forms.map((form) => form.surface), ["quelli", "quella", "quelle"]);
  } finally {
    corrected.db.close();
    source.db.close();
  }
});

test("the forms read probes the correction's rows by its key, in the statement that reads the record's own forms", async () => {
  const { db } = await seeded(KEYED);
  try {
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${ADJECTIVE_RECORD_FORM_SQL}`).all("[1]") as { detail: string }[]).map((row) => row.detail);
    assert.ok(plan.some((step) => /SEARCH a USING INDEX sqlite_autoindex_corrected_adjective_form_1 \(record_id=\?\)/.test(step)), plan.join("\n"));
    assert.ok(!plan.some((step) => /SCAN (a|corrected_adjective_form)\b/.test(step)), plan.join("\n"));
  } finally {
    db.close();
  }
});

test("an entry that misquotes its own line is refused by the seed and by correct:records", async () => {
  const [quello] = KEYED;
  const line = LINES[quello.record.lineNo - 1];
  const misquoted: [string, AdjectiveFormsCorrection, string][] = [
    ["another removed text", { ...quello, adjectiveForms: { ...quello.adjectiveForms, removes: [{ index: 0, removes: "quella" }] } }, "removed-form-differs"],
    ["no such form", { ...quello, adjectiveForms: { ...quello.adjectiveForms, removes: [{ index: 3, removes: "quelli" }] } }, "removed-form-differs"],
    ["a form the line lists", { ...quello, adjectiveForms: { adds: [{ surface: "quella", gender: "feminine", number: "singular" }] } }, "form-already-listed"],
    [
      "one form twice",
      { ...quello, adjectiveForms: { adds: [{ surface: "quei", gender: "masculine", number: "plural" }, { surface: "quei", gender: "masculine", number: "plural" }] } },
      "form-added-twice",
    ],
  ];
  const source = await seeded([]);
  try {
    source.db.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    for (const [what, entry, reason] of misquoted) {
      assert.equal(adjectiveFormsMisquote(entry, line), reason, what);
      await assert.rejects(seeded([entry]), new RegExp(`misquotes the forms of its own line: ${reason}`), what);
      assert.throws(() => planCorrections(readerOf(source.db), [entry]), new RegExp(`misquotes the forms of its own line: ${reason}`), what);
    }
  } finally {
    source.db.close();
  }
  assert.equal(adjectiveFormsMisquote(quello, LINES.find((one) => one.startsWith('{"word": "quello"') && one.includes('"pos": "pron"')) ?? ""), "not-an-adjective");
});

test("a line a newer release changed is reported by the seed and by correct:records, never corrected (ADR 0025)", async () => {
  const [quello] = KEYED;
  const newer = LINES.map((line, i) => (i === quello.record.lineNo - 1 ? line.replace('{"form": "quelli", "tags": ["masculine", "plural"]}', '{"form": "quei", "tags": ["masculine", "plural"]}') : line));
  assert.notEqual(newer[quello.record.lineNo - 1], LINES[quello.record.lineNo - 1]);
  const { db, report } = await seeded([quello], newer);
  try {
    assert.deepEqual(report.corrections, { keyed: 1, applied: 0, unapplied: [{ id: correctionId(quello), reason: "line-digest-differs" }] });
    assert.deepEqual(all(db, "SELECT * FROM corrected_adjective_form"), []);
    assert.equal((await readingOf(db, "quello", "adj")).formCorrection, undefined);

    db.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    const plan = planCorrections(readerOf(db), [quello]);
    assert.deepEqual(plan.adjectiveForms.map((entry) => entry.state === "not-in-master" && entry.why), ["line-digest-differs"]);
    assert.equal(plan.sql, "");
    assert.match(describeEntry(plan.adjectiveForms[0]), /not written; the record at line \d+ is not the line the entry names/);
  } finally {
    db.close();
  }
});

test("a master seeded before adjective forms gets the rows a seed now writes, once, through correct:records, and a lookup without the table shows the source", async () => {
  const fresh = await seeded(KEYED);
  const before = await seeded([]);
  try {
    before.db.exec("DROP TABLE corrected_adjective_form;");
    // A lookup on it reads no correction and fails nothing.
    assert.equal((await readingOf(before.db, "quello", "adj")).formCorrection, undefined);

    const reader = readerOf(before.db);
    assert.deepEqual(missingForCorrections(reader), ["corrected_adjective_form"]);
    const plan = planCorrections(reader, KEYED);
    assert.deepEqual(plan.adjectiveForms.map((entry) => entry.state), ["write", "write"]);
    assert.deepEqual(plan.counts.toJSON(), { records: { added: 0, changed: 2, removed: 0 }, written: { corrected_adjective_form: 11, correction_version: 1 }, deleted: {} });
    assert.match(describeEntry(plan.adjectiveForms[0]), /quello \(record \d+\): written$/);
    assert.deepEqual(
      wordsOfCorrections(plan),
      touchedWords(["quello", "quel", "quell'", "quei", "quegli", "quelli", "bello", "bel", "bell'", "bei", "begli"]),
    );
    assert.throws(() => before.db.exec(plan.sql), /no such table/);
    before.db.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    assert.deepEqual(missingForCorrections(reader), []);
    assert.equal(planCorrections(reader, KEYED).sql, plan.sql);
    const imported = IMPORTED.map((table) => all(before.db, `SELECT * FROM ${table} ORDER BY 1, 2`));
    before.db.exec(plan.sql);
    assert.deepEqual(unwritten(reader, plan), []);
    assert.deepEqual(IMPORTED.map((table) => all(before.db, `SELECT * FROM ${table} ORDER BY 1, 2`)), imported);
    assert.deepEqual(all(before.db, "SELECT * FROM corrected_adjective_form"), all(fresh.db, "SELECT * FROM corrected_adjective_form"));
    assert.equal((await readingOf(before.db, "quello", "adj")).formCorrection?.added.length, 5);

    const again = planCorrections(reader, KEYED);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
    assert.deepEqual(again.adjectiveForms.map((entry) => entry.state), ["already", "already"]);
  } finally {
    fresh.db.close();
    before.db.close();
  }
});
