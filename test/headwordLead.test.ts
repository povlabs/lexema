// Rule `gloss-headword-lead/v1` (#325, ADR 0019): where the headword and its
// `( approfondimento)` link lead a definition, the seed stores the definition
// alone, a one-off update does the same to an older seed, and the raw line
// keeps the source's wording.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dropStoredHeadwordLeads } from "../src/import/headwordLeadUpdate.js";
import type { DictionarySql } from "../src/import/normalizeGlosses.js";
import { seedSql } from "../src/import/seedSql.js";
import { HEADWORD_LEAD_GLOSS_GLOB, withoutHeadwordLead } from "../src/italian/sourceTextNormalization.js";

// Every gloss the rule changes in release it-0c432803: word, archive line, gloss.
const LEADS: readonly (readonly [string, number, string])[] = [
  ["do", 10367, "do ( approfondimento) di petto: do acuto posto due ottave sopra il do centrale, cantato da un tenore con voce piena, cioè diversa dal registro di falsetto o falsettone"],
  ["filetto", 40204, "filetto ( approfondimento) detto di:"],
  ["palo", 43791, "palo ( approfondimento) pezza onorevole (di primo ordine) che occupa verticalmente la parte centrale dello scudo ed è delimitata da due linee verticali parallele"],
  ["banda", 45622, "banda ( approfondimento) pezza onorevole (di primo ordine) che ha un andamento diagonale dall’angolo superiore destro (a sinistra dell'osservatore) all'angolo inferiore sinistro (a destra dell'osservatore), occupa un terzo dell’ampiezza dello scudo, ed è delimitata da due linee diagonali parallele"],
  ["biglietto", 47955, "biglietto ( approfondimento) piccolo rettangolo posto in verticale; quando è posto in orizzontale diviene biglietto coricato; talora si usa il sinonimo plinto"],
  ["orlo", 52120, "orlo ( approfondimento) vedi orlatura"],
  ["balzana", 56392, "balzana ( approfondimento) partizione orizzontale a metà, dello scudo, o di pezze e figure: troncato"],
  ["fascia", 78801, "fascia ( approfondimento) pezza onorevole (di primo ordine) che occupa orizzontalmente la parte centrale dello scudo ed è delimitata da due linee orizzontali parallele"],
  ["cinta", 110548, "cinta ( approfondimento) bordura larga la metà del normale e distaccata dal bordo dello scudo di uno spazio pari alla sua larghezza; per tale pezza il Manno suggerisce il termine orlatura"],
  ["sbarra", 122502, "sbarra ( approfondimento) pezza onorevole (di primo ordine) che ha un andamento diagonale dall’angolo superiore sinistro (a destra dell'osservatore) all'angolo inferiore destro (a sinistra dell'osservatore), occupa un terzo dell’ampiezza dello scudo, ed è delimitata da due linee diagonali parallele"],
  ["sbarra", 122502, "sbarra ( approfondimento)detto dell'attrezzo utilizzato nella ginnastica artistica maschile, che permette l'esecuzione di esercizi di appoggio e oscillazione"],
  ["controbastone", 123172, "controbastone ( approfondimento) una sbarra molto diminuita in larghezza e spesso scorciata"],
];

// Every bare headword line of the release, which stays as written for the page to hide.
const BARE: readonly (readonly [string, string])[] = [
  ["casa", "casa ( approfondimento) f sing"],
  ["casa", "casa ( citazioni)"],
  ["verde", "verde ( approfondimento)"],
  ["pianoforte", "pianoforte ( approfondimento) m sing"],
  ["pianoforte", "pianoforte ( citazioni)"],
  ["punta", "punta ( approfondimento):"],
  ["manuale", "manuale ( approfondimento) m sing"],
  ["lap steel guitar", "lap steel guitar ( approfondimento) f sing"],
  ["console steel guitar", "console steel guitar ( approfondimento)"],
];

test("a gloss the headword line leads is stored as the text after the link", () => {
  const prose = (word: string) => LEADS.filter(([w]) => w === word).map(([w, , gloss]) => withoutHeadwordLead(w, gloss));
  assert.deepEqual(prose("orlo"), ["vedi orlatura"]);
  assert.deepEqual(prose("filetto"), ["detto di:"]);
  assert.deepEqual(prose("sbarra").map((text) => text.slice(0, 15)), ["pezza onorevole", "detto dell'attr"]);
  // Only the lead goes: the stored text is the rest of the gloss, word for word.
  for (const [word, , gloss] of LEADS) {
    const stored = withoutHeadwordLead(word, gloss);
    assert.equal(gloss.slice(`${word} ( approfondimento)`.length).trimStart(), stored, gloss);
    assert.notEqual(stored.charAt(0), " ", gloss);
  }
});

test("a bare headword line, or another word's line, is left as written", () => {
  for (const [word, gloss] of BARE) assert.equal(withoutHeadwordLead(word, gloss), gloss, gloss);
  assert.equal(withoutHeadwordLead("caso", LEADS[2][2]), LEADS[2][2]);
  assert.equal(withoutHeadwordLead("palo", "legno lungo e diritto"), "legno lungo e diritto");
});

test("the update's GLOB selects every gloss the rule changes", () => {
  const db = new DatabaseSync(":memory:");
  const glob = db.prepare("SELECT ? GLOB ? AS hit");
  for (const [, , gloss] of LEADS) assert.equal((glob.get(gloss, HEADWORD_LEAD_GLOSS_GLOB) as { hit: number }).hit, 1, gloss);
  db.close();
});

const record = (word: string, glosses: string[][]): string =>
  JSON.stringify({ word, pos: "noun", pos_title: "Sostantivo", lang_code: "it", tags: ["masculine"], senses: glosses.map((g) => ({ glosses: g })) });
const PALO = LEADS[2][2];
const ORLO = LEADS[5][2];
const LINES = [
  record("palo", [["legno lungo e diritto"], [PALO]]),
  record("orlo", [["margine"], [ORLO]]),
  record("verde", [["verde ( approfondimento)"], ["colore"]]),
];
const EXPECTED = ["legno lungo e diritto", withoutHeadwordLead("palo", PALO), "margine", "vedi orlatura", "verde ( approfondimento)", "colore"];

async function seeded(run: (db: DatabaseSync) => void): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-headword-lead-"));
  try {
    const input = join(dir, "fixture.jsonl");
    await writeFile(input, `${LINES.join("\n")}\n`);
    const report = await seedSql({
      input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: [], validateFixtureClosure: false,
    });
    assert.ok(report.sourceTextRules.includes("gloss-headword-lead/v1"), "the seed reports the rule it wrote under");
    const db = new DatabaseSync(":memory:");
    try {
      for (const part of report.parts) db.exec(readFileSync(part, "utf8"));
      run(db);
    } finally {
      db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const glosses = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT text FROM sense_gloss ORDER BY gloss_id").all() as { text: string }[]).map(({ text }) => text);
const rawLines = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all() as { raw_json: string }[]).map(({ raw_json }) => raw_json);

test("the seed stores the definition without its lead and keeps the raw line byte-for-byte", async () => {
  await seeded((db) => {
    assert.deepEqual(glosses(db), EXPECTED);
    assert.deepEqual(rawLines(db), LINES);
  });
});

test("the one-off update rewrites a database seeded before the rule, once, and reports the rows", async () => {
  await seeded((db) => {
    const sql: DictionarySql = {
      query: <Row>(text: string) => db.prepare(text).all() as Row[],
      run: (text: string) => db.exec(text),
    };
    // As a seed before #325 wrote them: the source's wording.
    const update = db.prepare("UPDATE sense_gloss SET text = ? WHERE text = ?");
    update.run(PALO, EXPECTED[1]);
    update.run(ORLO, "vedi orlatura");

    assert.deepEqual(dropStoredHeadwordLeads(sql), { rule: "gloss-headword-lead/v1", candidates: 3, changed: 2 });
    assert.deepEqual(glosses(db), EXPECTED);
    assert.deepEqual(rawLines(db), LINES);

    assert.deepEqual(dropStoredHeadwordLeads(sql), { rule: "gloss-headword-lead/v1", candidates: 1, changed: 0 });
    assert.deepEqual(glosses(db), EXPECTED);
  });
});
