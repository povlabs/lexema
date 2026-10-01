// Records the section-language rule finds in another language are hidden
// (#382, ADR 0023): seeded whole, reached by nothing a reader asks. The pages
// are the regression pages saved verbatim from the dump
// (fixtures/section-language/regressions.json) and one made up for a form-of
// edge, so no case needs the dump or `it-extract.jsonl.gz`.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import { findForeignRecords, readTitles } from "../src/import/hiddenLayer.js";
import { planHide, unhidden } from "../src/import/hideRecords.js";
import { seedSql, type SeedSqlReport } from "../src/import/seedSql.js";
import { readLanguageHeadings } from "../src/italian/sectionLanguage.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { findNearby } from "../src/lookup/nearby.js";
import { randomHeadword } from "../src/lookup/random.js";
import { suggest } from "../src/lookup/suggest.js";
import { RAW_PAGE_WIKI, rawPageSource, type RawPage } from "../src/source/rawPage.js";
import type { MasterReader } from "../src/update/master.js";

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

const LINES = [
  ...fixture.cases.flatMap(({ word, records }) => records.map((record) => recordLine(word, record.pos_title, [{ glosses: record.glosses }]))),
  SKIRMISHES,
  SKIRMISH,
];
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
/** Seeded with the raw pages: the rule hides. */
let seeded: DatabaseSync;
let report: SeedSqlReport;

async function seed(name: string, judged: boolean): Promise<{ db: DatabaseSync; report: SeedSqlReport }> {
  const result = await seedSql({
    input: archive,
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
    `SELECT r.line_no, r.word, h.rule, h.because, h.language, h.page_line, p.title, p.revision_id
       FROM hidden_record h JOIN source_record r ON r.record_id = h.record_id JOIN raw_page p ON p.page_id = h.page_id
      ORDER BY r.line_no`,
  ).all().map((row) => ({ ...row }));

const EXPECTED_HIDDEN = () => [
  { line_no: lineOf("curie", 1), word: "curie", rule: "section-language/v1", because: "language-line", language: "nl", page_line: pageLineOf("curie", "{{-nl-}}"), title: "curie", revision_id: 3539009 },
  { line_no: lineOf("dolmen", 1), word: "dolmen", rule: "section-language/v1", because: "late-heading", language: "en", page_line: pageLineOf("dolmen", "{{-sost-|en}}"), title: "dolmen", revision_id: 4055841 },
  { line_no: lineOf("skirmish"), word: "skirmish", rule: "section-language/v1", because: "late-heading", language: "en", page_line: pageLineOf("skirmish", "{{-sost-|en}}"), title: "skirmish", revision_id: 1 },
];

test("the seed hides the records the rule finds in another language, naming the rule and the page line", () => {
  assert.deepEqual(hiddenRows(seeded), EXPECTED_HIDDEN());
  assert.deepEqual(report.hidden, { rule: "section-language/v1", ran: true, hidden: 3, languageLine: 1, lateHeading: 2 });
  assert.equal(report.rows.hidden_record, 3);
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

test("a seed without raw pages hides nothing", async () => {
  const { db, report: plain } = await seed("plain", false);
  try {
    assert.deepEqual(plain.hidden, { rule: "section-language/v1", ran: false });
    assert.equal((db.prepare("SELECT count(*) AS n FROM hidden_record").get() as { n: number }).n, 0);
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
  const nouns = LINES.flatMap((line, index) => ((JSON.parse(line) as { pos: string }).pos === "noun" ? [index + 1] : []));
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
    hidden_record: rows("SELECT record_id, rule, because, language, page_line FROM hidden_record"),
  };
}

test("the one-off update brings a dictionary seeded before the rule to what a seed now writes, and a second run plans nothing", async () => {
  const { db: before } = await seed("before", false);
  try {
    // A master seeded before the rule has no hidden_record table.
    before.exec("DROP TABLE hidden_record");
    const reader = readerOf(before);
    const { titles } = await readTitles(archive);
    const found = await findForeignRecords(PAGES, titles, languages);
    assert.deepEqual(found.map(({ word, foreign }) => [word, foreign.lineNo]), EXPECTED_HIDDEN().map((row) => [row.word, row.line_no]));

    const schema = await readFile(SCHEMA, "utf8");
    const plan = planHide(reader, found, schema);
    assert.equal(plan.hides.length, 3);
    assert.ok(plan.removed.lookup_form > 0 && plan.removed.form_of_edge === 0, JSON.stringify(plan.removed));
    const lines = before.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all();
    before.exec(plan.sql);
    assert.deepEqual(unhidden(reader, plan), []);
    assert.deepEqual(hiddenRows(before), EXPECTED_HIDDEN());
    assert.deepEqual(servingRows(before), servingRows(seeded));
    assert.deepEqual(before.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all(), lines);

    const again = planHide(reader, found, schema);
    assert.deepEqual({ hides: again.hides.length, alreadyHidden: again.alreadyHidden, sql: again.sql }, { hides: 0, alreadyHidden: 3, sql: "" });
  } finally {
    before.close();
  }
});

test("the update refuses a master whose record at a found line is another word", async () => {
  const { db } = await seed("other", false);
  try {
    const { titles } = await readTitles(archive);
    const found = await findForeignRecords(PAGES, titles, languages);
    const moved = found.map((record) => ({ ...record, foreign: { ...record.foreign, lineNo: record.foreign.lineNo - 1 } }));
    assert.throws(() => planHide(readerOf(db), moved, ""), /does not hold these records/);
  } finally {
    db.close();
  }
});
