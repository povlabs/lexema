// A Preview's dictionary slice (#447): the words each command's plan touches
// (src/deploy/touchedWords.ts, the `touched` field of `planWrite`'s plan),
// the slice built from them on a local dictionary (src/deploy/previewSlice.ts),
// what a lookup reads there, and the route the Worker takes between it and
// the shared dictionary (src/lookup/slice.ts). The records are verbatim
// archive lines of it-0c432803 (fixtures/dev-seed.jsonl,
// fixtures/page-entry-forms.jsonl, fixtures/curated-corrections.jsonl) and the
// pages verbatim revisions of its dump (fixtures/upstream-pages/), as in
// loadPageEntries.test.ts and correctRecords.test.ts.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import { PreviewSlice, sliceFingerprint, SliceRefused, sliceKeys } from "../src/deploy/previewSlice.js";
import { builtSlice, declaredSlice, readOnlyReader } from "../src/deploy/sliceCli.js";
import { NO_WORDS, touchedWords, unbounded, unionOf, wordsOfApply, wordsOfCorrections, wordsOfHide, wordsOfPageEntries } from "../src/deploy/touchedWords.js";
import { planWrite, readyChange, type WritePlan } from "../src/deploy/writePlan.js";
import type { Git } from "../src/deploy/pending.js";
import { planCorrections } from "../src/import/correctRecords.js";
import type { FoundRecord } from "../src/import/hiddenLayer.js";
import { planHide } from "../src/import/hideRecords.js";
import { archiveWords, findPageEntries, planPageEntries } from "../src/import/loadPageEntries.js";
import { seedSql } from "../src/import/seedSql.js";
import { CURATED_CORRECTIONS } from "../src/italian/curatedCorrections.js";
import { FORM_OF_FOREIGN_LEMMA_RULE } from "../src/italian/formOfForeignLemma.js";
import { fromNodeSqlite, type LookupDatabase } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { dictionaryFor } from "../src/lookup/slice.js";
import { loadFixturePages, rawPageSource, type RawPage } from "../src/source/rawPage.js";
import { chooseChanges, planApply, type ApplyPlan } from "../src/update/apply.js";
import { parseChange, parseDraft, type DeclarationDraft } from "../src/update/declaration.js";
import { diffAgainstMaster } from "../src/update/diff.js";
import type { MasterReader } from "../src/update/master.js";
import type { ArchiveFactsCatalog } from "../src/source/archiveFacts.js";
import { SOURCE_TEXT_UPDATE_RULES } from "../src/import/normalizeSourceText.js";
import { atFixtureLines, correctionFixtureLines } from "./correctionFixture.js";

const RELEASE = "it-slice";
const SCHEMA = resolve("src/db/schema.sql");

const pages = await loadFixturePages(resolve("fixtures"));
const PAGES: RawPage[] = ["raccontare", "fornire", "grufolare", "tremare", "dipendere", "dismagare", "movere", "mastoide", "lungo"].map((title) => {
  const page = pages.page(title);
  assert.ok(page, title);
  return page;
});

const lines = async (path: string): Promise<string[]> => (await readFile(path, "utf8")).trimEnd().split("\n");
const record = (fields: Record<string, unknown>): string => JSON.stringify({ lang_code: "it", ...fields });
const DIPENDERE = record({ word: "dipendere", pos: "verb", pos_title: "Verbo", senses: [{ glosses: ["essere subordinato"] }] });
const DIPENDO = record({ word: "dipendo", pos: "verb", pos_title: "Voce verbale", senses: [{ glosses: ["prima persona singolare del presente indicativo di dipendere"], tags: ["form-of"], form_of: [{ word: "dipendere" }] }] });
const DISMAGO = record({ word: "dismago", pos: "verb", pos_title: "Voce verbale", senses: [{ glosses: ["prima persona singolare del presente indicativo di dismagare"], tags: ["form-of"], form_of: [{ word: "dismagare" }] }] });

let dir: string;
let schema: string;
let archive: string;
let later: string;
let correctionArchive: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-slice-"));
  schema = await readFile(SCHEMA, "utf8");
  const master = [...(await lines("fixtures/dev-seed.jsonl")), ...(await lines("fixtures/page-entry-forms.jsonl")), DIPENDERE, DIPENDO];
  archive = join(dir, "master.jsonl.gz");
  await writeFile(archive, gzipSync(`${master.join("\n")}\n`));
  // The feed: `casa` with one more sense, and a new form, `dismago`.
  const casa = master.findIndex((line) => (JSON.parse(line) as { word: string }).word === "casa");
  const fixed = JSON.parse(master[casa]) as { senses: unknown[] };
  later = join(dir, "later.jsonl.gz");
  await writeFile(later, gzipSync(`${[...master.slice(0, casa), JSON.stringify({ ...fixed, senses: [...fixed.senses, { glosses: ["dimora del feed di prova"] }] }), ...master.slice(casa + 1), DISMAGO].join("\n")}\n`));
  correctionArchive = join(dir, "corrections.jsonl.gz");
  await writeFile(correctionArchive, gzipSync(`${(await correctionFixtureLines()).join("\n")}\n`));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

let seeds = 0;
/** `input` seeded as a served master, with foreign keys on, as on D1. */
async function seeded(input: string): Promise<DatabaseSync> {
  const { parts } = await seedSql({ input, outputDir: join(dir, `seed-${++seeds}`), schema: SCHEMA, releaseId: RELEASE, license: "CC-BY-SA-4.0" });
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
  return db;
}

/** The shared dictionary as the slice reads it, keeping every statement it was sent. */
function readerOf(db: DatabaseSync, sent: string[] = []): MasterReader {
  return {
    query: <Row>(sql: string) => {
      sent.push(sql);
      return db.prepare(sql).all() as Row[];
    },
  };
}

const fixtureCatalog = (masterSha: string, feedSha: string): ArchiveFactsCatalog => {
  const fact = (id: `itwiktionary-${string}`) => ({ sourceUrl: "https://example.org/fixture", retrievedAt: "2026-10-01T00:00:00Z", dump: { id, basis: "recorded" as const }, evidence: ["synthetic fixture"] });
  return { [masterSha]: fact("itwiktionary-20260701"), [feedSha]: fact("itwiktionary-20260901") };
};

/** The feed's two changes, `casa` changed and `dismago` new, planned against `db`. */
async function applyPlan(db: DatabaseSync): Promise<ApplyPlan> {
  const reader = readerOf(db);
  const found = await diffAgainstMaster(reader, later);
  const chosen = chooseChanges(found, found.diff.changes.map((change) => change.id));
  return planApply(reader, found, chosen, { appliedAt: "2026-10-04T00:00:00Z", catalog: fixtureCatalog(found.master.archiveSha256, found.feed.archiveSha256) });
}

/** A hide of `dipendo`, whose form-of target a Spanish record lists, by rule form-of-foreign-lemma/v1. */
function hideFound(db: DatabaseSync): FoundRecord[] {
  const { line_no: lineNo } = db.prepare("SELECT line_no FROM source_record WHERE word = 'dipendo'").get() as { line_no: number };
  return [{ rule: FORM_OF_FOREIGN_LEMMA_RULE, word: "dipendo", lineNo, form: { lineNo, word: "dipendo", code: "es", lemmaLine: 1, lemma: "dipendere" } }];
}

const outcomeOf = async (db: LookupDatabase, word: string): Promise<string> => (await lookup({ db, releaseId: RELEASE, query: word })).outcome;

// --- The words each plan touches --------------------------------------------

test("each command's plan names the words it writes: update:auto, hide:records, correct:records and load:page-entries", async () => {
  const db = await seeded(archive);
  try {
    const reader = readerOf(db);
    assert.deepEqual(wordsOfApply(await applyPlan(db)), { kind: "words", words: ["casa", "dismago"] });
    assert.deepEqual(wordsOfApply(null), NO_WORDS);
    assert.deepEqual(wordsOfHide(planHide(reader, hideFound(db))), { kind: "words", words: ["dipendo"] });
    const entries = planPageEntries(reader, await findPageEntries(PAGES, await archiveWords(archive)), CURATED_CORRECTIONS);
    // `lungo`'s two entries are one word; `dipendere` is spelled by a record, so no entry is written for it.
    assert.deepEqual(wordsOfPageEntries(entries), { kind: "words", words: ["dismagare", "fornire", "grufolare", "lungo", "mastoide", "raccontare", "tremare"] });
    db.exec(entries.sql);
    // Written once, a page entry's definition correction is already there, and a correction run touches nothing.
    assert.deepEqual(wordsOfCorrections(planCorrections(reader, CURATED_CORRECTIONS.filter((correction) => correction.entry !== undefined))), NO_WORDS);
  } finally {
    db.close();
  }
  const corrections = await seeded(correctionArchive);
  try {
    const fixture = atFixtureLines(await correctionFixtureLines(), RELEASE).slice(0, 3);
    assert.deepEqual(wordsOfCorrections(planCorrections(readerOf(corrections), fixture)), touchedWords(fixture.map(({ record }) => record.word)));
  } finally {
    corrections.close();
  }
});

test("planWrite carries the touched words: none for update:upgrade, unbounded for normalize:source-text, the records' words for correct:records", async () => {
  const db = await seeded(correctionArchive);
  try {
    const reader = readerOf(db);
    const fixture = atFixtureLines(await correctionFixtureLines(), RELEASE).slice(0, 2);
    const plan = (text: string, corrections = fixture) => planWrite(readyChange(parseChange("test", text), null), reader, "2026-10-04T00:00:00Z", { corrections });
    assert.deepEqual((await plan('{"command":"update:upgrade"}')).touched, NO_WORDS);
    assert.deepEqual((await plan(JSON.stringify({ command: "normalize:source-text", inputs: { rules: SOURCE_TEXT_UPDATE_RULES } }))).touched, unbounded("normalize:source-text"));
    assert.deepEqual((await plan('{"command":"correct:records"}')).touched, touchedWords(fixture.map(({ record }) => record.word)));
  } finally {
    db.close();
  }
  assert.deepEqual(unionOf(touchedWords(["b", "a"]), touchedWords(["a", "c"])), { kind: "words", words: ["a", "b", "c"] });
  assert.deepEqual(unionOf(touchedWords(["a"]), unbounded("normalize:source-text")), unbounded("normalize:source-text"));
});

// --- The slice ------------------------------------------------------------------

/** Every row of every table, by table, so two databases can be compared. */
function snapshot(db: DatabaseSync): Map<string, string[]> {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  return new Map(tables.map(({ name }) => [name, (db.prepare(`SELECT * FROM ${name}`).all() as object[]).map((row) => JSON.stringify(row)).sort()]));
}

const build = (db: DatabaseSync, words: readonly string[], changes: { file: string; sql: string }[] = [], sent?: string[]) =>
  PreviewSlice.build({ reader: readerOf(db, sent), words, schema, changes, fingerprint: "f".repeat(64) });

test("a slice of words with no change looks each of them up exactly as the shared dictionary does, and sends it only reads", async () => {
  const db = await seeded(archive);
  const sent: string[] = [];
  const words = ["casa", "dipendo", "dipendere", "studenti", "bello", "andare"];
  const slice = build(db, words, [], sent);
  try {
    for (const word of words) {
      const shared = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
      const sliced = await lookup({ db: fromNodeSqlite(slice.db), releaseId: RELEASE, query: word });
      assert.notEqual(shared.outcome, "rejected", word);
      assert.deepEqual(sliced, shared, word);
    }
    assert.ok(sent.length > 0);
    for (const sql of sent) assert.match(sql, /^SELECT\s/, sql);
    // Only what those words read: far fewer records than the dictionary holds.
    const records = (database: DatabaseSync) => (database.prepare("SELECT count(*) AS n FROM source_record").get() as { n: number }).n;
    assert.ok(records(slice.db) < records(db) / 4, `${records(slice.db)} of ${records(db)}`);
    // `andare`'s forms (`vado`, `andavano`) only name it: the slice holds the rows that list them, not their own search rows.
    const listed = slice.db.prepare("SELECT word FROM source_record r WHERE NOT EXISTS (SELECT 1 FROM lookup_form l WHERE l.record_id = r.record_id) ORDER BY word").all() as { word: string }[];
    assert.ok(listed.some(({ word }) => word === "vado"), JSON.stringify(listed));
    assert.deepEqual(slice.keys, sliceKeys(words));
  } finally {
    slice.close();
    db.close();
  }
});

test("on a slice with the pull request's changes, a word it adds or recovers is found and a word it hides is not, while the shared dictionary is unchanged", async () => {
  const db = await seeded(archive);
  const reader = readerOf(db);
  const apply = await applyPlan(db);
  const hide = planHide(reader, hideFound(db));
  const entries = planPageEntries(reader, await findPageEntries(PAGES, await archiveWords(archive)), CURATED_CORRECTIONS);
  const words = unionOf(unionOf(wordsOfApply(apply), wordsOfHide(hide)), wordsOfPageEntries(entries));
  assert.ok(words.kind === "words");
  const before = snapshot(db);
  const slice = build(db, words.words, [
    { file: "dictionary-changes/a-update-auto.json", sql: apply.sql },
    { file: "dictionary-changes/b-hide-records.json", sql: hide.sql },
    { file: "dictionary-changes/c-load-page-entries.json", sql: entries.sql },
  ]);
  try {
    const shared = fromNodeSqlite(db);
    const sliced = fromNodeSqlite(slice.db);
    // Added and recovered: found on the slice, not in the shared dictionary.
    for (const word of ["dismago", "raccontare", "fornire", "lungo"]) {
      assert.equal(await outcomeOf(shared, word), "not-found", word);
      assert.equal(await outcomeOf(sliced, word), "found", word);
    }
    // Hidden: found in the shared dictionary, not on the slice.
    assert.equal(await outcomeOf(shared, "dipendo"), "found");
    assert.equal(await outcomeOf(sliced, "dipendo"), "not-found");
    // Changed: the slice reads the feed's record, with its new sense.
    const casa = await lookup({ db: sliced, releaseId: RELEASE, query: "casa" });
    assert.ok(casa.outcome === "found");
    assert.ok(JSON.stringify(casa.readings).includes("dimora del feed di prova"));
    assert.equal(JSON.stringify(await lookup({ db: shared, releaseId: RELEASE, query: "casa" })).includes("dimora del feed di prova"), false);
    // The shared dictionary was only read.
    assert.deepEqual(snapshot(db), before);

    // The Worker's route: the slice for a word it serves, hidden ones included; the shared dictionary for any other.
    for (const word of ["dismago", "Dipendo ", "raccontare"]) assert.equal(await dictionaryFor(word, shared, sliced), sliced, word);
    for (const word of ["cane", "bello", ""]) assert.equal(await dictionaryFor(word, shared, sliced), shared, word);
    assert.equal(await dictionaryFor("dismago", shared, undefined), shared);
  } finally {
    slice.close();
    db.close();
  }
});

test("the slice's SQL file rebuilds it whole on an empty database, and it counts each row once per table and once per index", async () => {
  const db = await seeded(archive);
  const apply = await applyPlan(db);
  const slice = build(db, ["casa", "dismago"], [{ file: "a.json", sql: apply.sql }]);
  try {
    const sql = slice.sql();
    assert.match(sql, /^PRAGMA defer_foreign_keys = true;\n/);
    // The fingerprint row is the last write, so a file that stops part way leaves none.
    assert.match(sql.trimEnd(), /INSERT INTO preview_slice \(singleton, fingerprint, format\) VALUES\n {2}\(1, 'f{64}', 'preview-slice\/v1'\);$/);
    for (const statement of sql.split(";\n")) assert.ok(Buffer.byteLength(statement) < 100_000, statement.slice(0, 80));
    const empty = new DatabaseSync(":memory:");
    try {
      empty.exec("PRAGMA foreign_keys = ON");
      empty.exec("BEGIN");
      empty.exec(sql);
      empty.exec("COMMIT");
      assert.deepEqual(snapshot(empty), snapshot(slice.db));
    } finally {
      empty.close();
    }

    const indexes = (table: string) => (slice.db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type = 'index' AND tbl_name = ?").get(table) as { n: number }).n;
    const byTable = slice.rowsByTable();
    assert.equal(slice.rowsWritten, Object.entries(byTable).reduce((sum, [table, rows]) => sum + rows * (1 + indexes(table)), 0));
    // lookup_form's rows are each written to its three indexes and its UNIQUE one.
    assert.equal(indexes("lookup_form"), 4);
    assert.equal(byTable.preview_slice_word, 2);
    assert.equal(byTable.preview_slice, 1);
  } finally {
    slice.close();
    db.close();
  }
});

test("a change whose SQL names a row the slice lacks is refused, and no slice is made", async () => {
  const db = await seeded(archive);
  try {
    assert.throws(
      () => build(db, ["casa"], [{ file: "dictionary-changes/x.json", sql: "INSERT INTO sense (sense_id, record_id, sense_index, json_pointer) VALUES (99999999, 99999999, 0, '/senses/0');" }]),
      (error: unknown) => error instanceof SliceRefused && /dictionary-changes\/x\.json does not run on the slice: .*FOREIGN KEY/.test(error.message),
    );
    assert.throws(() => build(db, []), SliceRefused);
  } finally {
    db.close();
  }
});

test("the slice reads the shared dictionary through a reader that refuses anything but one SELECT", () => {
  const sent: string[] = [];
  const reader = readOnlyReader({ query: <Row>(sql: string) => (sent.push(sql), [] as Row[]) });
  for (const sql of ["DELETE FROM source_record", "UPDATE lookup_form SET surface = ''", "SELECT 1; DROP TABLE sense", "PRAGMA foreign_keys = OFF", "INSERT INTO sense VALUES (1)"]) {
    assert.throws(() => reader.query(sql), /read-only/, sql);
  }
  assert.deepEqual(sent, []);
  reader.query("SELECT 1");
  assert.deepEqual(sent, ["SELECT 1"]);
});

// --- What a branch's build asks of its declarations -------------------------

/** A Git whose `main` and `HEAD` differ by `added`, each a declaration path and its text. */
function fakeGit(added: Record<string, string>, fetch: "ok" | "fails" = "ok"): Git {
  return {
    run: (args) => {
      if (args[0] === "fetch") {
        if (fetch === "fails") throw new Error("could not resolve host: github.com");
        return "";
      }
      if (args[0] === "diff") return `${Object.keys(added).join("\n")}\n`;
      if (args[0] === "show") return added[args[1].slice("HEAD:".length)];
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
    test: () => true,
  };
}

const DECLARATION = '{"command":"correct:records","inputs":{}}\n';

test("a branch's declarations past main give the slice's fingerprint; none, an unread base or an unreadable file give no slice", () => {
  assert.deepEqual(declaredSlice(fakeGit({}), schema), { state: "none", reason: "the branch adds no change declaration past main" });
  assert.match((declaredSlice(fakeGit({}, "fails"), schema) as { reason: string }).reason, /^the base could not be read: fetching main failed/);
  assert.match((declaredSlice(fakeGit({ "dictionary-changes/x.json": "{" }), schema) as { reason: string }).reason, /^a declaration could not be read/);

  const files = { "dictionary-changes/2026-10-04-correct.json": DECLARATION };
  const declared = declaredSlice(fakeGit(files), schema);
  assert.equal(declared.state, "declared");
  assert.equal(declared.state === "declared" && declared.fingerprint, sliceFingerprint([{ file: "dictionary-changes/2026-10-04-correct.json", text: DECLARATION }], schema));
  // The same declarations and schema give the same fingerprint; a changed declaration or schema, another.
  assert.deepEqual(declaredSlice(fakeGit(files), schema), declared);
  const fingerprint = (state: ReturnType<typeof declaredSlice>) => (state.state === "declared" ? state.fingerprint : undefined);
  assert.notEqual(fingerprint(declaredSlice(fakeGit({ "dictionary-changes/2026-10-04-correct.json": DECLARATION.replace("{}", "{ }") }), schema)), fingerprint(declared));
  assert.notEqual(fingerprint(declaredSlice(fakeGit(files), `${schema}\n-- changed`)), fingerprint(declared));
});

test("a build plans each declaration, and gives no slice for a whole-dictionary rewrite, a plan that touches no word or a plan that cannot be read", async () => {
  const db = await seeded(correctionArchive);
  try {
    const reader = readerOf(db);
    const fixture = atFixtureLines(await correctionFixtureLines(), RELEASE).slice(0, 2);
    const draft = (file: string, command: string): DeclarationDraft => parseDraft(file, JSON.stringify(command === "normalize:source-text" ? { command, inputs: { rules: SOURCE_TEXT_UPDATE_RULES } } : { command }));
    const declared = (...drafts: DeclarationDraft[]) => ({ state: "declared" as const, fingerprint: "f".repeat(64), declarations: drafts });
    const plan = (declaration: DeclarationDraft): Promise<WritePlan> => planWrite(readyChange(declaration, null), reader, "2026-10-04T00:00:00Z", { corrections: fixture });

    const rewrite = await builtSlice(declared(draft("dictionary-changes/a.json", "normalize:source-text")), schema, { reader, plan: () => assert.fail("a rewrite is not planned") });
    assert.deepEqual(rewrite, { state: "none", reason: "dictionary-changes/a.json runs normalize:source-text, which rewrites the whole dictionary, so no word set bounds a slice" });
    const upgrade = await builtSlice(declared(draft("dictionary-changes/a.json", "update:upgrade")), schema, { reader, plan });
    assert.deepEqual(upgrade, { state: "none", reason: "the declarations touch no word (only update:upgrade, or plans that write nothing)" });
    const unread = await builtSlice(declared(draft("dictionary-changes/a.json", "correct:records")), schema, { reader, plan: () => Promise.reject(new Error("offline")) });
    assert.deepEqual(unread, { state: "none", reason: "the plan of dictionary-changes/a.json could not be read: offline" });

    const built = await builtSlice(declared(draft("dictionary-changes/a.json", "update:upgrade"), draft("dictionary-changes/b.json", "correct:records")), schema, { reader, plan });
    assert.ok(built.state === "built");
    try {
      assert.deepEqual(built.slice.keys, sliceKeys(fixture.map(({ record }) => record.word)));
      assert.equal(built.slice.fingerprint, "f".repeat(64));
      // The correction is on the slice, and not in the shared dictionary.
      const corrected = (database: DatabaseSync) => (database.prepare("SELECT count(*) AS n FROM corrected_claim").get() as { n: number }).n;
      assert.equal(corrected(db), 0);
      assert.ok(corrected(built.slice.db) > 0);
    } finally {
      built.slice.close();
    }
  } finally {
    db.close();
  }
});
