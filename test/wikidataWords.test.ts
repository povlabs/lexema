// Wikidata words (ADR 0033, #812): Italian lexemes from Wikidata's dump kept
// as imported, `load:wikidata-words` writing the committed snapshot's words
// with an Italian gloss into a seeded master, and a lookup reading a word only where no Wiktionary reading
// answers the spelling. Inputs are verbatim: lexemes of the dump of
// 2026-10-07 (fixtures/wikidata-words/), the development fixture
// (fixtures/dev-seed.jsonl) and the declared lemma fixture
// (fixtures/declared-lemmas.jsonl), lines of it-0c432803.

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { POS_BY_TITLE } from "../src/italian/partOfSpeech.js";
import { lookupBatch } from "../src/lookup/batch.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { declaredLemma } from "../src/lookup/declaredLemma.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { entryKey, isWikidataWord, publicEntryId, type Reading } from "../src/lookup/types.js";
import { WIKIDATA_WORD_HEADS_SQL, WIKIDATA_WORD_SQL } from "../src/lookup/wikidataWords.js";
import { BESIDE_SOURCE_HEADS_SQL, BESIDE_SOURCE_SQL } from "../src/lookup/besideSource.js";
import { planNames } from "../src/names/loadNames.js";
import { nameItem } from "../src/names/nameItem.js";
import { planWrite, readyChange } from "../src/deploy/writePlan.js";
import { touchedWords, wordsOfWikidataWords } from "../src/deploy/touchedWords.js";
import { parseDeclaration } from "../src/update/declaration.js";
import { planUpgrade, upgradeShortfall, wikidataWordBeforeGenders, type MasterReader } from "../src/update/master.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";
import { POS_TITLE_BY_CATEGORY } from "../src/wikidataWords/lexicalCategories.js";
import { LexemeDumpRefused, PINNED_LEXEME_DUMP, wikidataWordsOf, type LexemeDump } from "../src/wikidataWords/lexemeDump.js";
import { missingForWikidataWords, planWikidataWords, unwrittenWikidataWords, wordRow } from "../src/wikidataWords/loadWikidataWords.js";
import { hasItalianGloss, InvalidWikidataWord, keysOfWord, lexemePageUrl, wikidataWord, wikidataWordOfDump, type WikidataWord, type WikidataWordSpec } from "../src/wikidataWords/wikidataWord.js";
import { askedKeysOf, ASKED_WORDS_PATH, isAsked, parseSnapshot, readWordSnapshot, snapshotText, WORD_SNAPSHOT_PATH } from "../src/wikidataWords/wordSnapshot.js";

const RELEASE = "it-wikidata-words";
const SCHEMA = "src/db/schema.sql";
const DATE = PINNED_LEXEME_DUMP.date;

/** The fixture's lexemes, by lemma. */
const WORDS = parseSnapshot(await readFile("fixtures/wikidata-words/lexemes.jsonl", "utf8"));
const word = (lemma: string): WikidataWord => {
  const found = WORDS.find((one) => one.lemma === lemma);
  assert.ok(found !== undefined, lemma);
  return found;
};

test("the category table maps each lexical category onto a section title of the closed set", () => {
  for (const title of Object.values(POS_TITLE_BY_CATEGORY)) assert.ok(Object.hasOwn(POS_BY_TITLE, title), title);
  assert.equal(POS_TITLE_BY_CATEGORY.Q1084, "Sostantivo");
  assert.equal(POS_TITLE_BY_CATEGORY.Q34698, "Aggettivo");
  // A proverb is no part of speech the page has: the table leaves it out.
  assert.ok(!Object.hasOwn(POS_TITLE_BY_CATEGORY, "Q35102"));
});

test("a Wikidata word keeps its Italian lemma, forms and glosses, and one with no lemma or of another lexeme's parts cannot be made", async () => {
  const lines = (await readFile("fixtures/wikidata-words/dump-lines.json", "utf8")).split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line.replace(/,$/, "")));
  const [proverb, paralimpico, orsetto] = lines;
  assert.equal(wikidataWordOfDump(proverb), undefined, "a proverb's category is not mapped");
  assert.equal(wikidataWordOfDump({ ...paralimpico, language: "Q1860" }), undefined, "an English lexeme is not kept");
  assert.deepEqual(wikidataWordOfDump(paralimpico), word("paralimpico"));
  assert.deepEqual(keysOfWord(word("paralimpico")), ["paralimpico", "paralimpici", "paralimpica", "paralimpiche"]);
  // Orsetto's one sense is glossed in English only, so it keeps none.
  assert.deepEqual(wikidataWordOfDump(orsetto)?.glosses, []);

  const spec: WikidataWordSpec = { ...word("pentirsi") };
  const refused = (bad: WikidataWordSpec) => assert.throws(() => wikidataWord(bad), InvalidWikidataWord);
  refused({ ...spec, lexeme: "L0" });
  refused({ ...spec, lemma: " " });
  refused({ ...spec, forms: [{ form: "L1-F1", spelling: "pento", features: [] }] });
  refused({ ...spec, glosses: [{ sense: "L1422655-S1", gloss: "" }] });
  refused({ ...spec, glosses: [...spec.glosses, ...spec.glosses] });
  // @ts-expect-error a proverb is not a category the table maps
  refused({ ...spec, category: "Q35102" });
  assert.equal(lexemePageUrl("L1247138"), "https://www.wikidata.org/wiki/Lexeme:L1247138");
});

test("a Wikidata word keeps the genders its lexeme states (P5185), and one that states none keeps none (#849)", async () => {
  const lines = (await readFile("fixtures/wikidata-words/dump-lines.json", "utf8")).split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line.replace(/,$/, "")));
  const [, paralimpico, orsetto] = lines;
  // orsetto states maschile once, for the whole lexeme; paralimpico, an adjective, states no gender.
  assert.deepEqual(wikidataWordOfDump(orsetto)?.genders, ["Q499327"]);
  assert.deepEqual(wikidataWordOfDump(paralimpico)?.genders, []);
  // A deprecated statement, which Wikidata marks as wrong, and one with no value name none.
  const [statement] = orsetto.claims.P5185;
  const deprecated = { ...statement, rank: "deprecated" };
  const noValue = { ...statement, mainsnak: { snaktype: "novalue", property: "P5185" } };
  const feminine = { ...statement, mainsnak: { ...statement.mainsnak, datavalue: { ...statement.mainsnak.datavalue, value: { "entity-type": "item", "numeric-id": 1775415, id: "Q1775415" } } } };
  assert.deepEqual(wikidataWordOfDump({ ...orsetto, claims: { P5185: [deprecated, noValue] } })?.genders, []);
  // Both genders, in the lexeme's order, each once.
  assert.deepEqual(wikidataWordOfDump({ ...orsetto, claims: { P5185: [feminine, statement, feminine] } })?.genders, ["Q1775415", "Q499327"]);

  const spec: WikidataWordSpec = { ...word("pentirsi") };
  assert.throws(() => wikidataWord({ ...spec, genders: ["Q499327", "Q499327"] }), InvalidWikidataWord);
  // @ts-expect-error a gender is an item
  assert.throws(() => wikidataWord({ ...spec, genders: ["P5185"] }), InvalidWikidataWord);
});

test("the dump is read a lexeme at a time and refused after the last when it is not the pinned file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-lexeme-dump-"));
  try {
    const path = join(dir, "lexemes.json.gz");
    const bytes = gzipSync(await readFile("fixtures/wikidata-words/dump-lines.json"));
    await writeFile(path, bytes);
    const dump: LexemeDump = { date: DATE, url: "https://example.org/lexemes.json.gz", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    const read: string[] = [];
    for await (const one of wikidataWordsOf(path, dump)) read.push(one.lexeme);
    assert.deepEqual(read, ["L1247138", "L1214279"]);
    await assert.rejects(async () => {
      for await (const one of wikidataWordsOf(path, { ...dump, sha256: "0".repeat(64) })) assert.ok(one);
    }, LexemeDumpRefused);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the committed snapshot holds every lexeme the count names, each once, in lexeme order, taken for the asked words", async () => {
  const committed = await readWordSnapshot();
  const report = await readFile("reports/2026-10-11-missing-common-words.md", "utf8");
  const group = report.slice(report.indexOf("### In Wikidata's words"), report.indexOf("### In neither"));
  const counted = [...new Set(group.match(/L\d+/g))].sort();
  assert.deepEqual(committed.map((one) => one.lexeme).sort(), counted);
  assert.equal(committed.length, 63);
  // Only the 19 with an Italian gloss are loaded (ADR 0033's 2026-10-12 amendment).
  assert.equal(committed.filter(hasItalianGloss).length, 19);
  // Each is spelled by an asked word; the four fixture lines are the snapshot's own.
  const asked = askedKeysOf(await readFile(ASKED_WORDS_PATH, "utf8"));
  assert.equal(asked.size, 60);
  assert.ok(committed.every((one) => isAsked(one, asked)));
  for (const lemma of ["papà", "ci", "paralimpico", "pentirsi"]) assert.deepEqual(committed.find((one) => one.lexeme === word(lemma).lexeme), word(lemma));
  // A text the command would not write is refused.
  const text = snapshotText(WORDS);
  const [first, second, ...rest] = text.split("\n");
  assert.throws(() => parseSnapshot([second, first, ...rest].join("\n")), /not in lexeme order/);
  assert.throws(() => parseSnapshot(text.replace('"lemma":"papà"', '"lemma":""')), new RegExp(`${WORD_SNAPSHOT_PATH} line 1`));
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

/** `fixture` seeded as a release, with no Wikidata word table, as a master from before #812. */
async function seeded(fixture: string): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-wikidata-words-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(await readFile(fixture)));
    const { parts } = await seedSql({ input: archive, outputDir: join(dir, "sql"), schema: SCHEMA, releaseId: RELEASE, license: "CC-BY-SA-4.0", onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    } });
    const db = new DatabaseSync(":memory:");
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    db.exec("DROP TABLE wikidata_word_key; DROP TABLE wikidata_word;");
    return db;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The fixture seeded, upgraded and loaded with the fixture's lexemes. */
async function loaded(fixture: string, words: readonly WikidataWord[] = WORDS): Promise<DatabaseSync> {
  const db = await seeded(fixture);
  execute(db, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
  execute(db, (await planWikidataWords(readerOf(db), words)).sql);
  return db;
}

/** Each reading as a page tells it apart: a record's word and part of speech, or a Wikidata word's lexeme, lemma, title and glosses. */
const shown = (readings: readonly Reading[]): string[] =>
  readings.map((reading) =>
    isWikidataWord(reading) ? `${reading.lexeme} ${reading.word} ${reading.posTitle}: ${reading.lexemeGlosses.map(({ text }) => text).join(" | ")}` : `${reading.word} ${reading.pos}`,
  );

async function readingsOf(db: DatabaseSync, query: string): Promise<string[]> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
  return result.outcome === "found" ? shown(result.readings) : [result.outcome];
}

test("load:wikidata-words writes each glossed lexeme with a spelling the dictionary does not answer, after the upgrade, and only once", async () => {
  const db = await seeded("fixtures/dev-seed.jsonl");
  try {
    const reader = readerOf(db);
    const recordsBefore = db.prepare("SELECT * FROM source_record_json ORDER BY record_id").all();
    const plan = await planWikidataWords(reader, WORDS);
    // Only papà and pentirsi have an Italian gloss, and each has a spelling the development fixture does not answer: `papino`, `pento`.
    const glossed = WORDS.filter(hasItalianGloss);
    assert.deepEqual(plan.written.map((one) => one.lexeme), ["L1144362", "L1422655"]);
    // ci, paralimpico and verbalizzare have none, so they are left out though the fixture answers none of `c'`, `paralimpico`, `verbalizzo`.
    assert.deepEqual(plan.unglossed.map((one) => one.lexeme), ["L1165467", "L1247138", "L1255218"]);
    assert.deepEqual([plan.answered, plan.absent, plan.snapshot], [[], [], DATE]);
    const keys = glossed.reduce((sum, one) => sum + keysOfWord(one).length, 0);
    assert.deepEqual(plan.counts.toJSON(), { records: { added: 0, changed: 0, removed: 0 }, written: { wikidata_word: 2, wikidata_word_key: keys }, deleted: {} });
    assert.deepEqual(wordsOfWikidataWords(plan), touchedWords(glossed.flatMap((one) => [one.lemma, ...one.forms.map((form) => form.spelling)])));
    // The SQL creates nothing (#509): the upgrade gives the master the tables, and the plan is the same after it.
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/);
    assert.deepEqual(missingForWikidataWords(reader), ["wikidata_word", "wikidata_word_key"]);
    execute(db, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    assert.deepEqual(missingForWikidataWords(reader), []);
    assert.equal((await planWikidataWords(reader, WORDS)).sql, plan.sql);
    execute(db, plan.sql);
    assert.deepEqual(unwrittenWikidataWords(reader, plan), []);
    assert.deepEqual(db.prepare("SELECT * FROM source_record_json ORDER BY record_id").all(), recordsBefore);

    const again = await planWikidataWords(reader, WORDS);
    assert.equal(again.sql, "");
    assert.equal(again.counts, PlanCounts.NONE);

    // A lexeme whose every spelling the dictionary answers is left out: `sale` and `sala`, both records here.
    const sale = wikidataWord({ lexeme: "L9999999", lemma: "sale", category: "Q1084", genders: [], forms: [{ form: "L9999999-F1", spelling: "sale", features: [] }], glosses: [{ sense: "L9999999-S1", gloss: "condimento" }] });
    assert.deepEqual((await planWikidataWords(reader, [...WORDS, sale])).answered.map((one) => one.lexeme), ["L9999999"]);
  } finally {
    db.close();
  }
});

test("a master whose wikidata_word is from before genders is upgraded with its rows, and the load then writes each lexeme's genders, with no re-import (#849)", async () => {
  const db = await seeded("fixtures/dev-seed.jsonl");
  try {
    const reader = readerOf(db);
    const schema = await readFile(SCHEMA, "utf8");
    // The Wikidata word tables as #812 created them, before the genders column.
    const before = schema.replace(/^ {2}-- The lexeme's grammatical genders.*\n {2}-- The default.*\n {2}genders .*\n/m, "");
    assert.notEqual(before, schema);
    execute(db, masterUpgradeSql(before));
    assert.equal(wikidataWordBeforeGenders(reader), true);
    const old = ["lexeme", "snapshot", "lemma", "category", "forms", "glosses"] as const;
    for (const one of WORDS.filter(hasItalianGloss)) {
      const row = wordRow(one, DATE);
      db.prepare(`INSERT INTO wikidata_word (${old.join(", ")}) VALUES (${old.map(() => "?").join(", ")})`).run(...old.map((column) => row[column]));
      for (const key of keysOfWord(one)) db.prepare("INSERT INTO wikidata_word_key (word_key, lexeme, snapshot) VALUES (?, ?, ?)").run(key, one.lexeme, DATE);
    }
    const rows = (): unknown[] => db.prepare("SELECT lexeme, snapshot FROM wikidata_word ORDER BY lexeme, snapshot").all().map((row) => ({ ...row }));
    const held = rows();
    const keys = db.prepare("SELECT count(*) AS n FROM wikidata_word_key").get();
    // Before the upgrade a lookup reads every Wikidata word as stating no gender, and serves it.
    assert.deepEqual(await readingsOf(db, "paparino"), ["L1144362 papà Sostantivo: termine affettuoso per riferirsi al genitore di sesso maschile"]);

    // papà states maschile; pentirsi states none, so only papà differs from what the master holds.
    const words = WORDS.map((one) => (one.lemma === "papà" ? wikidataWord({ ...one, genders: ["Q499327"] }) : wikidataWord({ ...one, genders: [] })));
    const plan = await planWikidataWords(reader, words);
    assert.deepEqual(plan.written.map((one) => one.lexeme), ["L1144362"]);
    assert.deepEqual(missingForWikidataWords(reader), ["wikidata_word"]);

    // The upgrade rebuilds the two tables with every row they hold, and gives each row no gender.
    const upgrade = planUpgrade(reader, schema);
    assert.deepEqual(upgrade.changed, ["wikidata_word"]);
    assert.deepEqual(upgrade.kept.map(({ name, rows: count }) => [name, count]), [["wikidata_word", 2], ["wikidata_word_key", (keys as { n: number }).n]]);
    execute(db, upgrade.sql);
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), []);
    assert.deepEqual([wikidataWordBeforeGenders(reader), missingForWikidataWords(reader)], [false, []]);
    assert.deepEqual(rows(), held);
    assert.deepEqual(db.prepare("SELECT DISTINCT genders FROM wikidata_word").all().map((row) => ({ ...row })), [{ genders: "[]" }]);

    // The plan is the one it was before the upgrade, and replaces papà's row of this snapshot in place.
    assert.equal((await planWikidataWords(reader, words)).sql, plan.sql);
    execute(db, plan.sql);
    assert.deepEqual(unwrittenWikidataWords(reader, plan), []);
    assert.deepEqual(rows(), held);
    assert.deepEqual(db.prepare("SELECT lexeme, genders FROM wikidata_word ORDER BY lexeme").all().map((row) => ({ ...row })), [
      { lexeme: "L1144362", genders: '["Q499327"]' },
      { lexeme: "L1422655", genders: "[]" },
    ]);
    assert.equal((await planWikidataWords(reader, words)).sql, "");
  } finally {
    db.close();
  }
});

test("a refresh writes a changed lexeme as a row of the newer dump, keeps the older as history, and leaves a dropped one serving", async () => {
  const db = await loaded("fixtures/dev-seed.jsonl");
  try {
    const reader = readerOf(db);
    const changed = WORDS.filter((one) => one.lemma !== "papà").map((one) =>
      one.lemma === "pentirsi" ? wikidataWord({ ...one, glosses: [{ sense: "L1422655-S1", gloss: "provare rimorso per un'azione sbagliata commessa" }] }) : one,
    );
    const refresh = await planWikidataWords(reader, changed, "2026-10-14");
    assert.deepEqual([refresh.written.map((one) => one.lexeme), refresh.absent], [["L1422655"], ["L1144362"]]);
    assert.deepEqual(refresh.counts.toJSON().deleted, {});
    execute(db, refresh.sql);
    assert.deepEqual(unwrittenWikidataWords(reader, refresh), []);
    assert.deepEqual(
      db.prepare("SELECT snapshot FROM wikidata_word WHERE lexeme = 'L1422655' ORDER BY snapshot").all().map((row) => ({ ...row })),
      [{ snapshot: DATE }, { snapshot: "2026-10-14" }],
    );
    assert.deepEqual(await readingsOf(db, "pento"), ["L1422655 pentirsi Verbo: provare rimorso per un'azione sbagliata commessa"]);
    // The lexeme the newer snapshot dropped keeps its row, still served.
    assert.deepEqual(db.prepare("SELECT snapshot FROM wikidata_word WHERE lexeme = 'L1144362'").all().map((row) => ({ ...row })), [{ snapshot: DATE }]);
    assert.deepEqual(await readingsOf(db, "paparino"), ["L1144362 papà Sostantivo: termine affettuoso per riferirsi al genitore di sesso maschile"]);
  } finally {
    db.close();
  }
});

test("Wiktionary wins: a word both have shows only the Wiktionary entry, and a spelling only Wikidata has shows its lexeme", async () => {
  const db = await loaded("fixtures/dev-seed.jsonl");
  try {
    // papà is a record of the fixture and the lemma of lexeme L1144362: only the record shows.
    assert.deepEqual(await readingsOf(db, "papà"), ["papà noun"]);
    // paparino is one of that lexeme's forms and spells nothing of Wiktionary's: the lexeme answers it.
    assert.deepEqual(await readingsOf(db, "paparino"), ["L1144362 papà Sostantivo: termine affettuoso per riferirsi al genitore di sesso maschile"]);
    // A lexeme with no Italian gloss is not loaded, so it answers nothing.
    assert.deepEqual(await readingsOf(db, "paralimpico"), ["not-found"]);
    assert.deepEqual(await readingsOf(db, "Paralimpiche"), ["not-found"]);

    const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "Paparino" });
    assert.ok(result.outcome === "found");
    const [papa] = result.readings;
    assert.ok(isWikidataWord(papa));
    assert.deepEqual(
      [papa.word, papa.pos, papa.posTitle, papa.ref, papa.isAboutQuery, papa.senses, papa.recovered, papa.lexemeGlosses.map(({ text }) => text)],
      // Paparino spells one of its forms, not its lemma, so it is not about the query, as a record listing it would not be (#851).
      ["papà", "noun", "Sostantivo", { releaseId: RELEASE, wiki: "www.wikidata.org", lexeme: "L1144362", snapshot: DATE }, false, [], [], ["termine affettuoso per riferirsi al genitore di sesso maschile"]],
    );
    assert.deepEqual(papa.evidence, [
      { origin: "embedded-form", surface: "paparino", ref: { releaseId: RELEASE, wiki: "www.wikidata.org", lexeme: "L1144362", snapshot: DATE, form: "L1144362-F4" }, formSource: null },
    ]);
    assert.equal(entryKey(papa), "lexeme-L1144362");
    assert.equal(publicEntryId({ releaseId: RELEASE, lexeme: papa.lexeme }), `${RELEASE}:wikidata:L1144362`);

    // `/exists` credits the lexeme, and a word Wiktionary has stays credited to Wiktionary.
    const present = await exists({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "paparino" });
    assert.ok(present.outcome === "present");
    assert.deepEqual([present.word, present.lexeme], ["papà", "L1144362"]);
    assert.equal((await exists({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "paralimpico" })).outcome, "absent");
    const record = await exists({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "papà" });
    assert.ok(record.outcome === "present");
    assert.deepEqual([record.word, record.lexeme], ["papà", undefined]);

    // The batch answers each word as the lookup does, under the same ids.
    const { answers } = await lookupBatch({ db: fromNodeSqlite(db), releaseId: RELEASE, queries: ["papà", "paparino", "paralimpico", "pento", "qqqqqq"] });
    const ids = answers.map((answer) => (answer.outcome === "found" ? answer.candidates.map((candidate) => `${publicEntryId(candidate)} ${candidate.word} ${candidate.pos} ${candidate.posTitle}`) : answer.outcome));
    assert.deepEqual(ids.slice(1), [
      [`${RELEASE}:wikidata:L1144362 papà noun Sostantivo`],
      "not-found",
      [`${RELEASE}:wikidata:L1422655 pentirsi verb Verbo`],
      "not-found",
    ]);
    assert.ok(Array.isArray(ids[0]) && ids[0].every((id) => !id.includes(":wikidata:")), String(ids[0]));
  } finally {
    db.close();
  }
});

test("a spelling only name entries answer shows its Wikidata words after them", async () => {
  const db = await loaded("fixtures/dev-seed.jsonl");
  try {
    const island = nameItem({ item: "Q1000003", label: "Paparino", description: "isola", category: "island" });
    execute(db, (await planNames(readerOf(db), [island])).sql);
    const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "paparino" });
    assert.ok(result.outcome === "found");
    assert.deepEqual(result.readings.map((reading) => reading.nameItem ?? reading.lexeme), ["Q1000003", "L1144362"]);
    const { answers } = await lookupBatch({ db: fromNodeSqlite(db), releaseId: RELEASE, queries: ["paparino"] });
    assert.ok(answers[0].outcome === "found");
    assert.deepEqual(answers[0].candidates.map((candidate) => candidate.nameItem ?? candidate.lexeme), ["Q1000003", "L1144362"]);
  } finally {
    db.close();
  }
});

test("a declared lemma's page stays: a Wikidata word does not take a spelling the page answers as a declared lemma", async () => {
  // verbalizzare has no Italian gloss, so it is given one here, or the load would leave it out and prove nothing.
  const glossed = WORDS.map((one) => (one.lemma === "verbalizzare" ? wikidataWord({ ...one, glosses: [{ sense: "L1255218-S1", gloss: "mettere a verbale" }] }) : one));
  const db = await loaded("fixtures/declared-lemmas.jsonl", glossed);
  try {
    const db2 = fromNodeSqlite(db);
    const result = await lookup({ db: db2, releaseId: RELEASE, query: "verbalizzare" });
    assert.equal(result.outcome, "not-found");
    assert.ok(result.outcome === "not-found" && (await declaredLemma(db2, RELEASE, result)) !== undefined);
    assert.equal((await exists({ db: db2, releaseId: RELEASE, query: "verbalizzare" })).outcome, "absent");
    const { answers } = await lookupBatch({ db: db2, releaseId: RELEASE, queries: ["verbalizzare"] });
    assert.equal(answers[0].outcome, "not-found");
  } finally {
    db.close();
  }
});

test("a lookup reads a key's Wikidata words by index, in the one statement that reads the hand-kept readings and the name entries", async () => {
  const db = await loaded("fixtures/dev-seed.jsonl");
  try {
    const plan = (sql: string, ...params: string[]) => (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
    for (const steps of [
      plan(BESIDE_SOURCE_SQL, "paralimpico"),
      plan(BESIDE_SOURCE_HEADS_SQL, JSON.stringify(["paralimpico", "pento"])),
      plan(WIKIDATA_WORD_SQL, "paralimpico"),
      plan(WIKIDATA_WORD_HEADS_SQL, JSON.stringify(["paralimpico", "pento"])),
    ]) {
      assert.ok(!steps.some((step) => /SCAN (k|w|l|wikidata_word|wikidata_word_key|name_entry|hand_kept_definition)\b/.test(step)), steps.join("\n"));
    }
    const asked: string[] = [];
    const recording = fromNodeSqlite(db);
    const all = recording.all.bind(recording);
    recording.all = (sql, params) => {
      asked.push(sql);
      return all(sql, params);
    };
    // A word Wiktionary answers and one only Wikidata has read the words in the same one statement, a lookup or a batch.
    for (const query of ["casa", "paparino"]) await lookup({ db: recording, releaseId: RELEASE, query });
    await lookupBatch({ db: recording, releaseId: RELEASE, queries: ["casa", "papà", "paparino", "pento", "qqqqqq"] });
    assert.deepEqual(asked.filter((sql) => sql.includes("FROM wikidata_word")), [BESIDE_SOURCE_SQL, BESIDE_SOURCE_SQL, BESIDE_SOURCE_HEADS_SQL]);
    // A dictionary without the tables is sent none naming them.
    asked.length = 0;
    db.exec("DROP TABLE wikidata_word_key; DROP TABLE wikidata_word;");
    assert.deepEqual(await readingsOf(db, "paparino"), ["not-found"]);
    await lookup({ db: recording, releaseId: RELEASE, query: "paparino" });
    await lookupBatch({ db: recording, releaseId: RELEASE, queries: ["paparino"] });
    assert.ok(!asked.some((sql) => sql.includes("FROM wikidata_word")), asked.join("\n---\n"));
  } finally {
    db.close();
  }
});

test("a declaration of load:wikidata-words takes no inputs and plans the committed snapshot's write", async () => {
  const file = "dictionary-changes/2026-10-11-load-wikidata-words.json";
  const declaration = parseDeclaration(file, JSON.stringify({
    command: "load:wikidata-words",
    inputs: {},
    expected: { records: { added: 0, changed: 0, removed: 0 }, written: { wikidata_word: 1, wikidata_word_key: 7 }, deleted: {} },
  }));
  assert.equal(declaration.command, "load:wikidata-words");
  assert.throws(() => parseDeclaration(file, JSON.stringify({ command: "load:wikidata-words", inputs: { archive: "it-0c432803" }, expected: declaration.expected })), /inputs of load:wikidata-words/);
  const db = await seeded("fixtures/dev-seed.jsonl");
  try {
    execute(db, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    assert.ok(declaration.command === "load:wikidata-words");
    const planned = await planWrite(readyChange(declaration, null), readerOf(db), "2026-10-11T00:00:00Z", { wikidataWords: [word("papà"), word("paralimpico")] });
    // paralimpico has no Italian gloss, so only papà and its seven spellings are written.
    assert.deepEqual(planned.run.counts.toJSON(), { records: { added: 0, changed: 0, removed: 0 }, written: { wikidata_word: 1, wikidata_word_key: 7 }, deleted: {} });
    execute(db, planned.sql);
    assert.deepEqual(planned.readBack(readerOf(db)), []);
  } finally {
    db.close();
  }
});
