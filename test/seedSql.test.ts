import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createGunzip } from "node:zlib";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { seedSql } from "../src/import/seedSql.js";
import { ARCHIVE_FACTS, archiveFactsFor, PUBLISHED_ARCHIVE_SHA256 } from "../src/source/archiveFacts.js";
import { loadFixturePages, type RawPageSource } from "../src/source/rawPage.js";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../src/import/pageOnlyCandidates.js";
import { unrecordedPageTitlesOf } from "../src/import/measureUnrecordedPages.js";
import { applyParts, PartFailure } from "../src/import/sqlParts.js";
import { normalizeItalianExact } from "../src/italian/normalize.js";
import { CURATED_CORRECTIONS, correctionId } from "../src/italian/curatedCorrections.js";
import { FixtureLines } from "../src/italian/correctionsAtLines.js";

const rawLemma = '{ "word":"lemma", "pos":"noun", "pos_title":"Sostantivo", "lang_code":"it", "forms":[{"form":"forma","source":"Appendice:Coniugazioni/Italiano/lemma","tags":["plural"]}], "senses":[{"glosses":["una voce"],"tags":["rare"]}] }';
const rawForm = JSON.stringify({
  word: "forma", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
  tags: ["form-of"], senses: [{ form_of: [{ word: "lemma" }] }],
});
const rawDangling = JSON.stringify({
  word: "orfano", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
  senses: [{ form_of: [{ word: "missing-lemma" }] }],
});

const HUEY_WORDS = [
  "acqua", "albero", "amica", "amico", "andare", "andavano", "avere", "bella", "bello",
  "cane", "casa", "case", "casetta", "città", "dire", "dormire", "essere", "fare",
  "fine", "finire", "gatto", "grande", "librare", "libro", "luna", "mangiare", "mare",
  "parlare", "parlerei", "partire", "ragazza", "ragazzo", "rosso", "sala", "salare", "sale",
  "salire", "scuola", "sole", "strada", "studente", "studentessa", "studenti", "studiare",
  "tavolo", "vado", "vedere", "venire", "vivere", "zaino",
] as const;

type ExpectedRecord = { pos: string; keyCount: number; forms: number };
type FixtureExpectations = { recordsByWord: Record<string, { recordCount: number; records: ExpectedRecord[] }> };
const expectations = JSON.parse(readFileSync(resolve("fixtures/dev-seed-expectations.json"), "utf8")) as FixtureExpectations;
const fixturePath = resolve(process.env.DEV_SEED_FIXTURE ?? "fixtures/dev-seed.jsonl");

async function fixture(lines: readonly string[]) {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  const input = join(dir, "fixture.jsonl");
  const outputDir = join(dir, "sql");
  await writeFile(input, `${lines.join("\n")}\n`);
  return { dir, input, outputDir };
}

// Each part is executed on its own, as Wrangler does, so a statement cut across
// a part boundary fails here as an incomplete statement.
function openSeed(parts: readonly string[], database: string): DatabaseSync {
  const db = new DatabaseSync(database);
  for (const part of parts) db.exec(readFileSync(part, "utf8"));
  return db;
}

test("emits valid SQL with verbatim lines, form source, and all candidates", async () => {
  const { dir, input, outputDir } = await fixture([rawLemma, rawForm, rawDangling]);
  const database = join(dir, "seed.sqlite");
  try {
    const report = await seedSql({
      input, outputDir, schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: ["lemma", "forma", "orfano"], validateFixtureClosure: false,
    });
    assert.equal(report.rows.source_record, 3);
    assert.equal(report.rows.source_record_json, 3);
    assert.equal(report.rows.lookup_form, 4);
    assert.equal(report.rows.form_of_edge, 2);

    const db = openSeed(report.parts, database);
    try {
      const raw = (db.prepare("SELECT raw_json FROM source_record_json WHERE record_id = 1").get() as { raw_json: string }).raw_json;
      assert.equal(raw, rawLemma);
      const source = (db.prepare("SELECT form_source FROM lookup_form WHERE surface = 'forma'").get() as { form_source: string }).form_source;
      assert.equal(source, "Appendice:Coniugazioni/Italiano/lemma");
      const candidates = (db.prepare("SELECT target_word, candidate_record_id FROM form_of_candidate WHERE target_word = 'lemma' ORDER BY candidate_record_id").all() as { target_word: string; candidate_record_id: number }[]).map((row) => ({ ...row }));
      assert.deepEqual(candidates, [{ target_word: "lemma", candidate_record_id: 1 }]);
      assert.equal((db.prepare("SELECT count(*) AS n FROM form_of_candidate WHERE target_word = 'missing-lemma'").get() as { n: number }).n, 0);
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("fixture closure fails with the missing target name", async () => {
  const { dir, input, outputDir } = await fixture([rawDangling]);
  try {
    await assert.rejects(
      seedSql({ input, outputDir, schema: resolve("src/db/schema.sql"), requiredWords: ["orfano"], validateFixtureClosure: true }),
      /missing form_of target word: missing-lemma/,
    );
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("committed fixture matches archive-derived expectations", async () => {
  const fixtureLines = readFileSync(fixturePath, "utf8").trimEnd().split("\n");
  const fixtureWords = new Set<string>();
  const fixtureByWord = new Map<string, Array<{ raw: string; pos: string; keyCount: number; forms: number }>>();
  const allFormOfTargets: string[] = [];
  for (const raw of fixtureLines) {
    const record = JSON.parse(raw) as {
      word: string;
      pos: string;
      forms?: unknown[];
      senses?: Array<{ form_of?: Array<{ word?: unknown }> }>;
    };
    fixtureWords.add(record.word);
    const entries = fixtureByWord.get(record.word) ?? [];
    entries.push({ raw, pos: record.pos, keyCount: Object.keys(record).length, forms: record.forms?.length ?? 0 });
    fixtureByWord.set(record.word, entries);
    for (const sense of record.senses ?? []) {
      for (const edge of sense.form_of ?? []) {
        assert.equal(typeof edge.word, "string", `${record.word}: form_of target must be a word`);
        allFormOfTargets.push(edge.word as string);
      }
    }
  }

  const expectedWords = Object.keys(expectations.recordsByWord);
  assert.deepEqual([...fixtureWords].sort(), [...expectedWords].sort(), "fixture words must match the archive-derived table");
  for (const word of HUEY_WORDS) {
    assert.ok(fixtureWords.has(word), `missing required word: ${word}`);
  }
  // An edge resolves by its word's key, as `form_of_candidate` joins it: `Parti` resolves to `parti`.
  const fixtureKeys = new Set([...fixtureWords].map(normalizeItalianExact));
  for (const target of allFormOfTargets) {
    assert.ok(fixtureKeys.has(normalizeItalianExact(target)), `missing form_of target word: ${target}`);
  }
  for (const [word, expectation] of Object.entries(expectations.recordsByWord)) {
    const actualRecords = fixtureByWord.get(word) ?? [];
    assert.equal(actualRecords.length, expectation.recordCount, `${word}: fixture record count`);
    assert.deepEqual(actualRecords.map(({ pos, keyCount, forms }) => ({ pos, keyCount, forms })), expectation.records,
      `${word}: fixture record shape differs from archive-derived expectation`);
  }

  // The archive is ignored and absent in CI; when the source cache holds it locally, retain the stronger byte check.
  if (!existsSync(resolve(".data/source/it-extract.jsonl.gz"))) return;
  const archiveByWord = new Map<string, Array<{ raw: string; pos: string; keys: string[]; forms: number }>>();
  const archiveSelectedLines: string[] = [];
  const input = createReadStream(resolve(".data/source/it-extract.jsonl.gz")).pipe(createGunzip());
  // The archive has records larger than readline's 4 KiB default. Node accepts
  // this option at runtime, but older @types/node releases do not declare it.
  const lines = createInterface({ input, crlfDelay: Infinity, maxLineLength: 1_000_000 } as any);
  for await (const raw of lines) {
    const record = JSON.parse(raw) as { word?: string; lang_code?: string; pos?: string; forms?: unknown[] };
    if (record.lang_code !== "it" || !record.word || !fixtureWords.has(record.word)) continue;
    archiveSelectedLines.push(raw);
    const entries = archiveByWord.get(record.word) ?? [];
    entries.push({ raw, pos: record.pos ?? "", keys: Object.keys(record).sort(), forms: record.forms?.length ?? 0 });
    archiveByWord.set(record.word, entries);
  }

  assert.deepEqual(fixtureLines, archiveSelectedLines, "fixture must be the archive selection in archive order");
  assert.deepEqual([...archiveByWord.keys()].sort(), [...fixtureByWord.keys()].sort());
  for (const word of fixtureWords) {
    const fixtureRecords = fixtureByWord.get(word) ?? [];
    const archiveRecords = archiveByWord.get(word) ?? [];
    assert.equal(fixtureRecords.length, archiveRecords.length, `${word}: fixture record count`);
    const remaining = new Map(archiveRecords.map((record, index) => [index, record]));
    for (const fixtureRecord of fixtureRecords) {
      const archiveEntry = [...remaining.entries()].find(([, candidate]) => candidate.raw === fixtureRecord.raw);
      assert.ok(archiveEntry, `${word}: fixture line is not an archive line`);
      const [index, archiveRecord] = archiveEntry;
      assert.deepEqual(Object.keys(JSON.parse(fixtureRecord.raw)).sort(), archiveRecord.keys, `${word}: archive key set`);
      assert.equal(fixtureRecord.forms, archiveRecord.forms, `${word}: archive form count`);
      assert.equal(fixtureRecord.pos, archiveRecord.pos);
      remaining.delete(index);
    }
    assert.equal(remaining.size, 0, `${word}: archive records omitted from fixture`);
  }
});

// The words whose form_of edges lead to a word with no record, which the dev
// seed cannot hold (docs/DEV_SEED.md): each word whole, every line of it the
// archive's, in archive order, and none of them a dev-seed word.
test("the no-base-record fixture is the archive's lines of words whose edges lead to a word with no record", async () => {
  const lines = readFileSync(resolve("fixtures/no-base-record.jsonl"), "utf8").trimEnd().split("\n");
  const records = lines.map((raw) => JSON.parse(raw) as { word: string; senses?: Array<{ form_of?: Array<{ word: string }> }> });
  const words = new Set(records.map((record) => record.word));
  const devWords = new Set(Object.keys(expectations.recordsByWord));
  assert.deepEqual([...words].filter((word) => devWords.has(word)), [], "a word in both fixtures");
  const devKeys = new Set([...devWords].map(normalizeItalianExact));
  const ownKeys = new Set([...words].map(normalizeItalianExact));
  // Each word's edge targets, by the key the release resolves them by.
  const targetsOf = new Map<string, string[]>([...words].map((word) => [word, []]));
  for (const record of records) {
    for (const sense of record.senses ?? []) for (const edge of sense.form_of ?? []) targetsOf.get(record.word)!.push(normalizeItalianExact(edge.word));
  }
  const dangling = [...targetsOf.values()].flat().filter((key) => !devKeys.has(key) && !ownKeys.has(key));
  // A word belongs here when one of its edges names a word with no record, or a word that belongs here.
  const kept = new Set([...targetsOf].filter(([, keys]) => keys.some((key) => dangling.includes(key))).map(([word]) => word));
  for (let grew = true; grew; ) {
    grew = false;
    for (const [word, keys] of targetsOf) {
      if (kept.has(word) || !keys.some((key) => [...kept].some((other) => normalizeItalianExact(other) === key))) continue;
      kept.add(word);
      grew = true;
    }
  }
  assert.deepEqual([...words].filter((word) => !kept.has(word)), [], "a word whose edges all reach a record belongs in the dev seed");

  if (!existsSync(resolve(".data/source/it-extract.jsonl.gz"))) return;
  const input = createReadStream(resolve(".data/source/it-extract.jsonl.gz")).pipe(createGunzip());
  const archive = createInterface({ input, crlfDelay: Infinity, maxLineLength: 1_000_000 } as any);
  const selected: string[] = [];
  const headwordKeys = new Set<string>();
  for await (const raw of archive) {
    const record = JSON.parse(raw) as { word?: string; lang_code?: string };
    if (record.lang_code !== "it" || !record.word) continue;
    headwordKeys.add(normalizeItalianExact(record.word));
    if (words.has(record.word)) selected.push(raw);
  }
  assert.deepEqual(lines, selected, "the fixture must be the archive selection in archive order");
  for (const key of dangling) assert.ok(!headwordKeys.has(key), `${key} has a record in the archive`);
});

test("missing required fixture words and repeated output are deterministic", async () => {
  const { dir, input, outputDir } = await fixture([rawLemma]);
  const outputDir2 = join(dir, "sql-2");
  try {
    await assert.rejects(
      seedSql({ input, outputDir, schema: resolve("src/db/schema.sql"), requiredWords: ["absent"] }),
      /missing required word: absent/,
    );
    const first = await seedSql({ input, outputDir, schema: resolve("src/db/schema.sql"), releaseId: "it-test", requiredWords: ["lemma"] });
    const second = await seedSql({ input, outputDir: outputDir2, schema: resolve("src/db/schema.sql"), releaseId: "it-test", requiredWords: ["lemma"] });
    assert.deepEqual(await concatenated(first.parts), await concatenated(second.parts));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a form refused for its surface still reports its own refused leaves", async () => {
  // writeRecord reads every form surface before it reads any form's members
  // (importRelease.ts, "Read once, before either pass over forms[]"). A pass
  // that returned on the refused surface lost the tag's rejection from both
  // the rejection list and the count. This drives the seeder's own path, not
  // the record validator, because writeRecord is where that ordering lives.
  const { dir, input, outputDir } = await fixture([
    JSON.stringify({
      word: "valido", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
      forms: [{ form: 42, tags: [9, "plural"], raw_tags: 8, source: 7 }],
      senses: [{ glosses: ["valido"] }],
    }),
  ]);
  try {
    const rejections: { kind: string; lineNo: number; reason: string }[] = [];
    const report = await seedSql({
      input, outputDir, schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: ["valido"], validateFixtureClosure: false,
      onRejection: (item) => rejections.push(item),
    });
    assert.equal(report.rows.source_record, 1);
    assert.deepEqual(rejections, [
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/form is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/source is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/tags/0 is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/raw_tags is not an array" },
    ]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

async function concatenated(parts: readonly string[]): Promise<Buffer> {
  return Buffer.concat(await Promise.all(parts.map((part) => readFile(part))));
}

/** Tables keyed by their primary key alone (no rowid), dumped in key order instead. */
const WITHOUT_ROWID = new Set(["accent_fold", "typo_key"]);

function tableDump(db: DatabaseSync): Record<string, unknown[]> {
  const tables = (db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
    .map(({ name }) => name);
  return Object.fromEntries(tables.map((table) => [table, db.prepare(`SELECT * FROM "${table}" ORDER BY ${WITHOUT_ROWID.has(table) ? "1, 2, 3" : "rowid"}`).all().map((row) => ({ ...row }))]));
}

// The raw pages seedDev reads, so the dev seed here carries the recovered layer too.
const rawPages = await loadFixturePages(resolve("fixtures"));
// The page-only candidates seedDev offers for the fixture (#499).
const unrecorded = await readUnrecordedPageTitles(resolve(UNRECORDED_PAGE_TITLES_FILE));
const devPageOnly = await PageOnlyCandidates.forSeedInput(fixturePath, resolve(UNRECORDED_PAGE_TITLES_FILE));

// The committed corrections seedDev keys to the fixture's lines (#742).
const devCorrections = (await FixtureLines.read(fixturePath, "it-dev")).key(CURATED_CORRECTIONS);

const devSeed = (outputDir: string, partCeilingBytes?: number, pages: RawPageSource = rawPages) =>
  seedSql({
    input: fixturePath, outputDir, schema: resolve("src/db/schema.sql"), releaseId: "it-dev",
    requiredWords: HUEY_WORDS, validateFixtureClosure: true, partCeilingBytes, rawPages: pages, pageOnly: devPageOnly,
    corrections: devCorrections.held,
  });

/** The words the seed wrote page-only entries for, sorted. */
const pageOnlyWords = (parts: readonly string[]): string[] => {
  const db = openSeed(parts, ":memory:");
  try {
    return [...new Set(db.prepare("SELECT word FROM recovered_entry").all().map((row) => row.word as string))].sort();
  } finally { db.close(); }
};

test("the fifty-word dev seed is one part with the same rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  try {
    const report = await devSeed(join(dir, "sql"));
    assert.deepEqual(report.parts, [join(dir, "sql", "part-001.sql")]);
    assert.deepEqual(report.rows, {
      source_record: 1085, source_record_json: 1085, lookup_form: 12358, accent_fold: 488, typo_key: 3772, form_of_edge: 496,
      sense: 1776, sense_gloss: 1760, sense_label: 857, grammar_claim: 48170,
      raw_page: 20, recovered_definition: 10, recovered_label: 6, recovered_example: 7, hidden_record: 0,
      // The curated corrections whose lines the fixture holds, keyed to its
      // own (#742): seven records' gender or number and 99 senses' edges, 8 of
      // them replacing an edge that names another word (#733), and 13 meaning
      // senses' (#755): 12 removed, and `fermi`'s pointed at `fermo`. The
      // one table-cell entry's line, `assorbire`'s, is not in the fixture.
      corrected_claim: 7,
      corrected_form: 0,
      corrected_edge: 99,
      // The one hide's line, `diplomatizzare`'s (#773), is not in the fixture either.
      hidden_recovered_definition: 0,
      // Only the fixture pages on the committed list of it-0c432803's
      // record-less titles are page-only candidates (#499): 20 of them, of
      // which 17 recover (`lungo` as two entries), `grufolare` and `tremare`
      // among them, whose curated definition corrections apply.
      recovered_entry: 18, entry_definition: 27, entry_label: 12, entry_example: 6,
      // Their other fields, each read from the entry's own page (ADR 0026).
      entry_fact: 367,
      corrected_definition: 2,
      // The committed hand-kept readings, whatever the fixture holds (ADR
      // 0031, #745): si's pronoun's four definitions and come's conjunction's one.
      hand_kept_definition: 5,
      release_table_rows: 26,
    });
    // 36 of the fixture's records have a raw page under fixtures/. Three pages
    // state definitions their record does not carry: `casa`'s seven and
    // `beato`'s verb form's one, whose records carry none, and `servizio`'s
    // two more beside its own.
    assert.deepEqual(report.recovery, {
      rawPages: rawPages.size, recordsWithAPage: 36, fullLoss: 2, partialLoss: 1,
      definitions: 10, examples: 7, unrendered: 0,
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("the dev seed writes the committed corrections the fixture holds, keyed to it-dev, and leaves out the rest (#742)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  try {
    const { held, leftOut } = devCorrections;
    const keyed = held.filter((correction) => correction.record !== undefined);
    assert.equal(keyed.length, 106);
    // Entries whose archive lines the fixture does not carry, `fissazione`'s and `assorbire`'s among them.
    const leftOutWords = new Set(leftOut.map((correction) => correction.record?.word));
    for (const word of ["fissazione", "assorbire"]) assert.ok(leftOutWords.has(word), word);
    const report = await devSeed(join(dir, "sql"));
    assert.deepEqual(report.corrections, { keyed: 106, applied: 106, unapplied: [] });
    const db = openSeed(report.parts, ":memory:");
    try {
      const edges = db.prepare(
        `SELECT r.word, e.sense_index, e.target_word, e.correction_id FROM corrected_edge e
           JOIN source_record r ON r.record_id = e.record_id WHERE r.word IN ('costruttori', 'parti') ORDER BY r.word, e.sense_index`,
      ).all().map((row) => ({ ...row }));
      const idOf = (word: string, sense: number) =>
        correctionId(held.find((correction) => correction.record?.word === word && correction.edge?.sense === sense) ?? assert.fail(`${word} ${sense}`));
      assert.deepEqual(edges, [
        { word: "costruttori", sense_index: 0, target_word: "costruttore", correction_id: idOf("costruttori", 0) },
        { word: "parti", sense_index: 1, target_word: "parto", correction_id: idOf("parti", 1) },
        { word: "parti", sense_index: 2, target_word: "parto", correction_id: idOf("parti", 2) },
      ]);
      assert.match(idOf("costruttori", 0), /^it-dev:\d+\/senses\/0$/);
      // A removed edge (#755) is a row that names no word: `basilica`'s "vena principale dell'avambraccio".
      assert.deepEqual(
        db.prepare(`SELECT e.sense_index, e.json_pointer, e.target_word, e.target_word_key, e.base_evidence_url FROM corrected_edge e
                      JOIN source_record r ON r.record_id = e.record_id WHERE r.word = 'basilica'`).all().map((row) => ({ ...row })),
        [{ sense_index: 0, json_pointer: "/senses/0/glosses/0", target_word: null, target_word_key: null, base_evidence_url: null }],
      );
      // Every row is keyed to the fixture; no entry left out reaches the SQL.
      const ids = db.prepare("SELECT correction_id AS id FROM corrected_edge UNION ALL SELECT correction_id FROM corrected_claim").all().map((row) => row.id as string);
      assert.equal(ids.length, 106);
      assert.ok(ids.every((id) => id.startsWith("it-dev:")), ids.join(", "));
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("the dev seed offers only the release's record-less titles as page-only entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  try {
    const words = pageOnlyWords((await devSeed(join(dir, "sql"))).parts);
    // Pages sampled under fixtures/upstream-wikitext/ for words it-0c432803 has
    // records for are not page-only entries, though the fixture lacks them.
    for (const word of ["acquirente", "albanese", "americana", "Dalia"]) {
      assert.ok(rawPages.page(word) !== undefined, `${word} has a fixture page`);
      assert.ok(!words.includes(word), `${word} is not a page-only entry`);
    }
    // A fixture page the release has no record for still is one, `raccontare`
    // among them. `irrequieti`, `mezz'ora` and `motteggio` are listed too, and
    // ADR 0028 excludes their layouts.
    assert.deepEqual(words, [
      "a monte", "accerchiarsi", "dipendere", "dismagare", "fidelizzare", "finora", "fornire", "grufolare", "lungo",
      "mastoide", "piallare", "piangere sul latte versato", "purità", "raccontare", "tantundem", "tremare", "trincetto",
    ]);
    const listed = new Set(unrecorded.titles);
    assert.deepEqual(words.filter((word) => !listed.has(word)), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a dev seed over the whole dump reads only the listed pages, never every title", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  // A stand-in for the dump: it would hold every main-namespace page, so
  // listing its titles is the walk the fixture seed must not make.
  const asked: string[] = [];
  const dump: RawPageSource = {
    page: (title) => {
      asked.push(title);
      return rawPages.page(title);
    },
    titles: () => {
      throw new Error("the fixture seed walked every title of the raw page source");
    },
    size: 758_429,
  };
  try {
    const words = pageOnlyWords((await devSeed(join(dir, "sql"), undefined, dump)).parts);
    const listed = new Set(unrecorded.titles);
    const offered = new Set(unrecorded.titles.filter((title) => rawPages.page(title) !== undefined));
    assert.ok(words.length > 0 && words.every((word) => offered.has(word)));
    // The archive's own records ask for their pages too; nothing else is read.
    const recordWords = new Set(readFileSync(fixturePath, "utf8").trimEnd().split("\n").map((line) => JSON.parse(line).word as string));
    assert.deepEqual([...new Set(asked)].filter((title) => !listed.has(title) && !recordWords.has(title)), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a release archive offers every raw page with no Italian record, a fixture only the committed list", async () => {
  const every = await PageOnlyCandidates.forSeedInput("it-extract.jsonl.gz", resolve(UNRECORDED_PAGE_TITLES_FILE));
  assert.deepEqual([...every.titlesIn(rawPages)], [...rawPages.titles()]);
  assert.deepEqual([...devPageOnly.titlesIn(rawPages)], unrecorded.titles.filter((title) => rawPages.page(title) !== undefined));

  // Seeded as a full release is, the same archive and pages offer the
  // sampled pages too (ADR 0028): its records are all the release has.
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  try {
    const report = await seedSql({
      input: fixturePath, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-dev",
      rawPages, pageOnly: every,
    });
    const words = pageOnlyWords(report.parts);
    for (const word of ["acquirente", "albanese", "americana", "Dalia", "raccontare"]) assert.ok(words.includes(word), word);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("the committed record-less titles are the release measurement's, sorted and distinct", async () => {
  assert.equal(unrecorded.release, `it-${PUBLISHED_ARCHIVE_SHA256.slice(0, 8)}`);
  const measurement = JSON.parse(await readFile(resolve(unrecorded.measuredBy), "utf8"));
  assert.equal(measurement.release, unrecorded.release);
  assert.deepEqual(unrecorded, unrecordedPageTitlesOf(measurement, unrecorded.measuredBy));
});

test("a seed forced across parts cuts only between statements and loads the same database", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  const ceiling = 256 * 1024;
  try {
    const single = await devSeed(join(dir, "single"));
    const split = await devSeed(join(dir, "split"), ceiling);
    assert.equal(single.parts.length, 1);
    assert.ok(split.parts.length > 1, `expected several parts, got ${split.parts.length}`);
    assert.deepEqual(split.parts, split.parts.map((_, index) => join(dir, "split", `part-${String(index + 1).padStart(3, "0")}.sql`)));
    for (const part of split.parts) {
      assert.ok((await stat(part)).size <= ceiling, `${part} exceeds the ceiling`);
      assert.match(await readFile(part, "utf8"), /;\n$/, `${part} does not end on a statement`);
    }
    // Nothing is lost or reordered: the parts are the single seed, cut in pieces.
    assert.deepEqual(await concatenated(split.parts), await concatenated(single.parts));

    const singleDb = openSeed(single.parts, ":memory:");
    const splitDb = openSeed(split.parts, ":memory:");
    try {
      assert.deepEqual(tableDump(splitDb), tableDump(singleDb));
    } finally { singleDb.close(); splitDb.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("the recovered layer sits beside casa's record and leaves every source row as the seed without pages writes it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  try {
    const withPages = await devSeed(join(dir, "pages"));
    const without = await seedSql({
      input: fixturePath, outputDir: join(dir, "bare"), schema: resolve("src/db/schema.sql"), releaseId: "it-dev",
      requiredWords: HUEY_WORDS, validateFixtureClosure: true, corrections: devCorrections.held,
    });
    const pagesDb = openSeed(withPages.parts, ":memory:");
    const bareDb = openSeed(without.parts, ":memory:");
    try {
      const layer = ["raw_page", "recovered_definition", "recovered_label", "recovered_example", "release_table_rows",
        "recovered_entry", "entry_definition", "entry_label", "entry_example", "entry_fact", "corrected_definition"];
      // A page-only entry is searchable, so it adds its own nearby keys and changes no other.
      const nearby = ["accent_fold", "typo_key"];
      const source = (dump: Record<string, unknown[]>) =>
        Object.fromEntries(Object.entries(dump).filter(([table]) => !layer.includes(table) && !nearby.includes(table)));
      const withPagesDump = tableDump(pagesDb);
      const bareDump = tableDump(bareDb);
      assert.deepEqual(source(withPagesDump), source(bareDump));
      const pageOnlyKeys = new Set(pagesDb.prepare("SELECT word_key FROM recovered_entry").all().map((row) => row.word_key));
      for (const table of nearby) {
        const bare = new Set(bareDump[table].map((row) => JSON.stringify(row)));
        const added = withPagesDump[table].filter((row) => !bare.delete(JSON.stringify(row)));
        assert.equal(bare.size, 0, `${table}: every row of the seed without pages stays`);
        assert.ok(added.every((row) => pageOnlyKeys.has((row as { surface_key: string }).surface_key)), `${table}: only page-only entries add rows`);
      }

      const casaLine = readFileSync(fixturePath, "utf8").split("\n").find((line) => JSON.parse(line).word === "casa");
      const casa = pagesDb.prepare(
        "SELECT r.record_id, j.raw_json FROM source_record r JOIN source_record_json j USING (record_id) WHERE r.word = 'casa'",
      ).get() as { record_id: number; raw_json: string };
      assert.equal(casa.raw_json, casaLine);
      const recovered = pagesDb.prepare(
        `SELECT d.route, d.page_line, p.title, p.revision_id FROM recovered_definition d JOIN raw_page p USING (page_id)
          WHERE d.record_id = ? ORDER BY d.definition_index`,
      ).all(casa.record_id) as { route: string; page_line: number; title: string; revision_id: number }[];
      assert.deepEqual(recovered.map((row) => row.page_line), [8, 10, 13, 15, 17, 18, 20]);
      assert.ok(recovered.every((row) => row.route === "below-page-control" && row.title === "casa" && row.revision_id === 4257826));
    } finally { pagesDb.close(); bareDb.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a definition the page wrapped onto the line after its `#` is stored with its route, label and page line", async () => {
  const { dir, input, outputDir } = await fixture([readFileSync(resolve("fixtures/pantomima.jsonl"), "utf8").trimEnd()]);
  try {
    const report = await seedSql({ input, outputDir, schema: resolve("src/db/schema.sql"), rawPages });
    const db = openSeed(report.parts, ":memory:");
    try {
      const rows = db.prepare(
        `SELECT d.route, d.page_line, d.text, p.title, p.revision_id, l.label
           FROM recovered_definition d JOIN raw_page p USING (page_id) LEFT JOIN recovered_label l USING (recovered_id)`,
      ).all();
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        {
          route: "wrapped-prose",
          page_line: 6,
          text: "Susseguirsi di gesti vivaci e concitati, per comunicare agli altri senza che i presenti se ne accorgano.",
          title: "pantomima",
          revision_id: 3994400,
          label: "figurato",
        },
      ]);
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a reseed replaces the parts an earlier, larger seed left", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  const outputDir = join(dir, "sql");
  try {
    await devSeed(outputDir, 256 * 1024);
    await writeFile(join(outputDir, "notes.txt"), "kept");
    const report = await devSeed(outputDir);
    assert.equal(report.parts.length, 1);
    assert.deepEqual((await readdir(outputDir)).sort(), ["notes.txt", "part-001.sql"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a statement larger than the ceiling is refused, not split", async () => {
  const { dir, input, outputDir } = await fixture([rawLemma]);
  try {
    await assert.rejects(
      seedSql({ input, outputDir, schema: resolve("src/db/schema.sql"), partCeilingBytes: 1024 }),
      /-byte SQL unit exceeds the 1024-byte part ceiling/,
    );
    await assert.rejects(
      seedSql({ input, outputDir, schema: resolve("src/db/schema.sql"), partCeilingBytes: 0 }),
      /part ceiling must be a positive whole number of bytes/,
    );
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a failed part stops the load and names the failed and applied parts", async () => {
  const attempted: string[] = [];
  const parts = ["part-001.sql", "part-002.sql", "part-003.sql"];
  await assert.rejects(
    applyParts(parts, (part) => {
      attempted.push(part);
      if (part === "part-002.sql") throw new Error("wrangler exited 1");
    }),
    (error: unknown) => {
      assert.ok(error instanceof PartFailure);
      assert.equal(error.part, "part-002.sql");
      assert.equal(error.index, 2);
      assert.equal(error.total, 3);
      assert.deepEqual(error.applied, ["part-001.sql"]);
      assert.match(error.message, /part 2 of 3 failed: part-002\.sql\napplied before it: part-001\.sql/);
      return true;
    },
  );
  assert.deepEqual(attempted, ["part-001.sql", "part-002.sql"]);
});

test("with leaveImporting the SQL never marks the release servable, and still records its counters", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  const database = join(dir, "seed.sqlite");
  try {
    const report = await seedSql({
      input: fixturePath, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-dev",
      requiredWords: HUEY_WORDS, validateFixtureClosure: true, leaveImporting: true,
    });
    assert.equal(report.status, "complete");
    const db = openSeed(report.parts, database);
    try {
      const row = db.prepare("SELECT status, lines_read, admitted FROM source_release WHERE release_id = 'it-dev'").get() as
        { status: string; lines_read: number; admitted: number };
      // Loaded in full, and still not servable until a caller verifies it.
      assert.equal(row.status, "importing");
      assert.equal(row.lines_read, report.linesRead);
      assert.equal(row.admitted, report.admitted);
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

const JULY_SHA256 = "0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf";

type ReleaseFactsRow = {
  source_url: string | null;
  retrieved_at: string | null;
  upstream_release: string | null;
  upstream_release_basis: string | null;
};

const releaseFacts = (db: DatabaseSync): ReleaseFactsRow =>
  ({ ...db.prepare("SELECT source_url, retrieved_at, upstream_release, upstream_release_basis FROM source_release").get() }) as ReleaseFactsRow;

test("the July archive's facts are committed once, keyed by its checksum, with their evidence", async () => {
  assert.deepEqual(
    { ...archiveFactsFor(JULY_SHA256), evidence: undefined },
    {
      sourceUrl: "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz",
      retrievedAt: "2026-07-20T09:04:02Z",
      dump: { id: "itwiktionary-20260701", basis: "inferred" },
      evidence: undefined,
    },
  );
  assert.equal(archiveFactsFor("f".repeat(64)), undefined);
  // A key the seed could never compute would hold facts no archive gets.
  for (const [sha, facts] of Object.entries(ARCHIVE_FACTS)) {
    assert.match(sha, /^[0-9a-f]{64}$/, `${sha}: a lowercase SHA-256`);
    assert.match(facts.dump.id, /^itwiktionary-\d{8}$/, `${sha}: a Wikimedia dump id`);
    // Each pointer names a file in this repository that shows the fact.
    assert.ok(facts.evidence.length > 0, `${sha}: evidence`);
    for (const pointer of facts.evidence) {
      const path = pointer.split(/[ :]/, 1)[0];
      assert.ok(existsSync(resolve(path)), `${sha}: evidence ${path} exists`);
    }
  }
});

test("a seed records the facts keyed by its archive's checksum, and only those", async () => {
  const { dir, input, outputDir } = await fixture([rawLemma]);
  try {
    const sha = createHash("sha256").update(await readFile(input)).digest("hex");
    const report = await seedSql({
      input, outputDir, schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      archiveFacts: { [sha]: ARCHIVE_FACTS[JULY_SHA256] },
    });
    assert.equal(report.archiveFacts, ARCHIVE_FACTS[JULY_SHA256]);
    const db = openSeed(report.parts, join(dir, "match.sqlite"));
    try {
      assert.deepEqual(releaseFacts(db), {
        source_url: "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz",
        retrieved_at: "2026-07-20T09:04:02Z",
        upstream_release: "itwiktionary-20260701",
        upstream_release_basis: "inferred",
      });
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("an archive with any other checksum records none of the facts", async () => {
  const { dir, input, outputDir } = await fixture([rawLemma]);
  try {
    // The committed catalog, as every real seed reads it. This file is not the
    // July archive, so nothing of the July archive's may land on it.
    const report = await seedSql({ input, outputDir, schema: resolve("src/db/schema.sql"), releaseId: "it-test" });
    assert.equal(report.archiveFacts, undefined);
    const db = openSeed(report.parts, join(dir, "other.sqlite"));
    try {
      assert.deepEqual(releaseFacts(db), {
        source_url: null, retrieved_at: null, upstream_release: null, upstream_release_basis: null,
      });
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("the dev fixture, cut from the July archive, is a different file and records none of its facts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  try {
    const report = await seedSql({
      input: fixturePath, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-dev",
      requiredWords: HUEY_WORDS, validateFixtureClosure: true,
    });
    assert.notEqual(report.archiveSha256, JULY_SHA256);
    const db = openSeed(report.parts, join(dir, "dev.sqlite"));
    try {
      assert.deepEqual(releaseFacts(db), {
        source_url: null, retrieved_at: null, upstream_release: null, upstream_release_basis: null,
      });
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("the schema refuses a dump without its basis, and an id that is not a dump's", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(readFileSync(resolve("src/db/schema.sql"), "utf8"));
    const insert = (dump: string | null, basis: string | null) =>
      db.prepare(
        `INSERT INTO source_release (release_id, source_name, upstream_release, upstream_release_basis,
           archive_r2_key, archive_sha256, archive_bytes, normalizer, importer_version, schema_version)
         VALUES (?, 'kaikki-it-wiktextract', ?, ?, 'releases/x.jsonl.gz', ?, 1, 'it-normalize/v1', 'it-import/v1', 1)`,
      ).run(`it-${Math.random()}`, dump, basis, "0".repeat(64));
    insert("itwiktionary-20260701", "inferred");
    insert(null, null);
    assert.throws(() => insert("itwiktionary-20260701", null), /CHECK constraint failed/);
    assert.throws(() => insert(null, "inferred"), /CHECK constraint failed/);
    assert.throws(() => insert("itwiktionary-20260701", "guessed"), /CHECK constraint failed/);
    assert.throws(() => insert("1 July 2026", "inferred"), /CHECK constraint failed/);
  } finally { db.close(); }
});
