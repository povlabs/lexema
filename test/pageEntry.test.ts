// Real dump revisions and archive lines (52740 racconto; 53209 fornito),
// it-0c432803 / itwiktionary-20260701. See fixtures/page-entry-provenance.md.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite, type LookupDatabase } from "../src/lookup/database.js";
import { OPTIONAL_TABLES_SQL, PAGE_ENTRY_TABLES } from "../src/lookup/served.js";
import { lookup, exists } from "../src/lookup/lookup.js";
import { lookupBatch } from "../src/lookup/batch.js";
import { loadFixturePages, rawPageSource } from "../src/source/rawPage.js";
import { recoverPageEntry } from "../src/italian/pageEntry.js";

const pages = await loadFixturePages(resolve("fixtures"));
const page = (title: string) => { const value = pages.page(title); assert.ok(value); return value; };

test("ruled layouts recover definitions in page order with exact line evidence, not foreign entries or existing words", () => {
  const expected: Record<string, [number, string[]]> = {
    raccontare: [2, ["narrare, oralmente o tramite scrittura, eventi o storie", "rappresentare qualcosa, in genere cosa non gradita"]],
    dipendere: [2, ["esprime una condizione necessaria"]],
    dismagare: [2, ["Togliere, escludere", "Distogliere dalla coscienza di sè o del dovere."]],
    fornire: [2, ["dare cose a qualcuno"]],
  };
  for (const [title, [posLine, texts]] of Object.entries(expected)) {
    const source = page(title);
    const result = recoverPageEntry(source, new Set());
    assert.equal(result.outcome, "recovered", title);
    assert.ok(result.outcome === "recovered");
    assert.equal(result.entry.pos, "verb");
    assert.equal(result.entry.posRef.line, posLine);
    assert.equal(result.entry.posWikitext, source.wikitext.split("\n")[posLine - 1]);
    assert.deepEqual(result.entry.definitions.map((item) => item.text), texts);
    for (const definition of result.entry.definitions) {
      assert.equal(definition.ref.revisionId, source.revisionId);
      assert.equal(definition.ref.title, title);
      assert.equal(definition.wikitext, source.wikitext.split("\n")[definition.ref.line - 1]);
      for (const example of definition.examples) {
        assert.equal(example.ref.revisionId, source.revisionId);
        assert.equal(example.wikitext, source.wikitext.split("\n")[example.ref.line - 1]);
      }
    }
  }
  const result = recoverPageEntry(page("raccontare"), new Set());
  assert.ok(result.outcome === "recovered");
  assert.deepEqual(result.entry.definitions[1].labels, ["figurato"]);
  assert.deepEqual(result.entry.definitions[1].examples.map((example) => example.text), ["quello lì non me la racconta giusta"]);
  for (const title of ["movere", "skirmish", "notiziare"]) {
    assert.notEqual(recoverPageEntry(page(title), new Set()).outcome, "recovered", title);
  }
  assert.equal(recoverPageEntry(page("raccontare"), new Set(["raccontare"])).outcome, "present-in-archive");
});

test("isolated seed finds page entries and resolves real form records without inventing archive identities or fields", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-entry-"));
  const db = new DatabaseSync(":memory:");
  try {
    const input = join(dir, "input.jsonl");
    await writeFile(input, (await readFile(resolve("fixtures/dev-seed.jsonl"), "utf8")) + (await readFile(resolve("fixtures/page-entry-forms.jsonl"), "utf8")));
    const options = { input, outputDir: join(dir, "sql"),
      schema: resolve("src/db/schema.sql"), releaseId: "it-page-entry-test" };
    // The comparison seed has precisely the same originals, without page recovery.
    const baseline = await seedSql({ ...options, rawPages: { size: pages.size - 2, page: (title) =>
      title === "raccontare" || title === "fornire" ? undefined : pages.page(title) } });
    assert.ok(baseline.rows.recovered_definition > 0);
    const before = new DatabaseSync(":memory:");
    try {
      for (const part of baseline.parts) before.exec(await readFile(part, "utf8"));
      const report = await seedSql({ ...options, rawPages: pages });
      for (const part of report.parts) db.exec(await readFile(part, "utf8"));
      const read = fromNodeSqlite(db);
      for (const [title, form] of [["raccontare", "racconto"], ["fornire", "fornito"]]) {
        const result = await lookup({ db: read, releaseId: options.releaseId, query: title });
        assert.equal(result.outcome, "found", title);
        assert.ok(result.outcome === "found");
        const entry = result.readings[0];
        assert.ok(entry.entryId !== undefined);
        assert.equal(entry.recordId, undefined);
        assert.equal(entry.ref.lineNo, undefined);
        assert.equal(entry.ref.revisionId, page(title).revisionId);
        assert.ok(entry.recovered.length > 0);
        assert.deepEqual(entry.forms, []);
        assert.deepEqual(entry.wordFacts.pronunciations, []);
        assert.deepEqual(entry.wordFacts.etymologies, []);
        const inflected = await lookup({ db: read, releaseId: options.releaseId, query: form });
        assert.ok(inflected.outcome === "found");
        const link = inflected.readings.flatMap((reading) => reading.lemmaLinks).find((link) => link.targetWord === title);
        assert.ok(link?.kind === "candidates");
        assert.equal(link.candidates[0].entryId, entry.entryId);
        assert.equal((await exists({ db: read, releaseId: options.releaseId, query: title })).outcome, "present");
      }
      // Batch is the same candidate identity and stays light at any batch size.
      const queries = ["raccontare", "racconto", "fornire", "fornito"];
      const statements: string[] = [];
      const batch = await lookupBatch({ db: { all: (sql, params) => { statements.push(sql); return read.all(sql, params); } },
        releaseId: options.releaseId, queries });
      assert.deepEqual(batch.answers.map((answer) => answer.outcome), queries.map(() => "found"));
      // The release and the optional tables (one D1 call), the search, the links.
      assert.equal(statements.length, 4);
      for (const answer of batch.answers) {
        assert.ok(answer.outcome === "found");
        assert.ok(answer.candidates[0].entryId !== undefined);
        assert.equal(answer.candidates[0].lineNo, undefined);
      }
      for (const table of ["source_record", "source_record_json", "sense", "sense_gloss", "lookup_form", "form_of_edge", "recovered_definition", "recovered_label", "recovered_example"]) {
        assert.deepEqual(db.prepare(`SELECT * FROM ${table}`).all(), before.prepare(`SELECT * FROM ${table}`).all(), table);
      }
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
      const stored = db.prepare(`SELECT p.title, p.revision_id, p.revision_timestamp, d.page_line, d.wikitext
        FROM entry_definition d JOIN recovered_entry e USING (entry_id) JOIN raw_page p USING (page_id)`).all();
      assert.equal(stored.length, 3);
      for (const row of stored) {
        const source = page(String(row.title));
        assert.equal(row.revision_id, source.revisionId);
        assert.equal(row.revision_timestamp, source.timestamp);
        assert.equal(row.wikitext, source.wikitext.split("\n")[Number(row.page_line) - 1]);
      }
      const present = await seedSql({ ...options, outputDir: join(dir, "present"), rawPages: rawPageSource([page("skirmish")]) });
      assert.equal(present.rows.recovered_entry, 0);
    } finally { before.close(); }
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});

test("a dictionary seeded before the page-entry tables answers as it did, and never names them", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-entry-"));
  const empty = new DatabaseSync(":memory:");
  const old = new DatabaseSync(":memory:");
  try {
    const releaseId = "it-page-entry-test";
    const seeded = await seedSql({ input: resolve("fixtures/dev-seed.jsonl"), outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId, rawPages: pages });
    for (const part of seeded.parts) {
      const sql = await readFile(part, "utf8");
      empty.exec(sql);
      old.exec(sql);
    }
    assert.equal((empty.prepare("SELECT count(*) AS n FROM recovered_entry").get() as { n: number }).n, 0);
    for (const table of [...PAGE_ENTRY_TABLES].reverse()) old.exec(`DROP TABLE ${table}`);

    const sent: string[] = [];
    const watched = fromNodeSqlite(old);
    const oldRead: LookupDatabase = { all: (sql, params) => { sent.push(sql); return watched.all(sql, params); } };
    const emptyRead = fromNodeSqlite(empty);
    const words = ["casa", "vado", "andare", "bello", "raccontare"];
    for (const query of words) {
      assert.deepEqual(await lookup({ db: oldRead, releaseId, query }), await lookup({ db: emptyRead, releaseId, query }), query);
      assert.deepEqual(await exists({ db: oldRead, releaseId, query }), await exists({ db: emptyRead, releaseId, query }), query);
    }
    assert.equal((await lookup({ db: oldRead, releaseId, query: "casa" })).outcome, "found");
    assert.equal((await lookup({ db: oldRead, releaseId, query: "vado" })).outcome, "found");
    assert.deepEqual(await lookupBatch({ db: oldRead, releaseId, queries: words }), await lookupBatch({ db: emptyRead, releaseId, queries: words }));
    const named = sent.filter((sql) => PAGE_ENTRY_TABLES.some((table) => new RegExp(`\\b${table}\\b`).test(sql.replace(OPTIONAL_TABLES_SQL, ""))));
    assert.deepEqual(named, []);

    // Some page-entry tables without the rest is no schema anyone seeded: refused, never read as either.
    empty.exec("DROP TABLE entry_example");
    await assert.rejects(lookup({ db: emptyRead, releaseId, query: "casa" }), /not every page-entry table/);
  } finally { empty.close(); old.close(); await rm(dir, { recursive: true, force: true }); }
});
