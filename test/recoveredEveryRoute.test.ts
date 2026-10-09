// `pnpm run load:recovered-definitions` on every route a seed writes (#770): a
// dictionary that lacks some of what a fresh seed recovers, on any route,
// record-backed or page-only, gains exactly those rows and changes no other.
// The records are verbatim archive lines of it-0c432803 and the pages verbatim
// revisions of its dump itwiktionary-20260701 (fixtures/recovered-routes/,
// fixtures/unlisted-definitions/, fixtures/upstream-pages/).

import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
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
    // progetto (archive line 24370) and quadro's Aggettivo (archive line 70573).
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
];

/** A correction of `new age`'s first definition, as `correct:records` writes one beside a held entry. */
const NEW_AGE_CORRECTION = `INSERT INTO corrected_definition (entry_id, definition_index, text, correction_id, evidence_url)
  SELECT entry_id, 0, 'movimento spirituale', 'page:4066634:0', 'https://it.wiktionary.org/w/index.php?title=new_age&oldid=4066634'
    FROM recovered_entry WHERE word = 'new age'`;

/** A fresh seed without the class rows: the shape of a dictionary seeded before the renderer read them. */
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
     ${NEW_AGE_CORRECTION};`,
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
const PRESERVED = (table: string): boolean => !["raw_page", "recovered_definition", "recovered_label", "recovered_example", "entry_definition", "entry_label", "entry_example"].includes(table);

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
    ]);
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
    assert.deepEqual(
      plan.entries.map((entry) => [entry.entry.page.title, entry.definitions.map((planned) => [planned.state, planned.definition.ref.line, planned.definition.text, planned.definition.labels])]),
      [
        [
          "new age",
          [
            ["already", 3, plan.entries[0].definitions[0].definition.text, ["forestierismo"]],
            ["write", 5, "persona trasognante che conclude poco e si impone come moralista", ["gergale", "spregiativo"]],
          ],
        ],
      ],
    );
    // The pages of progetto, pantomima, centouno and bavaglio, which no held row names any more.
    assert.deepEqual(
      plan.counts.toJSON(),
      new PlanCounts(
        { added: 0, changed: 0, removed: 0 },
        { raw_page: 4, recovered_definition: 6, recovered_label: 6, recovered_example: 1, entry_definition: 1, entry_label: 2, entry_example: 1 },
      ).toJSON(),
    );
    // Data only, and no row the dictionary holds is changed or deleted.
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|DELETE|UPDATE|ALTER)\b/i);
    assert.deepEqual(plan.records.flatMap((record) => record.differing), []);
    const listing = planListing(plan);
    assert.equal(listing.filter((line) => line.includes(" — written as ")).length, 7);
    assert.ok(listing.some((line) => line.startsWith("progetto (Sostantivo, archive line 5,") && line.includes("line 7, sub-term") && line.includes("[diritto, politica]")), listing.join("\n"));
    assert.ok(listing.some((line) => line.startsWith("new age (page-only entry") && line.includes("line 5, sense-line") && line.includes("[gergale, spregiativo]")), listing.join("\n"));
    assert.match(listing.at(-2) ?? "", /^7 definition\(s\) written for 7 word\(s\)/);
    assert.match(listing.at(-1) ?? "", /^0 held definition/);

    execute(db, plan.sql);
    assert.deepEqual(unwrittenDefinitions(reader, plan), []);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

    // The recovered layer and the page-only entries' tables hold what a fresh seed's do.
    assert.deepEqual(recoveredLayer(db), recoveredLayer(fresh));
    const after = snapshot(db);
    const seed = snapshot(fresh);
    for (const table of ENTRY_TABLES) assert.deepEqual(after.get(table), seed.get(table), table);
    assert.deepEqual(
      after.get("raw_page")?.map((row) => JSON.parse(row) as { title: string; revision_id: number }).map(({ title, revision_id }) => `${title}@${revision_id}`).sort(),
      seed.get("raw_page")?.map((row) => JSON.parse(row) as { title: string; revision_id: number }).map(({ title, revision_id }) => `${title}@${revision_id}`).sort(),
    );
    // Every row held before is held after, unchanged, and every other table is as it was: records, `source_record_json` and the corrected definition included.
    for (const [table, rows] of before) {
      const now = new Set(after.get(table));
      assert.deepEqual(rows.filter((row) => !now.has(row)), [], `${table} lost or changed a row`);
      if (PRESERVED(table)) assert.deepEqual(after.get(table), rows, `${table} changed`);
    }

    // Each word's page reads as a fresh seed's does, in its order; new age's first definition still corrected.
    for (const word of ["casa", "pantomima", "centouno", "bavaglio", "progetto", "quadro", "new age"]) {
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
      ["movimento spirituale", ["forestierismo"], plan.entries[0].definitions[0].definition.text],
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

test("a lacking definition a fresh seed lists before a held one is refused, naming it, rather than shown out of order", async () => {
  const db = await seeded("unordered");
  try {
    // quadro holds its line 14 and lacks line 13, which a fresh seed lists first.
    execute(db, `DELETE FROM recovered_definition WHERE page_line = 13 AND record_id = (SELECT record_id FROM source_record WHERE word = 'quadro');`);
    await assert.rejects(async () => planRecoveredDefinitions(readerOf(db), await found()), /lists a lacking definition before a held one of: quadro \(Aggettivo, line 6\)/);
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
