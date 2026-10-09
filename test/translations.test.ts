// A record's translations (#739), read off its own archive line. The lines in
// `fixtures/translations.jsonl` are lines of release it-0c432803, verbatim:
// casa (archive line 1), macchina the noun (2058), macchina the verb form of
// macchinare (2059), macchinare (48699), macchine (64522) and fratelli (64531).

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { lookup } from "../src/lookup/lookup.js";
import { readSourceFields } from "../src/lookup/sourceRecord.js";
import type { Reading, SourceRef, Translation } from "../src/lookup/types.js";
import { readOnlyDictionary } from "./databases.js";

const FIXTURE = "fixtures/translations.jsonl";
/** Each fixture line by its archive line number. */
const ARCHIVE_LINES = [1, 2058, 2059, 48699, 64522, 64531];

async function archiveLine(lineNo: number): Promise<unknown> {
  const lines = (await readFile(FIXTURE, "utf8")).trimEnd().split("\n");
  const at = ARCHIVE_LINES.indexOf(lineNo);
  assert.ok(at !== -1 && lines.length === ARCHIVE_LINES.length, `archive line ${lineNo} is in the fixture`);
  return JSON.parse(lines[at]);
}

const refOn = (lineNo: number) => (jsonPointer: string): SourceRef => ({ releaseId: "it-0c432803", lineNo, jsonPointer, lineSha256: "x" });

const translationsAt = async (lineNo: number): Promise<Translation[]> => readSourceFields(await archiveLine(lineNo), refOn(lineNo)).translations;

/** A translation as `code name word sense pointer`. */
const row = (t: Translation) => [t.langCode, t.langName, t.word, t.sense, t.ref.jsonPointer];

test("macchina the noun gives all 14 translations in source order, each field verbatim with its pointer", async () => {
  const items = await translationsAt(2058);
  assert.deepEqual(items.map(row), [
    ["fr", "francese", "machine", "apparecchio, strumento", "/translations/0"],
    ["cic", "chickasaw", "chunali shepa", "apparecchio, strumento", "/translations/1"],
    ["el", "greco", "μηχανή", "apparecchio, strumento", "/translations/2"],
    ["nap", "napoletano", "màchina", "apparecchio, strumento", "/translations/3"],
    ["ru", "russo", "машина", "apparecchio, strumento", "/translations/4"],
    ["ru", "russo", "станок", "apparecchio, strumento", "/translations/5"],
    ["sv", "svedese", "bil", "apparecchio, strumento", "/translations/6"],
    ["de", "tedesco", "Maschine", "apparecchio, strumento", "/translations/7"],
    ["el", "greco", "αυτοκίνητο", "automobile", "/translations/8"],
    ["en", "inglese", "car", "automobile", "/translations/9"],
    ["en", "inglese", "automobile", "automobile", "/translations/10"],
    ["de", "tedesco", "Auto", "automobile", "/translations/11"],
    ["ru", "russo", "автомобиль", "automobile", "/translations/12"],
    ["ru", "russo", "машина", "automobile", "/translations/13"],
  ]);
  assert.deepEqual(items[9].ref, { releaseId: "it-0c432803", lineNo: 2058, jsonPointer: "/translations/9", lineSha256: "x" });
});

test("casa gives its 110 translations, its English ones where the source put them", async () => {
  const items = await translationsAt(1);
  assert.equal(items.length, 110);
  assert.deepEqual(items.filter((t) => t.langCode === "en").map(row), [
    ["en", "inglese", "house", "edificio destinato all'abitazione", "/translations/30"],
    ["en", "inglese", "home", "domicilio", "/translations/74"],
    ["en", "inglese", "house", "(astrologia) ognuna delle dodici suddivisioni del cielo", "/translations/106"],
  ]);
});

test("fratelli, a form-of record, gives its own two translations, which carry no sense: null, not a placeholder", async () => {
  assert.deepEqual((await translationsAt(64531)).map(row), [
    ["br", "bretone", "breudeur", null, "/translations/0"],
    ["en", "inglese", "brothers", null, "/translations/1"],
  ]);
});

test("macchine lists none, so it gives none", async () => {
  assert.deepEqual(await translationsAt(64522), []);
});

test("an entry with a missing or empty word or lang_code gives no item and no error; the others keep their pointers", () => {
  const record = {
    word: "x",
    translations: [
      { lang_code: "en", lang: "inglese", word: "kept", sense: "s" },
      { lang: "inglese", word: "no code" },
      { lang_code: "", word: "empty code" },
      { lang_code: "  ", word: "blank code" },
      { lang_code: "en" },
      { lang_code: "en", word: "" },
      { lang_code: "en", word: 3 },
      { lang_code: ["en"], word: "code not a string" },
      "not an entry",
      null,
      { lang_code: "de", word: "also kept", sense: "" },
    ],
  };
  assert.deepEqual(readSourceFields(record, refOn(9)).translations.map(row), [
    ["en", "inglese", "kept", "s", "/translations/0"],
    ["de", null, "also kept", null, "/translations/10"],
  ]);
  assert.deepEqual(readSourceFields({ word: "x", translations: "none" }, refOn(9)).translations, []);
  assert.deepEqual(readSourceFields({ word: "x" }, refOn(9)).translations, []);
});

// --- The lookup, over the same lines ----------------------------------------

const RELEASE = "it-translations-test";

async function withTranslationWords(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-translations-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(FIXTURE)));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  try {
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    await run(db);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function readings(db: DatabaseSync, query: string): Promise<[Reading, ...Reading[]]> {
  const result = await lookup({ db: readOnlyDictionary(db), releaseId: RELEASE, query });
  assert.ok(result.outcome === "found", `${query}: expected a found result, got ${result.outcome}`);
  return result.readings;
}

const words = (reading: Reading) => reading.translations.map((t) => `${t.langCode}:${t.word}`);

test("each reading carries its own record's translations, pointing into its own line", async () => {
  await withTranslationWords(async (db) => {
    const macchina = await readings(db, "macchina");
    const noun = macchina.find((reading) => reading.pos === "noun");
    const verb = macchina.find((reading) => reading.pos === "verb");
    assert.ok(noun !== undefined && verb !== undefined);
    assert.equal(noun.translations.length, 14);
    assert.deepEqual(noun.translations.filter((t) => t.langCode === "en").map((t) => [t.word, t.sense]), [["car", "automobile"], ["automobile", "automobile"]]);
    // The source copies the page's table onto the verb form's record too, and
    // the reading serves its record's list as written: the same 14.
    assert.deepEqual(words(verb), words(noun));
    assert.equal(noun.translations[0].ref.lineNo, noun.ref.lineNo);
    assert.equal(verb.translations[0].ref.lineNo, verb.ref.lineNo);
    assert.notEqual(noun.ref.lineNo, verb.ref.lineNo);
  });
});

test("a form-of reading borrows nothing from its lemma: macchine, whose record lists none, has none", async () => {
  await withTranslationWords(async (db) => {
    const macchine = (await readings(db, "macchine")).find((reading) => reading.word === "macchine");
    assert.ok(macchine !== undefined, "macchine is a reading of its own");
    assert.ok(macchine.lemmaLinks.some((link) => link.kind === "candidates" && link.candidates.some((lemma) => lemma.word === "macchina")));
    assert.deepEqual(macchine.translations, []);
    // fratelli's lemma is not in the fixture; its own two are its own.
    const [fratelli] = await readings(db, "fratelli");
    assert.deepEqual(words(fratelli), ["br:breudeur", "en:brothers"]);
  });
});
