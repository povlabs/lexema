// The curated definition corrections (#450): the committed entries, checked
// against the verbatim dump revisions they name; the layer the seed writes from
// them, read back through `lookup()`; and `correct:records` writing them into a
// master seeded before them. Inputs are verbatim: archive lines 119046 `tremo`
// and 283047 `grufolando` of it-0c432803 (fixtures/definition-corrections.jsonl),
// and revisions 4002473 `tremare` and 3906191 `grufolare` of the dump
// itwiktionary-20260701 (fixtures/upstream-pages/), which equal those
// revisions' raw wikitext on it.wiktionary.org.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
  CURATED_CORRECTIONS,
  definitionCorrections,
  evidenceUrl,
  type CuratedCorrection,
  type DefinitionCorrection,
} from "../src/italian/curatedCorrections.js";
import { recoverPageEntry } from "../src/italian/pageEntry.js";
import { describeDefinition, planCorrections, unwritten } from "../src/import/correctRecords.js";
import { seedSql, type SeedSqlReport } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { servedVersion, versionToken } from "../src/lookup/served.js";
import type { RecoveredDefinition } from "../src/lookup/types.js";
import { loadFixturePages, rawPageSource, type RawPage, type RawPageSource } from "../src/source/rawPage.js";
import type { MasterReader } from "../src/update/master.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";

const RELEASE = "it-definition-corrections";
const SCHEMA = "src/db/schema.sql";
const pages = await loadFixturePages(resolve("fixtures"));
const page = (title: string): RawPage => {
  const value = pages.page(title);
  assert.ok(value, title);
  return value;
};
const DEFINITIONS = definitionCorrections(CURATED_CORRECTIONS);
const correctionOf = (title: string): DefinitionCorrection => {
  const correction = DEFINITIONS.find((entry) => entry.entry.title === title);
  assert.ok(correction, title);
  return correction;
};

test("each definition entry quotes its revision's line and text exactly, and cites evidence", () => {
  assert.deepEqual(DEFINITIONS.map((correction) => [correction.entry.title, correction.entry.revisionId, correction.replaces.index]), [
    ["grufolare", 3906191, 0],
    ["tremare", 4002473, 0],
  ]);
  for (const correction of DEFINITIONS) {
    const source = page(correction.entry.title);
    assert.equal(source.revisionId, correction.entry.revisionId);
    assert.equal(source.wikitext.split("\n")[correction.replaces.line - 1], correction.replaces.wikitext);
    const recovered = recoverPageEntry(source, new Set());
    assert.ok(recovered.outcome === "recovered");
    // The correction's entry is the page's one entry of its part of speech.
    const [entry, ...others] = recovered.entries.filter((candidate) => candidate.pos === correction.entry.pos);
    assert.deepEqual(others, []);
    const definition = entry.definitions[correction.replaces.index];
    assert.equal(definition.ref.line, correction.replaces.line);
    assert.equal(definition.wikitext, correction.replaces.wikitext);
    assert.equal(definition.text, correction.replaces.text);
    assert.notEqual(correction.text, correction.replaces.text);
    assert.ok(correction.evidence.length > 0);
    for (const evidence of correction.evidence) {
      assert.match(evidenceUrl(evidence), /^https:\/\/(it|en)\.wiktionary\.org\/w\/index\.php\?title=[^&]+&oldid=\d+$/);
    }
  }
  // The list's type admits no definition entry without evidence.
  const unevidenced: DefinitionCorrection = {
    ...correctionOf("grufolare"),
    // @ts-expect-error a correction without evidence is not a correction
    evidence: [],
  };
  assert.ok(unevidenced);
});

interface Seeded {
  db: DatabaseSync;
  report: SeedSqlReport;
  definitionsOf: (word: string) => Promise<RecoveredDefinition[]>;
}

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

async function seeded(corrections: readonly CuratedCorrection[] | undefined, rawPages: RawPageSource = pages): Promise<{ db: DatabaseSync; report: SeedSqlReport }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-definition-corrections-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(await readFile(resolve("fixtures/definition-corrections.jsonl"))));
    const report = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: SCHEMA,
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      rawPages,
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

async function withSeed(corrections: readonly CuratedCorrection[] | undefined, run: (seed: Seeded) => Promise<void>, rawPages?: RawPageSource): Promise<void> {
  const { db, report } = await seeded(corrections, rawPages);
  try {
    await run({
      db,
      report,
      definitionsOf: async (word) => {
        const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
        assert.ok(result.outcome === "found", word);
        assert.equal(result.readings.length, 1, word);
        return result.readings[0].recovered;
      },
    });
  } finally {
    db.close();
  }
}

const textsOf = (definitions: readonly RecoveredDefinition[]) => definitions.map((definition) => [definition.text, definition.labels]);

test("the seed writes each correction beside its entry, and a lookup reads its wording in place of the page's", async () => {
  const grufolare = correctionOf("grufolare");
  const tremare = correctionOf("tremare");
  const { db: plain } = await seeded([]);
  try {
    await withSeed(undefined, async ({ db, report, definitionsOf }) => {
      assert.deepEqual(report.definitionCorrections, { listed: 2, applied: 2, unapplied: [] });
      assert.deepEqual(textsOf(await definitionsOf("grufolare")), [[grufolare.text, []]]);
      assert.deepEqual(textsOf(await definitionsOf("tremare")), [
        [tremare.text, []],
        ["essere agitato da scosse continue", ["figurato"]],
      ]);
      const [corrected, figurative] = await definitionsOf("tremare");
      assert.deepEqual(corrected.correction, { id: "page:4002473:0", evidenceUrl: evidenceUrl(tremare.evidence[0]), replaces: tremare.replaces.text });
      assert.equal(figurative.correction, null);
      // The correction is its own layer, naming where it came from.
      assert.deepEqual(all(db, `SELECT e.word, c.definition_index, c.text, c.correction_id, c.evidence_url
        FROM corrected_definition c JOIN recovered_entry e USING (entry_id) ORDER BY e.word`), [
        { word: "grufolare", definition_index: 0, text: grufolare.text, correction_id: "page:3906191:0", evidence_url: "https://en.wiktionary.org/w/index.php?title=grufolare&oldid=71335228" },
        { word: "tremare", definition_index: 0, text: tremare.text, correction_id: "page:4002473:0", evidence_url: "https://en.wiktionary.org/w/index.php?title=tremare&oldid=88487832" },
      ]);
      // Every source row, the page's own words among them, stays byte for byte.
      for (const table of ["source_record", "source_record_json", "raw_page", "recovered_entry", "entry_definition", "entry_label", "entry_example"]) {
        assert.deepEqual(all(db, `SELECT * FROM ${table}`), all(plain, `SELECT * FROM ${table}`), table);
      }
      assert.deepEqual(all(db, "PRAGMA foreign_key_check"), []);
    });
    // Without the layer, the page's own words are read.
    await withSeed([], async ({ definitionsOf }) => {
      assert.deepEqual(textsOf(await definitionsOf("grufolare")), [["verso prodotto dai suini", []]]);
    });
  } finally {
    plain.close();
  }
});

test("a correction does not reach an entry another revision changed or no entry at all: it is reported", async () => {
  const later = rawPageSource([
    { ...page("grufolare"), revisionId: 4100000 },
    page("tremare"),
  ]);
  const tremare = correctionOf("tremare");
  const moved: DefinitionCorrection = { ...tremare, replaces: { ...tremare.replaces, index: 1 } };
  // A title the seed recovers no entry for: a later dump that drops the page, or an archive record that now carries the word.
  const absent: DefinitionCorrection = { ...correctionOf("grufolare"), entry: { ...correctionOf("grufolare").entry, title: "grufolarsi", revisionId: 1 } };
  await withSeed([correctionOf("grufolare"), moved, absent], async ({ db, report, definitionsOf }) => {
    assert.deepEqual(report.definitionCorrections, {
      listed: 3,
      applied: 0,
      unapplied: [
        { id: "page:3906191:0", reason: "revision-differs" },
        { id: "page:4002473:1", reason: "definition-differs" },
        { id: "page:1:0", reason: "no-entry" },
      ],
    });
    assert.deepEqual(all(db, "SELECT count(*) AS n FROM corrected_definition"), [{ n: 0 }]);
    assert.deepEqual(textsOf(await definitionsOf("grufolare")), [["verso prodotto dai suini", []]]);
  }, later);
});

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });

/** Run the plan's SQL as one transaction, as `wrangler d1 execute --file` does. */
function execute(db: DatabaseSync, sql: string): void {
  db.exec("BEGIN");
  try {
    db.exec(sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

test("correct:records writes the corrections into a master seeded before them, once, and reads them back", async () => {
  const schema = await readFile(SCHEMA, "utf8");
  const { db: fresh } = await seeded(undefined);
  const { db: before } = await seeded([]);
  try {
    // A master seeded before #450: page-only entries, and no corrected_definition.
    before.exec("DROP TABLE corrected_definition; DROP TABLE correction_version;");
    const entriesBefore = all(before, "SELECT * FROM entry_definition ORDER BY entry_id, definition_index");
    const lookupOf = async (word: string) => {
      const result = await lookup({ db: fromNodeSqlite(before), releaseId: RELEASE, query: word });
      assert.ok(result.outcome === "found");
      return textsOf(result.readings[0].recovered);
    };
    assert.deepEqual(await lookupOf("grufolare"), [["verso prodotto dai suini", []]]);
    const versionBefore = versionToken(await servedVersion(fromNodeSqlite(before), RELEASE));

    const reader = readerOf(before);
    const plan = planCorrections(reader, DEFINITIONS);
    const entryOf = (word: string) => (before.prepare("SELECT entry_id FROM recovered_entry WHERE word = ?").get(word) as { entry_id: number }).entry_id;
    assert.deepEqual(plan.definitions.map(describeDefinition), [
      `  page:3906191:0 grufolare (entry ${entryOf("grufolare")}): written`,
      `  page:4002473:0 tremare (entry ${entryOf("tremare")}): written`,
    ]);
    // A definition entry changes no record; its rows are what the counts name.
    assert.deepEqual(plan.counts.toJSON(), { records: { added: 0, changed: 0, removed: 0 }, written: { corrected_definition: 2, correction_version: 1 }, deleted: {} });
    // The SQL creates nothing (#509): the upgrade gives the master the tables, and the plan is the same after it.
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/);
    execute(before, masterUpgradeSql(schema));
    assert.equal(planCorrections(reader, DEFINITIONS).sql, plan.sql);
    execute(before, plan.sql);
    assert.deepEqual(unwritten(reader, plan), []);

    const rows = (db: DatabaseSync) => all(db, "SELECT e.word, c.* FROM corrected_definition c JOIN recovered_entry e USING (entry_id) ORDER BY e.word");
    assert.deepEqual(rows(before), rows(fresh));
    assert.deepEqual(all(before, "SELECT * FROM entry_definition ORDER BY entry_id, definition_index"), entriesBefore);
    assert.deepEqual(await lookupOf("grufolare"), [[correctionOf("grufolare").text, []]]);
    assert.equal(versionToken(await servedVersion(fromNodeSqlite(before), RELEASE)), `${versionBefore}.fix-1`);

    const again = planCorrections(reader, DEFINITIONS);
    assert.equal(again.sql, "");
    assert.deepEqual(again.definitions.map((entry) => entry.state), ["already", "already"]);
    assert.equal(again.counts, PlanCounts.NONE);

    // A held row that differs is replaced: the counts name the row deleted and the row written.
    before.exec(`UPDATE corrected_definition SET text = 'altro' WHERE entry_id = ${entryOf("tremare")}`);
    const rewrite = planCorrections(reader, DEFINITIONS);
    assert.deepEqual(rewrite.definitions.map((entry) => entry.state), ["already", "write"]);
    assert.deepEqual(rewrite.counts.toJSON(), {
      records: { added: 0, changed: 0, removed: 0 },
      written: { corrected_definition: 1, correction_version: 1 },
      deleted: { corrected_definition: 1 },
    });
    execute(before, rewrite.sql);
    assert.deepEqual(unwritten(reader, rewrite), []);
  } finally {
    before.close();
    fresh.close();
  }
});

test("correct:records reports, and never writes, a correction the master's entry does not match", async () => {
  const later = rawPageSource([{ ...page("grufolare"), revisionId: 4100000 }, page("tremare")]);
  const { db } = await seeded([], later);
  try {
    // A master seeded before the page-entry tables holds no entry to correct.
    const old = await seeded([]);
    try {
      old.db.exec("DROP TABLE corrected_definition; DROP TABLE entry_fact; DROP TABLE entry_example; DROP TABLE entry_label; DROP TABLE entry_definition; DROP TABLE recovered_entry;");
      const none = planCorrections(readerOf(old.db), DEFINITIONS);
      assert.equal(none.sql, "");
      assert.deepEqual(none.definitions.map(describeDefinition), [
        "  page:3906191:0 grufolare: not written; the master holds no page-only entry of grufolare",
        "  page:4002473:0 tremare: not written; the master holds no page-only entry of tremare",
      ]);
    } finally {
      old.db.close();
    }

    const plan = planCorrections(readerOf(db), DEFINITIONS);
    assert.deepEqual(plan.definitions.map((entry) => (entry.state === "not-in-master" ? entry.why : entry.state)), ["revision-differs", "write"]);
    assert.match(describeDefinition(plan.definitions[0]), /another revision than 3906191/);
    execute(db, plan.sql);
    assert.deepEqual(all(db, "SELECT correction_id FROM corrected_definition"), [{ correction_id: "page:4002473:0" }]);
  } finally {
    db.close();
  }
});
