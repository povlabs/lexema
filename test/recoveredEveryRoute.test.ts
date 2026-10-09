// `pnpm run load:recovered-definitions` on every route a seed writes (#770): a
// dictionary that lacks some of what a fresh seed recovers, on any route,
// record-backed or page-only, gains exactly those rows and changes no other,
// and the keys of its held page-only entries rank as a fresh seed ranks them
// (#785). The records are verbatim archive lines of it-0c432803 and the pages
// verbatim revisions of its dump itwiktionary-20260701 (fixtures/recovered-routes/,
// fixtures/unlisted-definitions/, fixtures/upstream-pages/). `Aglio` is
// revision 4023379, the one that dump holds
// (reports/2026-10-03-unrecorded-page-layouts.json), saved off the wiki's API
// by that revision id with its SHA-1 checked.

import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import { wordsOfRecoveredDefinitions } from "../src/deploy/touchedWords.js";
import { archiveWords } from "../src/import/loadPageEntries.js";
import {
  appendKeepsSeedOrder,
  findRecoveredDefinitions,
  planListing,
  planRecoveredDefinitions,
  readPagesForTheRules,
  unwrittenDefinitions,
  type FoundDefinitions,
} from "../src/import/loadRecoveredDefinitions.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { loadFixturePages, rawPageSource, readSavedPage, type RawPage } from "../src/source/rawPage.js";
import type { MasterReader } from "../src/update/master.js";
import { PlanCounts } from "../src/update/planCounts.js";

const RELEASE = "it-routes";
const SCHEMA = "src/db/schema.sql";
const ROUTES_DIR = resolve("fixtures/recovered-routes");
const UNLISTED_DIR = resolve("fixtures/unlisted-definitions");

const saved = async (dir: string, name: string): Promise<RawPage> => readSavedPage(await readFile(join(dir, name), "utf8"), name);
const fixturePages = await loadFixturePages(resolve("fixtures"));
const PAGES: RawPage[] = [
  fixturePages.page("casa") ?? assert.fail("casa"),
  fixturePages.page("pantomima") ?? assert.fail("pantomima"),
  await saved(UNLISTED_DIR, "centouno.wikitext"),
  await saved(UNLISTED_DIR, "bavaglio.wikitext"),
  ...(await Promise.all((await readdir(ROUTES_DIR)).filter((name) => name.endsWith(".wikitext")).sort().map((name) => saved(ROUTES_DIR, name)))),
];

const lines = async (path: string): Promise<string[]> => (await readFile(path, "utf8")).trimEnd().split("\n");
const wordOf = (line: string): string => (JSON.parse(line) as { word: string }).word;

let dir: string;
let archive: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-every-route-"));
  const devSeed = await lines("fixtures/dev-seed.jsonl");
  const unlisted = await lines(join(UNLISTED_DIR, "archive-lines.jsonl"));
  const master = [
    devSeed.find((line) => wordOf(line) === "casa") ?? assert.fail("casa"),
    ...(await lines("fixtures/pantomima.jsonl")),
    ...unlisted.filter((line) => ["centouno", "bavaglio"].includes(wordOf(line))),
    // progetto (archive line 24370), quadro's Aggettivo (archive line 70573), magrebina (archive line 59503)
    // and aglio (archive line 1349), whose key the page-only entry `Aglio` shares.
    ...(await lines(join(ROUTES_DIR, "archive-lines.jsonl"))),
  ];
  archive = join(dir, "master.jsonl.gz");
  await writeFile(archive, gzipSync(`${master.join("\n")}\n`));
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

async function seeded(name: string): Promise<DatabaseSync> {
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, name),
    schema: SCHEMA,
    releaseId: RELEASE,
    license: "CC-BY-SA-4.0",
    rawPages: rawPageSource(PAGES),
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
  return db;
}

/** One row on each route a seed writes, and one page-only entry's definition: what a dictionary seeded before a renderer read them lacks. */
const CLASS: readonly { word: string; line: number; route: string }[] = [
  { word: "casa", line: 20, route: "below-page-control" },
  { word: "progetto", line: 7, route: "sub-term" },
  { word: "quadro", line: 14, route: "lead-in-item" },
  { word: "pantomima", line: 6, route: "wrapped-prose" },
  { word: "centouno", line: 4, route: "bullet-line" },
  { word: "bavaglio", line: 4, route: "prose-line" },
  // A wrapped-prose line above a prose line the dictionary holds (archive line 59503).
  { word: "magrebina", line: 7, route: "wrapped-prose" },
];

/** magrebina's prose line as a dictionary that read it alone holds it: its record's first definition. */
const MAGREBINA_PROSE = `SELECT d.* FROM recovered_definition d JOIN source_record r ON r.record_id = d.record_id WHERE r.word = 'magrebina' AND d.page_line = 8`;

/** A correction of `new age`'s first definition, as `correct:records` writes one beside a held entry. */
const NEW_AGE_CORRECTION = `INSERT INTO corrected_definition (entry_id, definition_index, text, correction_id, evidence_url)
  SELECT entry_id, 0, 'movimento spirituale', 'page:4066634:0', 'https://it.wiktionary.org/w/index.php?title=new_age&oldid=4066634'
    FROM recovered_entry WHERE word = 'new age'`;

/** `key`'s `accent_fold` and `typo_key` rows ranked `by` lower than a fresh seed ranks them. */
const RANKED_LOWER = (key: string, by: number): string =>
  ["accent_fold", "typo_key"].map((table) => `UPDATE ${table} SET richness = richness - ${by} WHERE surface_key = '${key}';`).join("\n");

/** How many `accent_fold` and `typo_key` rows `db` holds for `key`. A key with no accent to fold has no `accent_fold` row. */
const nearbyCount = (db: DatabaseSync, key: string): { accent_fold: number; typo_key: number } => {
  const count = (table: string): number => (db.prepare(`SELECT count(*) AS n FROM ${table} WHERE surface_key = ?`).get(key) as { n: number }).n;
  return { accent_fold: count("accent_fold"), typo_key: count("typo_key") };
};

/** `key`'s richness, off its own `typo_key` row. */
const rankOf = (db: DatabaseSync, key: string): number =>
  (db.prepare("SELECT richness FROM typo_key WHERE deletion_key = ? AND surface_key = ?").get(key, key) as { richness: number }).richness;

/** Every row of the nearby tables, sorted. */
const nearbyRows = (db: DatabaseSync): Map<string, string[]> =>
  new Map(["accent_fold", "typo_key"].map((table) => [table, (db.prepare(`SELECT * FROM ${table}`).all() as object[]).map((row) => JSON.stringify(row)).sort()]));

/** A fresh seed without the class rows: the shape of a dictionary seeded before the renderer read them, `new age` ranked by its one definition then. */
async function lacking(name: string): Promise<DatabaseSync> {
  const db = await seeded(name);
  const ids = CLASS.map(({ word, line, route }) => {
    const row = db
      .prepare(
        `SELECT d.recovered_id FROM recovered_definition d JOIN source_record r ON r.record_id = d.record_id
          WHERE r.word = ? AND d.page_line = ? AND d.route = ?`,
      )
      .get(word, line, route) as { recovered_id: number } | undefined;
    assert.ok(row, `a fresh seed recovers ${word} line ${line} on ${route}`);
    return row.recovered_id;
  });
  const entry = db.prepare(`SELECT entry_id FROM recovered_entry WHERE word = 'new age'`).get() as { entry_id: number } | undefined;
  assert.ok(entry, "a fresh seed reads the new age entry");
  execute(
    db,
    `${["recovered_label", "recovered_example", "recovered_definition"].map((table) => `DELETE FROM ${table} WHERE recovered_id IN (${ids.join(", ")});`).join("\n")}
     ${["entry_label", "entry_example", "entry_definition"].map((table) => `DELETE FROM ${table} WHERE entry_id = ${entry.entry_id} AND definition_index = 1;`).join("\n")}
     DELETE FROM raw_page WHERE page_id NOT IN (SELECT page_id FROM recovered_definition)
       AND page_id NOT IN (SELECT page_id FROM hidden_record WHERE page_id IS NOT NULL)
       AND page_id NOT IN (SELECT page_id FROM recovered_entry);
     ${NEW_AGE_CORRECTION};
     ${RANKED_LOWER("new age", 1)}
     UPDATE recovered_definition SET definition_index = 0 WHERE recovered_id = (SELECT recovered_id FROM (${MAGREBINA_PROSE}));`,
  );
  return db;
}

async function found(): Promise<FoundDefinitions> {
  const read = await readPagesForTheRules(PAGES, await archiveWords(archive));
  return { records: await findRecoveredDefinitions(archive, read.pages), entries: read.entries };
}

/** Every row of every table, by table. */
function snapshot(db: DatabaseSync): Map<string, string[]> {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  return new Map(tables.map(({ name }) => [name, (db.prepare(`SELECT * FROM ${name}`).all() as object[]).map((row) => JSON.stringify(row)).sort()]));
}

/** The recovered layer as a reader can tell it apart: every row by its record, place and content, with its lead-in by page line, labels and examples, and its page by title and revision; no row id. */
function recoveredLayer(db: DatabaseSync): unknown[] {
  return db
    .prepare(
      `SELECT r.line_no, r.word, r.pos_title, d.definition_index, d.route, d.term, d.page_line, d.wikitext, d.text, d.held_as_example,
              d.lead_in_sense_index, li.page_line AS lead_in_page_line, p.title, p.revision_id,
              (SELECT json_group_array(json_array(label_index, label)) FROM recovered_label l WHERE l.recovered_id = d.recovered_id) AS labels,
              (SELECT json_group_array(json_array(example_index, page_line, wikitext, text)) FROM recovered_example x WHERE x.recovered_id = d.recovered_id) AS examples
         FROM recovered_definition d JOIN source_record r ON r.record_id = d.record_id JOIN raw_page p ON p.page_id = d.page_id
         LEFT JOIN recovered_definition li ON li.recovered_id = d.lead_in_recovered_id
        ORDER BY r.line_no, d.definition_index`,
    )
    .all()
    .map((row) => ({ ...row }));
}

const ENTRY_TABLES = ["recovered_entry", "entry_definition", "entry_label", "entry_example", "entry_fact", "corrected_definition"];
const NEARBY = ["accent_fold", "typo_key"];
const PRESERVED = (table: string): boolean =>
  ![...NEARBY, "raw_page", "recovered_definition", "recovered_label", "recovered_example", "entry_definition", "entry_label", "entry_example"].includes(table);

test("a dictionary lacking a definition on each route a seed writes, and a held entry's definition, gains exactly what a fresh seed holds", async () => {
  const db = await lacking("lacking");
  const fresh = await seeded("fresh");
  try {
    execute(fresh, NEW_AGE_CORRECTION);
    const reader = readerOf(db);
    const before = snapshot(db);
    const plan = planRecoveredDefinitions(reader, await found());

    const writes = plan.records.flatMap((record) =>
      record.definitions.flatMap((planned) => (planned.state === "write" ? [[record.found.word, planned.definition.ref.line, planned.definition.route, planned.definition.labels]] : [])),
    );
    assert.deepEqual(writes, [
      ["casa", 20, "below-page-control", ["astrologia"]],
      ["pantomima", 6, "wrapped-prose", ["figurato"]],
      ["centouno", 4, "bullet-line", ["matematica"]],
      ["bavaglio", 4, "prose-line", []],
      ["progetto", 7, "sub-term", ["diritto", "politica"]],
      ["quadro", 14, "lead-in-item", ["spregiativo"]],
      ["magrebina", 7, "wrapped-prose", []],
    ]);
    // A fresh seed lists magrebina's wrapped-prose line first, so the prose line it holds moves after it, and nothing else of it changes.
    const magrebina = plan.records.find((record) => record.found.word === "magrebina") ?? assert.fail();
    const prose = db.prepare(MAGREBINA_PROSE).get() as { recovered_id: number };
    assert.deepEqual(magrebina.definitions.map((planned) => [planned.state, planned.definition.ref.line, planned.state === "write" ? planned.definitionIndex : null]), [
      ["write", 7, 0],
      ["already", 8, null],
    ]);
    assert.deepEqual(magrebina.moves, [{ recoveredId: prose.recovered_id, pageLine: 8, from: 0, to: 1 }]);
    assert.deepEqual(plan.records.filter((record) => record.found.word !== "magrebina").flatMap((record) => record.moves), []);
    const progetto = plan.records.find((record) => record.found.word === "progetto") ?? assert.fail();
    assert.equal(progetto.found.lineNo, 5, "progetto is the fixture archive's fifth line, archive line 24370 of it-0c432803");
    const subTerm = progetto.definitions[0];
    assert.ok(subTerm.state === "write" && subTerm.definition.route === "sub-term");
    assert.equal(subTerm.definition.term, "progetto di legge");
    const quadro = plan.records.find((record) => record.found.word === "quadro") ?? assert.fail();
    assert.deepEqual(quadro.definitions.map((planned) => [planned.state, planned.definition.ref.line, planned.definition.text]), [
      ["already", 13, "detto di persona ponderata e raziocinante"],
      ["write", 14, "detto di chi è lento nel comprendere"],
    ]);
    // Listed under the `#` line its lead-in is, a sense the record carries, as the seed lists it.
    assert.deepEqual(quadro.definitions[1].state === "write" ? quadro.definitions[1].leadIn : null, { in: "sense", senseIndex: 6 });
    const newAgeEntry = plan.entries.find((entry) => entry.entry.page.title === "new age") ?? assert.fail();
    assert.deepEqual(
      plan.entries.map((entry) => [entry.entry.page.title, entry.definitions.map((planned) => [planned.state, planned.definition.ref.line, planned.definition.text, planned.definition.labels])]),
      [
        // Held whole: the load writes nothing for it, and its key's rows already rank as a fresh seed's.
        ["Aglio", [["already", 4, "genere della famiglia delle Liliacee; la sua classificazione scientifica è Allium sativum ( tassonomia)", ["botanica"]]]],
        [
          "new age",
          [
            ["already", 3, newAgeEntry.definitions[0].definition.text, ["forestierismo"]],
            ["write", 5, "persona trasognante che conclude poco e si impone come moralista", ["gergale", "spregiativo"]],
          ],
        ],
      ],
    );
    // new age's key alone is ranked again: not Aglio's, which the load writes nothing for, nor any record's.
    assert.deepEqual(plan.rerankedKeys, ["new age"]);
    const newAgeRows = nearbyCount(fresh, "new age");
    assert.ok(newAgeRows.typo_key > 0);
    // The pages of progetto, pantomima, centouno and bavaglio, which no held row names any more.
    assert.deepEqual(
      plan.counts.toJSON(),
      new PlanCounts(
        { added: 0, changed: 0, removed: 0 },
        // Seven written and magrebina's held prose line moved; new age's nearby rows written again at a fresh seed's rank.
        { raw_page: 4, recovered_definition: 8, recovered_label: 6, recovered_example: 1, entry_definition: 1, entry_label: 2, entry_example: 1, ...newAgeRows },
        newAgeRows,
      ).toJSON(),
    );
    // Data only: the rows deleted are new age's nearby rows ranked before its definition was written, and the one held row changed is the one moved.
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/i);
    const deletes = plan.sql.match(/^DELETE .*$/gm) ?? [];
    assert.equal(deletes.length, newAgeRows.accent_fold + newAgeRows.typo_key);
    assert.ok(deletes.every((statement) => /^DELETE FROM (accent_fold|typo_key) WHERE .* surface_key = 'new age';$/.test(statement)), deletes.join("\n"));
    assert.deepEqual(plan.sql.match(/^UPDATE .*$/gm), [
      `UPDATE recovered_definition SET definition_index = definition_index + 1000000 WHERE recovered_id IN (SELECT value FROM json_each('[${prose.recovered_id}]'));`,
      `UPDATE recovered_definition SET definition_index = 1 WHERE recovered_id = ${prose.recovered_id};`,
    ]);
    assert.deepEqual(plan.records.flatMap((record) => record.differing), []);
    const listing = planListing(plan);
    assert.equal(listing.filter((line) => line.includes(" — written as ")).length, 8);
    assert.ok(listing.some((line) => line.startsWith("magrebina (") && line.includes("line 8): held as recovered") && line.includes("moved from index 0 to 1")), listing.join("\n"));
    assert.ok(listing.some((line) => line.startsWith("progetto (Sostantivo, archive line 5,") && line.includes("line 7, sub-term") && line.includes("[diritto, politica]")), listing.join("\n"));
    assert.ok(listing.some((line) => line.startsWith("new age (page-only entry") && line.includes("line 5, sense-line") && line.includes("[gergale, spregiativo]")), listing.join("\n"));
    assert.ok(listing.includes("new age: accent_fold and typo_key rows set to a fresh seed's rank"), listing.join("\n"));
    assert.match(listing.at(-2) ?? "", /^8 definition\(s\) written for 8 word\(s\), and 1 held one\(s\) moved/);
    assert.match(listing.at(-1) ?? "", /^0 held definition/);

    execute(db, plan.sql);
    assert.deepEqual(unwrittenDefinitions(reader, plan), []);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

    // The recovered layer and the page-only entries' tables hold what a fresh seed's do.
    assert.deepEqual(recoveredLayer(db), recoveredLayer(fresh));
    const after = snapshot(db);
    const seed = snapshot(fresh);
    for (const table of ENTRY_TABLES) assert.deepEqual(after.get(table), seed.get(table), table);
    // So do the nearby tables, byte for byte: new age ranked by both its definitions, richness included.
    assert.deepEqual(nearbyRows(db), nearbyRows(fresh));
    assert.equal(rankOf(db, "new age"), 2);
    assert.deepEqual(
      after.get("raw_page")?.map((row) => JSON.parse(row) as { title: string; revision_id: number }).map(({ title, revision_id }) => `${title}@${revision_id}`).sort(),
      seed.get("raw_page")?.map((row) => JSON.parse(row) as { title: string; revision_id: number }).map(({ title, revision_id }) => `${title}@${revision_id}`).sort(),
    );
    // Every row held before is held after, unchanged but for the moved row's index, and every other table is as it was: records, `source_record_json` and the corrected definition included.
    const movedRow = (row: string): boolean => (JSON.parse(row) as { recovered_id?: number }).recovered_id === prose.recovered_id;
    for (const [table, rows] of before) {
      const now = new Set(after.get(table));
      const lost = rows.filter((row) => !now.has(row));
      if (table === "recovered_definition") {
        assert.deepEqual(lost.map((row) => ({ ...(JSON.parse(row) as object), definition_index: 1 })), [db.prepare(MAGREBINA_PROSE).get()].map((row) => ({ ...row })), "only the moved row changed, and only its index");
        assert.ok(lost.every(movedRow));
      } else if (NEARBY.includes(table)) {
        assert.ok(lost.every((row) => (JSON.parse(row) as { surface_key: string }).surface_key === "new age"), `${table} changed a row of another key`);
      } else assert.deepEqual(lost, [], `${table} lost or changed a row`);
      if (PRESERVED(table)) assert.deepEqual(after.get(table), rows, `${table} changed`);
    }

    // Each word's page reads as a fresh seed's does, in its order; new age's first definition still corrected.
    for (const word of ["casa", "pantomima", "centouno", "bavaglio", "progetto", "quadro", "magrebina", "new age"]) {
      const shown = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
      assert.equal(shown.outcome, "found", word);
      assert.deepEqual(shown, await lookup({ db: fromNodeSqlite(fresh), releaseId: RELEASE, query: word }), word);
    }
    const page = async (word: string) => {
      const shown = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
      assert.ok(shown.outcome === "found", word);
      return shown.readings;
    };
    const [progettoReading] = await page("progetto");
    assert.deepEqual(progettoReading.recovered.map((definition) => [definition.text, definition.labels]), [[subTerm.definition.text, ["diritto", "politica"]]]);
    const [quadroReading] = await page("quadro");
    assert.deepEqual(quadroReading.senses[6].recoveredItems.map((definition) => [definition.text, definition.labels]), [
      ["detto di persona ponderata e raziocinante", []],
      ["detto di chi è lento nel comprendere", ["spregiativo"]],
    ]);
    const [newAge] = await page("new age");
    assert.deepEqual(newAge.recovered.map((definition) => [definition.text, definition.labels, definition.correction?.replaces ?? null]), [
      ["movimento spirituale", ["forestierismo"], newAgeEntry.definitions[0].definition.text],
      ["persona trasognante che conclude poco e si impone come moralista", ["gergale", "spregiativo"], null],
    ]);

    // A second run plans nothing.
    const again = planRecoveredDefinitions(reader, await found());
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
  } finally {
    db.close();
    fresh.close();
  }
});

test("a dictionary holding every definition but ranking a page-only entry's key otherwise than a fresh seed is set right, and a second run plans nothing", async () => {
  // new age's rows as the every-route load of 2026-10-09 left them on the shared dictionary, ranked by one definition of two,
  // and Aglio's ranked by its page alone, without the aglio record whose key it shares.
  const db = await seeded("stale");
  const fresh = await seeded("stale-fresh");
  try {
    const aglio = JSON.parse((await lines(join(ROUTES_DIR, "archive-lines.jsonl"))).find((line) => wordOf(line) === "aglio") ?? assert.fail()) as { senses: unknown[]; forms: unknown[] };
    // A fresh seed ranks aglio by its lemma record's senses plus forms and Aglio's one definition.
    assert.equal(rankOf(fresh, "aglio"), aglio.senses.length + aglio.forms.length + 1);
    execute(db, `${RANKED_LOWER("new age", 1)}\n${RANKED_LOWER("aglio", aglio.senses.length + aglio.forms.length)}`);
    const reader = readerOf(db);
    const before = snapshot(db);

    const plan = planRecoveredDefinitions(reader, await found());
    assert.deepEqual(plan.entries.flatMap((entry) => entry.definitions.filter(({ state }) => state === "write")), []);
    assert.deepEqual(plan.records.flatMap((record) => [...record.definitions.filter(({ state }) => state === "write"), ...record.removals, ...record.moves]), []);
    assert.deepEqual(plan.rerankedKeys, ["aglio", "new age"]);
    // A Preview's dictionary slice holds the words whose rank the run changes.
    assert.deepEqual(wordsOfRecoveredDefinitions(plan), { kind: "words", words: ["Aglio", "new age"] });
    const [ofAglio, ofNewAge] = [nearbyCount(fresh, "aglio"), nearbyCount(fresh, "new age")];
    const both = { accent_fold: ofAglio.accent_fold + ofNewAge.accent_fold, typo_key: ofAglio.typo_key + ofNewAge.typo_key };
    assert.deepEqual(plan.counts.toJSON(), new PlanCounts({ added: 0, changed: 0, removed: 0 }, both, both).toJSON());

    execute(db, plan.sql);
    assert.deepEqual(unwrittenDefinitions(reader, plan), []);
    assert.deepEqual(nearbyRows(db), nearbyRows(fresh));
    assert.equal(rankOf(db, "aglio"), aglio.senses.length + aglio.forms.length + 1);
    assert.equal(rankOf(db, "new age"), 2);
    // Nothing else changed.
    const after = snapshot(db);
    for (const [table, held] of before) if (!NEARBY.includes(table)) assert.deepEqual(after.get(table), held, table);

    const again = planRecoveredDefinitions(reader, await found());
    assert.deepEqual(again.rerankedKeys, []);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
  } finally {
    db.close();
    fresh.close();
  }
});

test("a fresh seed's dictionary plans nothing: no key of a held page-only entry or of a record is ranked again", async () => {
  const db = await seeded("as-seeded");
  try {
    const plan = planRecoveredDefinitions(readerOf(db), await found());
    assert.deepEqual(plan.rerankedKeys, []);
    assert.equal(plan.sql, "");
    assert.equal(plan.counts, PlanCounts.NONE);
  } finally {
    db.close();
  }
});

test("a page-only entry lacking a definition a fresh seed lists before a held one is refused, naming it, rather than shown out of order", async () => {
  const db = await seeded("unordered");
  try {
    // new age holds its line-5 definition and lacks its line-3 one, which a fresh seed lists first.
    execute(
      db,
      ["entry_label", "entry_example", "entry_definition"].map((table) => `DELETE FROM ${table} WHERE definition_index = 0 AND entry_id = (SELECT entry_id FROM recovered_entry WHERE word = 'new age');`).join("\n"),
    );
    await assert.rejects(async () => planRecoveredDefinitions(readerOf(db), await found()), /lists a lacking definition before a held one of: new age \(entry \d+, line 1\)/);
  } finally {
    db.close();
  }
});

test("appending keeps a fresh seed's order only when no held definition follows a lacking one", () => {
  assert.equal(appendKeepsSeedOrder([]), true);
  assert.equal(appendKeepsSeedOrder(["held", "held", "lacking", "lacking"]), true);
  assert.equal(appendKeepsSeedOrder(["held", "skipped", "lacking", "skipped"]), true);
  assert.equal(appendKeepsSeedOrder(["held", "lacking", "held"]), false);
  assert.equal(appendKeepsSeedOrder(["lacking", "skipped", "held"]), false);
});
