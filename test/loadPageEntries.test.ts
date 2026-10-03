// `pnpm run load:page-entries` (src/import/loadPageEntries.ts, #440, #477):
// the page-only entries (ADR 0024, ADR 0028) loaded into a dictionary seeded before their
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
import type { FoundRecord } from "../src/import/hiddenLayer.js";
import { planHide } from "../src/import/hideRecords.js";
import { archiveWords, describePlannedEntry, findPageEntries, missingForLoad, PAGE_ENTRY_RULES, planPageEntries, unloaded } from "../src/import/loadPageEntries.js";
import { accentFoldRowOf, seedSql, typoKeyRowsOf } from "../src/import/seedSql.js";
import { FORM_OF_FOREIGN_LEMMA_RULE } from "../src/italian/formOfForeignLemma.js";
import { normalizeItalianExact } from "../src/italian/normalize.js";
import { CURATED_CORRECTIONS, definitionCorrections } from "../src/italian/curatedCorrections.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { servedVersion } from "../src/lookup/served.js";
import { PUBLISHED_ARCHIVE_SHA256, type ArchiveFactsCatalog } from "../src/source/archiveFacts.js";
import { loadFixturePages, rawPageSource, type RawPage } from "../src/source/rawPage.js";
import { PAGE_ENTRY_RULE, PAGE_ENTRY_RULE_V2, recoverPageEntry } from "../src/italian/pageEntry.js";
import { chooseChanges, planApply } from "../src/update/apply.js";
import { parseChange, parseDeclaration, readDeclaration } from "../src/update/declaration.js";
import { diffAgainstMaster } from "../src/update/diff.js";
import { changedUpgrade, planUpgrade, upgradeShortfall, type MasterReader } from "../src/update/master.js";
import { createStatement, masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";

const RELEASE = "it-page-entries";
const SCHEMA = "src/db/schema.sql";
const PAGE_TABLES = ["recovered_entry", "entry_definition", "entry_label", "entry_example", "corrected_definition"];

const pages = await loadFixturePages(resolve("fixtures"));
// `mastoide` and `lungo` are rule v2's: a noun, and a page with two part-of-speech sections (ADR 0028).
const PAGES: RawPage[] = ["raccontare", "fornire", "grufolare", "tremare", "dipendere", "dismagare", "movere", "mastoide", "lungo"].map((title) => {
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

async function seeded(name: string, withPages: boolean, input = archive): Promise<DatabaseSync> {
  const { parts } = await seedSql({
    input,
    outputDir: join(dir, name),
    schema: SCHEMA,
    releaseId: RELEASE,
    license: "CC-BY-SA-4.0",
    ...(withPages ? { rawPages: rawPageSource(PAGES) } : {}),
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
  execute(db, (await planApply(reader, found, chosen, { appliedAt: "2026-10-02T00:00:00Z", catalog: fixtureCatalog(found.master.archiveSha256, found.feed.archiveSha256) })).sql);
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

/** A word's page-only entries' rows as a seed writes them, by page line, without the ids a database gives them. */
function entryRows(db: DatabaseSync, word: string): unknown {
  const entries = db.prepare(`SELECT e.*, p.title, p.revision_id, p.revision_timestamp FROM recovered_entry e JOIN raw_page p ON p.page_id = e.page_id WHERE e.word = ? ORDER BY e.page_line`).all(word) as Record<string, unknown>[];
  assert.ok(entries.length > 0, word);
  const key = entries[0].word_key as string;
  return {
    entries: entries.map(({ entry_id: id, page_id: _page, ...rest }) => {
      const rows = (table: string) => (db.prepare(`SELECT * FROM ${table} WHERE entry_id = ?`).all(id as number) as Record<string, unknown>[]).map(({ entry_id: _id, ...row }) => row);
      return { entry: rest, definitions: rows("entry_definition"), labels: rows("entry_label"), examples: rows("entry_example"), corrections: rows("corrected_definition") };
    }),
    accent: db.prepare("SELECT fold_key, headword, languages, richness FROM accent_fold WHERE surface_key = ?").all(key).map((row) => ({ ...row })),
    typo: db.prepare("SELECT deletion_key, languages, richness FROM typo_key WHERE surface_key = ? ORDER BY deletion_key").all(key).map((row) => ({ ...row })),
  };
}

const LOADED = ["dismagare", "fornire", "grufolare", "lungo", "mastoide", "raccontare", "tremare"];

test("a dictionary seeded before the tables, with a feed applied and records hidden, gains the entries and keeps every earlier row", async () => {
  const db = await liveShaped("live");
  const fresh = await seeded("fresh", true);
  try {
    const reader = readerOf(db);
    const before = snapshot(db);
    const versionBefore = await servedVersion(fromNodeSqlite(db), RELEASE);
    assert.equal((await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "raccontare" })).outcome, "not-found");

    // `dipendere` is spelled by a record a hide took out of search: the seed reads no page for it, and nor does the load.
    const spelled = await archiveWords(archive);
    assert.ok(spelled.has("dipendere"));
    const found = await findPageEntries(PAGES, spelled);
    const plan = planPageEntries(reader, found, CURATED_CORRECTIONS);
    assert.deepEqual(plan.entries.map((planned) => [planned.entry.page.title, planned.entry.rule, planned.state]), [
      ["dismagare", PAGE_ENTRY_RULE, "write"],
      ["fornire", PAGE_ENTRY_RULE, "write"],
      ["grufolare", PAGE_ENTRY_RULE, "write"],
      // One entry per part-of-speech section (ADR 0028).
      ["lungo", PAGE_ENTRY_RULE_V2, "write"],
      ["lungo", PAGE_ENTRY_RULE_V2, "write"],
      ["mastoide", PAGE_ENTRY_RULE_V2, "write"],
      ["raccontare", PAGE_ENTRY_RULE, "write"],
      ["tremare", PAGE_ENTRY_RULE, "write"],
    ]);
    assert.deepEqual(plan.corrections.map(({ id, title }) => [id, title]), [["page:3906191:0", "grufolare"], ["page:4002473:0", "tremare"]]);
    assert.deepEqual(plan.counts.records, { added: 0, changed: 0, removed: 0 });
    assert.equal(plan.counts.written.recovered_entry, 8);
    // `lungo`'s two entries share its one page row.
    assert.equal(plan.counts.written.raw_page, 7);
    assert.equal(plan.counts.written.corrected_definition, 2);
    assert.deepEqual(plan.counts.deleted, {});

    // The load's SQL is data only (#507): the tables come from the upgrade, run as its own batch first.
    assert.doesNotMatch(plan.sql, /\bCREATE\b/i);
    assert.deepEqual(missingForLoad(reader), [...PAGE_TABLES, "recovered_entry_by_key"]);
    execute(db, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    assert.deepEqual(missingForLoad(reader), []);
    // A plan counts the same, and writes the same SQL, before the upgrade as after it.
    const upgraded = planPageEntries(reader, found, CURATED_CORRECTIONS);
    assert.deepEqual(upgraded.counts.toJSON(), plan.counts.toJSON());
    assert.equal(upgraded.sql, plan.sql);
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
    assert.deepEqual(rawPage, found.map((entry) => ({ title: entry.page.title, revision_id: entry.page.revisionId })));

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
    const again = planPageEntries(reader, await findPageEntries(PAGES, spelled), CURATED_CORRECTIONS);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
    assert.deepEqual(again.entries.map(describePlannedEntry).filter((line) => line.endsWith("written") && !line.endsWith("already written")), []);
  } finally {
    db.close();
    fresh.close();
  }
});

/**
 * `recovered_entry` as #440 created it on the shared dictionary, verbatim from
 * src/db/schema.sql before ADR 0028: rule v1's verbs, one entry per word.
 */
const V1_RECOVERED_ENTRY = `CREATE TABLE recovered_entry (
  entry_id INTEGER PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES source_release(release_id),
  page_id INTEGER NOT NULL,
  word TEXT NOT NULL,
  word_key TEXT NOT NULL,
  pos TEXT NOT NULL CHECK (pos = 'verb'),
  pos_title TEXT NOT NULL CHECK (pos_title = 'Verbo'),
  rule TEXT NOT NULL CHECK (rule = 'italian-page-entry/v1'),
  page_line INTEGER NOT NULL CHECK (page_line > 0),
  wikitext TEXT NOT NULL,
  UNIQUE (release_id, word),
  FOREIGN KEY (page_id, release_id) REFERENCES raw_page(page_id, release_id)
) STRICT;`;

/** Every row of the page-entry tables and raw_page, by table. */
const pageEntrySnapshot = (db: DatabaseSync): string[][] =>
  ["raw_page", ...PAGE_TABLES].map((table) => (db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as object[]).map((row) => JSON.stringify(row)));

test("a dictionary loaded under rule v1 keeps those rows through the upgrade's rebuild, and the load then adds only rule v2's entries", async () => {
  const db = await liveShaped("v1-loaded");
  const fresh = await seeded("fresh-v2", true);
  try {
    const reader = readerOf(db);
    const schema = await readFile(SCHEMA, "utf8");
    // The shared dictionary after #440: the page-entry tables with rule v1's definition, holding rule v1's entries and their corrections.
    const v1Schema = schema.replace(createStatement(schema, "TABLE", "recovered_entry"), V1_RECOVERED_ENTRY);
    assert.notEqual(v1Schema, schema);
    execute(db, masterUpgradeSql(v1Schema));
    const spelled = await archiveWords(archive);
    const found = await findPageEntries(PAGES, spelled);
    const v1 = planPageEntries(reader, found.filter((entry) => entry.rule === PAGE_ENTRY_RULE), CURATED_CORRECTIONS);
    execute(db, v1.sql);
    assert.equal(v1.counts.written.recovered_entry, 5);
    assert.equal(v1.counts.written.corrected_definition, 2);
    const v1Rows = pageEntrySnapshot(db);

    // Rule v2's entries need the new definition: the load is refused whole without the upgrade.
    const early = planPageEntries(reader, found, CURATED_CORRECTIONS);
    assert.throws(() => execute(db, early.sql), /CHECK constraint failed|UNIQUE constraint failed/);
    assert.deepEqual(pageEntrySnapshot(db), v1Rows);

    // The upgrade rebuilds recovered_entry to schema.sql's definition and copies every row back as it was.
    assert.deepEqual(changedUpgrade(reader, schema), ["recovered_entry"]);
    const upgrade = planUpgrade(reader, schema);
    assert.deepEqual(upgrade.kept.map(({ name, rows }) => [name, rows]), [["recovered_entry", 5], ["entry_definition", v1.counts.written.entry_definition], ["entry_label", v1.counts.written.entry_label ?? 0], ["entry_example", v1.counts.written.entry_example ?? 0], ["corrected_definition", 2]]);
    execute(db, upgrade.sql);
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), []);
    assert.deepEqual(changedUpgrade(reader, schema), []);
    assert.deepEqual(pageEntrySnapshot(db), v1Rows);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

    // Rule v2 reads every rule v1 page as v1 still, so those entries are already held; only v2's are written.
    const plan = planPageEntries(reader, found, CURATED_CORRECTIONS);
    assert.deepEqual(plan.entries.map((planned) => [planned.entry.page.title, planned.state]), [
      ["dismagare", "already"],
      ["fornire", "already"],
      ["grufolare", "already"],
      ["lungo", "write"],
      ["lungo", "write"],
      ["mastoide", "write"],
      ["raccontare", "already"],
      ["tremare", "already"],
    ]);
    assert.equal(plan.counts.written.recovered_entry, 3);
    assert.equal(plan.counts.written.raw_page, 2);
    assert.equal(plan.counts.written.corrected_definition, undefined);
    execute(db, plan.sql);
    assert.deepEqual(unloaded(reader, plan), []);

    // Every word holds what a fresh seed under both rules writes for it, and a second run plans nothing.
    for (const word of LOADED) assert.deepEqual(entryRows(db, word), entryRows(fresh, word), word);
    assert.equal((db.prepare("SELECT count(*) AS n FROM recovered_entry").get() as { n: number }).n, 8);
    const again = planPageEntries(reader, found, CURATED_CORRECTIONS);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
  } finally {
    db.close();
    fresh.close();
  }
});

test("a page whose title differs from a word's only in case ranks that word's key together with it, as the seed does", async () => {
  // Synthetic titles over a verbatim revision: `Mare` shares `mare`'s key, which an archive lemma heads,
  // and `Mastoide` shares `mastoide`'s, which another page-only entry heads.
  const mastoide = PAGES.find((page) => page.title === "mastoide");
  assert.ok(mastoide);
  const cased = [{ ...mastoide, title: "Mare" }, { ...mastoide, title: "Mastoide" }];
  const pages = [...PAGES, ...cased];
  const db = await liveShaped("cased");
  const { parts } = await seedSql({ input: archive, outputDir: join(dir, "fresh-cased"), schema: SCHEMA, releaseId: RELEASE, license: "CC-BY-SA-4.0", rawPages: rawPageSource(pages), onRejection: () => {} });
  const fresh = new DatabaseSync(":memory:");
  for (const part of parts) fresh.exec(await readFile(part, "utf8"));
  try {
    const reader = readerOf(db);
    const typoOf = (on: DatabaseSync, key: string) => on.prepare("SELECT languages, richness FROM typo_key WHERE deletion_key = ? AND surface_key = ?").get(key, key) as { languages: number; richness: number };
    const lemma = typoOf(db, "mare");
    execute(db, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    const plan = planPageEntries(reader, await findPageEntries(pages, await archiveWords(archive)), CURATED_CORRECTIONS);
    execute(db, plan.sql);
    assert.deepEqual(unloaded(reader, plan), []);
    // `mare` keeps its lemma's languages, and its rank adds the page's definitions.
    const read = recoverPageEntry(mastoide, new Set());
    assert.ok(read.outcome === "recovered");
    const page = read.entries.reduce((sum, entry) => sum + entry.definitions.length, 0);
    assert.deepEqual({ ...typoOf(db, "mare") }, { languages: lemma.languages, richness: lemma.richness + page });
    for (const key of ["mare", "mastoide"]) assert.deepEqual({ ...typoOf(db, key) }, { ...typoOf(fresh, key) }, key);
    for (const table of ["accent_fold", "typo_key"]) {
      const rows = (on: DatabaseSync) => on.prepare(`SELECT * FROM ${table} WHERE surface_key IN ('mare', 'mastoide') ORDER BY 2, 3`).all().map((row) => JSON.stringify({ ...row }));
      assert.deepEqual(rows(db), rows(fresh), table);
    }
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
    const found = await findPageEntries(PAGES, await archiveWords(archive));
    assert.throws(() => planPageEntries(reader, found, CURATED_CORRECTIONS), /not every page-entry table/);
  } finally {
    db.close();
  }
});

test("a title whose page the dictionary holds from another revision is refused", async () => {
  const db = await liveShaped("other-revision");
  try {
    db.exec(`INSERT INTO raw_page (page_id, release_id, wiki, title, revision_id, revision_timestamp) VALUES (9999, '${RELEASE}', 'it.wiktionary.org', 'fornire', 1, '2020-01-01T00:00:00Z')`);
    const reader = readerOf(db);
    const found = await findPageEntries(PAGES, await archiveWords(archive));
    assert.throws(() => planPageEntries(reader, found, CURATED_CORRECTIONS), /holds revision 1 of fornire/);
  } finally {
    db.close();
  }
});

// A form whose own forms spell `raccontare`: it gives the page-only entry's
// key a `lookup_form` row, so hiding it or adding it recomputes that key's
// search rows (#501). It points at `raccontare` and spells no title itself, so
// the seed still recovers the entry.
const RACCONTA = record({
  word: "racconta",
  pos: "verb",
  pos_title: "Voce verbale",
  forms: [{ form: "raccontare", tags: ["infinitive"] }],
  senses: [{ glosses: ["terza persona singolare del presente indicativo di raccontare"], tags: ["form-of"], form_of: [{ word: "raccontare" }] }],
});

/** `raccontare`'s `typo_key` and `accent_fold` rows as the seed writes them for its page-only entry: headed, no translation, ranked by its definitions. */
function seededNearby(db: DatabaseSync): { typo: unknown[]; accent: unknown[] } {
  const { n: definitions } = db.prepare("SELECT count(*) AS n FROM entry_definition d JOIN recovered_entry e ON e.entry_id = d.entry_id WHERE e.word = 'raccontare'").get() as { n: number };
  assert.ok(definitions > 0);
  const key = normalizeItalianExact("raccontare");
  const score = { languages: new Set<string>(), richness: definitions };
  const accent = accentFoldRowOf(key, true, score);
  return {
    typo: typoKeyRowsOf(key, score).map((row) => ({ deletion_key: row.deletionKey, languages: row.languages, richness: row.richness })).sort((a, b) => (a.deletion_key < b.deletion_key ? -1 : 1)),
    accent: accent === undefined ? [] : [{ fold_key: accent.foldKey, headword: 1, languages: 0, richness: definitions }],
  };
}

/** `raccontare`'s nearby rows as the dictionary holds them. */
function heldNearby(db: DatabaseSync): { typo: unknown[]; accent: unknown[] } {
  const { typo, accent } = entryRows(db, "raccontare") as { typo: unknown[]; accent: unknown[] };
  return { typo, accent };
}

test("hiding a record that spells a page-only entry's key keeps the entry's search rows (#501)", async () => {
  const input = join(dir, "hide-racconta.jsonl.gz");
  await writeFile(input, gzipSync(`${[...master, RACCONTA].join("\n")}\n`));
  const db = await seeded("hide-racconta", true, input);
  try {
    const reader = readerOf(db);
    const seededRows = seededNearby(db);
    assert.ok(seededRows.typo.length > 0);
    assert.deepEqual(heldNearby(db), seededRows);
    // The form's row spells the entry's key, so the hide recomputes it.
    assert.deepEqual(db.prepare("SELECT origin FROM lookup_form lf JOIN source_record r ON r.record_id = lf.record_id WHERE r.word = 'racconta' AND lf.surface_key = 'raccontare'").all().map((row) => ({ ...row })), [{ origin: "embedded-form" }]);
    const lineNo = master.length + 1;
    const found: FoundRecord[] = [
      { rule: FORM_OF_FOREIGN_LEMMA_RULE, word: "racconta", lineNo, form: { lineNo, word: "racconta", code: "es", lemmaLine: 1, lemma: "raccontare" } },
    ];
    const plan = planHide(reader, found);
    assert.equal(plan.hides.length, 1);
    execute(db, plan.sql);
    assert.deepEqual(heldNearby(db), seededRows);
  } finally {
    db.close();
  }
});

test("applying a feed's new record that spells a page-only entry's key keeps the entry's search rows (#501)", async () => {
  const feed = join(dir, "feed-racconta.jsonl.gz");
  await writeFile(feed, gzipSync(`${[...master, RACCONTA].join("\n")}\n`));
  const db = await seeded("apply-racconta", true);
  try {
    const reader = readerOf(db);
    const seededRows = seededNearby(db);
    assert.ok(seededRows.typo.length > 0);
    assert.deepEqual(heldNearby(db), seededRows);
    const diffed = await diffAgainstMaster(reader, feed);
    assert.deepEqual(diffed.diff.changes.map((change) => [change.kind, change.word]), [["new", "racconta"]]);
    const chosen = chooseChanges(diffed, diffed.diff.changes.map((change) => change.id));
    const plan = await planApply(reader, diffed, chosen, {
      appliedAt: "2026-10-03T00:00:00Z",
      catalog: fixtureCatalog(diffed.master.archiveSha256, diffed.feed.archiveSha256),
    });
    execute(db, plan.sql);
    assert.deepEqual(heldNearby(db), seededRows);
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
    const change = parseChange("test", JSON.stringify({ command: "load:page-entries", inputs: { archive: releaseId, rules: [...PAGE_ENTRY_RULES] } }));
    const plan = await planWrite(readyChange(change, { archive, dump }), reader, "2026-10-03T00:00:00Z", { catalog, dumps });
    const expected = planPageEntries(reader, await findPageEntries(PAGES, await archiveWords(archive)), CURATED_CORRECTIONS);
    assert.deepEqual(plan.run.counts.toJSON(), expected.counts.toJSON());
    assert.equal(plan.sql, expected.sql);
    // The declaration that pins those counts parses; a wrong rule set does not.
    parseDeclaration("ok.json", JSON.stringify({ command: "load:page-entries", inputs: { archive: releaseId, rules: [...PAGE_ENTRY_RULES] }, expected: expected.counts.toJSON() }));
    assert.throws(() => parseDeclaration("bad.json", JSON.stringify({ command: "load:page-entries", inputs: { archive: releaseId, rules: [] }, expected: expected.counts.toJSON() })), /lacks italian-page-entry\/v1, italian-page-entry\/v2/);
    // Rule v1 alone, as #440 declared it, is not what the command applies now.
    assert.throws(() => parseDeclaration("v1.json", JSON.stringify({ command: "load:page-entries", inputs: { archive: releaseId, rules: [PAGE_ENTRY_RULE] }, expected: expected.counts.toJSON() })), /lacks italian-page-entry\/v2/);
    execute(db, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    execute(db, plan.sql);
    assert.deepEqual(plan.readBack(reader), []);
    // Another archive than the master's is refused before anything is planned.
    await assert.rejects(planWrite(readyChange(change, { archive: later, dump }), reader, "2026-10-03T00:00:00Z", { catalog, dumps }), /was seeded from the archive/);
  } finally {
    db.close();
  }
});

test("the deployed rule v1 declaration pinned the counts of the 14 the measurement found", async () => {
  // Deployed by #440 and never read again (src/deploy/pending.ts reads only added files), so it is
  // read as JSON: the command now applies rule v2 too, and its parser refuses a rule set without it.
  const declaration = JSON.parse(await readFile("dictionary-changes/2026-10-03-load-page-entries-it-0c432803.json", "utf8")) as {
    inputs: { archive: string; rules: string[] };
    expected: { records: unknown; written: Record<string, number>; deleted?: unknown };
  };
  assert.deepEqual(declaration.inputs, { archive: `it-${PUBLISHED_ARCHIVE_SHA256.slice(0, 8)}`, rules: [PAGE_ENTRY_RULE] });
  const measured = JSON.parse(await readFile("reports/2026-10-02-page-entry-recovery.json", "utf8")) as { eligible: number; titles: { outcome: string; definitions: number }[] };
  const recovered = measured.titles.filter((title) => title.outcome === "recovered");
  assert.equal(declaration.expected.written.recovered_entry, measured.eligible);
  assert.equal(declaration.expected.written.raw_page, measured.eligible);
  assert.equal(declaration.expected.written.entry_definition, recovered.reduce((sum, title) => sum + title.definitions, 0));
  assert.equal(declaration.expected.written.corrected_definition, definitionCorrections(CURATED_CORRECTIONS).length);
  assert.deepEqual(declaration.expected.records, { added: 0, changed: 0, removed: 0 });
  assert.equal(declaration.expected.deleted, undefined);
});

test("the committed rule v2 declaration loads the master's entries under both rules, on top of rule v1's", async () => {
  const declaration = await readDeclaration("dictionary-changes/2026-10-03-load-page-entries-v2-it-0c432803.json");
  assert.ok(declaration.command === "load:page-entries");
  assert.equal(declaration.inputs.archive, `it-${PUBLISHED_ARCHIVE_SHA256.slice(0, 8)}`);
  assert.deepEqual([...declaration.inputs.rules], [...PAGE_ENTRY_RULES]);
  assert.deepEqual(declaration.expected.records, { added: 0, changed: 0, removed: 0 });
  // Rule v1's 14 entries and their two corrected definitions are held already: the load writes no correction.
  assert.equal(declaration.expected.written.corrected_definition, undefined);
  // A page gives one raw_page row and at least one entry.
  const { raw_page: pages = 0, recovered_entry: entries = 0 } = declaration.expected.written;
  assert.ok(pages > 0 && entries >= pages);
});
