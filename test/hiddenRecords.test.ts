// Records the hiding rules find in another language are hidden (#382, #389,
// ADR 0023): seeded whole, reached by nothing a reader asks. The pages are the
// regression pages saved verbatim from the dump
// (fixtures/section-language/regressions.json) and one made up for a form-of
// edge; the archive adds four real lines for `form-of-foreign-lemma/v1`
// (fixtures/form-of-foreign-lemma/archive-lines.jsonl). No case needs the dump
// or `it-extract.jsonl.gz`.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import { findForeignRecords, findHiddenRecords, readRulePass } from "../src/import/hiddenLayer.js";
import { missingForHide, planHide, unhidden } from "../src/import/hideRecords.js";
import { seedSql, type SeedSqlReport } from "../src/import/seedSql.js";
import { readLanguageHeadings } from "../src/italian/sectionLanguage.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { findNearby } from "../src/lookup/nearby.js";
import { randomHeadword } from "../src/lookup/random.js";
import { suggest } from "../src/lookup/suggest.js";
import { servedVersion, versionToken } from "../src/lookup/served.js";
import { RAW_PAGE_WIKI, rawPageSource, type RawPage } from "../src/source/rawPage.js";
import { changedUpgrade, planUpgrade, upgradeShortfall, type MasterReader } from "../src/update/master.js";
import { createStatement, masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { overlongPatterns } from "../src/db/d1PatternLimit.js";
import { COUNTED_TABLES } from "../src/update/planCounts.js";
import { planOnlyRun } from "../src/update/planOnly.js";
import { masterReaderOf } from "../src/update/updateCli.js";
import { localD1 } from "./localD1.js";

const RELEASE = "it-hidden-test";
const SCHEMA = "src/db/schema.sql";
const REGRESSIONS = "fixtures/section-language/regressions.json";

interface Case {
  word: string;
  page: { title: string; revisionId: number; timestamp: string; wikitext: string };
  records: { pos_title: string; glosses: string[] }[];
}
const fixture = JSON.parse(await readFile(REGRESSIONS, "utf8")) as { cases: Case[] };
const languages = await readLanguageHeadings(REGRESSIONS);

const POS: Record<string, string> = { Sostantivo: "noun", Aggettivo: "adj" };
const recordLine = (word: string, posTitle: string, senses: unknown[]): string =>
  JSON.stringify({ word, lang_code: "it", pos: POS[posTitle], pos_title: posTitle, senses });

// An English entry filed under an Italian heading, below its translation box,
// and an Italian-tagged plural that points at it. The plural has no page, so
// the rule does not judge it. `skirmish` is the archive's last line.
const SKIRMISH_PAGE: RawPage = {
  wiki: RAW_PAGE_WIKI, title: "skirmish", revisionId: 1, timestamp: "2026-07-01T00:00:00Z",
  wikitext: "== {{-it-}} ==\n{{-trad-}}\n{{Trad1|}}\n{{Trad2}}\n\n{{-sost-|en}}\n# scaramuccia",
};
const SKIRMISHES = recordLine("skirmishes", "Sostantivo", [{ glosses: ["plurale di skirmish"], tags: ["form-of"], form_of: [{ word: "skirmish" }] }]);
const SKIRMISH = recordLine("skirmish", "Sostantivo", [{ glosses: ["scaramuccia"] }]);

// `zapatero` [es], which lists `zapateros` as its plural, `zapateros`,
// `amaricare` [la] and `amaricasti`, as it-0c432803 has them.
const FOREIGN_LEMMA_LINES = (await readFile("fixtures/form-of-foreign-lemma/archive-lines.jsonl", "utf8")).trimEnd().split("\n");

const LINES = [
  ...fixture.cases.flatMap(({ word, records }) => records.map((record) => recordLine(word, record.pos_title, [{ glosses: record.glosses }]))),
  ...FOREIGN_LEMMA_LINES,
  SKIRMISHES,
  SKIRMISH,
];
/** LINES with `zapatero`'s forms dropped, so `form-of-foreign-lemma/v1` finds nothing: a master seeded before it. */
const LINES_BEFORE_389 = LINES.map((line) => {
  const parsed = JSON.parse(line) as { word: string; lang_code: string };
  return parsed.word === "zapatero" && parsed.lang_code === "es" ? JSON.stringify({ ...parsed, forms: [] }) : line;
});
const PAGES: RawPage[] = [
  ...fixture.cases.map(({ page }): RawPage => ({ wiki: RAW_PAGE_WIKI, ...page })),
  SKIRMISH_PAGE,
];
const lineOf = (word: string, nth = 0): number =>
  LINES.flatMap((line, index) => ((JSON.parse(line) as { word: string }).word === word ? [index + 1] : []))[nth];
const pageLineOf = (title: string, text: string): number =>
  (PAGES.find((page) => page.title === title) as RawPage).wikitext.split("\n").indexOf(text) + 1;

let dir: string;
let archive: string;
let archiveBefore389: string;
/** Seeded with the raw pages: the rule hides. */
let seeded: DatabaseSync;
let report: SeedSqlReport;

async function seed(name: string, judged: boolean, input = archive): Promise<{ db: DatabaseSync; report: SeedSqlReport }> {
  const result = await seedSql({
    input,
    outputDir: join(dir, name),
    schema: SCHEMA,
    releaseId: RELEASE,
    ...(judged ? { rawPages: rawPageSource(PAGES), languageHeadings: languages } : {}),
  });
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const part of result.parts) db.exec(await readFile(part, "utf8"));
  return { db, report: result };
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-hidden-"));
  archive = join(dir, "archive.jsonl.gz");
  await writeFile(archive, gzipSync(`${LINES.join("\n")}\n`));
  archiveBefore389 = join(dir, "archive-before-389.jsonl.gz");
  await writeFile(archiveBefore389, gzipSync(`${LINES_BEFORE_389.join("\n")}\n`));
  ({ db: seeded, report } = await seed("judged", true));
});

after(async () => {
  seeded.close();
  await rm(dir, { recursive: true, force: true });
});

const recordIdAt = (db: DatabaseSync, line: number): number =>
  (db.prepare("SELECT record_id FROM source_record WHERE release_id = ? AND line_no = ?").get(RELEASE, line) as { record_id: number }).record_id;

const hiddenRows = (db: DatabaseSync) =>
  db.prepare(
    `SELECT r.line_no, r.word, h.rule, h.because, h.language, h.page_line, p.title, p.revision_id, h.lemma_line
       FROM hidden_record h JOIN source_record r ON r.record_id = h.record_id LEFT JOIN raw_page p ON p.page_id = h.page_id
      ORDER BY r.line_no`,
  ).all().map((row) => ({ ...row }));

const EXPECTED_HIDDEN = () => [
  { line_no: lineOf("curie", 1), word: "curie", rule: "section-language/v1", because: "language-line", language: "nl", page_line: pageLineOf("curie", "{{-nl-}}"), title: "curie", revision_id: 3539009, lemma_line: null },
  { line_no: lineOf("dolmen", 1), word: "dolmen", rule: "section-language/v1", because: "late-heading", language: "en", page_line: pageLineOf("dolmen", "{{-sost-|en}}"), title: "dolmen", revision_id: 4055841, lemma_line: null },
  { line_no: lineOf("zapateros"), word: "zapateros", rule: "form-of-foreign-lemma/v1", because: "lemma-lists-form", language: "es", page_line: null, title: null, revision_id: null, lemma_line: lineOf("zapatero") },
  { line_no: lineOf("skirmish"), word: "skirmish", rule: "section-language/v1", because: "late-heading", language: "en", page_line: pageLineOf("skirmish", "{{-sost-|en}}"), title: "skirmish", revision_id: 1, lemma_line: null },
];
const FOUND_ON_PAGES = () => EXPECTED_HIDDEN().filter((row) => row.rule === "section-language/v1");

test("the seed hides the records the rules find in another language, naming the rule and where it read the verdict", () => {
  assert.deepEqual(hiddenRows(seeded), EXPECTED_HIDDEN());
  assert.deepEqual(report.hidden, {
    sectionLanguage: { rule: "section-language/v1", ran: true, hidden: 3, languageLine: 1, lateHeading: 2 },
    formOfForeignLemma: { rule: "form-of-foreign-lemma/v1", hidden: 1 },
  });
  assert.equal(report.rows.hidden_record, 4);
});

test("an Italian verb form whose target is only a Latin record stays visible", async () => {
  const found = await lookup({ db: fromNodeSqlite(seeded), releaseId: RELEASE, query: "amaricasti" });
  assert.equal(found.outcome, "found");
  if (found.outcome !== "found") return;
  assert.deepEqual(found.readings.map((reading) => reading.ref.lineNo), [lineOf("amaricasti")]);
});

test("a hidden record keeps its line byte for byte and every row but its search rows and edges", () => {
  for (const { line_no } of EXPECTED_HIDDEN()) {
    const id = recordIdAt(seeded, line_no);
    const count = (sql: string) => (seeded.prepare(sql).get(id) as { n: number }).n;
    assert.equal((seeded.prepare("SELECT raw_json FROM source_record_json WHERE record_id = ?").get(id) as { raw_json: string }).raw_json, LINES[line_no - 1]);
    assert.equal(count("SELECT count(*) AS n FROM sense WHERE record_id = ?"), 1);
    assert.equal(count("SELECT count(*) AS n FROM lookup_form WHERE record_id = ?"), 0);
    assert.equal(count("SELECT count(*) AS n FROM form_of_edge WHERE record_id = ?"), 0);
  }
});

test("a seed without raw pages hides by the archive alone", async () => {
  const { db, report: plain } = await seed("plain", false);
  try {
    assert.deepEqual(plain.hidden, {
      sectionLanguage: { rule: "section-language/v1", ran: false },
      formOfForeignLemma: { rule: "form-of-foreign-lemma/v1", hidden: 1 },
    });
    assert.deepEqual(hiddenRows(db), EXPECTED_HIDDEN().filter((row) => row.rule === "form-of-foreign-lemma/v1"));
  } finally {
    db.close();
  }
});

test("a search finds the word's Italian records only, and a word with nothing else is not found", async () => {
  const db = fromNodeSqlite(seeded);
  for (const word of ["curie", "dolmen"]) {
    const found = await lookup({ db, releaseId: RELEASE, query: word });
    assert.equal(found.outcome, "found", word);
    if (found.outcome !== "found") continue;
    assert.deepEqual(found.readings.map((reading) => reading.ref.lineNo), [lineOf(word, 0)], word);
  }
  assert.equal((await lookup({ db, releaseId: RELEASE, query: "skirmish" })).outcome, "not-found");
  assert.equal((await lookup({ db, releaseId: RELEASE, query: "zapateros" })).outcome, "not-found");
  const zapateros = await suggest({ db, releaseId: RELEASE, prefix: "zapater" });
  assert.ok(!JSON.stringify(zapateros).includes('"zapateros"'), JSON.stringify(zapateros));
  const typed = await suggest({ db, releaseId: RELEASE, prefix: "skirmish" });
  assert.ok(typed.outcome === "suggested" && !typed.suggestions.includes("skirmish"), JSON.stringify(typed));
  const near = await findNearby({ db, releaseId: RELEASE, query: "skirmis" });
  assert.ok(!JSON.stringify(near).includes('"skirmish"'), JSON.stringify(near));
});

test("a form-of entry pointing at a hidden record keeps its text and links nowhere", async () => {
  const found = await lookup({ db: fromNodeSqlite(seeded), releaseId: RELEASE, query: "skirmishes" });
  assert.equal(found.outcome, "found");
  if (found.outcome !== "found") return;
  const [reading] = found.readings;
  assert.deepEqual(reading.senses.flatMap((sense) => sense.glosses.map((gloss) => gloss.text)), ["plurale di skirmish"]);
  assert.deepEqual(reading.lemmaLinks.map((link) => ({ kind: link.kind, targetWord: link.targetWord })), [{ kind: "dangling", targetWord: "skirmish" }]);
});

test("a random pick never draws a hidden record, and a draw past the last record a search reaches wraps to the first", async () => {
  const db = fromNodeSqlite(seeded);
  const hidden = new Set(EXPECTED_HIDDEN().map((row) => row.line_no));
  const nouns = LINES.flatMap((line, index) => {
    const { pos, lang_code } = JSON.parse(line) as { pos: string; lang_code: string };
    return pos === "noun" && lang_code === "it" ? [index + 1] : [];
  });
  const [low, high] = [nouns[0], nouns[nouns.length - 1]];
  const picked = new Set<number>();
  for (let line = low; line <= high; line++) {
    const draw = (line - low + 0.5) / (high - low + 1);
    const headword = await randomHeadword({ db, releaseId: RELEASE, pos: "noun", random: () => draw });
    assert.ok(headword !== undefined && !hidden.has(headword.lineNo), `line ${line}: ${JSON.stringify(headword)}`);
    picked.add(headword.lineNo);
  }
  assert.deepEqual([...picked].sort((a, b) => a - b), nouns.filter((line) => !hidden.has(line)));
  // `skirmish`, the last noun, is hidden: the last draw lands on the first noun.
  const last = await randomHeadword({ db, releaseId: RELEASE, pos: "noun", random: () => 0.999999 });
  assert.equal(last?.lineNo, low);
});

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });

/** Every row a reader's search, edge, nearby and hidden reads can reach, keyed by content rather than rowid. */
function servingRows(db: DatabaseSync) {
  const rows = (sql: string) => db.prepare(sql).all().map((row) => JSON.stringify(row)).sort();
  return {
    lookup_form: rows("SELECT record_id, origin, surface_key, json_pointer FROM lookup_form"),
    form_of_edge: rows("SELECT record_id, json_pointer, target_word FROM form_of_edge"),
    accent_fold: rows("SELECT fold_key, surface_key, headword, languages, richness FROM accent_fold"),
    typo_key: rows("SELECT deletion_key, surface_key, languages, richness FROM typo_key"),
    hidden_record: rows("SELECT record_id, rule, because, language, page_line, lemma_line FROM hidden_record"),
  };
}

// `hidden_record` as #382 wrote it, before `form-of-foreign-lemma/v1`.
const HIDDEN_RECORD_BEFORE_389 = `CREATE TABLE hidden_record (
  record_id  INTEGER PRIMARY KEY REFERENCES source_record(record_id) ON DELETE CASCADE,
  release_id TEXT    NOT NULL,
  page_id    INTEGER NOT NULL,
  rule       TEXT    NOT NULL CHECK (rule = 'section-language/v1'),
  because    TEXT    NOT NULL CHECK (because IN ('language-line', 'late-heading')),
  language   TEXT    NOT NULL CHECK (language <> 'it' AND language <> ''),
  page_line  INTEGER NOT NULL CHECK (page_line > 0),
  FOREIGN KEY (record_id, release_id)
    REFERENCES source_record(record_id, release_id) ON DELETE CASCADE,
  FOREIGN KEY (page_id, release_id)
    REFERENCES raw_page(page_id, release_id) ON DELETE CASCADE
) STRICT;`;

/** Every record both rules find in the archive and the regression pages. */
async function foundInArchive() {
  return findHiddenRecords(PAGES, await readRulePass(archive), languages);
}

test("the update finds what the seed hides", async () => {
  const found = await foundInArchive();
  assert.deepEqual(found.map(({ rule, word, lineNo }) => [rule, word, lineNo]), EXPECTED_HIDDEN().map((row) => [row.rule, row.word, row.line_no]));
});

test("the one-off update brings a dictionary seeded before both rules to what a seed now writes, and a second run plans nothing", async () => {
  const { db: before } = await seed("before", false, archiveBefore389);
  try {
    // A master seeded before #382 has no hidden_record table.
    before.exec("DROP TABLE hidden_record; DROP TABLE hide_version");
    const reader = readerOf(before);
    const found = await foundInArchive();
    const schema = await readFile(SCHEMA, "utf8");
    // Put recovery/provenance rows beside a record about to be hidden.
    const id = recordIdAt(before, found[0].lineNo);
    before.exec(`
      INSERT INTO raw_page VALUES (1, '${RELEASE}', 'it.wiktionary.org', 'kept-test-page', 1, '2026-07-01T00:00:00Z');
      INSERT INTO recovered_definition VALUES (1, ${id}, '${RELEASE}', 1, 0, 'below-page-control', NULL, 7, '#* testo', 'testo', NULL, 0, NULL);
      INSERT INTO recovered_label VALUES (1, 0, 'figurato');
      INSERT INTO recovered_example VALUES (1, 0, 8, '#*: esempio', 'esempio');
      INSERT INTO claim_review (record_id, json_pointer, status, note, evidence_url, reviewed_at, reviewed_by)
        VALUES (${id}, '/senses/0/glosses/0', 'disputed', 'kept note', 'https://example.org', '2026-07-01T00:00:00Z', 'test');
    `);
    const preservedTables = ['source_record_json', 'source_record', 'sense', 'sense_gloss', 'raw_page', 'recovered_definition', 'recovered_label', 'recovered_example', 'claim_review'];
    const snapshot = () => preservedTables.map((table) => before.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
    const preserved = snapshot();
    assert.ok(preserved.every((rows) => rows.length > 0));
    const plan = planHide(reader, found);
    assert.equal(plan.hides.length, 4);
    assert.ok(plan.removed.lookup_form > 0 && plan.removed.form_of_edge === 1, JSON.stringify(plan.removed));
    // The SQL creates nothing (#509): the hide refuses to write until the upgrade gives the master its tables, and plans the same after it.
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/);
    assert.deepEqual(missingForHide(reader), ["hide_version", "hidden_record"]);
    before.exec(masterUpgradeSql(schema));
    assert.deepEqual(missingForHide(reader), []);
    assert.equal(planHide(reader, found).sql, plan.sql);
    const lines = before.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all();
    const version = async () => versionToken(await servedVersion(fromNodeSqlite(before), RELEASE));
    const original = await version();
    before.exec("BEGIN");
    assert.throws(() => before.exec(`${plan.sql}\nINSERT INTO missing_table VALUES (1);`), /missing_table/);
    before.exec("ROLLBACK");
    assert.equal(await version(), original, "a failed transaction publishes no identity");
    before.exec("BEGIN");
    before.exec(plan.sql);
    before.exec("COMMIT");
    const hiddenVersion = await version();
    assert.notEqual(hiddenVersion, original, "a committed nonempty hide moves the identity");
    assert.deepEqual(unhidden(reader, plan), []);
    assert.deepEqual(hiddenRows(before), EXPECTED_HIDDEN());
    assert.deepEqual(servingRows(before), servingRows(seeded));
    assert.deepEqual(before.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all(), lines);
    // The hide adds only the evidence pages its own rule requires.
    const newPages = before.prepare("SELECT page_id FROM raw_page WHERE page_id > 1").all();
    assert.ok(newPages.length > 0);
    const after = snapshot();
    const pageIndex = preservedTables.indexOf('raw_page');
    after[pageIndex] = after[pageIndex].filter((row) => row.page_id === 1);
    assert.deepEqual(after, preserved);

    const again = planHide(reader, found);
    assert.deepEqual({ hides: again.hides.length, alreadyHidden: again.alreadyHidden, sql: again.sql }, { hides: 0, alreadyHidden: 4, sql: "" });
    before.exec(again.sql);
    assert.equal(await version(), hiddenVersion, "an empty hide moves nothing");
  } finally {
    before.close();
  }
});

/** `before` with #382's `hidden_record`, holding the rows the section-language rule hid. */
function withHiddenRecordBefore389(before: DatabaseSync): void {
  before.exec(`ALTER TABLE hidden_record RENAME TO kept;
    ${HIDDEN_RECORD_BEFORE_389}
    INSERT INTO hidden_record SELECT record_id, release_id, page_id, rule, because, language, page_line FROM kept;
    DROP TABLE kept;`);
  const heldLines = before.prepare("SELECT r.line_no FROM hidden_record h JOIN source_record r USING (record_id) ORDER BY r.line_no").all();
  assert.deepEqual(heldLines.map((row) => row.line_no), FOUND_ON_PAGES().map((row) => row.line_no));
}

const tableSql = (db: DatabaseSync, name: string) => db.prepare("SELECT sql FROM sqlite_schema WHERE name = ?").get(name);

test("the upgrade rebuilds a hidden_record table written before form-of-foreign-lemma/v1, keeping its rows, and the hide then hides the new rule's records", async () => {
  const { db: before } = await seed("before-389", true, archiveBefore389);
  try {
    withHiddenRecordBefore389(before);
    const reader = readerOf(before);
    const found = await foundInArchive();
    const schema = await readFile(SCHEMA, "utf8");
    // The hide plans on #382's table, but refuses to write into it.
    const plan = planHide(reader, found);
    assert.deepEqual(
      { hides: plan.hides.map(({ found: record }) => record.word), alreadyHidden: plan.alreadyHidden },
      { hides: ["zapateros"], alreadyHidden: 3 },
    );
    assert.deepEqual(missingForHide(reader), ["hidden_record"]);
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/);

    const upgrade = planUpgrade(reader, schema);
    assert.deepEqual({ missing: upgrade.missing, changed: upgrade.changed }, { missing: [], changed: ["hidden_record"] });
    assert.deepEqual(upgrade.kept.map(({ name, rows }) => [name, rows]), [["hidden_record", 3]], "only hidden_record is rebuilt");
    assert.deepEqual(overlongPatterns(upgrade.sql), []);
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), ["the upgrade left hidden_record without its lemma_line column"]);
    before.exec("BEGIN");
    before.exec(upgrade.sql);
    before.exec("COMMIT");
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), []);
    assert.deepEqual(tableSql(before, "hidden_record"), tableSql(seeded, "hidden_record"));
    assert.deepEqual(hiddenRows(before), EXPECTED_HIDDEN().filter((row) => row.rule === "section-language/v1"));
    assert.deepEqual(before.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(planUpgrade(reader, schema).sql, "");
    assert.deepEqual(missingForHide(reader), []);

    assert.equal(planHide(reader, found).sql, plan.sql);
    before.exec(plan.sql);
    assert.deepEqual(unhidden(reader, plan), []);
    assert.deepEqual(hiddenRows(before), EXPECTED_HIDDEN());
    assert.deepEqual(servingRows(before), servingRows(seeded));
    assert.equal(planHide(reader, found).sql, "");
  } finally {
    before.close();
  }
});

test("an upgrade that rebuilds the page-entry tables rebuilds a hidden_record from before #389 with them, and both keep every row", async () => {
  const { db: before } = await seed("before-389-and-page-entries", true, archiveBefore389);
  try {
    withHiddenRecordBefore389(before);
    const schema = await readFile(SCHEMA, "utf8");
    // `recovered_entry` as before its page_line CHECK, with a row and a definition.
    before.exec("DROP TABLE entry_example; DROP TABLE entry_label; DROP TABLE corrected_definition; DROP TABLE entry_definition; DROP TABLE recovered_entry;");
    before.exec(createStatement(schema, "TABLE", "recovered_entry").replace("page_line INTEGER NOT NULL CHECK (page_line > 0)", "page_line INTEGER NOT NULL"));
    for (const table of ["entry_definition", "entry_label", "entry_example", "corrected_definition"]) before.exec(createStatement(schema, "TABLE", table));
    before.exec(createStatement(schema, "INDEX", "recovered_entry_by_key"));
    before.prepare("INSERT INTO raw_page VALUES (900001, ?, 'it.wiktionary.org', 'scrivere', 4100, '2026-09-01T00:00:00Z')").run(RELEASE);
    before.prepare("INSERT INTO recovered_entry VALUES (1, ?, 900001, 'scrivere', 'scrivere', 'verb', 'Verbo', 'italian-page-entry/v1', 3, '')").run(RELEASE);
    before.exec("INSERT INTO entry_definition VALUES (1, 0, 'sense-line', NULL, 4, '# tracciare segni', 'tracciare segni', NULL)");
    const reader = readerOf(before);

    const upgrade = planUpgrade(reader, schema);
    assert.deepEqual(upgrade.changed, ["recovered_entry", "hidden_record"]);
    assert.deepEqual(upgrade.kept.map(({ name, rows }) => [name, rows]), [
      ["recovered_entry", 1], ["entry_definition", 1], ["entry_label", 0], ["entry_example", 0], ["corrected_definition", 0], ["hidden_record", 3],
    ]);
    assert.deepEqual(overlongPatterns(upgrade.sql), []);
    before.exec("BEGIN");
    before.exec(upgrade.sql);
    before.exec("COMMIT");
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), []);
    assert.deepEqual(changedUpgrade(reader, schema), []);
    for (const name of ["recovered_entry", "hidden_record"]) assert.deepEqual(tableSql(before, name), tableSql(seeded, name), name);
    assert.deepEqual(hiddenRows(before), EXPECTED_HIDDEN().filter((row) => row.rule === "section-language/v1"));
    assert.equal((before.prepare("SELECT count(*) AS n FROM entry_definition").get() as { n: number }).n, 1);
    assert.deepEqual(before.prepare("PRAGMA foreign_key_check").all(), []);
    assert.deepEqual(before.prepare("SELECT name FROM sqlite_schema WHERE name LIKE 'upgrade_kept_%'").all(), []);
  } finally {
    before.close();
  }
});

test("an upgrade that leaves fewer hidden_record rows than it found is reported short", async () => {
  const { db: before } = await seed("before-389-short", true, archiveBefore389);
  try {
    withHiddenRecordBefore389(before);
    const schema = await readFile(SCHEMA, "utf8");
    const reader = readerOf(before);
    const upgrade = planUpgrade(reader, schema);
    before.exec("BEGIN");
    before.exec(upgrade.sql);
    before.exec("COMMIT");
    before.exec("DELETE FROM hidden_record WHERE record_id = (SELECT min(record_id) FROM hidden_record)");
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), ["the upgrade left 2 row(s) in hidden_record, which held 3"]);
  } finally {
    before.close();
  }
});

test("hide:records' plan-only run counts each hide as a removal and leaves a local D1 byte-identical", async () => {
  const { db } = await seed("plan-only", false);
  const d1Dir = await mkdtemp(join(dir, "plan-only-"));
  try {
    const d1 = localD1(d1Dir, db);
    const reader = masterReaderOf(d1.target);
    const before = d1.sha256();
    const plan = planHide(reader, await foundInArchive());
    const run = planOnlyRun("hide:records", plan.counts, reader);
    // A seed without the pages hides only what form-of-foreign-lemma/v1 finds; the rest are this plan's.
    assert.equal(plan.hides.length + plan.alreadyHidden, EXPECTED_HIDDEN().length);
    assert.ok(plan.hides.length > 0);
    assert.deepEqual(run.counts.records, { added: 0, changed: 0, removed: plan.hides.length });
    assert.equal(run.counts.written.hidden_record, plan.hides.length);
    assert.equal(d1.sha256(), before);
    assert.ok(d1.calls.every((call) => call[0] === "--json"), "every call reads");

    // The counts are what the file does: each table moves by its rows written less its rows deleted.
    const rows = () => Object.fromEntries(COUNTED_TABLES.map((table) => [table, (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n]));
    const held = rows();
    db.exec(plan.sql);
    const moved = rows();
    for (const table of COUNTED_TABLES.filter((name) => name !== "hide_version")) {
      assert.equal(moved[table] - held[table], (plan.counts.written[table] ?? 0) - (plan.counts.deleted[table] ?? 0), table);
    }
  } finally {
    db.close();
  }
});

test("the update refuses a master whose record at a found line is another word", async () => {
  const { db } = await seed("other", false);
  try {
    const found = await foundInArchive();
    const moved = found.map((record) => ({ ...record, lineNo: record.lineNo - 1 }));
    assert.throws(() => planHide(readerOf(db), moved), /does not hold these records/);
  } finally {
    db.close();
  }
});
