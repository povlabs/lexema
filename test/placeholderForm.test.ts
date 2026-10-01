// Wikizionario's empty plural template, "inserisci qui voce al plurale", is no
// form (#342, ADR 0019): the seed writes it no lookup row and no form claims, a
// one-off update removes the rows an older seed wrote, and the raw line keeps it.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeStoredForms } from "../src/import/normalizeForms.js";
import type { DictionarySql } from "../src/import/normalizeGlosses.js";
import { type SeedSqlReport, seedSql } from "../src/import/seedSql.js";
import { PLURAL_PLACEHOLDER_FORM, normalizeFormSurface } from "../src/italian/sourceTextNormalization.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import type { Reading } from "../src/lookup/types.js";
import { readOnlyDictionary } from "./databases.js";

const RELEASE = "it-test";

// Release it-0c432803, line for line: one of the 110 records carrying it.
const MIOPLASTICA =
  '{"word": "mioplastica", "lang_code": "it", "lang": "Italiano", "pos": "noun", "pos_title": "Sostantivo", "senses": [{"glosses": ["ricostruzione di un muscolo"], "categories": ["Chirurgia-IT", "Medicina-IT"], "topics": ["medicine", "surgery"]}], "categories": ["Sostantivi in italiano"], "forms": [{"form": "inserisci qui voce al plurale", "tags": ["plural"]}], "etymology_texts": ["da mio- ossia \\"muscolo\\" e plastica"]}';
// The template beside a real form, which keeps its own index and pointer.
const PITTORE = JSON.stringify({
  word: "pittore", lang_code: "it", pos: "noun", pos_title: "Sostantivo", senses: [{ glosses: ["chi dipinge"] }],
  forms: [{ form: PLURAL_PLACEHOLDER_FORM, tags: ["plural"] }, { form: "pittrice", tags: ["feminine"] }],
});
// A real plural.
const CASA = JSON.stringify({
  word: "casa", lang_code: "it", pos: "noun", pos_title: "Sostantivo", senses: [{ glosses: ["edificio"] }],
  forms: [{ form: "case", tags: ["plural"] }],
});
const LINES = [MIOPLASTICA, PITTORE, CASA];

test("only the exact template is no form; every other surface is kept as written", () => {
  assert.equal(normalizeFormSurface(PLURAL_PLACEHOLDER_FORM), undefined);
  for (const surface of ["case", "pittrice", "Inserisci qui voce al plurale", " inserisci qui voce al plurale", "inserisci qui voce al plurale.", "inserisci qui"]) {
    assert.equal(normalizeFormSurface(surface), surface, surface);
  }
});

async function seeded(run: (db: DatabaseSync, report: SeedSqlReport) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-placeholder-form-"));
  try {
    const input = join(dir, "fixture.jsonl");
    await writeFile(input, `${LINES.join("\n")}\n`);
    const report = await seedSql({
      input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: RELEASE,
      requiredWords: [], validateFixtureClosure: false,
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    try {
      for (const part of report.parts) db.exec(readFileSync(part, "utf8"));
      await run(db, report);
    } finally {
      db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const rawLines = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all() as { raw_json: string }[]).map(({ raw_json }) => raw_json);

async function reading(db: DatabaseSync, query: string, word: string): Promise<Reading> {
  const result = await lookup({ db: readOnlyDictionary(db), releaseId: RELEASE, query });
  assert.ok(result.outcome === "found", query);
  const found = result.readings.find((candidate) => candidate.word === word);
  assert.ok(found, `${query}: no reading of ${word}`);
  return found;
}

/** The template finds nothing; each record's forms table is the real forms, at their own pointers; the raw lines are untouched. */
async function assertNoPlaceholderForm(db: DatabaseSync): Promise<void> {
  assert.deepEqual(rawLines(db), LINES, "source_record_json is the archive line, byte for byte");

  const result = await lookup({ db: readOnlyDictionary(db), releaseId: RELEASE, query: PLURAL_PLACEHOLDER_FORM });
  assert.equal(result.outcome, "not-found");

  const formsOf = (r: Reading) => r.forms.map((form) => [form.surface, form.ref.jsonPointer, form.claims.map((claim) => claim.status === "stated" ? claim.value : claim.status)]);
  assert.deepEqual(formsOf(await reading(db, "mioplastica", "mioplastica")), []);
  assert.deepEqual(formsOf(await reading(db, "pittore", "pittore")), [["pittrice", "/forms/1/form", ["feminine"]]]);
  assert.deepEqual(formsOf(await reading(db, "casa", "casa")), [["case", "/forms/0/form", ["plural"]]]);
  await reading(db, "case", "casa");
}

test("the seed writes no row for the template and keeps every real form", async () => {
  await seeded(async (db, report) => {
    assert.ok(report.sourceTextRules.includes("form-plural-placeholder/v1"), "the seed reports the rule it wrote under");
    const claims = db.prepare("SELECT count(*) AS n FROM grammar_claim WHERE scope = 'form' AND scope_index = 0 AND record_id IN (SELECT record_id FROM source_record WHERE word IN ('mioplastica', 'pittore'))").get() as { n: number };
    assert.equal(claims.n, 0, "no claim about the template");
    await assertNoPlaceholderForm(db);
  });
});

test("the one-off update removes what an older seed wrote for the template, once, and reports the rows", async () => {
  await seeded(async (db) => {
    const sql: DictionarySql = {
      query: <Row>(text: string) => db.prepare(text).all() as Row[],
      run: (text: string) => db.exec(text),
    };
    // As a seed before #342 wrote them: a lookup row and a stated plural for each template.
    const records = db.prepare("SELECT record_id, word FROM source_record WHERE word IN ('mioplastica', 'pittore')").all() as { record_id: number; word: string }[];
    for (const { record_id } of records) {
      db.prepare(`INSERT INTO lookup_form (record_id, release_id, origin, surface, surface_key, json_pointer, form_index, form_source)
                  VALUES (?, ?, 'embedded-form', ?, ?, '/forms/0/form', 0, NULL)`).run(record_id, RELEASE, PLURAL_PLACEHOLDER_FORM, PLURAL_PLACEHOLDER_FORM);
      db.prepare(`INSERT INTO grammar_claim (record_id, scope, scope_index, json_pointer, status, dimension, value, source_text)
                  VALUES (?, 'form', 0, '/forms/0/tags/0', 'stated', 'number', 'plural', 'plural')`).run(record_id);
    }
    const before = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: PLURAL_PLACEHOLDER_FORM });
    assert.ok(before.outcome === "found" && before.readings.length === 2, "the older seed's rows make the template searchable");

    assert.deepEqual(normalizeStoredForms(sql), { rule: "form-plural-placeholder/v1", forms: 2, claims: 2 });
    assert.deepEqual(normalizeStoredForms(sql), { rule: "form-plural-placeholder/v1", forms: 0, claims: 0 });
    await assertNoPlaceholderForm(db);
  });
});
