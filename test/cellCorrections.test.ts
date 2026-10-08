// Curated table cells (ADR 0030, #723): `assorbire`'s plural essere cells,
// checked against the archive line they name, written by the seed and by
// `pnpm run correct:records` beside the record, and read back through
// `lookup()` in place of the source's spelling. The record is release
// it-0c432803's line 113784, verbatim, in fixtures/essere-compound-cells.jsonl.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { compoundAuxiliary } from "../src/italian/compoundAuxiliary.js";
import { CURATED_CORRECTIONS, cellCorrections, correctionId, evidenceUrl, type CellCorrection, type CuratedCorrection } from "../src/italian/curatedCorrections.js";
import { planCorrections, unwritten } from "../src/import/correctRecords.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { CORRECTED_RECORD_FORM_SQL, lookup } from "../src/lookup/lookup.js";
import type { SourceForm } from "../src/lookup/types.js";
import type { MasterReader } from "../src/update/master.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";
import { atFixtureLines } from "./correctionFixture.js";

const RELEASE = "it-cells";
const SCHEMA = "src/db/schema.sql";
const LINES = (await readFile("fixtures/essere-compound-cells.jsonl", "utf8")).trimEnd().split("\n");

const [ASSORBIRE] = cellCorrections(CURATED_CORRECTIONS);
const KEYED: CellCorrection[] = atFixtureLines(LINES, RELEASE, [ASSORBIRE]);

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });
const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

/** The fixture seeded with `corrections`. */
async function seeded(corrections: readonly CuratedCorrection[]): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-cells-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${LINES.join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({
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
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    return db;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** assorbire's own forms, as a lookup reads them. */
async function formsOf(db: DatabaseSync): Promise<SourceForm[]> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "assorbire" });
  assert.ok(result.outcome === "found");
  const reading = result.readings.find((candidate) => candidate.word === "assorbire" && candidate.pos === "verb");
  assert.ok(reading !== undefined);
  return reading.forms;
}

test("assorbire's entry names its line, and quotes every cell it sets as the line spells it: all 21 plural essere cells and no other", () => {
  assert.equal(ASSORBIRE.record.releaseId, "it-0c432803");
  assert.equal(ASSORBIRE.record.lineNo, 113784);
  assert.equal(correctionId(ASSORBIRE), "it-0c432803:113784:cells");
  const line = LINES[KEYED[0].record.lineNo - 1];
  const record = JSON.parse(line) as { word: string; pos: string; forms: { form: string; tags?: string[]; raw_tags?: string[] }[] };
  assert.equal(record.word, ASSORBIRE.record.word);
  assert.equal(record.pos, ASSORBIRE.record.pos);
  for (const cell of ASSORBIRE.cells) assert.equal(record.forms[cell.index].form, cell.replaces, `forms/${cell.index}`);
  // The cells the source spells with a repeated word are exactly the plural essere cells, and the entry sets each of them.
  const repeated = record.forms.flatMap((form, index) => (form.form.endsWith("assorti, assorti") ? [index] : []));
  assert.equal(repeated.length, 21);
  assert.deepEqual(ASSORBIRE.cells.map((cell) => cell.index), repeated);
  for (const cell of ASSORBIRE.cells) {
    assert.equal(compoundAuxiliary(cell.surface), "essere", cell.surface);
    assert.match(cell.surface, /^\S+ assorbiti, assorti$/);
  }
  assert.equal(evidenceUrl(ASSORBIRE.evidence[0]), "https://it.wiktionary.org/w/index.php?title=Appendice%3AConiugazioni%2FItaliano%2Fassorbire&oldid=2506943");
});

test("the seed writes one row per cell beside the record, and the lookup reads each in place of the source's spelling", async () => {
  const corrected = await seeded(KEYED);
  const source = await seeded([]);
  try {
    const rows = all(corrected, "SELECT form_index, surface, correction_id, evidence_url FROM corrected_form ORDER BY form_index");
    assert.deepEqual(rows, ASSORBIRE.cells.map((cell) => ({ form_index: cell.index, surface: cell.surface, correction_id: `${RELEASE}:${KEYED[0].record.lineNo}:cells`, evidence_url: evidenceUrl(ASSORBIRE.evidence[0]) })));
    // The record's own rows are as imported.
    for (const table of ["source_record_json", "lookup_form", "grammar_claim"]) {
      assert.deepEqual(all(corrected, `SELECT * FROM ${table} ORDER BY 1, 2`), all(source, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }

    const before = await formsOf(source);
    const after = await formsOf(corrected);
    assert.equal(after.length, before.length);
    const cells = new Map(ASSORBIRE.cells.map((cell) => [cell.index, cell]));
    for (const [i, form] of after.entries()) {
      const cell = cells.get(form.index);
      if (cell === undefined) {
        // Every other cell, the singular essere ones among them, reads as the source spells it.
        assert.deepEqual(form, before[i]);
        continue;
      }
      assert.equal(form.surface, cell.surface);
      assert.deepEqual(form.corrected, { replaces: cell.replaces, correction: { id: `${RELEASE}:${KEYED[0].record.lineNo}:cells`, evidenceUrl: evidenceUrl(ASSORBIRE.evidence[0]) } });
      // The cell still points at the line's own entry.
      assert.deepEqual({ ...form, surface: before[i].surface, corrected: undefined }, { ...before[i], corrected: undefined });
    }
    assert.equal(after.find((form) => form.index === 30)?.surface, "sono assorbito, assorto");
  } finally {
    corrected.close();
    source.close();
  }
});

test("the seed refuses an entry that misquotes a cell of the line it names", async () => {
  const [first, ...rest] = KEYED[0].cells;
  const misquoting: CellCorrection = { ...KEYED[0], cells: [{ ...first, replaces: "siamo assorbiti" }, ...rest] };
  await assert.rejects(seeded([misquoting]), /misquotes the cells at forms 36/);
});

test("the forms read joins each cell's correction by its primary key, in the statement it always sent", async () => {
  const db = await seeded(KEYED);
  try {
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${CORRECTED_RECORD_FORM_SQL}`).all("[1, 2]") as { detail: string }[]).map((row) => row.detail);
    assert.deepEqual(
      plan,
      [
        "SEARCH f USING INDEX lookup_form_by_record (record_id=?)",
        "LIST SUBQUERY 1",
        "SCAN json_each VIRTUAL TABLE INDEX 1:",
        "SEARCH c USING INDEX sqlite_autoindex_corrected_form_1 (record_id=? AND form_index=?) LEFT-JOIN",
      ],
      plan.join("\n"),
    );
  } finally {
    db.close();
  }
});

test("a master seeded before cell corrections gets the rows a seed now writes, once, and a lookup without the table reads the source", async () => {
  const fresh = await seeded(KEYED);
  const before = await seeded([]);
  try {
    before.exec("DROP TABLE corrected_form;");
    // A lookup on it reads no cell correction and fails nothing.
    assert.equal((await formsOf(before)).find((form) => form.index === 36)?.surface, "siamo assorbito, assorti, assorti");

    const reader = readerOf(before);
    const plan = planCorrections(reader, KEYED);
    assert.deepEqual(plan.entries.map((entry) => entry.state), ["write"]);
    assert.deepEqual(plan.counts.toJSON(), { records: { added: 0, changed: 1, removed: 0 }, written: { corrected_form: 21, correction_version: 1 }, deleted: {} });
    assert.throws(() => before.exec(plan.sql), /no such table/);
    before.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    assert.equal(planCorrections(reader, KEYED).sql, plan.sql);
    before.exec(plan.sql);
    assert.deepEqual(unwritten(reader, plan), []);
    assert.deepEqual(all(before, "SELECT * FROM corrected_form ORDER BY form_index"), all(fresh, "SELECT * FROM corrected_form ORDER BY form_index"));
    assert.equal((await formsOf(before)).find((form) => form.index === 36)?.surface, "siamo assorbiti, assorti");

    const again = planCorrections(reader, KEYED);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
    assert.deepEqual(again.entries.map((entry) => entry.state), ["already"]);
  } finally {
    fresh.close();
    before.close();
  }
});
