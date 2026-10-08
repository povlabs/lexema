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
import { PreviewSlice } from "../src/deploy/previewSlice.js";
import { missingForCorrections, planCorrections, unwritten } from "../src/import/correctRecords.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { CORRECTED_CELL_FIRST_SPELLING_SQL, CORRECTED_CELL_SEARCH_SQL, CORRECTED_RECORD_FORM_SQL, exists, lookup } from "../src/lookup/lookup.js";
import type { SourceForm } from "../src/lookup/types.js";
import { planUpgrade, rebuildsOf, upgradeShortfall, type MasterReader } from "../src/update/master.js";
import { createStatement, masterUpgradeSql } from "../src/update/masterUpgrade.js";
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

// --- search reads the corrected spelling (#743) -----------------------------

/** How a lookup of `query` found it: its route, and each reading's word and part of speech with the surface and pointer of every cell it was found by. */
async function foundAs(db: DatabaseSync, query: string): Promise<{ route: string; readings: { word: string; pos: string; evidence: [string, string | undefined][] }[] } | "not-found"> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
  if (result.outcome !== "found") return "not-found";
  return {
    route: result.route.kind,
    readings: result.readings.map((reading) => ({
      word: reading.word,
      pos: reading.pos,
      evidence: reading.evidence.map((occurrence) => [occurrence.surface, "jsonPointer" in occurrence.ref ? occurrence.ref.jsonPointer : undefined]),
    })),
  };
}

/** Each distinct corrected spelling, with the pointers of the cells set to it: `siamo assorbiti, assorti` sets `/forms/36/form` and `/forms/114/form`. */
const SPELLINGS = [...new Set(KEYED.flatMap((correction) => correction.cells.map((cell) => cell.surface)))].map((surface) => ({
  surface,
  pointers: KEYED.flatMap((correction) => correction.cells.filter((cell) => cell.surface === surface).map((cell) => `/forms/${cell.index}/form`)).sort(),
}));

/** The lookup of a corrected spelling: assorbire's verb reading, found by the cells set to it, each as the correction spells it. */
const asCells = (route: string, surface: string, pointers: readonly string[]) => ({
  route,
  readings: [{ word: "assorbire", pos: "verb", evidence: pointers.map((pointer): [string, string] => [surface, pointer]) }],
});

/** `foundAs`, with each reading's evidence in pointer order, so two reads compare whatever order they list it in. */
async function foundSorted(db: DatabaseSync, query: string): ReturnType<typeof foundAs> {
  const found = await foundAs(db, query);
  if (found === "not-found") return found;
  return { ...found, readings: found.readings.map((reading) => ({ ...reading, evidence: [...reading.evidence].sort((a, b) => ((a[1] ?? "") < (b[1] ?? "") ? -1 : 1)) })) };
}

/** `db` with `corrected_form` as #723 created it, before `surface_key` and its index, holding the same rows. */
async function unkeyed(db: DatabaseSync): Promise<void> {
  const rows = all(db, "SELECT record_id, release_id, form_index, surface, correction_id, evidence_url FROM corrected_form") as Record<string, string | number>[];
  db.exec("DROP TABLE corrected_form");
  const stated = createStatement(await readFile(SCHEMA, "utf8"), "TABLE", "corrected_form");
  const before = stated.replace(/^ {2}surface_key .*\n/m, "");
  assert.notEqual(before, stated);
  db.exec(before);
  const insert = db.prepare("INSERT INTO corrected_form (record_id, release_id, form_index, surface, correction_id, evidence_url) VALUES (?, ?, ?, ?, ?, ?)");
  for (const row of rows) insert.run(row.record_id, row.release_id, row.form_index, row.surface, row.correction_id, row.evidence_url);
}

test("every corrected cell's spelling finds assorbire's verb reading, found as that cell: whole, by its first spelling, and as its feminine (#743)", async () => {
  const corrected = await seeded(KEYED);
  const source = await seeded([]);
  try {
    assert.equal(SPELLINGS.length > 1, true);
    for (const { surface, pointers } of SPELLINGS) {
      const [first] = surface.split(", ");
      const feminine = first.replace(/assorbiti$/, "assorbite");
      assert.notEqual(feminine, first);
      // The whole cell, as `SEARCH_SQL`'s exact route reads it.
      assert.deepEqual(await foundSorted(corrected, surface), asCells("surface", surface, pointers), surface);
      // Its first spelling, `siamo assorbiti`, through rule it-essere-agreement/v1's first-spelling range.
      assert.deepEqual(await foundSorted(corrected, first), asCells("first-spelling", surface, pointers), first);
      // Its feminine, `siamo assorbite`, read as that masculine by the same rule.
      assert.deepEqual(await foundSorted(corrected, feminine), asCells("feminine", surface, pointers), feminine);
      for (const query of [surface, first, feminine]) {
        const answer = await exists({ db: fromNodeSqlite(corrected), releaseId: RELEASE, query });
        assert.equal(answer.outcome === "present" ? answer.word : answer.outcome, "assorbire", query);
        // Without the correction, the source spells none of them.
        assert.equal(await foundAs(source, query), "not-found", query);
      }
    }
    assert.deepEqual(await foundSorted(corrected, "siamo assorbiti"), asCells("first-spelling", "siamo assorbiti, assorti", ["/forms/114/form", "/forms/36/form"]));
  } finally {
    corrected.close();
    source.close();
  }
});

test("each cell's source spelling finds what it found without the correction, and the record's imported rows are unchanged (#743)", async () => {
  const corrected = await seeded(KEYED);
  const source = await seeded([]);
  try {
    const replaced = [...new Set(KEYED.flatMap((correction) => correction.cells.map((cell) => cell.replaces)))];
    const firsts = [...new Set(replaced.map((spelling) => spelling.split(", ")[0]))];
    for (const query of [...replaced, ...firsts]) assert.deepEqual(await foundSorted(corrected, query), await foundSorted(source, query), query);
    // The whole source cell still finds assorbire by that cell, as the source spells it.
    assert.deepEqual(
      await foundSorted(corrected, "siamo assorbito, assorti, assorti"),
      asCells("surface", "siamo assorbito, assorti, assorti", ["/forms/114/form", "/forms/36/form"]),
    );
    // Its first spelling, `siamo assorbito`, does not agree with the plural `siamo`, and finds nothing with the correction or without it.
    assert.equal(await foundAs(source, "siamo assorbito"), "not-found");
    assert.equal(await foundAs(corrected, "siamo assorbito"), "not-found");
    for (const table of ["source_record_json", "lookup_form"]) {
      assert.deepEqual(all(corrected, `SELECT * FROM ${table} ORDER BY 1, 2`), all(source, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
  } finally {
    corrected.close();
    source.close();
  }
});

test("a corrected cell spelled as another record's own spelling is a candidate beside that record (#743)", async () => {
  const db = await seeded(KEYED);
  try {
    const plain = await foundAs(db, "accorgersi");
    assert.ok(plain !== "not-found");
    assert.deepEqual(plain.readings.map((reading) => reading.word), ["accorgersi"]);
    // A cell set to that spelling: the source's row and the cell's are both read, and neither hides the other.
    db.exec("UPDATE corrected_form SET surface = 'accorgersi', surface_key = 'accorgersi' WHERE form_index = 36");
    const both = await foundAs(db, "accorgersi");
    assert.ok(both !== "not-found");
    assert.deepEqual(both.route, "surface");
    assert.deepEqual(
      both.readings.map((reading) => [reading.word, reading.evidence]),
      [
        ...plain.readings.map((reading) => [reading.word, reading.evidence]),
        ["assorbire", [["accorgersi", "/forms/36/form"]]],
      ],
    );
  } finally {
    db.close();
  }
});

test("a Preview's slice of a corrected cell's spelling holds the record it finds, keyed, from a shared dictionary keyed or not (#743)", async () => {
  const fresh = await seeded(KEYED);
  const older = await seeded(KEYED);
  try {
    await unkeyed(older);
    const schema = await readFile(SCHEMA, "utf8");
    for (const [name, shared] of [["keyed", fresh], ["unkeyed", older]] as const) {
      const slice = PreviewSlice.build({ reader: readerOf(shared), words: ["Siamo assorbiti, assorti"], schema, changes: [], fingerprint: name });
      try {
        assert.deepEqual(all(slice.db, "SELECT * FROM corrected_form ORDER BY form_index"), all(fresh, "SELECT * FROM corrected_form ORDER BY form_index"), name);
        assert.deepEqual(await foundSorted(slice.db, "siamo assorbiti, assorti"), asCells("surface", "siamo assorbiti, assorti", ["/forms/114/form", "/forms/36/form"]), name);
      } finally {
        slice.close();
      }
    }
  } finally {
    fresh.close();
    older.close();
  }
});

test("the corrected-cell search reads corrected_form_by_key, exact and by range, never a scan (#743)", async () => {
  const db = await seeded(KEYED);
  try {
    const planOf = (sql: string, ...params: string[]): string[] =>
      (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
    const exact = planOf(CORRECTED_CELL_SEARCH_SQL, RELEASE, "siamo assorbiti, assorti");
    const range = planOf(CORRECTED_CELL_FIRST_SPELLING_SQL, RELEASE, "siamo assorbiti, ", "siamo assorbiti,!");
    assert.equal(exact[0], "SEARCH c USING INDEX corrected_form_by_key (release_id=? AND surface_key=?)", exact.join("\n"));
    assert.equal(range[0], "SEARCH c USING INDEX corrected_form_by_key (release_id=? AND surface_key>? AND surface_key<?)", range.join("\n"));
    for (const plan of [exact, range]) {
      assert.ok(!plan.some((step) => /SCAN (corrected_form|lookup_form|source_record|grammar_claim|c|lf|r|g)\b/.test(step)), plan.join("\n"));
      assert.ok(plan.includes("SEARCH lf USING INDEX lookup_form_by_record (record_id=?)"), plan.join("\n"));
      assert.ok(plan.some((step) => step.includes("grammar_claim_by_record")), plan.join("\n"));
    }
  } finally {
    db.close();
  }
});

test("a master whose corrected_form predates the key still serves, and update:upgrade keys every row it holds (#743)", async () => {
  const fresh = await seeded(KEYED);
  const before = await seeded(KEYED);
  try {
    await unkeyed(before);
    const reader = readerOf(before);
    // It serves: the table shows the corrected cells, and search reads the source's spellings alone.
    assert.equal((await formsOf(before)).find((form) => form.index === 36)?.surface, "siamo assorbiti, assorti");
    assert.equal(await foundAs(before, "siamo assorbiti"), "not-found");
    assert.equal(await foundAs(before, "siamo assorbiti, assorti"), "not-found");
    assert.deepEqual(await foundSorted(before, "siamo assorbito, assorti, assorti"), await foundSorted(fresh, "siamo assorbito, assorti, assorti"));
    // `correct:records` waits for the upgrade, and plans the same before it as after.
    assert.deepEqual(missingForCorrections(reader), ["corrected_form"]);
    assert.deepEqual(planCorrections(reader, KEYED).entries.map((entry) => entry.state), ["already"]);

    const schema = await readFile(SCHEMA, "utf8");
    const upgrade = planUpgrade(reader, schema);
    assert.deepEqual(upgrade.missing, ["corrected_form_by_key"]);
    assert.deepEqual(upgrade.changed, ["corrected_form"]);
    assert.deepEqual(rebuildsOf(upgrade), [{ table: "corrected_form", rows: 21 }]);
    before.exec(upgrade.sql);
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), []);
    assert.deepEqual(all(before, "SELECT * FROM corrected_form ORDER BY form_index"), all(fresh, "SELECT * FROM corrected_form ORDER BY form_index"));
    assert.deepEqual(missingForCorrections(reader), []);
    assert.deepEqual(planCorrections(reader, KEYED).entries.map((entry) => entry.state), ["already"]);
    for (const query of ["siamo assorbiti", "siamo assorbite", "siamo assorbiti, assorti"]) {
      assert.deepEqual(await foundSorted(before, query), await foundSorted(fresh, query), query);
    }
    assert.equal(planUpgrade(reader, schema).sql, "");
  } finally {
    fresh.close();
    before.close();
  }
});
