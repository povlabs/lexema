// A recovered definition hidden by a curated correction (#773, ADR 0030's
// amendment of 2026-10-09): `diplomatizzare`'s Verbo line 3,
// `{{Transitivo|it}}hhhhhhhh`, which rule `recovered-prose-line/v1` reads as a
// definition by layout alone. The page is it.wiktionary revision 3978915 as
// dump itwiktionary-20260701 holds it, and the record is it-0c432803's archive
// line 573791, both verbatim, in fixtures/recovered-hide/. The control is
// `urgere`'s recovered line 3, from fixtures/unlisted-definitions/.

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
  hideMismatch,
  recoveredHides,
  type CuratedCorrection,
  type RecoveredDefinitionHide,
} from "../src/italian/curatedCorrections.js";
import { ONLY_RECORD, recordText, recoverDefinitions, type Siblings } from "../src/italian/recovery.js";
import { describeHide, missingForCorrections, planCorrections, unwritten } from "../src/import/correctRecords.js";
import { seedSql, type SeedSqlReport } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { HIDING_RECOVERED_SQL, lookup } from "../src/lookup/lookup.js";
import { everyRecovered, type Reading } from "../src/lookup/types.js";
import { rawPageSource, readSavedPage, type RawPage } from "../src/source/rawPage.js";
import type { MasterReader } from "../src/update/master.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";
import { atFixtureLines } from "./correctionFixture.js";

const RELEASE = "it-recovered-hide";
const SCHEMA = "src/db/schema.sql";

const linesOf = async (file: string): Promise<string[]> => (await readFile(file, "utf8")).trimEnd().split("\n");
const pageOf = async (file: string): Promise<RawPage> => readSavedPage(await readFile(file, "utf8"), file);

const DIPLOMATIZZARE_LINE = (await linesOf("fixtures/recovered-hide/diplomatizzare.jsonl"))[0];
/** `urgere`'s two Verbo records; the first is the one its recovered line 3 is read for. */
const URGERE_LINES = (await linesOf("fixtures/unlisted-definitions/archive-lines.jsonl")).filter((line) => (JSON.parse(line) as { word: string }).word === "urgere");
const LINES = [DIPLOMATIZZARE_LINE, ...URGERE_LINES];
const PAGES = [await pageOf("fixtures/recovered-hide/diplomatizzare.wikitext"), await pageOf("fixtures/unlisted-definitions/urgere.wikitext")];

const [DIPLOMATIZZARE] = recoveredHides(CURATED_CORRECTIONS);
const KEYED: RecoveredDefinitionHide[] = atFixtureLines(LINES, RELEASE, [DIPLOMATIZZARE]);

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });
const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

/** The two words seeded, with their pages, and with `corrections`. */
async function seeded(corrections: readonly CuratedCorrection[]): Promise<{ db: DatabaseSync; report: SeedSqlReport }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-recovered-hide-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${LINES.join("\n")}\n`, "utf8")));
    const report = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: SCHEMA,
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      rawPages: rawPageSource(PAGES),
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

/** The verb reading of `word`, as a lookup reads it. */
async function verbOf(db: DatabaseSync, word: string): Promise<Reading> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
  assert.ok(result.outcome === "found", word);
  const reading = result.readings.find((candidate) => candidate.word === word && candidate.pos === "verb");
  assert.ok(reading !== undefined, word);
  return reading;
}

/** Every recovered definition of `word`'s verb readings, as [text, labels]. */
async function recoveredOf(db: DatabaseSync, word: string): Promise<[string, string[]][]> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
  assert.ok(result.outcome === "found", word);
  return result.readings.filter((reading) => reading.word === word).flatMap((reading) => everyRecovered(reading).map((definition): [string, string[]] => [definition.text, definition.labels]));
}

/** urgere's recovered line 3, as its first record's reading shows it. */
const URGERE_LINE_3: [string, string[]] = ["occorrere nell'immediato, necessario al più presto.", ["intransitivo"]];

/** The rows a hide leaves as imported: the record's line, its page, and its recovered definitions with their labels. */
const IMPORTED = ["source_record", "source_record_json", "raw_page", "recovered_definition", "recovered_label", "recovered_example"];

test("the entry names diplomatizzare's archive line and its page's line 3 as revision 3978915 states it, and cites that revision and the ruling", () => {
  assert.equal(recoveredHides(CURATED_CORRECTIONS).length, 1);
  const { record, hides, evidence } = DIPLOMATIZZARE;
  assert.deepEqual([record.releaseId, record.lineNo, record.word, record.pos], ["it-0c432803", 573791, "diplomatizzare", "verb"]);
  assert.equal(record.lineSha256, createHash("sha256").update(DIPLOMATIZZARE_LINE, "utf8").digest("hex"));
  const page = PAGES[0];
  assert.deepEqual([evidence.page.wiki, evidence.page.title, evidence.page.revisionId], [page.wiki, page.title, page.revisionId]);
  assert.equal(page.revisionId, 3978915);
  assert.deepEqual(hides, { line: 3, wikitext: "{{Transitivo|it}}hhhhhhhh", text: "hhhhhhhh" });
  assert.equal(page.wikitext.split("\n")[hides.line - 1], hides.wikitext);
  assert.equal(evidenceUrl(evidence.page), "https://it.wiktionary.org/w/index.php?title=diplomatizzare&oldid=3978915");
  assert.equal(evidence.ruling, "https://github.com/povlabs/lexema/issues/773#issuecomment-6082693102");
  assert.equal(correctionId(DIPLOMATIZZARE), "it-0c432803:573791/page-line/3");
});

test("rule recovered-prose-line/v1 reads diplomatizzare's line 3 as a definition labelled transitivo, as it reads urgere's line 3", () => {
  const read = (line: string, page: RawPage, siblings: Siblings) => {
    const recovery = recoverDefinitions(recordText(JSON.parse(line) as Parameters<typeof recordText>[0], siblings), page);
    assert.ok(recovery.outcome === "matched");
    return recovery.recovered.map((definition) => [definition.route, definition.ref.line, definition.wikitext, definition.text, definition.labels]);
  };
  assert.deepEqual(read(DIPLOMATIZZARE_LINE, PAGES[0], ONLY_RECORD), [["prose-line", 3, "{{Transitivo|it}}hhhhhhhh", "hhhhhhhh", ["transitivo"]]]);
  assert.deepEqual(read(URGERE_LINES[0], PAGES[1], [["transitivo"]]), [["prose-line", 3, "{{Intransitivo|it}} occorrere nell'immediato, necessario al più presto. ", "occorrere nell'immediato, necessario al più presto.", ["intransitivo"]]]);
});

test("the seed writes the hide as its own row, leaves every imported row as it is, and the lookup shows neither the text nor its label", async () => {
  const hidden = await seeded(KEYED);
  const source = await seeded([]);
  try {
    const id = `${RELEASE}:1/page-line/3`;
    assert.deepEqual(all(hidden.db, "SELECT r.word, h.page_line, h.correction_id, h.evidence_url FROM hidden_recovered_definition h JOIN source_record r USING (record_id)"), [
      { word: "diplomatizzare", page_line: 3, correction_id: id, evidence_url: evidenceUrl(DIPLOMATIZZARE.evidence.page) },
    ]);
    assert.deepEqual(hidden.report.corrections, { keyed: 1, applied: 1, unapplied: [] });
    assert.equal(hidden.report.rows.hidden_recovered_definition, 1);
    for (const table of IMPORTED) {
      assert.deepEqual(all(hidden.db, `SELECT * FROM ${table} ORDER BY 1, 2`), all(source.db, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
    // The rule still read the row; it stays beside the record.
    assert.deepEqual(all(hidden.db, "SELECT d.page_line, d.wikitext, d.text, l.label FROM recovered_definition d JOIN recovered_label l USING (recovered_id) JOIN source_record r USING (record_id) WHERE r.word = 'diplomatizzare'"), [
      { page_line: 3, wikitext: "{{Transitivo|it}}hhhhhhhh", text: "hhhhhhhh", label: "transitivo" },
    ]);

    assert.deepEqual(await recoveredOf(source.db, "diplomatizzare"), [["hhhhhhhh", ["transitivo"]]]);
    assert.deepEqual(await recoveredOf(hidden.db, "diplomatizzare"), []);
    // The control: urgere's recovered line 3 is shown, with its label, as without the hide.
    assert.deepEqual(await recoveredOf(hidden.db, "urgere"), await recoveredOf(source.db, "urgere"));
    assert.deepEqual((await recoveredOf(hidden.db, "urgere"))[0], URGERE_LINE_3);
    // Nothing marks the correction (ADR 0016): the reading is the source's, less that one definition.
    const before = await verbOf(source.db, "diplomatizzare");
    const after = await verbOf(hidden.db, "diplomatizzare");
    assert.deepEqual(after, { ...before, recovered: [] });
    assert.doesNotMatch(JSON.stringify(after), /hhhhhhhh|page-line|issuecomment/);
  } finally {
    hidden.db.close();
    source.db.close();
  }
});

test("the recovered read probes each definition's hide by its key, in the statement it always sent", async () => {
  const { db } = await seeded(KEYED);
  try {
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${HIDING_RECOVERED_SQL}`).all("[1]") as { detail: string }[]).map((row) => row.detail);
    assert.ok(plan.includes("SEARCH hr USING COVERING INDEX sqlite_autoindex_hidden_recovered_definition_1 (record_id=? AND page_line=?)"), plan.join("\n"));
    assert.ok(!plan.some((step) => /SCAN (hr|hidden_recovered_definition)\b/.test(step)), plan.join("\n"));
  } finally {
    db.close();
  }
});

/** The hide, naming something its line does not hold. */
const MISMATCHED: [string, RecoveredDefinitionHide, string][] = [
  ["another revision", { ...KEYED[0], evidence: { ...KEYED[0].evidence, page: { ...KEYED[0].evidence.page, revisionId: 3978914 } } }, "revision-differs"],
  ["other wikitext", { ...KEYED[0], hides: { ...KEYED[0].hides, wikitext: "{{Transitivo|it}} hhhhhhhh" } }, "line-differs"],
  ["other text", { ...KEYED[0], hides: { ...KEYED[0].hides, text: "hhhhhhh" } }, "line-differs"],
  ["a line the rule does not read", { ...KEYED[0], hides: { ...KEYED[0].hides, line: 7 } }, "row-gone"],
];

test("a hide whose line no longer matches is reported by the seed and by correct:records, never applied (ADR 0025)", async () => {
  const source = await seeded([]);
  try {
    source.db.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    for (const [what, hide, reason] of MISMATCHED) {
      const { db, report } = await seeded([hide]);
      try {
        assert.deepEqual(report.corrections, { keyed: 1, applied: 0, unapplied: [{ id: correctionId(hide), reason }] }, what);
        assert.deepEqual(all(db, "SELECT * FROM hidden_recovered_definition"), [], what);
        assert.deepEqual(await recoveredOf(db, "diplomatizzare"), [["hhhhhhhh", ["transitivo"]]], what);
      } finally {
        db.close();
      }
      const plan = planCorrections(readerOf(source.db), [hide]);
      assert.deepEqual(plan.hides.map((entry) => entry.state === "not-in-master" && entry.why), [reason], what);
      assert.equal(plan.sql, "", what);
      assert.match(describeHide(plan.hides[0]), /not written/, what);
    }
  } finally {
    source.db.close();
  }
  // The rule's own answer, without a dictionary: no row at all is a row gone.
  assert.equal(hideMismatch(KEYED[0], []), "row-gone");
});

test("a master seeded before hides gets the row a seed now writes, once, and a lookup without the table shows the source", async () => {
  const fresh = await seeded(KEYED);
  const before = await seeded([]);
  try {
    before.db.exec("DROP TABLE hidden_recovered_definition;");
    // A lookup on it reads no hide and fails nothing.
    assert.deepEqual(await recoveredOf(before.db, "diplomatizzare"), [["hhhhhhhh", ["transitivo"]]]);

    const reader = readerOf(before.db);
    assert.deepEqual(missingForCorrections(reader), ["hidden_recovered_definition"]);
    const plan = planCorrections(reader, KEYED);
    assert.deepEqual(plan.hides.map((entry) => entry.state), ["write"]);
    assert.deepEqual(plan.counts.toJSON(), { records: { added: 0, changed: 1, removed: 0 }, written: { hidden_recovered_definition: 1, correction_version: 1 }, deleted: {} });
    assert.throws(() => before.db.exec(plan.sql), /no such table/);
    before.db.exec(masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    assert.deepEqual(missingForCorrections(reader), []);
    assert.equal(planCorrections(reader, KEYED).sql, plan.sql);
    const imported = IMPORTED.map((table) => all(before.db, `SELECT * FROM ${table} ORDER BY 1, 2`));
    before.db.exec(plan.sql);
    assert.deepEqual(unwritten(reader, plan), []);
    assert.deepEqual(IMPORTED.map((table) => all(before.db, `SELECT * FROM ${table} ORDER BY 1, 2`)), imported);
    assert.deepEqual(all(before.db, "SELECT * FROM hidden_recovered_definition"), all(fresh.db, "SELECT * FROM hidden_recovered_definition"));
    assert.deepEqual(await recoveredOf(before.db, "diplomatizzare"), []);
    assert.deepEqual((await recoveredOf(before.db, "urgere"))[0], URGERE_LINE_3);

    const again = planCorrections(reader, KEYED);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
    assert.deepEqual(again.hides.map((entry) => entry.state), ["already"]);
  } finally {
    fresh.db.close();
    before.db.close();
  }
});
