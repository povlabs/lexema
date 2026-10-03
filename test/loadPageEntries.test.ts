// `pnpm run load:page-entries` (src/import/loadPageEntries.ts, #440): the
// page-only entries (ADR 0024) loaded into a dictionary seeded before their
// tables, after it took a feed's changes and hid records, and held to what a
// fresh seed writes. The records are verbatim archive lines of it-0c432803
// (fixtures/dev-seed.jsonl, fixtures/page-entry-forms.jsonl,
// fixtures/definition-corrections.jsonl, fixtures/form-of-foreign-lemma/), and
// the pages verbatim revisions of its dump (fixtures/upstream-pages/,
// fixtures/page-entry-provenance.md).

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import { planWrite, readyChange } from "../src/deploy/writePlan.js";
import { danglingTitles, describePlannedEntry, findPageEntries, planPageEntries, unloaded } from "../src/import/loadPageEntries.js";
import { seedSql } from "../src/import/seedSql.js";
import { CURATED_CORRECTIONS, definitionCorrections } from "../src/italian/curatedCorrections.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { servedVersion } from "../src/lookup/served.js";
import { PUBLISHED_ARCHIVE_SHA256, type ArchiveFactsCatalog } from "../src/source/archiveFacts.js";
import { loadFixturePages, type RawPage } from "../src/source/rawPage.js";
import { chooseChanges, planApply } from "../src/update/apply.js";
import { parseChange, parseDeclaration, readDeclaration } from "../src/update/declaration.js";
import { diffAgainstMaster } from "../src/update/diff.js";
import type { MasterReader } from "../src/update/master.js";
import { PlanCounts } from "../src/update/planCounts.js";

const RELEASE = "it-page-entries";
const SCHEMA = "src/db/schema.sql";
const PAGE_TABLES = ["recovered_entry", "entry_definition", "entry_label", "entry_example", "corrected_definition"];

const pages = await loadFixturePages(resolve("fixtures"));
const PAGES: RawPage[] = ["raccontare", "fornire", "grufolare", "tremare", "dipendere", "dismagare", "movere"].map((title) => {
  const page = pages.page(title);
  assert.ok(page, title);
  return page;
});

const lines = async (path: string): Promise<string[]> => (await readFile(path, "utf8")).trimEnd().split("\n");
const record = (fields: Record<string, unknown>): string => JSON.stringify({ lang_code: "it", ...fields });

// `dipendo` points at `dipendere`, whose own record a hide took out of search:
// the seed recovers no entry for a title a record spells, hidden or not.
const DIPENDERE = record({ word: "dipendere", pos: "verb", pos_title: "Verbo", senses: [{ glosses: ["essere subordinato"] }] });
const DIPENDO = record({ word: "dipendo", pos: "verb", pos_title: "Voce verbale", senses: [{ glosses: ["prima persona singolare del presente indicativo di dipendere"], tags: ["form-of"], form_of: [{ word: "dipendere" }] }] });
// A form the feed adds, pointing at `dismagare`, which no record spells.
const DISMAGO = record({ word: "dismago", pos: "verb", pos_title: "Voce verbale", senses: [{ glosses: ["prima persona singolare del presente indicativo di dismagare"], tags: ["form-of"], form_of: [{ word: "dismagare" }] }] });

let dir: string;
let master: string[];
let archive: string;
let later: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-page-entries-"));
  master = [
    ...(await lines("fixtures/dev-seed.jsonl")),
    ...(await lines("fixtures/page-entry-forms.jsonl")),
    ...(await lines("fixtures/definition-corrections.jsonl")),
    ...(await lines("fixtures/form-of-foreign-lemma/archive-lines.jsonl")),
    DIPENDERE,
    DIPENDO,
  ];
  archive = join(dir, "master.jsonl.gz");
  await writeFile(archive, gzipSync(`${master.join("\n")}\n`));
  // The feed: `casa` with one more sense, and a new form.
  const casa = master.findIndex((line) => (JSON.parse(line) as { word: string }).word === "casa");
  const fixed = JSON.parse(master[casa]) as { senses: unknown[] };
  later = join(dir, "later.jsonl.gz");
  await writeFile(later, gzipSync(`${[...master.slice(0, casa), JSON.stringify({ ...fixed, senses: [...fixed.senses, { glosses: ["famiglia"] }] }), ...master.slice(casa + 1), DISMAGO].join("\n")}\n`));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });

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

async function seeded(name: string, withPages: boolean): Promise<DatabaseSync> {
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, name),
    schema: SCHEMA,
    releaseId: RELEASE,
    license: "CC-BY-SA-4.0",
    ...(withPages ? { rawPages: { page: (title: string) => PAGES.find((page) => page.title === title), size: PAGES.length } } : {}),
    // The other-language lines are `zapatero`'s, which no seed admits.
    onRejection: (rejection) => {
      if (rejection.kind !== "other-language") throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
  return db;
}

const fixtureCatalog = (masterSha: string, feedSha: string): ArchiveFactsCatalog => {
  const fact = (id: `itwiktionary-${string}`) => ({ sourceUrl: "https://example.org/fixture", retrievedAt: "2026-10-01T00:00:00Z", dump: { id, basis: "recorded" as const }, evidence: ["synthetic fixture"] });
  return { [masterSha]: fact("itwiktionary-20260701"), [feedSha]: fact("itwiktionary-20260901") };
};

/**
 * The live dictionary's shape (#440): seeded before the page-entry tables,
 * with a feed's changes applied and records hidden, by a seed's own rule and
 * by a later hide.
 */
async function liveShaped(name: string): Promise<DatabaseSync> {
  const db = await seeded(name, false);
  const reader = readerOf(db);
  const found = await diffAgainstMaster(reader, later);
  const chosen = chooseChanges(found, found.diff.changes.map((change) => change.id));
  assert.deepEqual(found.diff.changes.map((change) => [change.kind, change.word]).sort(), [["changed", "casa"], ["new", "dismago"]]);
  execute(db, (await planApply(reader, found, chosen, { schema: await readFile(SCHEMA, "utf8"), appliedAt: "2026-10-02T00:00:00Z", catalog: fixtureCatalog(found.master.archiveSha256, found.feed.archiveSha256) })).sql);
  // What a hide of `dipendere` leaves: its row in hidden_record, and no search row or edge.
  const { record_id: id } = db.prepare("SELECT record_id FROM source_record WHERE word = 'dipendere'").get() as { record_id: number };
  execute(db, `DELETE FROM lookup_form WHERE record_id = ${id}; DELETE FROM form_of_edge WHERE record_id = ${id};
    INSERT INTO hidden_record (record_id, release_id, page_id, rule, because, language, page_line, lemma_line) VALUES (${id}, '${RELEASE}', NULL, 'form-of-foreign-lemma/v1', 'lemma-lists-form', 'es', NULL, 1);`);
  // The live dictionary took its feed before the upgrade created these tables (#438), so it has none.
  db.exec(PAGE_TABLES.map((table) => `DROP TABLE ${table};`).reverse().join("\n"));
  return db;
}

/** Every row of every table, by table. */
function snapshot(db: DatabaseSync): Map<string, string[]> {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  return new Map(tables.map(({ name }) => [name, (db.prepare(`SELECT * FROM ${name}`).all() as object[]).map((row) => JSON.stringify(row)).sort()]));
}

/** A page-only entry's rows as a seed writes them, without the ids a database gives them. */
function entryRows(db: DatabaseSync, word: string): unknown {
  const entry = db.prepare(`SELECT e.*, p.title, p.revision_id, p.revision_timestamp FROM recovered_entry e JOIN raw_page p ON p.page_id = e.page_id WHERE e.word = ?`).get(word) as Record<string, unknown> | undefined;
  assert.ok(entry, word);
  const { entry_id: id, page_id: _page, ...rest } = entry;
  const rows = (table: string) => (db.prepare(`SELECT * FROM ${table} WHERE entry_id = ?`).all(id as number) as Record<string, unknown>[]).map(({ entry_id: _id, ...row }) => row);
  const key = rest.word_key as string;
  return {
    entry: rest,
    definitions: rows("entry_definition"),
    labels: rows("entry_label"),
    examples: rows("entry_example"),
    corrections: rows("corrected_definition"),
    accent: db.prepare("SELECT fold_key, headword, languages, richness FROM accent_fold WHERE surface_key = ?").all(key).map((row) => ({ ...row })),
    typo: db.prepare("SELECT deletion_key, languages, richness FROM typo_key WHERE surface_key = ? ORDER BY deletion_key").all(key).map((row) => ({ ...row })),
  };
}

const LOADED = ["fornire", "grufolare", "raccontare", "tremare"];

test("a dictionary seeded before the tables, with a feed applied and records hidden, gains the entries and keeps every earlier row", async () => {
  const db = await liveShaped("live");
  const fresh = await seeded("fresh", true);
  try {
    const reader = readerOf(db);
    const before = snapshot(db);
    const versionBefore = await servedVersion(fromNodeSqlite(db), RELEASE);
    assert.equal((await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "raccontare" })).outcome, "not-found");

    const titles = danglingTitles(reader);
    // `dipendere` is listed: only a hidden record spells it, and a hidden record has no search row.
    assert.deepEqual([...titles].filter((title) => PAGES.some((page) => page.title === title)).sort(), ["dipendere", "dismagare", "fornire", "grufolare", "raccontare", "tremare"]);
    const found = await findPageEntries(PAGES, titles);
    const plan = planPageEntries(reader, found, await readFile(SCHEMA, "utf8"), CURATED_CORRECTIONS);
    assert.deepEqual(plan.entries.map((planned) => [planned.entry.page.title, planned.state]), [
      ["dipendere", "spelled-by-a-record"],
      // `dismagare` only the feed's new form points at; a fresh seed of the master alone has no form pointing at it.
      ["dismagare", "write"],
      ["fornire", "write"],
      ["grufolare", "write"],
      ["raccontare", "write"],
      ["tremare", "write"],
    ]);
    assert.deepEqual(plan.corrections.map(({ id, title }) => [id, title]), [["page:3906191:0", "grufolare"], ["page:4002473:0", "tremare"]]);
    assert.deepEqual(plan.counts.records, { added: 0, changed: 0, removed: 0 });
    assert.equal(plan.counts.written.recovered_entry, 5);
    assert.equal(plan.counts.written.raw_page, 5);
    assert.equal(plan.counts.written.corrected_definition, 2);
    assert.deepEqual(plan.counts.deleted, {});

    execute(db, plan.sql);
    assert.deepEqual(unloaded(reader, plan), []);

    // Every row held before is held after, unchanged; new rows land only in the tables the load writes.
    const after = snapshot(db);
    for (const [table, rows] of before) {
      const now = new Set(after.get(table));
      assert.deepEqual(rows.filter((row) => !now.has(row)), [], `${table} lost or changed a row`);
      if (!["raw_page", "accent_fold", "typo_key"].includes(table)) assert.equal(after.get(table)?.length, rows.length, `${table} gained a row`);
    }
    assert.deepEqual([...after.keys()].filter((table) => !before.has(table)).sort(), [...PAGE_TABLES].sort());
    // source_record_json byte for byte.
    assert.deepEqual(after.get("source_record_json"), before.get("source_record_json"));
    // The served identity names the same data: caches move with the Worker version the deploy uploads (docs/PAGE_ENTRIES.md).
    assert.deepEqual(await servedVersion(fromNodeSqlite(db), RELEASE), versionBefore);

    // Each entry is what a fresh seed writes for it, from the same revision and lines.
    for (const word of LOADED) assert.deepEqual(entryRows(db, word), entryRows(fresh, word), word);
    const rawPage = db.prepare("SELECT title, revision_id FROM raw_page p JOIN recovered_entry e ON e.page_id = p.page_id ORDER BY title").all().map((row) => ({ ...row }));
    assert.deepEqual(rawPage, found.filter((entry) => entry.page.title !== "dipendere").map((entry) => ({ title: entry.page.title, revision_id: entry.page.revisionId })));

    // Lookups find them, and the forms' links lead to them.
    for (const word of ["raccontare", "fornire"]) {
      const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
      assert.equal(result.outcome, "found", word);
      assert.ok(result.outcome === "found");
      assert.ok(result.readings.every((reading) => "entryId" in reading && reading.entryId !== undefined), word);
    }
    const grufolare = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "grufolare" });
    assert.ok(grufolare.outcome === "found");
    const correction = definitionCorrections(CURATED_CORRECTIONS).find((entry) => entry.entry.title === "grufolare");
    assert.ok(correction);
    assert.equal(grufolare.readings[0].recovered[0].text, correction.text);
    const racconto = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "racconto" });
    assert.ok(racconto.outcome === "found");
    assert.ok(JSON.stringify(racconto).includes('"entryId"'), "racconto's form-of link names the page-only entry");

    // A second run plans nothing.
    const again = planPageEntries(reader, await findPageEntries(PAGES, danglingTitles(reader)), await readFile(SCHEMA, "utf8"), CURATED_CORRECTIONS);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
    assert.deepEqual(again.entries.map(describePlannedEntry).filter((line) => line.endsWith("written") && !line.endsWith("already written")), []);
  } finally {
    db.close();
    fresh.close();
  }
});

test("a dictionary with some page-entry tables but not all is refused, and nothing is planned", async () => {
  const db = await seeded("partial", false);
  try {
    db.exec("DROP TABLE entry_example");
    const reader = readerOf(db);
    const found = await findPageEntries(PAGES, danglingTitles(reader));
    assert.throws(() => planPageEntries(reader, found, "", CURATED_CORRECTIONS), /not every page-entry table/);
  } finally {
    db.close();
  }
});

test("a title whose page the dictionary holds from another revision is refused", async () => {
  const db = await liveShaped("other-revision");
  try {
    db.exec(`INSERT INTO raw_page (page_id, release_id, wiki, title, revision_id, revision_timestamp) VALUES (9999, '${RELEASE}', 'it.wiktionary.org', 'fornire', 1, '2020-01-01T00:00:00Z')`);
    const reader = readerOf(db);
    const found = await findPageEntries(PAGES, danglingTitles(reader));
    const schema = await readFile(SCHEMA, "utf8");
    assert.throws(() => planPageEntries(reader, found, schema, CURATED_CORRECTIONS), /holds revision 1 of fornire/);
  } finally {
    db.close();
  }
});

const escape = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

test("a declared load:page-entries is planned by the deploy from the master's archive and dump, and its counts are what a plan-only run gives", async () => {
  const db = await liveShaped("declared");
  try {
    const reader = readerOf(db);
    const dump = join(dir, "dump.xml");
    const xml = PAGES.map((page) => `  <page>\n    <title>${escape(page.title)}</title>\n    <ns>0</ns>\n    <revision>\n      <id>${page.revisionId}</id>\n      <timestamp>${page.timestamp}</timestamp>\n      <text xml:space="preserve">${escape(page.wikitext)}</text>\n    </revision>\n  </page>`).join("\n");
    await writeFile(dump, `<mediawiki>\n${xml}\n</mediawiki>\n`);
    const dumpBytes = await readFile(dump);
    const archiveSha = createHash("sha256").update(await readFile(archive)).digest("hex");
    const catalog: ArchiveFactsCatalog = { [archiveSha]: { sourceUrl: "https://example.org/fixture", retrievedAt: "2026-10-01T00:00:00Z", dump: { id: "itwiktionary-20991001", basis: "recorded" }, evidence: ["synthetic fixture"] } };
    const dumps = { "itwiktionary-20991001": { bytes: dumpBytes.length, sha1: createHash("sha1").update(dumpBytes).digest("hex") } };
    const releaseId = `it-${archiveSha.slice(0, 8)}`;
    const change = parseChange("test", JSON.stringify({ command: "load:page-entries", inputs: { archive: releaseId, rules: ["italian-page-entry/v1"] } }));
    const plan = await planWrite(readyChange(change, { archive, dump }), reader, "2026-10-03T00:00:00Z", { catalog, dumps });
    const expected = planPageEntries(reader, await findPageEntries(PAGES, danglingTitles(reader)), await readFile(SCHEMA, "utf8"), CURATED_CORRECTIONS);
    assert.deepEqual(plan.run.counts.toJSON(), expected.counts.toJSON());
    assert.equal(plan.sql, expected.sql);
    // The declaration that pins those counts parses; a wrong rule set does not.
    parseDeclaration("ok.json", JSON.stringify({ command: "load:page-entries", inputs: { archive: releaseId, rules: ["italian-page-entry/v1"] }, expected: expected.counts.toJSON() }));
    assert.throws(() => parseDeclaration("bad.json", JSON.stringify({ command: "load:page-entries", inputs: { archive: releaseId, rules: [] }, expected: expected.counts.toJSON() })), /lacks italian-page-entry\/v1/);
    execute(db, plan.sql);
    assert.deepEqual(plan.readBack(reader), []);
    // Another archive than the master's is refused before anything is planned.
    await assert.rejects(planWrite(readyChange(change, { archive: later, dump }), reader, "2026-10-03T00:00:00Z", { catalog, dumps }), /was seeded from the archive/);
  } finally {
    db.close();
  }
});

test("the committed declaration loads the master's entries and pins the counts of the 14 the measurement found", async () => {
  const declaration = await readDeclaration("dictionary-changes/2026-10-03-load-page-entries-it-0c432803.json");
  assert.ok(declaration.command === "load:page-entries");
  assert.equal(declaration.inputs.archive, `it-${PUBLISHED_ARCHIVE_SHA256.slice(0, 8)}`);
  const measured = JSON.parse(await readFile("reports/2026-10-02-page-entry-recovery.json", "utf8")) as { eligible: number; titles: { outcome: string; definitions: number }[] };
  const recovered = measured.titles.filter((title) => title.outcome === "recovered");
  assert.equal(declaration.expected.written.recovered_entry, measured.eligible);
  assert.equal(declaration.expected.written.raw_page, measured.eligible);
  assert.equal(declaration.expected.written.entry_definition, recovered.reduce((sum, title) => sum + title.definitions, 0));
  assert.equal(declaration.expected.written.corrected_definition, definitionCorrections(CURATED_CORRECTIONS).length);
  assert.deepEqual(declaration.expected.records, { added: 0, changed: 0, removed: 0 });
  assert.deepEqual(declaration.expected.deleted, {});
});
