// `pnpm run load:recovered-definitions` (src/import/loadRecoveredDefinitions.ts,
// #706): the definitions the two unlisted rules read (ADR 0029) written into a
// dictionary seeded before them, after it took a feed's changes, and held to
// what a fresh seed writes. The records are verbatim archive lines of
// it-0c432803 (fixtures/dev-seed.jsonl, fixtures/unlisted-definitions/) and
// the pages verbatim revisions of its dump.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import { planWrite, readyChange } from "../src/deploy/writePlan.js";
import { wordsOfRecoveredDefinitions } from "../src/deploy/touchedWords.js";
import {
  changedForLoad,
  describePlannedRecord,
  findUnlistedDefinitions,
  pagesWithUnlistedLines,
  planRecoveredDefinitions,
  RECOVERED_DEFINITION_RULES,
  unwrittenDefinitions,
} from "../src/import/loadRecoveredDefinitions.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { everyRecovered } from "../src/lookup/types.js";
import type { ArchiveFactsCatalog } from "../src/source/archiveFacts.js";
import { loadFixturePages, rawPageSource, readSavedPage, type RawPage } from "../src/source/rawPage.js";
import { chooseChanges, planApply } from "../src/update/apply.js";
import { parseChange, parseDeclaration } from "../src/update/declaration.js";
import { diffAgainstMaster } from "../src/update/diff.js";
import { planUpgrade, rebuildsOf, upgradeShortfall, type MasterReader } from "../src/update/master.js";
import { createStatement } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";

const RELEASE = "it-unlisted";
const SCHEMA = "src/db/schema.sql";
const DIR = resolve("fixtures/unlisted-definitions");

const fixturePages = await loadFixturePages(resolve("fixtures"));
const casa = fixturePages.page("casa");
assert.ok(casa);
const PAGES: RawPage[] = [
  // `casa` has definitions the seed recovered below its page controls; the load leaves them as they are.
  casa,
  ...(await Promise.all((await readdir(DIR)).filter((name) => name.endsWith(".wikitext")).sort().map(async (name) => readSavedPage(await readFile(join(DIR, name), "utf8"), name)))),
];

const lines = async (path: string): Promise<string[]> => (await readFile(path, "utf8")).trimEnd().split("\n");

let dir: string;
let master: string[];
let archive: string;
let later: string;

/** `line` with one more sense glossed `gloss`, as a later release of it would hold it. */
const withSense = (line: string, gloss: string): string => {
  const record = JSON.parse(line) as { senses: unknown[] };
  return JSON.stringify({ ...record, senses: [...record.senses, { glosses: [gloss] }] });
};

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-recovered-definitions-"));
  master = [...(await lines("fixtures/dev-seed.jsonl")), ...(await lines(join(DIR, "archive-lines.jsonl")))];
  archive = join(dir, "master.jsonl.gz");
  await writeFile(archive, gzipSync(`${master.join("\n")}\n`));
  // The feed: `bavaglio` now carries its page's definition as a gloss, and `decrepito` a gloss of its own.
  const at = (word: string): number => master.findIndex((line) => (JSON.parse(line) as { word: string }).word === word);
  const fed = [...master];
  fed[at("bavaglio")] = withSense(master[at("bavaglio")], "Fazzoletto o cencio che si lega attorno alla bocca di una persona per impedirle di parlare o gridare.");
  fed[at("decrepito")] = withSense(master[at("decrepito")], "molto vecchio");
  later = join(dir, "later.jsonl.gz");
  await writeFile(later, gzipSync(`${fed.join("\n")}\n`));
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
 * The live dictionary's shape: seeded before the two rules, so it holds the
 * other routes' recovered definitions and none of theirs, with a feed's
 * changes applied.
 */
async function liveShaped(name: string): Promise<DatabaseSync> {
  const db = await seeded(name);
  execute(
    db,
    `DELETE FROM recovered_definition WHERE route IN ('bullet-line', 'prose-line');
     DELETE FROM raw_page WHERE page_id NOT IN (SELECT page_id FROM recovered_definition)
       AND page_id NOT IN (SELECT page_id FROM hidden_record WHERE page_id IS NOT NULL)
       AND page_id NOT IN (SELECT page_id FROM recovered_entry);`,
  );
  const reader = readerOf(db);
  const found = await diffAgainstMaster(reader, later);
  assert.deepEqual(found.diff.changes.map((change) => [change.kind, change.word]).sort(), [["changed", "bavaglio"], ["changed", "decrepito"]]);
  const chosen = chooseChanges(found, found.diff.changes.map((change) => change.id));
  execute(db, (await planApply(reader, found, chosen, { appliedAt: "2026-10-07T00:00:00Z", catalog: fixtureCatalog(found.master.archiveSha256, found.feed.archiveSha256) })).sql);
  return db;
}

/** Every row of every table, by table. */
function snapshot(db: DatabaseSync): Map<string, string[]> {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  return new Map(tables.map(({ name }) => [name, (db.prepare(`SELECT * FROM ${name}`).all() as object[]).map((row) => JSON.stringify(row)).sort()]));
}

/** A master record's recovered definitions as a seed writes them, without the ids a database gives them. */
function recoveredRows(db: DatabaseSync, word: string, posTitle: string): unknown[] {
  return db
    .prepare(
      `SELECT d.definition_index, d.route, d.term, d.page_line, d.wikitext, d.text, d.held_as_example, d.lead_in_sense_index, p.title, p.revision_id,
              (SELECT json_group_array(label) FROM (SELECT label FROM recovered_label l WHERE l.recovered_id = d.recovered_id ORDER BY label_index)) AS labels
         FROM recovered_definition d JOIN source_record r ON r.record_id = d.record_id JOIN raw_page p ON p.page_id = d.page_id
        WHERE r.release_id = ? AND r.word = ? AND r.pos_title = ? ORDER BY d.definition_index`,
    )
    .all(RELEASE, word, posTitle)
    .map((row) => ({ ...row }));
}

const WRITTEN: readonly [string, string][] = [
  ["Consap", "Acronimo / Abbreviazione"],
  ["centouno", "Aggettivo numerale"],
  ["cinquantadue", "Aggettivo numerale"],
  ["decrepito", "Aggettivo"],
  ["esterofilo", "Aggettivo"],
  ["esterofilo", "Sostantivo"],
  ["furbo", "Aggettivo"],
  ["furbo", "Sostantivo"],
  ["museruola", "Sostantivo"],
  ["urgere", "Verbo"],
];

test("a dictionary seeded before the rules, with a feed applied, gains their definitions and keeps every earlier row", async () => {
  const db = await liveShaped("live");
  const fresh = await seeded("fresh");
  try {
    const reader = readerOf(db);
    const before = snapshot(db);
    const pages = await pagesWithUnlistedLines(PAGES);
    assert.deepEqual([...pages.keys()].sort(), ["Consap", "bavaglio", "centouno", "cinquantadue", "decrepito", "esterofilo", "furbo", "museruola", "urgere"]);
    const found = await findUnlistedDefinitions(archive, pages);
    const plan = planRecoveredDefinitions(reader, found);
    assert.deepEqual(
      plan.records.map((record) => [record.found.word, record.found.posTitle, record.definitions.map((planned) => planned.state)]).sort(),
      [
        ["decrepito", "Aggettivo", ["write", "write"]],
        // The feed's record in its place carries the definition as a gloss now, so the page shows it once.
        ["bavaglio", "Sostantivo", ["carried-by-served"]],
        ["museruola", "Sostantivo", ["write"]],
        ["centouno", "Aggettivo numerale", ["write"]],
        ["furbo", "Aggettivo", ["write", "write", "write", "write"]],
        ["furbo", "Sostantivo", ["write", "write", "write"]],
        // Both of `urgere`'s records, intransitive and transitive, match its one Verbo section.
        ["urgere", "Verbo", ["write"]],
        ["urgere", "Verbo", ["write"]],
        ["esterofilo", "Aggettivo", ["write"]],
        ["esterofilo", "Sostantivo", ["write"]],
        ["Consap", "Acronimo / Abbreviazione", ["write"]],
        ["cinquantadue", "Aggettivo numerale", ["write"]],
      ].sort(),
    );
    // Each found record is the master's record of its archive line, and `decrepito` and `bavaglio` are served by the feed's.
    const replaced = new Map(plan.records.map((record) => [record.found.word, record.servedRecordId !== record.recordId]));
    assert.equal(replaced.get("decrepito"), true);
    assert.equal(replaced.get("bavaglio"), true);
    assert.equal(replaced.get("centouno"), false);
    assert.deepEqual(plan.counts.toJSON(), new PlanCounts({ added: 0, changed: 0, removed: 0 }, { raw_page: 8, recovered_definition: 17, recovered_label: 11 }).toJSON());
    assert.deepEqual(plan.counts.deleted, {});
    // Data only: the upgrade is what changes a table (#507).
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|DELETE|UPDATE|ALTER)\b/i);
    assert.match(describePlannedRecord(plan.records.find((record) => record.found.word === "bavaglio") ?? assert.fail()).join("\n"), /not written; record \d+, applied in its place, carries it/);
    assert.deepEqual(wordsOfRecoveredDefinitions(plan), { kind: "words", words: ["Consap", "centouno", "cinquantadue", "decrepito", "esterofilo", "furbo", "museruola", "urgere"] });

    execute(db, plan.sql);
    assert.deepEqual(unwrittenDefinitions(reader, plan), []);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

    // Every row held before is held after, unchanged; new rows land only in the tables the load writes.
    const after = snapshot(db);
    for (const [table, rows] of before) {
      const now = new Set(after.get(table));
      assert.deepEqual(rows.filter((row) => !now.has(row)), [], `${table} lost or changed a row`);
      if (!["raw_page", "recovered_definition", "recovered_label"].includes(table)) assert.equal(after.get(table)?.length, rows.length, `${table} gained a row`);
    }
    assert.deepEqual([...after.keys()], [...before.keys()]);
    assert.deepEqual(after.get("source_record_json"), before.get("source_record_json"));
    // `casa`'s definitions, recovered by the seed below its page controls, are still there.
    assert.ok(recoveredRows(db, "casa", "Sostantivo").length > 0);
    assert.deepEqual(recoveredRows(db, "casa", "Sostantivo"), recoveredRows(fresh, "casa", "Sostantivo"));

    // Each record now holds what a fresh seed writes for it, from the same revision and lines.
    for (const [word, posTitle] of WRITTEN) {
      assert.ok(recoveredRows(db, word, posTitle).length > 0, word);
      assert.deepEqual(recoveredRows(db, word, posTitle), recoveredRows(fresh, word, posTitle), `${word} (${posTitle})`);
    }
    assert.deepEqual(recoveredRows(db, "bavaglio", "Sostantivo"), []);

    // The pages show them; `decrepito` through the feed's record that replaced its own.
    const shown = async (word: string): Promise<string[]> => {
      const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
      assert.ok(result.outcome === "found", word);
      return result.readings.flatMap((reading) => everyRecovered(reading).map((definition) => definition.text));
    };
    assert.deepEqual(await shown("centouno"), ["numero che viene dopo il cento e prima del centodue"]);
    assert.deepEqual(await shown("decrepito"), [
      "persona molto vecchia e quindi privo completamente di forze",
      "cosa assolutamente inefficiente e inadeguata; in particolare, privo di validità e di efficacia, perché antiquata e inattuale",
    ]);
    assert.deepEqual(await shown("bavaglio"), []);

    // A second run plans nothing.
    const again = planRecoveredDefinitions(reader, await findUnlistedDefinitions(archive, await pagesWithUnlistedLines(PAGES)));
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);
    assert.ok(again.records.every((record) => record.definitions.every((planned) => planned.state !== "write")));
  } finally {
    db.close();
    fresh.close();
  }
});

test("a record the archive does not hold at the found line is refused, and a page held at another revision is refused", async () => {
  const db = await liveShaped("refusals");
  try {
    const reader = readerOf(db);
    const found = await findUnlistedDefinitions(archive, await pagesWithUnlistedLines(PAGES));
    const centouno = found.find((record) => record.word === "centouno") ?? assert.fail();
    assert.throws(() => planRecoveredDefinitions(reader, [{ ...centouno, lineNo: 1 }]), /does not hold these records at the archive's lines: centouno/);
    // `casa`'s page row names the revision the seed read; a dump of another revision is not that page.
    const casaRecord = found.find((record) => record.word === "decrepito") ?? assert.fail();
    execute(db, `INSERT INTO raw_page (page_id, release_id, wiki, title, revision_id, revision_timestamp) VALUES (999, '${RELEASE}', 'it.wiktionary.org', 'decrepito', 1, '2020-01-01T00:00:00Z')`);
    assert.throws(() => planRecoveredDefinitions(reader, [casaRecord]), /holds revision 1 of decrepito/);
  } finally {
    db.close();
  }
});

/** `recovered_definition` as the live dictionary stores it (#511): schema.sql's, with the CHECK before the two routes. */
const beforeRoutes = (schema: string): string => {
  const stated = createStatement(schema, "TABLE", "recovered_definition");
  const older = stated.replace("'wrapped-prose', 'bullet-line', 'prose-line')", "'wrapped-prose')");
  assert.notEqual(older, stated);
  return older;
};

test("update:upgrade rebuilds recovered_definition stored before the two routes with every recovered row, and the load writes only after it", async () => {
  const db = await liveShaped("before-routes");
  try {
    const schema = await readFile(SCHEMA, "utf8");
    const reader = readerOf(db);
    // Give the dictionary the live table, keeping every row the seed and the feed left.
    const tables = ["recovered_definition", "recovered_label", "recovered_example"];
    const saved = tables.map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all()] as const);
    db.exec("PRAGMA foreign_keys = OFF");
    for (const table of [...tables].reverse()) db.exec(`DROP TABLE ${table}`);
    db.exec(beforeRoutes(schema));
    db.exec(createStatement(schema, "INDEX", "recovered_definition_by_record"));
    db.exec(createStatement(schema, "TABLE", "recovered_label"));
    db.exec(createStatement(schema, "TABLE", "recovered_example"));
    for (const [table, rows] of saved) {
      for (const row of rows) {
        const names = Object.keys(row);
        db.prepare(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`).run(...(Object.values(row) as (string | number | null)[]));
      }
    }
    db.exec("PRAGMA foreign_keys = ON");
    const held = tables.map((table) => (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
    assert.ok(held[0] > 0, "the seed recovered `casa`'s definitions");

    const found = await findUnlistedDefinitions(archive, await pagesWithUnlistedLines(PAGES));
    const plan = planRecoveredDefinitions(reader, found);
    // The live table refuses the two routes, so the load names it for the upgrade and writes nothing.
    assert.deepEqual(changedForLoad(reader, schema), ["recovered_definition"]);
    assert.throws(() => execute(db, plan.sql), /CHECK constraint failed/);

    const before = snapshot(db);
    const upgrade = planUpgrade(reader, schema);
    assert.deepEqual(upgrade.changed, ["recovered_definition"]);
    assert.deepEqual(rebuildsOf(upgrade), tables.map((table, index) => ({ table, rows: held[index] })));
    execute(db, upgrade.sql);
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), []);
    assert.deepEqual(changedForLoad(reader, schema), []);
    // Every row of every table is kept, the recovered tables' included.
    assert.deepEqual(snapshot(db), before);

    // The plan is the same after the upgrade, and now writes.
    const upgraded = planRecoveredDefinitions(reader, found);
    assert.equal(upgraded.sql, plan.sql);
    execute(db, upgraded.sql);
    assert.deepEqual(unwrittenDefinitions(reader, upgraded), []);
    const routes = db.prepare("SELECT DISTINCT route FROM recovered_definition").all().map((row) => row.route);
    assert.ok(routes.includes("below-page-control") && routes.includes("bullet-line") && routes.includes("prose-line"), routes.join(", "));
  } finally {
    db.close();
  }
});

const escape = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

test("a declared load:recovered-definitions is planned by the deploy from the master's archive and dump, and its counts are what the load plans", async () => {
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
    const change = parseChange("test", JSON.stringify({ command: "load:recovered-definitions", inputs: { archive: releaseId, rules: [...RECOVERED_DEFINITION_RULES] } }));
    const plan = await planWrite(readyChange(change, { archive, dump }), reader, "2026-10-07T00:00:00Z", { catalog, dumps });
    const expected = planRecoveredDefinitions(reader, await findUnlistedDefinitions(archive, await pagesWithUnlistedLines(PAGES)));
    assert.deepEqual(plan.run.counts.toJSON(), expected.counts.toJSON());
    assert.equal(plan.sql, expected.sql);
    assert.deepEqual(plan.touched, wordsOfRecoveredDefinitions(expected));
    // The declaration that pins those counts parses; a rule set without both rules does not.
    parseDeclaration("ok.json", JSON.stringify({ command: "load:recovered-definitions", inputs: { archive: releaseId, rules: [...RECOVERED_DEFINITION_RULES] }, expected: expected.counts.toJSON() }));
    assert.throws(
      () => parseDeclaration("bad.json", JSON.stringify({ command: "load:recovered-definitions", inputs: { archive: releaseId, rules: ["recovered-bullet-line/v1"] }, expected: expected.counts.toJSON() })),
      /lacks recovered-prose-line\/v1/,
    );
    execute(db, plan.sql);
    assert.deepEqual(plan.readBack(reader), []);
    // Another archive than the master's is refused before anything is planned.
    await assert.rejects(planWrite(readyChange(change, { archive: later, dump }), reader, "2026-10-07T00:00:00Z", { catalog, dumps }), /was seeded from the archive/);
  } finally {
    db.close();
  }
});
