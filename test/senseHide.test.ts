// A sense of a record hidden by a curated correction (#857, ADR 0030's
// amendment of 2026-10-17): `gaio`'s adjective sense 0, `Ultima_Sfaccim`,
// which its it.wiktionary page states as `# [[Ultima_Sfaccim]]`, a stray link
// where a definition should be. The record is it-0c432803's archive line 96753
// and the page revision 4057291 as dump itwiktionary-20260701 holds it, both
// verbatim, in fixtures/sense-hide/.

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
  CURATED_CORRECTIONS,
  correctionId,
  evidenceUrl,
  senseHideMisquote,
  senseHides,
  type CuratedCorrection,
  type SenseHide,
} from "../src/italian/curatedCorrections.js";
import { describeEntry, missingForCorrections, planCorrections, unwritten } from "../src/import/correctRecords.js";
import { seedSql, type SeedSqlReport } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { HIDING_SENSE_GLOSS_SQL, HIDING_SENSE_LABEL_SQL, lookup } from "../src/lookup/lookup.js";
import type { Reading } from "../src/lookup/types.js";
import { rawPageSource, readSavedPage, type RawPage } from "../src/source/rawPage.js";
import type { MasterReader } from "../src/update/master.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";
import { atFixtureLines } from "./correctionFixture.js";

const RELEASE = "it-sense-hide";
const SCHEMA = "src/db/schema.sql";

const GAIO_LINE = (await readFile("fixtures/sense-hide/gaio.jsonl", "utf8")).trimEnd();
const PAGE: RawPage = readSavedPage(await readFile("fixtures/sense-hide/gaio.wikitext", "utf8"), "fixtures/sense-hide/gaio.wikitext");

const [GAIO] = senseHides(CURATED_CORRECTIONS);
const KEYED: SenseHide[] = atFixtureLines([GAIO_LINE], RELEASE, [GAIO]);

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });
const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

/** `lines` seeded, with gaio's page, and with `corrections`. */
async function seeded(corrections: readonly CuratedCorrection[], lines: readonly string[] = [GAIO_LINE]): Promise<{ db: DatabaseSync; report: SeedSqlReport }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-sense-hide-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
    const report = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: SCHEMA,
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      rawPages: rawPageSource([PAGE]),
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

/** The adjective reading of gaio, as a lookup reads it. */
async function adjectiveOf(db: DatabaseSync): Promise<Reading> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "gaio" });
  assert.ok(result.outcome === "found");
  const reading = result.readings.find((candidate) => candidate.word === "gaio" && candidate.pos === "adj");
  assert.ok(reading !== undefined);
  return reading;
}

/** The glosses of the reading's senses, in the order the page lists them. */
const glossesOf = (reading: Reading): string[][] => reading.senses.map((sense) => sense.glosses.map((gloss) => gloss.text));

/** The rows a hidden sense leaves as imported: the record, its line, its senses with their glosses and labels, and its page. */
const IMPORTED = ["source_record", "source_record_json", "sense", "sense_gloss", "sense_label", "raw_page"];

test("the entry names gaio's archive line and its sense 0, quotes revision 4057291's line 6, and cites that revision and the ruling", () => {
  assert.equal(senseHides(CURATED_CORRECTIONS).length, 1);
  const { record, hidesSense, evidence } = GAIO;
  assert.deepEqual([record.releaseId, record.lineNo, record.word, record.pos], ["it-0c432803", 96753, "gaio", "adj"]);
  assert.equal(record.lineSha256, createHash("sha256").update(GAIO_LINE, "utf8").digest("hex"));
  assert.deepEqual(hidesSense, { index: 0, gloss: { pointer: "/senses/0/glosses/0", text: "Ultima_Sfaccim" }, line: 6, wikitext: "# [[Ultima_Sfaccim]]" });
  assert.equal(senseHideMisquote(GAIO, GAIO_LINE), undefined);
  assert.deepEqual([evidence.page.wiki, evidence.page.title, evidence.page.revisionId], [PAGE.wiki, PAGE.title, PAGE.revisionId]);
  assert.equal(PAGE.revisionId, 4057291);
  const pageLines = PAGE.wikitext.split("\n");
  assert.equal(pageLines[hidesSense.line - 1], hidesSense.wikitext);
  // The next line is the sense the page then shows first.
  assert.equal(pageLines[hidesSense.line], "# {{Term|araldica|it}} [[allegro]]");
  assert.equal(evidenceUrl(evidence.page), "https://it.wiktionary.org/w/index.php?title=gaio&oldid=4057291");
  assert.equal(evidence.ruling, "https://github.com/povlabs/lexema/issues/857#issuecomment-6237103400");
  assert.equal(correctionId(GAIO), "it-0c432803:96753/senses/0/hidden");
});

test("the seed writes the hide as its own row, keeps every imported row and the line byte for byte, and the lookup shows allegro first", async () => {
  const hidden = await seeded(KEYED);
  const source = await seeded([]);
  try {
    assert.deepEqual(all(hidden.db, "SELECT r.word, h.sense_index, h.json_pointer, h.correction_id, h.evidence_url FROM hidden_sense h JOIN source_record r USING (record_id)"), [
      { word: "gaio", sense_index: 0, json_pointer: "/senses/0/glosses/0", correction_id: `${RELEASE}:1/senses/0/hidden`, evidence_url: evidenceUrl(GAIO.evidence.page) },
    ]);
    assert.deepEqual(hidden.report.corrections, { keyed: 1, applied: 1, unapplied: [] });
    assert.equal(hidden.report.rows.hidden_sense, 1);
    for (const table of IMPORTED) {
      assert.deepEqual(all(hidden.db, `SELECT * FROM ${table} ORDER BY 1, 2`), all(source.db, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
    assert.deepEqual(all(hidden.db, "SELECT raw_json FROM source_record_json"), [{ raw_json: GAIO_LINE }]);

    const before = await adjectiveOf(source.db);
    const after = await adjectiveOf(hidden.db);
    assert.deepEqual(glossesOf(before), [["Ultima_Sfaccim"], ["allegro"]]);
    assert.deepEqual(glossesOf(after), [["allegro"]]);
    // Nothing marks the correction (ADR 0016): the reading is the source's, less that one sense.
    assert.deepEqual(after, { ...before, senses: before.senses.slice(1) });
    assert.doesNotMatch(JSON.stringify(after), /Ultima_Sfaccim|\/hidden|issuecomment/);
  } finally {
    hidden.db.close();
    source.db.close();
  }
});

test("the sense reads probe each sense's hide by its key", async () => {
  const { db } = await seeded(KEYED);
  try {
    for (const sql of [HIDING_SENSE_GLOSS_SQL, HIDING_SENSE_LABEL_SQL]) {
      const plan = (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all("[1]") as { detail: string }[]).map((row) => row.detail);
      assert.ok(plan.includes("SEARCH hs USING COVERING INDEX sqlite_autoindex_hidden_sense_1 (record_id=? AND sense_index=?)"), plan.join("\n"));
      assert.ok(!plan.some((step) => /SCAN (hs|hidden_sense)\b/.test(step)), plan.join("\n"));
    }
  } finally {
    db.close();
  }
});

test("an entry that misquotes its own line is refused, and one that names a sense with an edge is too", async () => {
  const misquoted: [string, SenseHide, string][] = [
    ["another gloss", { ...KEYED[0], hidesSense: { ...KEYED[0].hidesSense, gloss: { ...KEYED[0].hidesSense.gloss, text: "Ultima Sfaccim" } } }, "gloss-differs"],
    ["another pointer", { ...KEYED[0], hidesSense: { ...KEYED[0].hidesSense, gloss: { ...KEYED[0].hidesSense.gloss, pointer: "/senses/1/glosses/0" } } }, "gloss-differs"],
    ["another sense", { ...KEYED[0], hidesSense: { ...KEYED[0].hidesSense, index: 1 } }, "gloss-differs"],
    ["no such sense", { ...KEYED[0], hidesSense: { ...KEYED[0].hidesSense, index: 2 } }, "no-sense"],
  ];
  const source = await seeded([]);
  try {
    source.db.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    for (const [what, hide, reason] of misquoted) {
      assert.equal(senseHideMisquote(hide, GAIO_LINE), reason, what);
      await assert.rejects(seeded([hide]), new RegExp(`misquotes sense ${hide.hidesSense.index} of its own line: ${reason}`), what);
      assert.throws(() => planCorrections(readerOf(source.db), [hide]), new RegExp(`misquotes sense ${hide.hidesSense.index} of its own line: ${reason}`), what);
    }
  } finally {
    source.db.close();
  }
  // A form sense declares an edge: hiding it would leave an edge to a sense no page shows.
  const form = JSON.stringify({ word: "gaia", senses: [{ glosses: ["femminile di gaio"], form_of: [{ word: "gaio" }] }] });
  const onForm: SenseHide = { ...GAIO, hidesSense: { ...GAIO.hidesSense, gloss: { pointer: "/senses/0/glosses/0", text: "femminile di gaio" } } };
  assert.equal(senseHideMisquote(onForm, form), "sense-has-edge");
});

test("a sense whose line a newer release changed is reported by the seed and by correct:records, never hidden (ADR 0025)", async () => {
  // gaio's line as a newer release might state it, the stray link set right: another line, another digest.
  const newer = GAIO_LINE.replace('[{"glosses": ["Ultima_Sfaccim"]}, ', '[{"glosses": ["lieto, allegro"]}, ');
  assert.notEqual(newer, GAIO_LINE);
  const { db, report } = await seeded(KEYED, [newer]);
  try {
    assert.deepEqual(report.corrections, { keyed: 1, applied: 0, unapplied: [{ id: correctionId(KEYED[0]), reason: "line-digest-differs" }] });
    assert.deepEqual(all(db, "SELECT * FROM hidden_sense"), []);
    assert.deepEqual(glossesOf(await adjectiveOf(db)), [["lieto, allegro"], ["allegro"]]);

    db.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    const plan = planCorrections(readerOf(db), KEYED);
    assert.deepEqual(plan.senseHides.map((entry) => entry.state === "not-in-master" && entry.why), ["line-digest-differs"]);
    assert.equal(plan.sql, "");
    assert.match(describeEntry(plan.senseHides[0]), /not written; the record at line 1 is not the line the entry names/);
  } finally {
    db.close();
  }
});

test("a master seeded before hidden senses gets the row a seed now writes, once, through correct:records, and a lookup without the table shows the source", async () => {
  const fresh = await seeded(KEYED);
  const before = await seeded([]);
  try {
    before.db.exec("DROP TABLE hidden_sense;");
    // A lookup on it reads no hide and fails nothing.
    assert.deepEqual(glossesOf(await adjectiveOf(before.db)), [["Ultima_Sfaccim"], ["allegro"]]);

    const reader = readerOf(before.db);
    assert.deepEqual(missingForCorrections(reader), ["hidden_sense"]);
    const plan = planCorrections(reader, KEYED);
    assert.deepEqual(plan.senseHides.map((entry) => entry.state), ["write"]);
    assert.deepEqual(plan.counts.toJSON(), { records: { added: 0, changed: 1, removed: 0 }, written: { hidden_sense: 1, correction_version: 1 }, deleted: {} });
    assert.match(describeEntry(plan.senseHides[0]), /gaio \(record 1\): written$/);
    assert.throws(() => before.db.exec(plan.sql), /no such table/);
    before.db.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    assert.deepEqual(missingForCorrections(reader), []);
    assert.equal(planCorrections(reader, KEYED).sql, plan.sql);
    const imported = IMPORTED.map((table) => all(before.db, `SELECT * FROM ${table} ORDER BY 1, 2`));
    before.db.exec(plan.sql);
    assert.deepEqual(unwritten(reader, plan), []);
    assert.deepEqual(IMPORTED.map((table) => all(before.db, `SELECT * FROM ${table} ORDER BY 1, 2`)), imported);
    assert.deepEqual(all(before.db, "SELECT * FROM hidden_sense"), all(fresh.db, "SELECT * FROM hidden_sense"));
    assert.deepEqual(glossesOf(await adjectiveOf(before.db)), [["allegro"]]);

    const again = planCorrections(reader, KEYED);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
    assert.deepEqual(again.senseHides.map((entry) => entry.state), ["already"]);
  } finally {
    fresh.db.close();
    before.db.close();
  }
});
