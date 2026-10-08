// Regression cases for the quality measurement (#17), one per finding the
// twelve-word spot check left open and reports/2026-10-01-dictionary-quality.md
// now verifies. Every record is a verbatim archive line: the twelve's words
// from fixtures/dev-seed.jsonl, the rest from fixtures/quality-regressions.jsonl
// (archive lines 196 `gallo`, 43791 `palo`, 139668 `vogare`, 140523 `voga`,
// 226888 `raccontavo`, 429722 `rifritto`, 56392 `balzana`). `palo` is in the
// dev seed too (#709), and a line in both files is read once. No case needs
// `it-extract.jsonl.gz`.
//
// The cases for #400 — the measurement reads the gloss text the page shows,
// not the archive's — use fixtures/headword-echo.jsonl (archive lines 31614
// `asciugatoio`, 31642 `presina`, 31786 `sci di fondo`, 43510 `dm`, 53318
// `sci`, verbatim) and fixtures/gloss-stamps.jsonl, whose records are not whole
// lines: they are cut down to the fields the stamp rule reads, glosses as
// written (test/glossGrammarStamp.test.ts).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import {
  duplicateForms,
  glossMood,
  hasGlossText,
  moodAgreement,
  PageSenses,
  rawTextNames,
  targetResolution,
  type QualityRecord,
} from "../src/italian/recordQuality.js";
import { isFurnitureGloss, readHeadwordLine, splitSenses } from "../src/italian/furniture.js";
import { recordText, recoverDefinitions } from "../src/italian/recovery.js";
import { lookup } from "../src/lookup/lookup.js";
import { readSavedPage } from "../src/source/rawPage.js";
import { readOnlyDictionary } from "./databases.js";

interface ArchiveLine extends QualityRecord {
  pos_title: string;
  senses: (QualityRecord["senses"][number] & { glosses?: string[]; raw_tags?: string[] })[];
}

/** Lines as the archive parser admits them: `forms` and every sense's `form_of` always arrays. A line in two files is one record. */
function read(...files: string[]): ArchiveLine[] {
  return [...new Set(files.flatMap((file) => readFileSync(resolve(file), "utf8").trim().split("\n")))]
    .map((line) => {
      const record = JSON.parse(line);
      return {
        ...record,
        forms: record.forms ?? [],
        senses: (record.senses ?? []).map((sense: object & { form_of?: unknown[] }) => ({ ...sense, form_of: sense.form_of ?? [] })),
      };
    });
}

const records = read("fixtures/dev-seed.jsonl", "fixtures/quality-regressions.jsonl");
const all = (word: string, pos?: string) => records.filter((record) => record.word === word && (pos === undefined || record.pos === pos));
const one = (word: string, pos: string) => {
  const found = all(word, pos);
  assert.equal(found.length, 1, `expected one ${pos} record of ${word}`);
  return found[0];
};
const kinds = (record: ArchiveLine) => PageSenses.of(record).kinds;
const tables = (word: string) => all(word, "verb").filter((record) => record.forms.length > 0).map((record) => record.forms);
const firstGloss = (record: ArchiveLine) => record.senses[0].glosses?.[0] ?? "";

test("casa: a non-empty gloss array with no meaning in it; the page shows the furniture only until the raw page is read", () => {
  const casa = one("casa", "noun");
  assert.equal(hasGlossText(casa), true);
  assert.deepEqual(kinds(casa), ["furniture", "furniture"]);
  // With nothing else to show, the page shows the two headword lines verbatim.
  assert.equal(PageSenses.of(casa).definitionsShown(0), 2);
  const page = readSavedPage(readFileSync(resolve("fixtures/upstream-pages/casa.wikitext"), "utf8"), "casa.wikitext");
  const recovery = recoverDefinitions(recordText(casa), page);
  assert.equal(recovery.outcome, "matched");
  const recovered = recovery.outcome === "matched" ? recovery.recovered.length : 0;
  // The seven recovered definitions replace them: the furniture is hidden.
  assert.equal(PageSenses.of(casa).definitionsShown(recovered), 7);
});

test("casa: its one raw tag names number, not gender", () => {
  const casa = one("casa", "noun");
  const raw = casa.senses.flatMap((sense) => sense.raw_tags ?? []);
  assert.deepEqual(raw, ["pl.: case"]);
  assert.deepEqual([...rawTextNames(raw[0])], ["number"]);
});

test("raw text names gender or number only through a stamp or a grammar word", () => {
  const names = (text: string) => [...rawTextNames(text)].sort();
  assert.deepEqual(names("f.sing."), ["gender", "number"]);
  assert.deepEqual(names("s.m.inv."), ["gender", "number"]);
  assert.deepEqual(names("msing"), ["gender", "number"]);
  assert.deepEqual(names("m/f"), ["gender"]);
  assert.deepEqual(names("solo maschile"), ["gender"]);
  assert.deepEqual(names("soltanto plurali"), ["number"]);
  // Register and field labels name neither, and neither does a misspelt stamp.
  for (const label of ["diritto", "scuola", "familiare", "forestierismo", "simg", "s", "km"]) assert.deepEqual(names(label), [], label);
});

test("a headword line is furniture only when nothing but gender and number stamps follows the link (#325)", () => {
  // Bare, as `verde` (line 112) and `console steel guitar` (605581) have it.
  assert.deepEqual(readHeadwordLine("verde ( approfondimento)", "verde"), { kind: "bare" });
  assert.equal(isFurnitureGloss("verde ( approfondimento)", "verde"), true);
  // A stamp only, as `casa` (1) and `pianoforte` (41076) have it, and `punta`'s (41179) lone colon.
  for (const [word, gloss] of [["casa", "casa ( approfondimento) f sing"], ["pianoforte", "pianoforte ( approfondimento) m sing"], ["punta", "punta ( approfondimento):"], ["case", "case ( approfondimento) f pl"]]) {
    assert.deepEqual(readHeadwordLine(gloss, word), { kind: "bare" }, gloss);
    assert.equal(isFurnitureGloss(gloss, word), true, gloss);
  }
  assert.equal(isFurnitureGloss("casa ( citazioni)", "casa"), true);
  // Prose after the link: a definition the link leads, never furniture.
  const palo = one("palo", "noun").senses[2].glosses?.[0] ?? "";
  assert.deepEqual(readHeadwordLine(palo, "palo"), {
    kind: "lead",
    prose: "pezza onorevole (di primo ordine) che occupa verticalmente la parte centrale dello scudo ed è delimitata da due linee verticali parallele",
  });
  assert.equal(isFurnitureGloss(palo, "palo"), false);
  assert.deepEqual(readHeadwordLine("orlo ( approfondimento) vedi orlatura", "orlo"), { kind: "lead", prose: "vedi orlatura" });
  // Another word's link, or no link at all, is no headword line of this record.
  assert.equal(readHeadwordLine("casa ( approfondimento) f sing", "caso"), undefined);
  assert.equal(readHeadwordLine("edificio", "casa"), undefined);
});

test("palo: a headword line that goes on to state a heraldic meaning is numbered as a definition", () => {
  const palo = one("palo", "noun");
  const heraldic = palo.senses.findIndex((sense) => (sense.glosses?.[0] ?? "").startsWith("palo ( approfondimento) pezza onorevole"));
  assert.notEqual(heraldic, -1);
  assert.equal(kinds(palo)[heraldic], "meaning");
  const split = PageSenses.of(palo).split(0);
  assert.deepEqual(split.furniture, []);
  assert.ok(split.numbered.includes(heraldic));
  assert.equal(PageSenses.of(palo).definitionsShown(0), kinds(palo).filter((kind) => kind === "meaning").length);
});

test("balzana: a headword-led definition with a form_of pointer is numbered like any other", () => {
  const balzana = one("balzana", "noun");
  const heraldic = 1;
  assert.ok((balzana.senses[heraldic].glosses?.[0] ?? "").startsWith("balzana ( approfondimento) partizione orizzontale"));
  assert.deepEqual(balzana.senses[heraldic].form_of, [{ word: "troncato" }]);
  assert.deepEqual(kinds(balzana), ["form-of", "form-of", "form-of"]);
  const split = PageSenses.of(balzana).split(0);
  assert.deepEqual(split.furniture, []);
  assert.deepEqual(split.numbered, [0, 1, 2]);
  assert.equal(PageSenses.of(balzana).definitionsShown(0), 3);
});

test("rifritto: a gloss array holding only the missing-definition placeholder shows nothing", () => {
  const rifritto = one("rifritto", "noun");
  assert.equal(hasGlossText(rifritto), true);
  assert.deepEqual(kinds(rifritto), ["placeholder"]);
  assert.equal(PageSenses.of(rifritto).definitionsShown(0), 0);
});

const ECHO_FIXTURE = "fixtures/headword-echo.jsonl";
const STAMP_FIXTURE = "fixtures/gloss-stamps.jsonl";
const from = (file: string, word: string) => {
  const found = read(file).filter((record) => record.word === word);
  assert.equal(found.length, 1, `expected one record of ${word} in ${file}`);
  return found[0];
};
const glossesOf = (record: ArchiveLine) => record.senses.map((sense) => sense.glosses ?? []);

test("presina: stored without its stamp, its one gloss only repeats the headword, so the record shows nothing (#400)", () => {
  const presina = from(ECHO_FIXTURE, "presina");
  assert.deepEqual(glossesOf(presina), [["presina f"]]);
  assert.equal(hasGlossText(presina), true);
  assert.deepEqual(kinds(presina), ["headword-echo"]);
  assert.equal(PageSenses.of(presina).definitionsShown(0), 0);
  // An echo as the archive writes it, behind punctuation, with no stamp to lift.
  assert.deepEqual(kinds(from(ECHO_FIXTURE, "sci di fondo")), ["headword-echo"]);
});

test("an ordinary meaning is a meaning, beside an echo or with the headword inside it (#400)", () => {
  const dm = from(ECHO_FIXTURE, "dm");
  assert.deepEqual(glossesOf(dm), [["domani"], ["DM"]]);
  assert.deepEqual(kinds(dm), ["meaning", "headword-echo"]);
  assert.equal(PageSenses.of(dm).definitionsShown(0), 1);
  const sci = from(ECHO_FIXTURE, "sci");
  assert.equal(glossesOf(sci)[1][0], "sport associato all'attività di andare sugli sci");
  assert.deepEqual(kinds(sci), ["meaning", "meaning"]);
  assert.equal(PageSenses.of(sci).definitionsShown(0), 2);
});

test("a gloss the seed takes a stamp off is read as stored: a placeholder, a headword line, or no gloss at all (#400)", () => {
  const pescante = from(STAMP_FIXTURE, "pescante");
  assert.deepEqual(glossesOf(pescante), [["definizione mancante; se vuoi, aggiungila tu m sing"]]);
  assert.deepEqual(kinds(pescante), ["placeholder"]);
  // The stamp is the whole gloss, so the seed stores no gloss for the sense.
  const pettinatore = from(STAMP_FIXTURE, "Pettinatore");
  assert.deepEqual(glossesOf(pettinatore), [["m sing"]]);
  assert.equal(hasGlossText(pettinatore), true);
  assert.deepEqual(kinds(pettinatore), ["no-gloss"]);
  assert.equal(PageSenses.of(pettinatore).definitionsShown(0), 0);
  // The headword line stays furniture, and the page holds it without the stamp.
  const pianoforte = from(STAMP_FIXTURE, "pianoforte");
  assert.deepEqual(kinds(pianoforte), ["furniture"]);
  assert.deepEqual(PageSenses.of(pianoforte).glosses(0), ["pianoforte ( approfondimento)"]);
});

/** `file`'s lines seeded as a release, the way test/headwordEcho.test.ts stands one up. */
async function withSeeded(file: string, run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const release = "it-0c432803";
  const dir = await mkdtemp(join(tmpdir(), "lexema-record-quality-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(file)));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: release,
    archiveR2Key: `releases/${release}.jsonl.gz`,
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

test("the measurement reads every sense as a lookup of the seeded record does, and numbers as many definitions as the page (#400)", async () => {
  for (const file of [ECHO_FIXTURE, STAMP_FIXTURE]) {
    const fixture = read(file);
    assert.ok(fixture.length > 0, file);
    await withSeeded(file, async (db) => {
      for (const record of fixture) {
        const result = await lookup({ db: readOnlyDictionary(db), releaseId: "it-0c432803", query: record.word });
        assert.ok(result.outcome === "found", `${record.word}: expected a found result, got ${result.outcome}`);
        const readings = result.readings.filter((reading) => reading.word === record.word);
        assert.equal(readings.length, 1, `${record.word}: one reading of the record`);
        const [reading] = readings;
        const measured = PageSenses.of(record);
        assert.deepEqual(
          record.senses.map((_, index) => measured.glosses(index)),
          reading.senses.map((sense) => sense.glosses.map((gloss) => gloss.text)),
          `${record.word}: the glosses the page holds`,
        );
        // The page's count, as web/lib/dictionary/definitions.ts takes it.
        const numbered = splitSenses(reading.senses, reading.word, reading.recovered.length, (sense) => ({
          glosses: sense.glosses.map((gloss) => gloss.text),
          opensRecoveredList: sense.recoveredItems.length > 0,
        })).numbered.length;
        assert.equal(measured.definitionsShown(reading.recovered.length), numbered + reading.recovered.length, `${record.word}: definitions shown`);
      }
    });
  }
});

test("parlerei: the conditional its gloss names is the one it-moods/v1 reads off parlare's table", () => {
  const parlerei = one("parlerei", "verb");
  assert.equal(glossMood(firstGloss(parlerei)), "condizionale");
  assert.equal(moodAgreement("parlerei", "condizionale", tables("parlare")), "corroborated");
});

test("studente: the verb record's present participle is not in studiare's table, which gives studiante", () => {
  const verb = one("studente", "verb");
  assert.equal(glossMood(firstGloss(verb)), "participio");
  assert.equal(moodAgreement("studente", "participio", tables("studiare")), "unlisted");
  const participle = tables("studiare")
    .flat()
    .find((form) => JSON.stringify(form.tags) === JSON.stringify(["present", "participle"]));
  assert.equal(participle?.form, "studiante");
});

test("voga: the gloss calls it a congiuntivo the target's own table spells voghi", () => {
  const voga = one("voga", "verb");
  // Its third sense; the first two, indicativo and imperativo, are in the table as stated.
  const gloss = voga.senses[2].glosses?.[0] ?? "";
  assert.equal(gloss, "terza persona singolare del congiuntivo presente di vogare");
  assert.equal(glossMood(gloss), "congiuntivo");
  assert.equal(moodAgreement("voga", "congiuntivo", tables("vogare")), "elsewhere");
  const cell = tables("vogare")
    .flat()
    .find((form) => JSON.stringify(form.tags) === '["present"]' && JSON.stringify(form.raw_tags) === '["che lui/che lei"]');
  assert.equal(cell?.form, "voghi");
});

test("bella: the noun points at bello, which two noun records carry", () => {
  const noun = one("bella", "noun");
  const target = noun.senses[0].form_of[0].word;
  assert.equal(target, "bello");
  assert.equal(targetResolution(all("bello").length), "ambiguous");
  assert.equal(targetResolution(all("bello", "noun").length), "ambiguous");
});

test("sale: three records, each a reading of its own; the plural of sala resolves only within its part of speech", () => {
  assert.deepEqual(
    all("sale").map((record) => [record.pos, [...new Set(kinds(record))]]),
    [
      ["noun", ["meaning"]],
      ["noun", ["form-of"]],
      ["verb", ["form-of"]],
    ],
  );
  // `sala` is a noun and a form of salare, so the bare word is two records.
  assert.equal(targetResolution(all("sala").length), "ambiguous");
  assert.equal(targetResolution(all("sala", "noun").length), "resolved");
  assert.equal(targetResolution(all("salire", "verb").length), "resolved");
});

test("raccontavo: a form-of record whose lemma has no record at all", () => {
  const raccontavo = one("raccontavo", "verb");
  assert.equal(raccontavo.senses[0].form_of[0].word, "raccontare");
  assert.equal(targetResolution(all("raccontare").length), "dangling");
});

test("duplicate embedded forms: studente lists studenti twice, gallo lists galli twice the same way, a verb's studi is three cells", () => {
  assert.deepEqual(
    duplicateForms(one("studente", "noun").forms).map(({ surface, indexes, relation }) => [surface, indexes, relation]),
    [["studenti", [0, 3], "subsumed"]],
  );
  assert.deepEqual(
    duplicateForms(one("gallo", "noun").forms).map(({ surface, relation }) => [surface, relation]),
    [["galli", "identical"]],
  );
  const studi = duplicateForms(tables("studiare")[0]).find(({ surface }) => surface === "studi");
  assert.equal(studi?.relation, "distinct");
});

test("glossMood reads one mood word, and refuses a gloss that names none or two", () => {
  assert.equal(glossMood("terza persona plurale dell'imperfetto indicativo di andare"), "indicativo");
  assert.equal(glossMood("plurale di studente"), undefined);
  assert.equal(glossMood("indicativo o congiuntivo"), undefined);
  // A mood word inside another word is not that mood.
  assert.equal(glossMood("participiale"), undefined);
});
