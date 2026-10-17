// A noun's or adjective's listed form, set right by a curated correction
// (#830, ADR 0027's 2026-10-17 amendment): `eguale`'s page names
// `equivalenti` its plural, and the entry sets that form to `eguali`. It is
// stored and read as a table cell's, so `eguali` finds eguale as its plural.
//
// fixtures/eguale.jsonl holds verbatim lines of it-0c432803, in archive
// order: 457791 `equivalenti` and 486085 `eguale`, adjectives both.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { FixtureLines } from "../src/italian/correctionsAtLines.js";
import { CURATED_CORRECTIONS, cellCorrections, correctionId, evidenceUrl, type CellCorrection } from "../src/italian/curatedCorrections.js";
import { seedSql } from "../src/import/seedSql.js";
import { lookupBatch } from "../src/lookup/batch.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import type { FoundResult } from "../src/lookup/types.js";
import { touchedWords, wordsOfCorrections } from "../src/deploy/touchedWords.js";
import { planCorrections } from "../src/import/correctRecords.js";
import type { MasterReader } from "../src/update/master.js";

const RELEASE = "it-eguale";
const LINES = (await readFile(new URL("../fixtures/eguale.jsonl", import.meta.url), "utf8")).trimEnd().split("\n");
const RULING = "https://github.com/povlabs/lexema/issues/830#issuecomment-6233334459";

const EGUALE = cellCorrections(CURATED_CORRECTIONS).find((correction) => correction.record.word === "eguale");
const KEYED: CellCorrection[] = FixtureLines.of(LINES, RELEASE).key(EGUALE === undefined ? [] : [EGUALE]).held;

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

async function seeded(corrections: readonly CellCorrection[]): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-eguale-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${LINES.join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: "src/db/schema.sql",
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

test("eguale's entry names its line, quotes the form it sets as the line spells it, and cites its page, en.wiktionary's eguali and the ruling", () => {
  assert.ok(EGUALE !== undefined);
  assert.equal(correctionId(EGUALE), "it-0c432803:486085:cells");
  assert.equal(KEYED.length, 1, "the fixture holds the line the entry names, byte for byte");
  const record = JSON.parse(LINES[KEYED[0].record.lineNo - 1]) as { word: string; pos: string; tags: string[]; forms: { form: string; tags: string[] }[] };
  assert.deepEqual([record.word, record.pos, record.tags], ["eguale", "adj", ["feminine", "masculine", "singular"]]);
  assert.deepEqual(record.forms, [{ form: "equivalenti", tags: ["plural"] }]);
  assert.deepEqual(EGUALE.cells, [{ index: 0, replaces: "equivalenti", surface: "eguali" }]);
  assert.deepEqual(EGUALE.evidence.map(evidenceUrl), [
    "https://it.wiktionary.org/w/index.php?title=eguale&oldid=3907185",
    "https://en.wiktionary.org/w/index.php?title=eguali&oldid=68995164",
  ]);
  assert.equal(EGUALE.ruling, RULING);
});

test("eguali finds eguale as its plural through the corrected form, and the record's own rows stay as imported (#830)", async () => {
  const corrected = await seeded(KEYED);
  const source = await seeded([]);
  try {
    for (const table of ["source_record_json", "lookup_form", "grammar_claim"]) {
      assert.deepEqual(all(corrected, `SELECT * FROM ${table} ORDER BY 1, 2`), all(source, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
    assert.equal((await lookup({ db: fromNodeSqlite(source), releaseId: RELEASE, query: "eguali" })).outcome, "not-found");

    const result = await lookup({ db: fromNodeSqlite(corrected), releaseId: RELEASE, query: "eguali" });
    assert.equal(result.outcome, "found");
    const [reading, ...rest] = (result as FoundResult).readings;
    assert.deepEqual(rest, []);
    assert.deepEqual([reading.word, reading.pos, reading.isAboutQuery], ["eguale", "adj", false]);
    const [plural] = reading.forms;
    assert.equal(plural.surface, "eguali");
    assert.deepEqual(plural.corrected, { replaces: "equivalenti", correction: { id: `${RELEASE}:2:cells`, evidenceUrl: evidenceUrl(EGUALE!.evidence[0]) } });
    assert.deepEqual(plural.claims.flatMap((claim) => (claim.status === "stated" ? [[claim.dimension, claim.value]] : [])), [["number", "plural"]]);

    const { answers } = await lookupBatch({ db: fromNodeSqlite(corrected), releaseId: RELEASE, queries: ["eguali"] });
    const [answer] = answers;
    assert.ok(answer.outcome === "found");
    assert.deepEqual(answer.candidates.map((candidate) => [candidate.word, candidate.pos, candidate.recordId]), [["eguale", "adj", reading.recordId]]);

    // eguale's own page reads the form as corrected.
    const own = await lookup({ db: fromNodeSqlite(corrected), releaseId: RELEASE, query: "eguale" });
    assert.ok(own.outcome === "found");
    assert.deepEqual(own.readings.map((one) => one.forms.map((form) => form.surface)), [["eguali"]]);
  } finally {
    corrected.close();
    source.close();
  }
});

test("a Preview's slice serves eguali and equivalenti beside eguale, the spellings the corrected form gives and retires (#830)", async () => {
  const source = await seeded([]);
  try {
    const reader: MasterReader = { query: <Row>(sql: string) => source.prepare(sql).all() as Row[] };
    assert.deepEqual(wordsOfCorrections(planCorrections(reader, KEYED)), touchedWords(["eguale", "eguali", "equivalenti"]));
  } finally {
    source.close();
  }
});
